-- =============================================================================
-- AIGMS — 0001 — Foundation : schémas, extensions, utilitaires
-- Sprint 0
-- =============================================================================
-- Le schéma `app` porte la logique de gouvernance côté serveur (helpers RLS,
-- règles de gate, moteur de réévaluation). Il n'est pas exposé à PostgREST :
-- l'API applicative ne voit que `public`.
-- =============================================================================

create extension if not exists "pgcrypto" with schema extensions;

create schema if not exists app;

comment on schema app is
  'Logique serveur AIGMS : helpers RLS, règles de gate, moteur de réévaluation. Non exposé via PostgREST.';

revoke all on schema app from public;
grant usage on schema app to authenticated, service_role;

-- -----------------------------------------------------------------------------
-- Horodatage : `updated_at` maintenu par trigger, jamais par le client.
-- -----------------------------------------------------------------------------
create or replace function app.touch_updated_at()
returns trigger
language plpgsql
as $$
begin
  new.updated_at := now();
  return new;
end;
$$;

comment on function app.touch_updated_at is
  'Trigger BEFORE UPDATE : force updated_at = now(). Empêche un client de falsifier la date de modification.';

-- -----------------------------------------------------------------------------
-- Références métier lisibles (règle : UUID interne + identifiant métier lisible).
-- Séquence logique par tenant et par préfixe, ex. DEC-IA-2026-0001, UC-2026-0007.
-- -----------------------------------------------------------------------------
create table if not exists app.business_ref_counter (
  tenant_id   uuid    not null,
  prefix      text    not null,
  year        integer not null,
  last_value  integer not null default 0,
  primary key (tenant_id, prefix, year)
);

comment on table app.business_ref_counter is
  'Compteur de références métier lisibles, cloisonné par tenant/préfixe/année.';

alter table app.business_ref_counter enable row level security;
-- Aucune policy : table accessible uniquement via app.next_business_ref (SECURITY DEFINER)
-- et via service_role. Les clients ne la lisent ni ne l'écrivent jamais.

create or replace function app.next_business_ref(p_tenant_id uuid, p_prefix text)
returns text
language plpgsql
security definer
set search_path = app, pg_catalog
as $$
declare
  v_year integer := extract(year from now())::integer;
  v_next integer;
begin
  if p_tenant_id is null or p_prefix is null or btrim(p_prefix) = '' then
    raise exception 'next_business_ref: tenant_id et prefix sont obligatoires';
  end if;

  insert into app.business_ref_counter (tenant_id, prefix, year, last_value)
  values (p_tenant_id, upper(p_prefix), v_year, 1)
  on conflict (tenant_id, prefix, year)
    do update set last_value = app.business_ref_counter.last_value + 1
  returning last_value into v_next;

  return format('%s-%s-%s', upper(p_prefix), v_year, lpad(v_next::text, 4, '0'));
end;
$$;

comment on function app.next_business_ref is
  'Retourne la prochaine référence métier lisible pour un tenant (ex. DEC-IA-2026-0001).';

revoke all on function app.next_business_ref(uuid, text) from public;
grant execute on function app.next_business_ref(uuid, text) to authenticated, service_role;

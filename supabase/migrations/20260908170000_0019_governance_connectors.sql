-- =============================================================================
-- AIGMS — 0019 — Connecteurs de gouvernance
-- Sprint 15 — l'abstraction avant les intégrations
-- =============================================================================
-- Le prompt de build est explicite : construire d'abord un contrat commun, pas
-- une collection d'intégrations spécifiques. `governance_connector` est ce
-- contrat. Chaque connecteur déclare ce que la matrice CONNECT exige : source,
-- capacités, authentification, portées, objets importés, fréquence, fraîcheur,
-- erreurs, propriétaire et rétention.
--
-- ---------------------------------------------------------------------------
-- AUCUN SECRET N'EST STOCKÉ ICI
-- ---------------------------------------------------------------------------
-- La table ne porte pas de jeton, pas de clé, pas de mot de passe — et n'en
-- portera pas. Elle porte le NOM de la variable d'environnement qui détient le
-- secret (`credential_env_var`). Le secret vit dans le coffre de la plateforme
-- d'hébergement, jamais dans une ligne que la RLS, une sauvegarde ou un export
-- pourrait laisser filer.
--
-- Conséquence assumée : la configuration d'un connecteur se fait à deux mains —
-- l'administrateur déclare le connecteur dans l'application, et pose le secret
-- dans les variables d'environnement. Voir ADR-0009.
-- =============================================================================

create type app.connector_kind as enum (
  'vanta', 'onetrust', 'servicenow', 'microsoft_purview',
  'microsoft_entra', 'azure', 'github', 'google_workspace',
  'jira', 'siem', 'openai_admin', 'anthropic_admin', 'generic_webhook'
);

create type app.connector_status as enum (
  'draft', 'configured', 'active', 'degraded', 'suspended', 'retired'
);

create type app.connector_capability as enum (
  'asset_inventory',      -- systèmes, modèles, agents, jeux de données
  'control_catalog',      -- bibliothèques de contrôles
  'evidence_pull',        -- preuves et attestations
  'control_status',       -- état d'un contrôle chez la source
  'incident_feed',        -- signaux d'incident
  'usage_metadata',       -- métadonnées d'usage
  'vendor_metadata'       -- informations fournisseur
);

create type app.connector_health as enum ('unknown', 'healthy', 'stale', 'error');

-- -----------------------------------------------------------------------------
-- governance_connector
-- -----------------------------------------------------------------------------
create table public.governance_connector (
  id                  uuid primary key default gen_random_uuid(),
  tenant_id           uuid not null references public.tenant (id) on delete cascade,
  business_ref        text not null,

  kind                app.connector_kind not null,
  display_name        text not null check (btrim(display_name) <> ''),
  description         text,

  -- Contrat d'intégration (Matrice BUILD/CONNECT/DON'T BUILD)
  source_of_truth     text not null check (btrim(source_of_truth) <> ''),
  capabilities        app.connector_capability[] not null
                        check (array_length(capabilities, 1) >= 1),
  base_url            text,
  auth_method         text not null default 'api_token',
  scopes              text[] not null default '{}',

  -- Nom de la variable d'environnement portant le secret. Jamais le secret.
  credential_env_var  text
                        check (credential_env_var is null
                               or credential_env_var ~ '^[A-Z][A-Z0-9_]{2,63}$'),

  -- Lecture seule et moindre privilège par défaut : l'écriture doit être un
  -- choix explicite, pas un oubli de configuration.
  is_read_only        boolean not null default true,
  sync_frequency      text not null default 'daily',
  retention_note      text,

  status              app.connector_status not null default 'draft',
  owner_user_id       uuid references public.user_profile (id) on delete set null,

  -- État observé
  health              app.connector_health not null default 'unknown',
  last_tested_at      timestamptz,
  last_sync_at        timestamptz,
  last_error          text,
  last_error_at       timestamptz,

  created_by          uuid references public.user_profile (id) on delete set null,
  created_at          timestamptz not null default now(),
  updated_at          timestamptz not null default now(),

  unique (tenant_id, business_ref),
  unique (tenant_id, kind, display_name),

  -- Un connecteur actif sait où il se branche et avec quelles habilitations.
  constraint connector_active_is_configured check (
    status not in ('active', 'degraded')
    or (credential_env_var is not null and base_url is not null)
  ),
  -- Une écriture vers un système tiers ne s'active pas par défaut : elle se
  -- justifie.
  constraint connector_write_is_justified check (
    is_read_only or btrim(coalesce(description, '')) <> ''
  )
);

comment on table public.governance_connector is
  'Contrat commun des intégrations CONNECT. Ne contient aucun secret : `credential_env_var` nomme la variable d''environnement qui le porte.';
comment on column public.governance_connector.credential_env_var is
  'NOM de la variable d''environnement détenant le secret. Y écrire un secret serait un défaut de sécurité.';
comment on column public.governance_connector.is_read_only is
  'Lecture seule par défaut. AIGMS lit des métadonnées, des statuts et des preuves ; il ne prend pas la main sur les systèmes tiers.';

create index governance_connector_tenant_idx on public.governance_connector (tenant_id, status);

create trigger governance_connector_touch_updated_at
  before update on public.governance_connector
  for each row execute function app.touch_updated_at();

create or replace function app.set_connector_business_ref()
returns trigger language plpgsql security definer
set search_path = app, public, pg_catalog as $$
begin
  if new.business_ref is null or btrim(new.business_ref) = '' then
    new.business_ref := app.next_business_ref(new.tenant_id, 'CNX');
  end if;
  return new;
end; $$;

create trigger governance_connector_set_business_ref
  before insert on public.governance_connector
  for each row execute function app.set_connector_business_ref();

-- Garde-fou : une valeur qui ressemble à un secret n'entre pas dans la table.
create or replace function app.guard_connector_secret()
returns trigger
language plpgsql
as $$
begin
  if new.credential_env_var is not null
     and (length(new.credential_env_var) > 64
          or new.credential_env_var ~* '^(sk|pk|ghp|gho|sbp|re|vcp|xox)[-_]'
          or new.credential_env_var ~ '[a-z]') then
    raise exception 'credential_env_var attend un NOM de variable d''environnement en majuscules, jamais un secret.'
      using errcode = 'check_violation';
  end if;
  return new;
end;
$$;

comment on function app.guard_connector_secret is
  'Refuse une valeur ayant l''apparence d''un secret là où seul un nom de variable est attendu.';

create trigger governance_connector_guard_secret
  before insert or update on public.governance_connector
  for each row execute function app.guard_connector_secret();

-- -----------------------------------------------------------------------------
-- Journal des synchronisations
-- -----------------------------------------------------------------------------
create table public.connector_sync_run (
  id             uuid primary key default gen_random_uuid(),
  tenant_id      uuid not null references public.tenant (id) on delete cascade,
  connector_id   uuid not null references public.governance_connector (id) on delete cascade,
  started_at     timestamptz not null default now(),
  finished_at    timestamptz,
  capability     app.connector_capability,
  outcome        app.connector_health not null default 'unknown',
  objects_seen   integer not null default 0,
  objects_kept   integer not null default 0,
  message        text,
  triggered_by   uuid references public.user_profile (id) on delete set null
);

comment on table public.connector_sync_run is
  'Trace d''exécution d''un connecteur : ce qui a été vu, ce qui a été retenu, et pourquoi le cas échéant.';

create index connector_sync_run_connector_idx
  on public.connector_sync_run (connector_id, started_at desc);

-- -----------------------------------------------------------------------------
-- RLS : configurer un connecteur est un acte d'administration
-- -----------------------------------------------------------------------------
alter table public.governance_connector enable row level security;
alter table public.governance_connector force  row level security;
alter table public.connector_sync_run   enable row level security;
alter table public.connector_sync_run   force  row level security;

create policy governance_connector_select on public.governance_connector
  for select to authenticated
  using (app.has_tenant_access(tenant_id));

create policy governance_connector_write on public.governance_connector
  for all to authenticated
  using (app.has_tenant_role(tenant_id, app.roles_administer()))
  with check (app.has_tenant_role(tenant_id, app.roles_administer()));

create policy connector_sync_run_select on public.connector_sync_run
  for select to authenticated
  using (app.has_tenant_access(tenant_id));

create policy connector_sync_run_write on public.connector_sync_run
  for all to authenticated
  using (app.has_tenant_role(tenant_id, app.roles_administer()))
  with check (app.has_tenant_role(tenant_id, app.roles_administer()));

grant select, insert, update, delete on public.governance_connector to authenticated;
grant select, insert, update, delete on public.connector_sync_run   to authenticated;
revoke all on public.governance_connector from anon;
revoke all on public.connector_sync_run   from anon;

-- -----------------------------------------------------------------------------
-- Journalisation : la fonction d'audit apprend à connaître les connecteurs
-- -----------------------------------------------------------------------------
-- Sans cette branche, un connecteur tomberait dans le cas `role_assignment` et
-- l'audit chercherait une colonne `role` qui n'existe pas ici.
create or replace function app.audit_administration()
returns trigger
language plpgsql
security definer
set search_path = app, public, pg_catalog
as $$
declare
  v_tenant   uuid;
  v_action   app.audit_action;
  v_entity   text := tg_table_name;
  v_id       uuid;
  v_ref      text;
  v_summary  text;
  v_before   jsonb;
  v_after    jsonb;
begin
  v_tenant := coalesce(
    case when tg_op = 'DELETE' then null else (to_jsonb(new) ->> 'tenant_id')::uuid end,
    case when tg_op = 'INSERT' then null else (to_jsonb(old) ->> 'tenant_id')::uuid end
  );

  if v_tenant is null then
    return coalesce(new, old);
  end if;

  v_action := case tg_op
    when 'INSERT' then case when tg_table_name in ('organization', 'governance_connector')
                            then 'create' else 'access_granted' end
    when 'UPDATE' then case when tg_table_name in ('organization', 'governance_connector')
                            then 'update' else 'access_granted' end
    when 'DELETE' then 'access_revoked'
  end::app.audit_action;

  if tg_table_name = 'organization' then
    v_id      := coalesce(new.id, old.id);
    v_ref     := coalesce(new.business_ref, old.business_ref);
    v_summary := case tg_op
      when 'INSERT' then format('Organisation « %s » créée', new.name)
      when 'UPDATE' then format('Organisation « %s » modifiée', new.name)
      else format('Organisation « %s » supprimée', old.name)
    end;
    v_before := case when tg_op = 'INSERT' then null
                     else jsonb_build_object('name', old.name, 'status', old.status) end;
    v_after  := case when tg_op = 'DELETE' then null
                     else jsonb_build_object('name', new.name, 'status', new.status) end;

  elsif tg_table_name = 'governance_connector' then
    v_id      := coalesce(new.id, old.id);
    v_ref     := coalesce(new.business_ref, old.business_ref);
    v_summary := case tg_op
      when 'INSERT' then format('Connecteur « %s » déclaré', new.display_name)
      when 'UPDATE' then format('Connecteur « %s » : statut %s', new.display_name, new.status)
      else format('Connecteur « %s » supprimé', old.display_name)
    end;
    -- La variable d'environnement est un nom, pas un secret : la journaliser
    -- documente la configuration sans rien divulguer.
    v_before := case when tg_op = 'INSERT' then null
                     else jsonb_build_object('status', old.status, 'is_read_only', old.is_read_only,
                                             'credential_env_var', old.credential_env_var) end;
    v_after  := case when tg_op = 'DELETE' then null
                     else jsonb_build_object('status', new.status, 'is_read_only', new.is_read_only,
                                             'credential_env_var', new.credential_env_var) end;

  elsif tg_table_name = 'membership' then
    v_id      := coalesce((to_jsonb(new) ->> 'user_id')::uuid, (to_jsonb(old) ->> 'user_id')::uuid);
    v_ref     := (select p.email from public.user_profile p where p.id = v_id);
    v_summary := case tg_op
      when 'INSERT' then format('Compte rattaché avec le rôle %s', new.role)
      when 'UPDATE' then format('Rôle porté de %s à %s', old.role, new.role)
      else format('Rattachement retiré (rôle %s)', old.role)
    end;
    v_before := case when tg_op = 'INSERT' then null
                     else jsonb_build_object('role', old.role, 'status', old.status) end;
    v_after  := case when tg_op = 'DELETE' then null
                     else jsonb_build_object('role', new.role, 'status', new.status) end;

  else -- role_assignment
    v_id      := coalesce((to_jsonb(new) ->> 'user_id')::uuid, (to_jsonb(old) ->> 'user_id')::uuid);
    v_ref     := (select p.email from public.user_profile p where p.id = v_id);
    v_summary := case tg_op
      when 'INSERT' then format('Rôle %s attribué sur une organisation', new.role)
      when 'UPDATE' then format('Rôle sur organisation porté de %s à %s', old.role, new.role)
      else format('Rôle %s retiré sur une organisation', old.role)
    end;
    v_before := case when tg_op = 'INSERT' then null
                     else jsonb_build_object('role', old.role, 'organization_id', old.organization_id) end;
    v_after  := case when tg_op = 'DELETE' then null
                     else jsonb_build_object('role', new.role, 'organization_id', new.organization_id) end;
  end if;

  perform app.log_audit(
    v_tenant, v_action, v_entity, v_id, v_ref, v_summary, v_before, v_after,
    jsonb_build_object('operation', tg_op)
  );

  return coalesce(new, old);
end;
$$;

create trigger governance_connector_audit
  after insert or update or delete on public.governance_connector
  for each row execute function app.audit_administration();

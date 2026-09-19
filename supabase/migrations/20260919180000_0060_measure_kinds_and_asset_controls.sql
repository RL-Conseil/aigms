-- =============================================================================
-- AIGMS — 0060 — Mesures techniques, organisationnelles, contractuelles
-- =============================================================================
-- Un contrôle était « une mesure », sans nature. Or les mesures techniques se
-- posent SUR UN ACTIF (chiffrement, journalisation, filtrage des sorties, test
-- de biais sur CE modèle) ; les organisationnelles sur l'organisation, le
-- processus ou le cas d'usage (politique, formation, revue, séparation des
-- rôles) ; les contractuelles sur un fournisseur (DPA, conditions d'usage) —
-- c'est ce qu'un transfert de risque attend.
--
--   1. `measure_kind` sur le contrôle-type et sur le contrôle : technique,
--      organisationnelle, contractuelle. Déduite du domaine du contrôle-type
--      (SEC, DAT, MON, OPS, INV → technique ; GOV, HUM, USE, CMP, RSK →
--      organisationnelle ; SUP → contractuelle), reprise à l'instanciation,
--      modifiable par contrôle, saisie pour un contrôle libre.
--   2. `asset_control` : une mesure technique mise en œuvre sur un actif —
--      avec un état et une note. C'est là que se prouve une mesure technique.
--   3. Lecture : les mesures techniques d'un actif, les actifs d'un cas d'usage
--      avec leurs mesures.
-- =============================================================================

create type app.measure_kind as enum ('technical', 'organizational', 'contractual');

-- -----------------------------------------------------------------------------
-- 1. La nature, sur le contrôle-type et sur le contrôle
-- -----------------------------------------------------------------------------
alter table public.catalog_control add column measure_kind app.measure_kind;
alter table public.control         add column measure_kind app.measure_kind;

comment on column public.catalog_control.measure_kind is
  'Nature de la mesure : technique (se pose sur un actif), organisationnelle (organisation, processus, cas d''usage), contractuelle (fournisseur).';
comment on column public.control.measure_kind is
  'Nature de la mesure. Reprise du contrôle-type, modifiable ; saisie pour un contrôle libre.';

-- La nature par domaine, posée sur les contrôles-types publiés. Le contenu
-- d'une version publiée est gelé : on lève la garde le temps de poser une
-- métadonnée qui ne change pas ce que le contrôle exige.
create or replace function app.measure_kind_for_domain(p_domain_code text)
returns app.measure_kind
language sql immutable set search_path = pg_catalog as $$
  select case upper(coalesce(p_domain_code, ''))
    when 'SEC' then 'technical' when 'DAT' then 'technical' when 'MON' then 'technical'
    when 'OPS' then 'technical' when 'INV' then 'technical'
    when 'SUP' then 'contractual'
    else 'organizational' end::app.measure_kind;
$$;

alter table public.catalog_control disable trigger catalog_control_guard_published;
update public.catalog_control cc
   set measure_kind = app.measure_kind_for_domain(d.code)
  from public.catalog_domain d
 where cc.domain_id = d.id and cc.measure_kind is null;
alter table public.catalog_control enable trigger catalog_control_guard_published;

-- Un contrôle-type importé après coup reçoit sa nature par son domaine.
create or replace function app.default_catalog_measure_kind()
returns trigger
language plpgsql
set search_path = app, public, pg_catalog
as $$
begin
  if new.measure_kind is null then
    select app.measure_kind_for_domain(d.code) into new.measure_kind
    from public.catalog_domain d where d.id = new.domain_id;
    new.measure_kind := coalesce(new.measure_kind, 'organizational');
  end if;
  return new;
end;
$$;

create trigger catalog_control_default_measure_kind before insert on public.catalog_control
  for each row execute function app.default_catalog_measure_kind();

-- Le contrôle reprend la nature du contrôle-type ; un contrôle libre sans
-- nature est organisationnel — la plus fréquente, et la moins engageante.
create or replace function app.complete_control_from_catalog()
returns trigger
language plpgsql
security definer
set search_path = app, public, pg_catalog
as $$
declare v_cc public.catalog_control%rowtype;
begin
  if new.owner_user_id is null then new.owner_user_id := app.current_user_id(); end if;
  if new.catalog_control_id is not null then
    select * into v_cc from public.catalog_control where id = new.catalog_control_id;
    if new.measure_kind is null then new.measure_kind := v_cc.measure_kind; end if;
    if new.expected_evidence is null and jsonb_typeof(v_cc.expected_evidence) = 'array' then
      select array_agg(x) into new.expected_evidence from jsonb_array_elements_text(v_cc.expected_evidence) x;
    end if;
    if new.assessment_questions is null and jsonb_typeof(v_cc.assessment_questions) = 'array' then
      select array_agg(x) into new.assessment_questions from jsonb_array_elements_text(v_cc.assessment_questions) x;
    end if;
    if new.test_procedure is null and jsonb_typeof(v_cc.tests) = 'array' and jsonb_array_length(v_cc.tests) > 0 then
      select string_agg(coalesce(t ->> 'description', t ->> 'name', t #>> '{}'), E'\n') into new.test_procedure
      from jsonb_array_elements(v_cc.tests) t;
    end if;
  end if;
  new.measure_kind := coalesce(new.measure_kind, 'organizational');
  return new;
end;
$$;

update public.control c
   set measure_kind = coalesce(cc.measure_kind, 'organizational')
  from public.catalog_control cc
 where cc.id = c.catalog_control_id and c.measure_kind is null;
update public.control set measure_kind = 'organizational' where measure_kind is null;

alter table public.control alter column measure_kind set not null;

-- -----------------------------------------------------------------------------
-- 2. Une mesure technique mise en œuvre sur un actif
-- -----------------------------------------------------------------------------
create type app.asset_control_status as enum ('planned', 'implemented', 'verified', 'not_applicable');

create table public.asset_control (
  id          uuid primary key default gen_random_uuid(),
  tenant_id   uuid not null references public.tenant (id) on delete cascade,
  asset_id    uuid not null references public.ai_asset (id) on delete cascade,
  control_id  uuid not null references public.control (id) on delete cascade,
  status      app.asset_control_status not null default 'planned',
  note        text,
  verified_at date,
  created_at  timestamptz not null default now(),
  updated_at  timestamptz not null default now(),
  unique (asset_id, control_id)
);

comment on table public.asset_control is
  'Une mesure mise en œuvre sur un actif d''IA : c''est là qu''une mesure technique se pose et se prouve.';

create index asset_control_control_idx on public.asset_control (control_id);

create trigger asset_control_touch_updated_at before update on public.asset_control
  for each row execute function app.touch_updated_at();

-- Actif et contrôle de la même organisation, même tenant.
create or replace function app.guard_asset_control()
returns trigger
language plpgsql
security definer
set search_path = app, public, pg_catalog
as $$
declare v_asset public.ai_asset%rowtype; v_control public.control%rowtype;
begin
  select * into v_asset from public.ai_asset where id = new.asset_id;
  select * into v_control from public.control where id = new.control_id;
  if v_asset.organization_id is distinct from v_control.organization_id then
    raise exception 'L''actif et le contrôle doivent appartenir à la même organisation.' using errcode = 'check_violation';
  end if;
  new.tenant_id := v_asset.tenant_id;
  return new;
end;
$$;

create trigger asset_control_guard before insert or update on public.asset_control
  for each row execute function app.guard_asset_control();

alter table public.asset_control enable row level security;
alter table public.asset_control force  row level security;

create policy asset_control_select on public.asset_control
  for select to authenticated using (app.has_tenant_access(tenant_id));
create policy asset_control_write on public.asset_control
  for all to authenticated
  using (app.has_tenant_role(tenant_id, app.roles_contribute()))
  with check (app.has_tenant_role(tenant_id, app.roles_contribute()));

grant select, insert, update, delete on public.asset_control to authenticated;
revoke all on public.asset_control from anon;

-- Journalisée comme toute écriture de gouvernance.
create trigger asset_control_audit after insert or update or delete on public.asset_control
  for each row execute function app.audit_business();

-- -----------------------------------------------------------------------------
-- 3. Lectures
-- -----------------------------------------------------------------------------
-- Les actifs d'un cas d'usage, avec leurs mesures — et, pour chaque mesure
-- technique applicable au cas d'usage, si un actif la porte.
create or replace function public.use_case_assets(p_use_case_id uuid)
returns jsonb
language sql
stable
security invoker
set search_path = app, public, pg_catalog
as $$
  select coalesce(jsonb_agg(jsonb_build_object(
    'link_id', l.id, 'relation', l.relation,
    'asset_id', a.id, 'business_ref', a.business_ref, 'name', a.name, 'kind', a.kind,
    'version', a.version, 'hosting_location', a.hosting_location,
    'contains_personal_data', a.contains_personal_data,
    'vendor', (select v.name from public.vendor v where v.id = a.vendor_id),
    'measures', coalesce((
      select jsonb_agg(jsonb_build_object(
        'id', ac.id, 'control_id', c.id, 'code', c.code, 'name', c.name,
        'measure_kind', c.measure_kind, 'control_status', c.status,
        'status', ac.status, 'note', ac.note, 'verified_at', ac.verified_at
      ) order by c.code)
      from public.asset_control ac join public.control c on c.id = ac.control_id
      where ac.asset_id = a.id
    ), '[]'::jsonb)
  ) order by a.kind, a.name), '[]'::jsonb)
  from public.use_case_asset_link l
  join public.ai_asset a on a.id = l.asset_id
  where l.use_case_id = p_use_case_id;
$$;

grant execute on function public.use_case_assets(uuid) to authenticated;

-- Le registre des actifs d'une organisation : chaque actif, les cas d'usage
-- qui l'emploient, ses mesures.
create or replace function public.asset_register(p_organization_id uuid)
returns jsonb
language sql
stable
security invoker
set search_path = app, public, pg_catalog
as $$
  select coalesce(jsonb_agg(jsonb_build_object(
    'id', a.id, 'business_ref', a.business_ref, 'name', a.name, 'kind', a.kind,
    'description', a.description, 'version', a.version, 'hosting_location', a.hosting_location,
    'contains_personal_data', a.contains_personal_data,
    'vendor', (select jsonb_build_object('id', v.id, 'name', v.name, 'review_status', v.review_status)
               from public.vendor v where v.id = a.vendor_id),
    'owner', (select coalesce(nullif(u.full_name, ''), u.email) from public.user_profile u where u.id = a.owner_user_id),
    'use_cases', coalesce((
      select jsonb_agg(jsonb_build_object('id', u.id, 'name', u.name, 'business_ref', u.business_ref,
                                          'status', u.status, 'relation', l.relation) order by u.business_ref)
      from public.use_case_asset_link l join public.ai_use_case u on u.id = l.use_case_id
      where l.asset_id = a.id
    ), '[]'::jsonb),
    'measures', coalesce((
      select jsonb_agg(jsonb_build_object(
        'id', ac.id, 'control_id', c.id, 'code', c.code, 'name', c.name,
        'measure_kind', c.measure_kind, 'control_status', c.status,
        'status', ac.status, 'note', ac.note, 'verified_at', ac.verified_at
      ) order by c.code)
      from public.asset_control ac join public.control c on c.id = ac.control_id
      where ac.asset_id = a.id
    ), '[]'::jsonb)
  ) order by a.kind, a.name), '[]'::jsonb)
  from public.ai_asset a
  where a.organization_id = p_organization_id;
$$;

grant execute on function public.asset_register(uuid) to authenticated;

-- Le suivi d'audit reste complet.
do $$
begin
  if exists (select 1 from app.audit_coverage_gaps()) then
    raise exception 'Couverture d''audit incomplète : %', (select string_agg(table_name, ', ') from app.audit_coverage_gaps());
  end if;
end;
$$;

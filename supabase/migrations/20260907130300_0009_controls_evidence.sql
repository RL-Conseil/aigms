-- =============================================================================
-- AIGMS — 0009 — Référentiels, contrôles et preuves
-- Vertical slice — Sprints 7 et 8
-- =============================================================================
-- `framework` et `requirement` constituent un catalogue plateforme partagé :
-- ce sont des résumés internes et des exigences dérivées, jamais la
-- reproduction d'un texte normatif protégé (Références V1 §1).
-- Les `control`, eux, appartiennent à un tenant.
-- =============================================================================

create type app.requirement_status as enum ('requirement', 'guidance', 'internal');

create type app.control_status as enum ('proposed', 'implemented', 'operating', 'ineffective', 'retired');

create type app.control_applicability_status as enum ('applicable', 'not_applicable', 'to_determine');

create type app.evidence_type as enum ('document', 'url', 'declarative', 'screenshot', 'log_extract', 'attestation', 'connector_pull');

create type app.evidence_validation_status as enum ('pending', 'validated', 'rejected', 'superseded');

create type app.evidence_freshness as enum ('fresh', 'expiring', 'expired', 'unknown');

-- -----------------------------------------------------------------------------
-- framework — catalogue plateforme versionné
-- -----------------------------------------------------------------------------
create table public.framework (
  id             uuid primary key default gen_random_uuid(),
  code           text not null,
  version        text not null,
  name           text not null,
  publisher      text,
  official_source text,
  effective_from date,
  withdrawn_from date,
  is_active      boolean not null default true,
  created_at     timestamptz not null default now(),
  updated_at     timestamptz not null default now(),
  unique (code, version)
);

comment on table public.framework is
  'Référentiel normatif ou réglementaire, identifié par code + version. Les dates d''effet sont des données, jamais du code (Références V1 §3).';

create trigger framework_touch_updated_at before update on public.framework
  for each row execute function app.touch_updated_at();

-- -----------------------------------------------------------------------------
-- requirement — exigence dérivée, résumée en interne
-- -----------------------------------------------------------------------------
create table public.requirement (
  id                    uuid primary key default gen_random_uuid(),
  framework_id          uuid not null references public.framework (id) on delete cascade,
  requirement_reference text not null,
  title                 text not null,
  internal_summary      text not null check (btrim(internal_summary) <> ''),
  status                app.requirement_status not null default 'requirement',
  effective_from        date,
  withdrawn_from        date,
  official_source       text,
  mapping_owner_id      uuid references public.user_profile (id) on delete set null,
  last_reviewed_at      date,
  created_at            timestamptz not null default now(),
  updated_at            timestamptz not null default now(),
  unique (framework_id, requirement_reference)
);

comment on table public.requirement is
  'Exigence dérivée : référence, résumé interne, statut, dates d''effet, source officielle et propriétaire du mapping. Aucune reproduction intégrale de texte protégé.';

create trigger requirement_touch_updated_at before update on public.requirement
  for each row execute function app.touch_updated_at();

-- -----------------------------------------------------------------------------
-- control — mesure de maîtrise, propriété du tenant
-- -----------------------------------------------------------------------------
create table public.control (
  id               uuid primary key default gen_random_uuid(),
  tenant_id        uuid not null references public.tenant (id) on delete cascade,
  organization_id  uuid not null references public.organization (id) on delete cascade,
  business_ref     text not null,
  code             text not null,
  name             text not null check (btrim(name) <> ''),
  objective        text not null check (btrim(objective) <> ''),
  owner_user_id    uuid references public.user_profile (id) on delete set null,
  status           app.control_status not null default 'proposed',
  is_mandatory     boolean not null default false,
  test_procedure   text,
  frequency        text,
  last_tested_at   date,
  next_test_at     date,
  created_at       timestamptz not null default now(),
  updated_at       timestamptz not null default now(),
  unique (tenant_id, business_ref),
  unique (organization_id, code)
);

comment on table public.control is
  'Contrôle de gouvernance. `is_mandatory` conditionne le gate PRODUCTION : un contrôle obligatoire applicable doit être affecté et opérant.';

create index control_org_status_idx on public.control (organization_id, status);
create trigger control_touch_updated_at before update on public.control
  for each row execute function app.touch_updated_at();
create trigger control_assert_tenant before insert or update on public.control
  for each row execute function app.assert_tenant_consistency();

create or replace function app.set_control_business_ref()
returns trigger language plpgsql security definer
set search_path = app, public, pg_catalog as $$
begin
  if new.business_ref is null or btrim(new.business_ref) = '' then
    new.business_ref := app.next_business_ref(new.tenant_id, 'CTL');
  end if;
  return new;
end; $$;

create trigger control_set_business_ref before insert on public.control
  for each row execute function app.set_control_business_ref();

-- -----------------------------------------------------------------------------
-- control_requirement_map — un contrôle satisfait N exigences
-- -----------------------------------------------------------------------------
create table public.control_requirement_map (
  id              uuid primary key default gen_random_uuid(),
  tenant_id       uuid not null references public.tenant (id) on delete cascade,
  control_id      uuid not null references public.control (id) on delete cascade,
  requirement_id  uuid not null references public.requirement (id) on delete cascade,
  coverage_note   text,
  mapped_by       uuid references public.user_profile (id) on delete set null,
  mapped_at       timestamptz not null default now(),
  unique (control_id, requirement_id)
);

comment on table public.control_requirement_map is
  'Mapping N:N contrôle ↔ exigence : un même contrôle couvre plusieurs référentiels (principe multi-framework).';

-- -----------------------------------------------------------------------------
-- control_applicability — affectation d'un contrôle à un cas d'usage
-- -----------------------------------------------------------------------------
create table public.control_applicability (
  id             uuid primary key default gen_random_uuid(),
  tenant_id      uuid not null references public.tenant (id) on delete cascade,
  control_id     uuid not null references public.control (id) on delete cascade,
  use_case_id    uuid not null references public.ai_use_case (id) on delete cascade,
  status         app.control_applicability_status not null default 'to_determine',
  justification  text,
  decided_by     uuid references public.user_profile (id) on delete set null,
  decided_at     timestamptz,
  created_at     timestamptz not null default now(),
  updated_at     timestamptz not null default now(),
  unique (control_id, use_case_id),
  -- Une exclusion doit être justifiée : pas de « non applicable » silencieux.
  constraint control_na_requires_justification check (
    status <> 'not_applicable' or btrim(coalesce(justification, '')) <> ''
  )
);

comment on table public.control_applicability is
  'Applicabilité d''un contrôle à un cas d''usage. Une exclusion exige une justification.';

create index control_applicability_use_case_idx on public.control_applicability (use_case_id, status);
create trigger control_applicability_touch_updated_at before update on public.control_applicability
  for each row execute function app.touch_updated_at();

-- -----------------------------------------------------------------------------
-- evidence
-- -----------------------------------------------------------------------------
create table public.evidence (
  id                 uuid primary key default gen_random_uuid(),
  tenant_id          uuid not null references public.tenant (id) on delete cascade,
  organization_id    uuid not null references public.organization (id) on delete cascade,
  business_ref       text not null,

  title              text not null check (btrim(title) <> ''),
  evidence_type      app.evidence_type not null,
  source             text not null check (btrim(source) <> ''),
  storage_path       text,
  external_url       text,
  content_hash       text,
  version            text,

  owner_user_id      uuid not null references public.user_profile (id) on delete restrict,
  collected_at       timestamptz not null default now(),
  valid_until        date,

  validation_status  app.evidence_validation_status not null default 'pending',
  validated_by       uuid references public.user_profile (id) on delete set null,
  validated_at       timestamptz,

  created_at         timestamptz not null default now(),
  updated_at         timestamptz not null default now(),

  unique (tenant_id, business_ref),
  check (validation_status <> 'validated' or (validated_by is not null and validated_at is not null)),
  -- Une preuve doit être atteignable : fichier, lien ou déclaration explicite.
  check (
    evidence_type = 'declarative'
    or storage_path is not null
    or external_url is not null
  )
);

comment on table public.evidence is
  'Preuve : source, type, propriétaire, dates de collecte et de validité, statut de validation, version/empreinte. La fraîcheur est calculée (voir app.evidence_freshness).';
comment on column public.evidence.owner_user_id is
  'Propriétaire obligatoire : toute preuve a un responsable humain identifié.';

create index evidence_org_idx on public.evidence (organization_id, validation_status);
create index evidence_expiry_idx on public.evidence (tenant_id, valid_until) where valid_until is not null;

create trigger evidence_touch_updated_at before update on public.evidence
  for each row execute function app.touch_updated_at();
create trigger evidence_assert_tenant before insert or update on public.evidence
  for each row execute function app.assert_tenant_consistency();

create or replace function app.set_evidence_business_ref()
returns trigger language plpgsql security definer
set search_path = app, public, pg_catalog as $$
begin
  if new.business_ref is null or btrim(new.business_ref) = '' then
    new.business_ref := app.next_business_ref(new.tenant_id, 'EVD');
  end if;
  return new;
end; $$;

create trigger evidence_set_business_ref before insert on public.evidence
  for each row execute function app.set_evidence_business_ref();

-- Fraîcheur : dérivée de valid_until, jamais stockée (elle changerait sans écriture).
create or replace function app.evidence_freshness(p_valid_until date)
returns app.evidence_freshness
language sql
stable
set search_path = pg_catalog
as $$
  select case
    when p_valid_until is null then 'unknown'
    when p_valid_until < current_date then 'expired'
    when p_valid_until < current_date + interval '30 days' then 'expiring'
    else 'fresh'
  end::app.evidence_freshness;
$$;

comment on function app.evidence_freshness is
  'Statut de fraîcheur d''une preuve. « expiring » à moins de 30 jours de l''échéance.';

grant execute on function app.evidence_freshness(date) to authenticated, service_role;

create view public.evidence_with_freshness
with (security_invoker = true) as
  select e.*, app.evidence_freshness(e.valid_until) as freshness_status
  from public.evidence e;

comment on view public.evidence_with_freshness is
  'Preuves enrichies de leur fraîcheur. security_invoker : la vue reste soumise à la RLS de l''appelant.';

-- -----------------------------------------------------------------------------
-- control_evidence
-- -----------------------------------------------------------------------------
create table public.control_evidence (
  id          uuid primary key default gen_random_uuid(),
  tenant_id   uuid not null references public.tenant (id) on delete cascade,
  control_id  uuid not null references public.control (id) on delete cascade,
  evidence_id uuid not null references public.evidence (id) on delete cascade,
  linked_at   timestamptz not null default now(),
  linked_by   uuid references public.user_profile (id) on delete set null,
  unique (control_id, evidence_id)
);

comment on table public.control_evidence is
  'Rattachement preuve ↔ contrôle. Un contrôle obligatoire sans preuve fraîche et validée est signalé au gate.';

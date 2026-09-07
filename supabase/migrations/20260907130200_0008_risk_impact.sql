-- =============================================================================
-- AIGMS — 0008 — Risques et AI Impact Assessment
-- Vertical slice — Sprints 4 et 5
-- =============================================================================
-- L'AIIA n'est pas une copie du registre des risques : le risque protège
-- l'organisation, l'AIIA examine les effets sur les personnes, les groupes et
-- la société (ISO/IEC 42005). Les deux objets sont donc distincts et liés.
-- =============================================================================

create type app.risk_level as enum ('low', 'moderate', 'high', 'critical');

create type app.risk_status as enum (
  'identified', 'analysed', 'treatment_planned', 'treatment_in_progress',
  'mitigated', 'accepted', 'closed'
);

create type app.risk_category as enum (
  'fundamental_rights', 'safety', 'security', 'privacy', 'bias_discrimination',
  'transparency', 'accuracy_robustness', 'operational', 'financial',
  'reputational', 'legal_compliance', 'environmental', 'third_party'
);

create type app.treatment_strategy as enum ('avoid', 'reduce', 'transfer', 'accept');

create type app.treatment_status as enum ('planned', 'in_progress', 'implemented', 'verified', 'abandoned');

-- -----------------------------------------------------------------------------
-- risk
-- -----------------------------------------------------------------------------
create table public.risk (
  id                    uuid primary key default gen_random_uuid(),
  tenant_id             uuid not null references public.tenant (id) on delete cascade,
  organization_id       uuid not null references public.organization (id) on delete cascade,
  use_case_id           uuid references public.ai_use_case (id) on delete cascade,
  business_ref          text not null,

  title                 text not null check (btrim(title) <> ''),
  scenario              text not null check (btrim(scenario) <> ''),
  category              app.risk_category not null,

  inherent_likelihood   smallint not null check (inherent_likelihood between 1 and 5),
  inherent_impact       smallint not null check (inherent_impact between 1 and 5),
  inherent_level        app.risk_level not null,

  residual_likelihood   smallint check (residual_likelihood between 1 and 5),
  residual_impact       smallint check (residual_impact between 1 and 5),
  residual_level        app.risk_level,

  owner_user_id         uuid references public.user_profile (id) on delete set null,
  status                app.risk_status not null default 'identified',

  -- Acceptation : jamais automatique, toujours nominative et datée.
  accepted_by           uuid references public.user_profile (id) on delete set null,
  accepted_at           timestamptz,
  acceptance_rationale  text,
  acceptance_review_at  date,

  next_review_at        date,
  created_by            uuid references public.user_profile (id) on delete set null,
  created_at            timestamptz not null default now(),
  updated_at            timestamptz not null default now(),

  unique (tenant_id, business_ref),
  -- Règle non négociable : une acceptation exige un responsable humain,
  -- une justification et une date de revue.
  constraint risk_acceptance_requires_human check (
    status <> 'accepted'
    or (accepted_by is not null
        and accepted_at is not null
        and btrim(coalesce(acceptance_rationale, '')) <> ''
        and acceptance_review_at is not null)
  )
);

comment on table public.risk is
  'Risque IA rattaché à un cas d''usage. Une acceptation est nominative, justifiée et assortie d''une date de revue (contrainte risk_acceptance_requires_human).';

create index risk_use_case_idx on public.risk (use_case_id, status);
create index risk_org_level_idx on public.risk (organization_id, residual_level, status);

create trigger risk_touch_updated_at before update on public.risk
  for each row execute function app.touch_updated_at();
create trigger risk_assert_tenant before insert or update on public.risk
  for each row execute function app.assert_tenant_consistency();

-- Cotation dérivée : le niveau est calculé, jamais saisi librement.
create or replace function app.rate_risk_level(p_likelihood smallint, p_impact smallint)
returns app.risk_level
language sql
immutable
set search_path = pg_catalog
as $$
  select case
    when p_likelihood is null or p_impact is null then null
    when p_likelihood * p_impact >= 16 then 'critical'
    when p_likelihood * p_impact >= 10 then 'high'
    when p_likelihood * p_impact >= 5  then 'moderate'
    else 'low'
  end::app.risk_level;
$$;

comment on function app.rate_risk_level is
  'Cotation vraisemblance × gravité sur une échelle 1-5. Déterministe et testable.';

create or replace function app.compute_risk_levels()
returns trigger
language plpgsql
set search_path = app, public, pg_catalog
as $$
begin
  new.inherent_level := app.rate_risk_level(new.inherent_likelihood, new.inherent_impact);
  new.residual_level := app.rate_risk_level(new.residual_likelihood, new.residual_impact);
  return new;
end;
$$;

create trigger risk_compute_levels
  before insert or update on public.risk
  for each row execute function app.compute_risk_levels();

create or replace function app.set_risk_business_ref()
returns trigger language plpgsql security definer
set search_path = app, public, pg_catalog as $$
begin
  if new.business_ref is null or btrim(new.business_ref) = '' then
    new.business_ref := app.next_business_ref(new.tenant_id, 'RSK');
  end if;
  return new;
end; $$;

create trigger risk_set_business_ref before insert on public.risk
  for each row execute function app.set_risk_business_ref();

-- -----------------------------------------------------------------------------
-- risk_treatment
-- -----------------------------------------------------------------------------
create table public.risk_treatment (
  id             uuid primary key default gen_random_uuid(),
  tenant_id      uuid not null references public.tenant (id) on delete cascade,
  risk_id        uuid not null references public.risk (id) on delete cascade,
  strategy       app.treatment_strategy not null,
  description    text not null check (btrim(description) <> ''),
  owner_user_id  uuid references public.user_profile (id) on delete set null,
  due_date       date,
  status         app.treatment_status not null default 'planned',
  effectiveness_note text,
  created_at     timestamptz not null default now(),
  updated_at     timestamptz not null default now()
);

comment on table public.risk_treatment is
  'Plan de traitement d''un risque. Un risque critique non traité et non accepté bloque le passage en production.';

create index risk_treatment_risk_idx on public.risk_treatment (risk_id, status);
create trigger risk_treatment_touch_updated_at before update on public.risk_treatment
  for each row execute function app.touch_updated_at();

-- -----------------------------------------------------------------------------
-- impact_assessment (AIIA)
-- -----------------------------------------------------------------------------
create type app.impact_assessment_status as enum ('draft', 'in_progress', 'completed', 'reopened', 'superseded');

create type app.impact_domain as enum (
  'fundamental_rights', 'health_safety', 'equality_non_discrimination',
  'privacy_data_protection', 'human_dignity_autonomy', 'access_to_services',
  'employment_working_conditions', 'consumer_protection', 'democratic_processes',
  'environment', 'vulnerable_groups', 'society_at_large'
);

create type app.impact_severity as enum ('negligible', 'limited', 'significant', 'severe');

create type app.impact_likelihood as enum ('unlikely', 'possible', 'likely', 'almost_certain');

create table public.impact_assessment (
  id                 uuid primary key default gen_random_uuid(),
  tenant_id          uuid not null references public.tenant (id) on delete cascade,
  organization_id    uuid not null references public.organization (id) on delete cascade,
  use_case_id        uuid not null references public.ai_use_case (id) on delete cascade,
  business_ref       text not null,

  scope_description  text not null check (btrim(scope_description) <> ''),
  methodology        text not null default 'ISO/IEC 42005',
  lifecycle_phase    text,
  status             app.impact_assessment_status not null default 'draft',

  -- Articulation avec le RGPD : l'AIIA ne s'y substitue pas.
  dpia_required      boolean not null default false,
  dpia_reference     text,

  conclusion         text,
  performed_by       uuid references public.user_profile (id) on delete set null,
  approved_by        uuid references public.user_profile (id) on delete set null,
  completed_at       timestamptz,
  next_review_at     date,
  supersedes_id      uuid references public.impact_assessment (id) on delete set null,
  reopened_reason    text,

  created_at         timestamptz not null default now(),
  updated_at         timestamptz not null default now(),

  unique (tenant_id, business_ref),
  check (status <> 'completed' or (completed_at is not null and btrim(coalesce(conclusion, '')) <> '')),
  check (not dpia_required or status <> 'completed' or dpia_reference is not null)
);

comment on table public.impact_assessment is
  'AI Impact Assessment (ISO/IEC 42005) : effets sur les personnes, les groupes et la société. Distinct du registre des risques.';

create index impact_assessment_use_case_idx on public.impact_assessment (use_case_id, status);

create trigger impact_assessment_touch_updated_at before update on public.impact_assessment
  for each row execute function app.touch_updated_at();
create trigger impact_assessment_assert_tenant before insert or update on public.impact_assessment
  for each row execute function app.assert_tenant_consistency();

create or replace function app.set_impact_business_ref()
returns trigger language plpgsql security definer
set search_path = app, public, pg_catalog as $$
begin
  if new.business_ref is null or btrim(new.business_ref) = '' then
    new.business_ref := app.next_business_ref(new.tenant_id, 'AIIA');
  end if;
  return new;
end; $$;

create trigger impact_assessment_set_business_ref before insert on public.impact_assessment
  for each row execute function app.set_impact_business_ref();

-- -----------------------------------------------------------------------------
-- impact_stakeholder
-- -----------------------------------------------------------------------------
create table public.impact_stakeholder (
  id                    uuid primary key default gen_random_uuid(),
  tenant_id             uuid not null references public.tenant (id) on delete cascade,
  impact_assessment_id  uuid not null references public.impact_assessment (id) on delete cascade,
  label                 text not null check (btrim(label) <> ''),
  is_vulnerable_group   boolean not null default false,
  estimated_population  text,
  consulted             boolean not null default false,
  consultation_method   text,
  created_at            timestamptz not null default now()
);

comment on table public.impact_stakeholder is
  'Partie prenante affectée. `is_vulnerable_group` renforce le niveau d''examen attendu.';

create index impact_stakeholder_aiia_idx on public.impact_stakeholder (impact_assessment_id);

-- -----------------------------------------------------------------------------
-- impact_finding
-- -----------------------------------------------------------------------------
create table public.impact_finding (
  id                    uuid primary key default gen_random_uuid(),
  tenant_id             uuid not null references public.tenant (id) on delete cascade,
  impact_assessment_id  uuid not null references public.impact_assessment (id) on delete cascade,
  stakeholder_id        uuid references public.impact_stakeholder (id) on delete set null,
  domain                app.impact_domain not null,
  description           text not null check (btrim(description) <> ''),
  is_adverse            boolean not null default true,
  severity              app.impact_severity not null,
  likelihood            app.impact_likelihood not null,
  mitigation            text,
  residual_severity     app.impact_severity,
  linked_risk_id        uuid references public.risk (id) on delete set null,
  owner_user_id         uuid references public.user_profile (id) on delete set null,
  created_at            timestamptz not null default now(),
  updated_at            timestamptz not null default now(),
  -- Un constat défavorable grave doit porter une mesure de réduction.
  constraint impact_finding_severe_requires_mitigation check (
    not (is_adverse and severity in ('significant', 'severe'))
    or btrim(coalesce(mitigation, '')) <> ''
  )
);

comment on table public.impact_finding is
  'Constat d''impact. Un constat défavorable significatif ou grave exige une mesure de réduction documentée.';

create index impact_finding_aiia_idx on public.impact_finding (impact_assessment_id, severity);

create trigger impact_finding_touch_updated_at before update on public.impact_finding
  for each row execute function app.touch_updated_at();

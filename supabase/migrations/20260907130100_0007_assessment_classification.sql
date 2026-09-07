-- =============================================================================
-- AIGMS — 0007 — Triage, Assessment et pré-classification réglementaire
-- Vertical slice — Sprint 3
-- =============================================================================
-- Principe (Référentiel V4 §M05) : le moteur produit une PRÉ-QUALIFICATION,
-- jamais une conclusion juridique. Toute classification porte un niveau de
-- validation juridique requis et n'est jamais adossée à une date codée en dur.
-- =============================================================================

create type app.assessment_kind as enum (
  'triage', 'regulatory_preclassification', 'risk_assessment',
  'impact_assessment', 'security_review', 'vendor_review'
);

create type app.assessment_status as enum ('draft', 'in_progress', 'completed', 'reopened', 'superseded');

create type app.regulatory_role as enum ('provider', 'deployer', 'importer', 'distributor', 'other', 'undetermined');

create type app.classification_flag as enum (
  'out_of_scope', 'to_confirm', 'prohibited_practice_suspected',
  'high_risk_potential', 'transparency_obligations', 'gpai_dependency',
  'privacy_impact', 'security_impact'
);

create type app.legal_review_level as enum ('none', 'internal_review', 'external_counsel_required');

-- -----------------------------------------------------------------------------
-- assessment — enveloppe générique d'une évaluation
-- -----------------------------------------------------------------------------
create table public.assessment (
  id                uuid primary key default gen_random_uuid(),
  tenant_id         uuid not null references public.tenant (id) on delete cascade,
  organization_id   uuid not null references public.organization (id) on delete cascade,
  use_case_id       uuid not null references public.ai_use_case (id) on delete cascade,
  business_ref      text not null,
  kind              app.assessment_kind not null,
  status            app.assessment_status not null default 'draft',
  -- Référentiel appliqué au moment de l'évaluation : les exigences évoluent,
  -- l'évaluation reste interprétable a posteriori.
  framework_code    text,
  framework_version text,
  performed_by      uuid references public.user_profile (id) on delete set null,
  completed_at      timestamptz,
  reopened_reason   text,
  supersedes_id     uuid references public.assessment (id) on delete set null,
  created_at        timestamptz not null default now(),
  updated_at        timestamptz not null default now(),
  unique (tenant_id, business_ref),
  check (status <> 'completed' or completed_at is not null)
);

comment on table public.assessment is
  'Évaluation rattachée à un cas d''usage. `supersedes_id` conserve la chaîne des réévaluations successives.';

create index assessment_use_case_idx on public.assessment (use_case_id, kind, status);

create trigger assessment_touch_updated_at before update on public.assessment
  for each row execute function app.touch_updated_at();
create trigger assessment_assert_tenant before insert or update on public.assessment
  for each row execute function app.assert_tenant_consistency();

create or replace function app.set_assessment_business_ref()
returns trigger language plpgsql security definer
set search_path = app, public, pg_catalog as $$
begin
  if new.business_ref is null or btrim(new.business_ref) = '' then
    new.business_ref := app.next_business_ref(new.tenant_id, 'ASM');
  end if;
  return new;
end; $$;

create trigger assessment_set_business_ref before insert on public.assessment
  for each row execute function app.set_assessment_business_ref();

-- -----------------------------------------------------------------------------
-- assessment_answer — réponses au questionnaire
-- -----------------------------------------------------------------------------
create table public.assessment_answer (
  id             uuid primary key default gen_random_uuid(),
  tenant_id      uuid not null references public.tenant (id) on delete cascade,
  assessment_id  uuid not null references public.assessment (id) on delete cascade,
  question_code  text not null,
  question_label text not null,
  answer_value   jsonb not null,
  justification  text,
  answered_by    uuid references public.user_profile (id) on delete set null,
  answered_at    timestamptz not null default now(),
  unique (assessment_id, question_code)
);

comment on table public.assessment_answer is
  'Réponse horodatée et justifiée. Constitue la preuve du raisonnement de gouvernance.';

-- -----------------------------------------------------------------------------
-- regulatory_classification — sortie du classifieur AI Act
-- -----------------------------------------------------------------------------
create table public.regulatory_classification (
  id                     uuid primary key default gen_random_uuid(),
  tenant_id              uuid not null references public.tenant (id) on delete cascade,
  organization_id        uuid not null references public.organization (id) on delete cascade,
  use_case_id            uuid not null references public.ai_use_case (id) on delete cascade,
  assessment_id          uuid references public.assessment (id) on delete set null,

  framework_code         text not null default 'EU_AI_ACT',
  framework_version      text not null,

  organization_role      app.regulatory_role not null default 'undetermined',
  flags                  app.classification_flag[] not null default '{}',
  rationale              text not null check (btrim(rationale) <> ''),
  legal_review_level     app.legal_review_level not null default 'internal_review',
  legal_review_completed boolean not null default false,
  legal_reviewer_id      uuid references public.user_profile (id) on delete set null,
  legal_review_at        timestamptz,

  is_current             boolean not null default true,
  classified_by          uuid references public.user_profile (id) on delete set null,
  classified_at          timestamptz not null default now(),
  next_review_at         date,
  created_at             timestamptz not null default now(),
  updated_at             timestamptz not null default now(),

  check (not legal_review_completed or legal_review_at is not null)
);

comment on table public.regulatory_classification is
  'Pré-qualification réglementaire d''un cas d''usage. Ne vaut pas avis juridique (Références V1 §5).';
comment on column public.regulatory_classification.framework_version is
  'Version du référentiel appliquée. Aucune date de conformité n''est codée en dur : elle est portée par le référentiel versionné.';

-- Une seule classification courante par cas d'usage ; les précédentes sont conservées.
create unique index regulatory_classification_current_idx
  on public.regulatory_classification (use_case_id)
  where is_current;

create trigger regulatory_classification_touch_updated_at
  before update on public.regulatory_classification
  for each row execute function app.touch_updated_at();
create trigger regulatory_classification_assert_tenant
  before insert or update on public.regulatory_classification
  for each row execute function app.assert_tenant_consistency();

-- -----------------------------------------------------------------------------
-- Complétude d'une classification, consommée par le gate PRODUCTION.
-- -----------------------------------------------------------------------------
create or replace function app.classification_is_complete(p_use_case_id uuid)
returns boolean
language sql
stable
security definer
set search_path = app, public, pg_catalog
as $$
  select exists (
    select 1
    from public.regulatory_classification c
    where c.use_case_id = p_use_case_id
      and c.is_current
      and c.organization_role <> 'undetermined'
      and c.flags <> '{}'
      and not ('to_confirm' = any (c.flags))
      and not ('prohibited_practice_suspected' = any (c.flags))
      and (c.legal_review_level = 'none' or c.legal_review_completed)
  );
$$;

comment on function app.classification_is_complete is
  'Vrai si la classification courante est exploitable : rôle déterminé, aucun drapeau « à confirmer » ou « pratique interdite », revue juridique close si requise.';

grant execute on function app.classification_is_complete(uuid) to authenticated, service_role;

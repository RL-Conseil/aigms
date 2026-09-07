-- =============================================================================
-- AIGMS — 0010 — Human Oversight, Registre de décisions et Actions
-- Vertical slice — Sprints 6 et 9
-- =============================================================================
-- Le registre de décisions est l'objet différenciant d'AIGMS. Règle absolue :
-- aucune acceptation de risque ni mise en production n'est approuvée par un
-- système. Toute approbation porte un approbateur humain, une justification,
-- une date d'effet et, si nécessaire, une date de revue.
-- =============================================================================

-- -----------------------------------------------------------------------------
-- human_oversight_plan
-- -----------------------------------------------------------------------------
create type app.oversight_plan_status as enum ('draft', 'submitted', 'approved', 'rejected', 'not_applicable', 'superseded');

create table public.human_oversight_plan (
  id                      uuid primary key default gen_random_uuid(),
  tenant_id               uuid not null references public.tenant (id) on delete cascade,
  organization_id         uuid not null references public.organization (id) on delete cascade,
  use_case_id             uuid not null references public.ai_use_case (id) on delete cascade,
  business_ref            text not null,

  autonomy_level          app.autonomy_level not null,
  accountable_user_id     uuid references public.user_profile (id) on delete restrict,
  required_competence     text,
  monitoring_cadence      text,
  intervention_triggers   text,
  override_procedure      text,
  stop_authority_user_id  uuid references public.user_profile (id) on delete restrict,
  stop_procedure          text,
  expected_evidence       text,

  status                  app.oversight_plan_status not null default 'draft',
  not_applicable_rationale text,
  approved_by             uuid references public.user_profile (id) on delete restrict,
  approved_at             timestamptz,
  next_review_at          date,

  created_at              timestamptz not null default now(),
  updated_at              timestamptz not null default now(),

  unique (tenant_id, business_ref),

  -- Un plan approuvé est complet : responsable, déclencheurs, arrêt, approbateur.
  constraint oversight_approved_is_complete check (
    status <> 'approved'
    or (accountable_user_id is not null
        and btrim(coalesce(intervention_triggers, '')) <> ''
        and stop_authority_user_id is not null
        and approved_by is not null
        and approved_at is not null)
  ),
  -- Une supervision déclarée non applicable doit être justifiée.
  constraint oversight_na_is_justified check (
    status <> 'not_applicable' or btrim(coalesce(not_applicable_rationale, '')) <> ''
  ),
  -- Au-delà de L2, l'autonomie impose une autorité d'arrêt nominative.
  constraint oversight_high_autonomy_needs_stop_authority check (
    autonomy_level in ('L0', 'L1', 'L2')
    or status in ('draft', 'not_applicable')
    or stop_authority_user_id is not null
  )
);

comment on table public.human_oversight_plan is
  'Plan de supervision humaine (M08). Un plan approuvé nomme un responsable redevable et une autorité d''arrêt.';

create unique index human_oversight_plan_active_idx
  on public.human_oversight_plan (use_case_id)
  where status in ('draft', 'submitted', 'approved', 'not_applicable');

create trigger human_oversight_plan_touch_updated_at before update on public.human_oversight_plan
  for each row execute function app.touch_updated_at();
create trigger human_oversight_plan_assert_tenant before insert or update on public.human_oversight_plan
  for each row execute function app.assert_tenant_consistency();

create or replace function app.set_oversight_business_ref()
returns trigger language plpgsql security definer
set search_path = app, public, pg_catalog as $$
begin
  if new.business_ref is null or btrim(new.business_ref) = '' then
    new.business_ref := app.next_business_ref(new.tenant_id, 'HOP');
  end if;
  return new;
end; $$;

create trigger human_oversight_plan_set_business_ref before insert on public.human_oversight_plan
  for each row execute function app.set_oversight_business_ref();

-- -----------------------------------------------------------------------------
-- governance_decision
-- -----------------------------------------------------------------------------
create type app.decision_type as enum (
  'use_case_authorization', 'pilot_approval', 'go_production',
  'risk_acceptance', 'policy_exception', 'significant_change',
  'suspension', 'retirement'
);

create type app.decision_status as enum (
  'draft', 'submitted', 'approved', 'approved_with_conditions', 'rejected', 'revoked', 'superseded'
);

create table public.governance_decision (
  id                 uuid primary key default gen_random_uuid(),
  tenant_id          uuid not null references public.tenant (id) on delete cascade,
  organization_id    uuid not null references public.organization (id) on delete cascade,
  use_case_id        uuid references public.ai_use_case (id) on delete cascade,
  business_ref       text not null,

  decision_type      app.decision_type not null,
  subject            text not null check (btrim(subject) <> ''),
  context            text,
  options_considered text,
  decision_statement text,
  conditions         text,
  rationale          text,

  status             app.decision_status not null default 'draft',
  version            integer not null default 1 check (version >= 1),
  supersedes_id      uuid references public.governance_decision (id) on delete set null,

  submitted_by       uuid references public.user_profile (id) on delete set null,
  submitted_at       timestamptz,
  approver_user_id   uuid references public.user_profile (id) on delete restrict,
  approved_at        timestamptz,

  effective_from     date,
  review_due_at      date,

  created_at         timestamptz not null default now(),
  updated_at         timestamptz not null default now(),

  unique (tenant_id, business_ref),

  -- Aucune décision approuvée sans approbateur humain, justification et date d'effet.
  constraint decision_approval_requires_human check (
    status not in ('approved', 'approved_with_conditions')
    or (approver_user_id is not null
        and approved_at is not null
        and btrim(coalesce(rationale, '')) <> ''
        and btrim(coalesce(decision_statement, '')) <> ''
        and effective_from is not null)
  ),
  -- Une approbation sous conditions énonce ses conditions.
  constraint decision_conditional_requires_conditions check (
    status <> 'approved_with_conditions' or btrim(coalesce(conditions, '')) <> ''
  ),
  -- Les décisions à effet durable portent une date de revue.
  constraint decision_review_date_required check (
    decision_type not in ('risk_acceptance', 'policy_exception', 'go_production')
    or status not in ('approved', 'approved_with_conditions')
    or review_due_at is not null
  ),
  constraint decision_rejection_requires_rationale check (
    status <> 'rejected' or btrim(coalesce(rationale, '')) <> ''
  )
);

comment on table public.governance_decision is
  'Registre des décisions de gouvernance (M07). Référence lisible DEC-IA-AAAA-####. Aucune approbation automatique.';

create index governance_decision_use_case_idx on public.governance_decision (use_case_id, decision_type, status);
create index governance_decision_review_idx on public.governance_decision (tenant_id, review_due_at)
  where review_due_at is not null;

create trigger governance_decision_touch_updated_at before update on public.governance_decision
  for each row execute function app.touch_updated_at();
create trigger governance_decision_assert_tenant before insert or update on public.governance_decision
  for each row execute function app.assert_tenant_consistency();

create or replace function app.set_decision_business_ref()
returns trigger language plpgsql security definer
set search_path = app, public, pg_catalog as $$
begin
  if new.business_ref is null or btrim(new.business_ref) = '' then
    new.business_ref := app.next_business_ref(new.tenant_id, 'DEC-IA');
  end if;
  return new;
end; $$;

create trigger governance_decision_set_business_ref before insert on public.governance_decision
  for each row execute function app.set_decision_business_ref();

-- Un approbateur ne peut pas approuver sa propre soumission : séparation des rôles.
create or replace function app.guard_decision_approval()
returns trigger
language plpgsql
security definer
set search_path = app, public, pg_catalog
as $$
begin
  -- Couvre l'INSERT autant que l'UPDATE : sans cela, une décision pourrait
  -- naître directement approuvée en contournant la séparation des rôles.
  if new.status in ('approved', 'approved_with_conditions')
     and (tg_op = 'INSERT' or old.status not in ('approved', 'approved_with_conditions')) then

    if new.approver_user_id is null then
      raise exception 'Une décision ne peut être approuvée sans approbateur humain identifié.'
        using errcode = 'check_violation';
    end if;

    if new.decision_type in ('go_production', 'risk_acceptance', 'policy_exception')
       and new.approver_user_id = new.submitted_by then
      raise exception 'Séparation des rôles : l''approbateur d''une décision % ne peut être son auteur.', new.decision_type
        using errcode = 'insufficient_privilege';
    end if;

    -- L'approbateur doit être un humain habilité sur l'organisation.
    if not exists (
      select 1 from public.user_profile p where p.id = new.approver_user_id
    ) then
      raise exception 'Approbateur inconnu : %', new.approver_user_id
        using errcode = 'foreign_key_violation';
    end if;
  end if;

  return new;
end;
$$;

comment on function app.guard_decision_approval is
  'Contrôle serveur de l''approbation : approbateur humain obligatoire et séparation auteur/approbateur sur les décisions les plus engageantes.';

create trigger governance_decision_guard_approval
  before insert or update on public.governance_decision
  for each row execute function app.guard_decision_approval();

-- -----------------------------------------------------------------------------
-- decision_link — rattachement d'une décision à ses éléments probants
-- -----------------------------------------------------------------------------
create type app.decision_link_target as enum ('risk', 'control', 'evidence', 'impact_assessment', 'change_request', 'incident', 'use_case');

create table public.decision_link (
  id           uuid primary key default gen_random_uuid(),
  tenant_id    uuid not null references public.tenant (id) on delete cascade,
  decision_id  uuid not null references public.governance_decision (id) on delete cascade,
  target_type  app.decision_link_target not null,
  target_id    uuid not null,
  note         text,
  created_at   timestamptz not null default now(),
  unique (decision_id, target_type, target_id)
);

comment on table public.decision_link is
  'Éléments sur lesquels une décision se fonde. Rend la décision reconstituable en audit.';

create index decision_link_target_idx on public.decision_link (target_type, target_id);

-- -----------------------------------------------------------------------------
-- action — plan d'action transverse
-- -----------------------------------------------------------------------------
create type app.action_status as enum ('open', 'in_progress', 'blocked', 'done', 'cancelled', 'overdue');

create type app.action_source as enum ('decision', 'risk', 'impact_finding', 'incident', 'audit_finding', 'control', 'change_request', 'management_review', 'manual');

create table public.action (
  id              uuid primary key default gen_random_uuid(),
  tenant_id       uuid not null references public.tenant (id) on delete cascade,
  organization_id uuid not null references public.organization (id) on delete cascade,
  use_case_id     uuid references public.ai_use_case (id) on delete cascade,
  business_ref    text not null,

  title           text not null check (btrim(title) <> ''),
  description     text,
  source          app.action_source not null default 'manual',
  source_id       uuid,

  owner_user_id   uuid references public.user_profile (id) on delete set null,
  due_date        date,
  status          app.action_status not null default 'open',
  -- Une action bloquante empêche le passage en production tant qu'elle est ouverte.
  is_blocking     boolean not null default false,
  closed_at       timestamptz,
  closure_note    text,

  created_at      timestamptz not null default now(),
  updated_at      timestamptz not null default now(),

  unique (tenant_id, business_ref),
  check (status <> 'done' or closed_at is not null)
);

comment on table public.action is
  'Action de gouvernance. `is_blocking` alimente la précondition « actions bloquantes closes » du gate PRODUCTION.';

create index action_open_idx on public.action (organization_id, status, due_date);
create index action_use_case_idx on public.action (use_case_id, status) where is_blocking;

create trigger action_touch_updated_at before update on public.action
  for each row execute function app.touch_updated_at();
create trigger action_assert_tenant before insert or update on public.action
  for each row execute function app.assert_tenant_consistency();

create or replace function app.set_action_business_ref()
returns trigger language plpgsql security definer
set search_path = app, public, pg_catalog as $$
begin
  if new.business_ref is null or btrim(new.business_ref) = '' then
    new.business_ref := app.next_business_ref(new.tenant_id, 'ACT');
  end if;
  return new;
end; $$;

create trigger action_set_business_ref before insert on public.action
  for each row execute function app.set_action_business_ref();

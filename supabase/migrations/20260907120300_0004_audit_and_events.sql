-- =============================================================================
-- AIGMS — 0004 — Audit log & Event model
-- Sprint 0
-- =============================================================================
-- `audit_log` : journal append-only des opérations sensibles (règle métier
-- non négociable « toute modification sensible journalisée »).
-- `governance_event` : événements métier persistés (UseCaseSubmitted,
-- RiskAccepted, DecisionApproved…), sans infrastructure de bus.
-- =============================================================================

create type app.audit_action as enum (
  'create', 'update', 'delete', 'archive',
  'status_transition', 'gate_evaluated', 'gate_blocked',
  'decision_approved', 'decision_rejected',
  'risk_accepted', 'evidence_validated',
  'reassessment_triggered',
  'access_granted', 'access_revoked',
  'login', 'export', 'read_sensitive'
);

-- -----------------------------------------------------------------------------
-- audit_log
-- -----------------------------------------------------------------------------
create table public.audit_log (
  id              bigserial primary key,
  tenant_id       uuid not null references public.tenant (id) on delete restrict,
  occurred_at     timestamptz not null default now(),
  actor_user_id   uuid references public.user_profile (id) on delete set null,
  actor_email     text,
  actor_role      app.app_role,
  action          app.audit_action not null,
  entity_type     text not null check (btrim(entity_type) <> ''),
  entity_id       uuid,
  entity_ref      text,
  summary         text,
  before_state    jsonb,
  after_state     jsonb,
  metadata        jsonb not null default '{}'::jsonb
);

comment on table public.audit_log is
  'Journal d''audit append-only. Aucun UPDATE ni DELETE n''est autorisé, y compris pour service_role (voir trigger audit_log_immutable).';
comment on column public.audit_log.actor_email is
  'Email capturé au moment du fait : la trace reste lisible après suppression du compte.';
comment on column public.audit_log.before_state is
  'État avant modification, restreint aux champs pertinents. Ne doit contenir aucun secret.';

create index audit_log_tenant_time_idx on public.audit_log (tenant_id, occurred_at desc);
create index audit_log_entity_idx      on public.audit_log (entity_type, entity_id, occurred_at desc);

-- Immuabilité : le journal ne se réécrit pas.
create or replace function app.reject_audit_mutation()
returns trigger
language plpgsql
as $$
begin
  raise exception 'audit_log est append-only : % interdit', tg_op
    using errcode = 'insufficient_privilege';
end;
$$;

create trigger audit_log_immutable
  before update or delete on public.audit_log
  for each row execute function app.reject_audit_mutation();

-- -----------------------------------------------------------------------------
-- Écriture du journal : uniquement par cette fonction.
-- -----------------------------------------------------------------------------
create or replace function app.log_audit(
  p_tenant_id    uuid,
  p_action       app.audit_action,
  p_entity_type  text,
  p_entity_id    uuid    default null,
  p_entity_ref   text    default null,
  p_summary      text    default null,
  p_before       jsonb   default null,
  p_after        jsonb   default null,
  p_metadata     jsonb   default '{}'::jsonb
)
returns bigint
language plpgsql
security definer
set search_path = app, public, pg_catalog
as $$
declare
  v_user_id uuid := app.current_user_id();
  v_email   text;
  v_id      bigint;
begin
  if p_tenant_id is null then
    raise exception 'log_audit: tenant_id obligatoire';
  end if;

  -- Un utilisateur ne peut journaliser que dans un tenant auquel il accède.
  -- service_role (hors JWT utilisateur) est autorisé : seeds, tâches système.
  if v_user_id is not null and not app.has_tenant_access(p_tenant_id) then
    raise exception 'log_audit: accès refusé au tenant %', p_tenant_id
      using errcode = 'insufficient_privilege';
  end if;

  select email into v_email from public.user_profile where id = v_user_id;

  insert into public.audit_log (
    tenant_id, actor_user_id, actor_email, actor_role, action,
    entity_type, entity_id, entity_ref, summary,
    before_state, after_state, metadata
  )
  values (
    p_tenant_id, v_user_id, v_email, app.tenant_role(p_tenant_id), p_action,
    p_entity_type, p_entity_id, p_entity_ref, p_summary,
    p_before, p_after, coalesce(p_metadata, '{}'::jsonb)
  )
  returning id into v_id;

  return v_id;
end;
$$;

comment on function app.log_audit is
  'Unique point d''écriture du journal d''audit. Refuse une écriture hors du périmètre tenant de l''appelant.';

revoke all on function app.log_audit(uuid, app.audit_action, text, uuid, text, text, jsonb, jsonb, jsonb) from public;
grant execute on function app.log_audit(uuid, app.audit_action, text, uuid, text, text, jsonb, jsonb, jsonb)
  to authenticated, service_role;

-- -----------------------------------------------------------------------------
-- governance_event — événements métier persistés
-- -----------------------------------------------------------------------------
create type app.governance_event_type as enum (
  'UseCaseSubmitted',
  'TriageCompleted',
  'ClassificationCompleted',
  'AssessmentCompleted',
  'RiskAccepted',
  'ImpactAssessmentCompleted',
  'OversightPlanApproved',
  'DecisionApproved',
  'ProductionGateBlocked',
  'ProductionGatePassed',
  'EvidenceExpired',
  'SignificantChangeDetected',
  'ReassessmentTriggered',
  'IncidentOpened',
  'CAPAClosed',
  'ReviewDue'
);

create table public.governance_event (
  id            uuid primary key default gen_random_uuid(),
  tenant_id     uuid not null references public.tenant (id) on delete cascade,
  event_type    app.governance_event_type not null,
  occurred_at   timestamptz not null default now(),
  subject_type  text not null,
  subject_id    uuid not null,
  payload       jsonb not null default '{}'::jsonb,
  emitted_by    uuid references public.user_profile (id) on delete set null
);

comment on table public.governance_event is
  'Événements de gouvernance persistés. Alimentent la timeline d''audit et les échéances, sans bus d''événements.';

create index governance_event_tenant_time_idx on public.governance_event (tenant_id, occurred_at desc);
create index governance_event_subject_idx     on public.governance_event (subject_type, subject_id, occurred_at desc);

create or replace function app.emit_event(
  p_tenant_id    uuid,
  p_event_type   app.governance_event_type,
  p_subject_type text,
  p_subject_id   uuid,
  p_payload      jsonb default '{}'::jsonb
)
returns uuid
language plpgsql
security definer
set search_path = app, public, pg_catalog
as $$
declare
  v_id uuid;
begin
  if p_tenant_id is null then
    raise exception 'emit_event: tenant_id obligatoire';
  end if;

  if app.current_user_id() is not null and not app.has_tenant_access(p_tenant_id) then
    raise exception 'emit_event: accès refusé au tenant %', p_tenant_id
      using errcode = 'insufficient_privilege';
  end if;

  insert into public.governance_event (tenant_id, event_type, subject_type, subject_id, payload, emitted_by)
  values (p_tenant_id, p_event_type, p_subject_type, p_subject_id, coalesce(p_payload, '{}'::jsonb), app.current_user_id())
  returning id into v_id;

  return v_id;
end;
$$;

revoke all on function app.emit_event(uuid, app.governance_event_type, text, uuid, jsonb) from public;
grant execute on function app.emit_event(uuid, app.governance_event_type, text, uuid, jsonb)
  to authenticated, service_role;

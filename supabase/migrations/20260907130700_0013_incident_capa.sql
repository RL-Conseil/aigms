-- =============================================================================
-- AIGMS — 0013 — Incidents et CAPA
-- Vertical slice — Sprint 12
-- =============================================================================
-- Workflow : OPEN -> CONTAINED -> INVESTIGATING -> ACTION_PLAN
--            -> EFFECTIVENESS_REVIEW -> CLOSED
-- Une CAPA est obligatoire pour un incident significatif (S1/S2), une
-- non-conformité majeure ou une récurrence.
-- =============================================================================

create type app.incident_severity as enum ('S1', 'S2', 'S3', 'S4');

create type app.incident_status as enum (
  'OPEN', 'CONTAINED', 'INVESTIGATING', 'ACTION_PLAN', 'EFFECTIVENESS_REVIEW', 'CLOSED'
);

create type app.incident_kind as enum ('incident', 'non_conformity', 'observation', 'near_miss');

create type app.capa_status as enum ('draft', 'in_progress', 'implemented', 'effectiveness_tested', 'closed', 'ineffective');

create table public.incident (
  id                 uuid primary key default gen_random_uuid(),
  tenant_id          uuid not null references public.tenant (id) on delete cascade,
  organization_id    uuid not null references public.organization (id) on delete cascade,
  use_case_id        uuid references public.ai_use_case (id) on delete set null,
  business_ref       text not null,

  title              text not null check (btrim(title) <> ''),
  description        text not null check (btrim(description) <> ''),
  kind               app.incident_kind not null default 'incident',
  severity           app.incident_severity not null,
  status             app.incident_status not null default 'OPEN',

  detected_at        timestamptz not null default now(),
  reported_by        uuid references public.user_profile (id) on delete set null,
  owner_user_id      uuid references public.user_profile (id) on delete set null,

  containment_action text,
  contained_at       timestamptz,
  root_cause         text,
  is_recurrence      boolean not null default false,

  -- Remise en service : décision explicite, jamais implicite.
  return_to_service_decision_id uuid references public.governance_decision (id) on delete set null,
  closed_at          timestamptz,
  closure_note       text,

  created_at         timestamptz not null default now(),
  updated_at         timestamptz not null default now(),

  unique (tenant_id, business_ref),
  check (status <> 'CLOSED' or (closed_at is not null and btrim(coalesce(root_cause, '')) <> '')),
  check (status not in ('CONTAINED', 'INVESTIGATING', 'ACTION_PLAN', 'EFFECTIVENESS_REVIEW', 'CLOSED')
         or contained_at is not null)
);

comment on table public.incident is
  'Incident, non-conformité ou observation. La clôture exige une cause racine documentée.';

create index incident_org_status_idx on public.incident (organization_id, status, severity);

create trigger incident_touch_updated_at before update on public.incident
  for each row execute function app.touch_updated_at();
create trigger incident_assert_tenant before insert or update on public.incident
  for each row execute function app.assert_tenant_consistency();

create or replace function app.set_incident_business_ref()
returns trigger language plpgsql security definer
set search_path = app, public, pg_catalog as $$
begin
  if new.business_ref is null or btrim(new.business_ref) = '' then
    new.business_ref := app.next_business_ref(new.tenant_id, 'INC');
  end if;
  return new;
end; $$;

create trigger incident_set_business_ref before insert on public.incident
  for each row execute function app.set_incident_business_ref();

-- -----------------------------------------------------------------------------
-- capa
-- -----------------------------------------------------------------------------
create table public.capa (
  id                    uuid primary key default gen_random_uuid(),
  tenant_id             uuid not null references public.tenant (id) on delete cascade,
  incident_id           uuid not null references public.incident (id) on delete cascade,
  business_ref          text not null,

  correction            text not null check (btrim(correction) <> ''),
  cause_analysis        text not null check (btrim(cause_analysis) <> ''),
  corrective_action     text not null check (btrim(corrective_action) <> ''),
  preventive_action     text,

  owner_user_id         uuid references public.user_profile (id) on delete set null,
  due_date              date,
  status                app.capa_status not null default 'draft',

  effectiveness_test    text,
  effectiveness_tested_at timestamptz,
  effectiveness_result  text,
  effectiveness_verified_by uuid references public.user_profile (id) on delete set null,

  closed_at             timestamptz,
  created_at            timestamptz not null default now(),
  updated_at            timestamptz not null default now(),

  unique (tenant_id, business_ref),
  -- Une CAPA ne se clôt pas sans test d'efficacité vérifié par un humain.
  constraint capa_closure_requires_effectiveness check (
    status <> 'closed'
    or (btrim(coalesce(effectiveness_test, '')) <> ''
        and effectiveness_tested_at is not null
        and btrim(coalesce(effectiveness_result, '')) <> ''
        and effectiveness_verified_by is not null
        and closed_at is not null)
  )
);

comment on table public.capa is
  'Correction, analyse de cause, action corrective, action préventive et test d''efficacité. La clôture exige une vérification humaine.';

create index capa_incident_idx on public.capa (incident_id, status);

create trigger capa_touch_updated_at before update on public.capa
  for each row execute function app.touch_updated_at();

create or replace function app.set_capa_business_ref()
returns trigger language plpgsql security definer
set search_path = app, public, pg_catalog as $$
begin
  if new.business_ref is null or btrim(new.business_ref) = '' then
    new.business_ref := app.next_business_ref(new.tenant_id, 'CAPA');
  end if;
  return new;
end; $$;

create trigger capa_set_business_ref before insert on public.capa
  for each row execute function app.set_capa_business_ref();

-- Un incident significatif ou récurrent ne se clôt pas sans CAPA close.
create or replace function app.guard_incident_closure()
returns trigger
language plpgsql
security definer
set search_path = app, public, pg_catalog
as $$
begin
  if new.status = 'CLOSED' and old.status <> 'CLOSED' then
    if (new.severity in ('S1', 'S2') or new.kind = 'non_conformity' or new.is_recurrence)
       and not exists (
         select 1 from public.capa c
         where c.incident_id = new.id and c.status = 'closed'
       ) then
      raise exception 'Incident % : une CAPA close est requise (sévérité %, non-conformité ou récurrence).',
        new.business_ref, new.severity
        using errcode = 'check_violation';
    end if;

    perform app.emit_event(new.tenant_id, 'CAPAClosed', 'incident', new.id,
      jsonb_build_object('severity', new.severity, 'kind', new.kind));
  end if;

  if new.status <> old.status and new.status = 'OPEN' then
    perform app.emit_event(new.tenant_id, 'IncidentOpened', 'incident', new.id, '{}'::jsonb);
  end if;

  return new;
end;
$$;

comment on function app.guard_incident_closure is
  'Interdit la clôture d''un incident significatif, d''une non-conformité ou d''une récurrence sans CAPA close.';

create trigger incident_guard_closure
  before update on public.incident
  for each row execute function app.guard_incident_closure();

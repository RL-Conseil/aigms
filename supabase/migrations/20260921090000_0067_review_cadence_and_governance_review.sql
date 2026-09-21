-- =============================================================================
-- AIGMS — 0067 — La cadence attendue, et la revue de gouvernance
-- =============================================================================
-- L'auditeur évalue la pertinence du calendrier de revue au regard du profil
-- de risque : criticité des systèmes, rôle de l'organisation vis-à-vis de
-- l'IA, taille de la structure (04_References/frequence_controles.png).
-- AIGMS connaissait les trois entrées et n'en déduisait rien.
--
--   1. `review_cadence(organisation)` — la classe (1 haute, 2 modérée,
--      3 faible) et la cadence attendue : traitement du registre, suivi des
--      incidents, comité de gouvernance, revue de direction.
--   2. La REVUE DE GOUVERNANCE (workflow E du kit, ISO/IEC 42001 § 9.3) :
--      planifiée à la cadence, avec un ordre du jour généré — décisions de la
--      période, CAPA ouvertes, risques élevés, changements, revues échues —,
--      des présents, un compte rendu, les décisions prises, la prochaine date.
--      Tenue, elle dépose sa preuve d'elle-même : le compte rendu, daté,
--      nominatif, à valider.
-- =============================================================================

-- -----------------------------------------------------------------------------
-- 1. La cadence attendue
-- -----------------------------------------------------------------------------
create type app.review_frequency as enum ('continuous', 'monthly', 'quarterly', 'semiannual', 'annual');

create or replace function app.review_cadence(p_organization_id uuid)
returns jsonb
language plpgsql
stable
security definer
set search_path = app, public, pg_catalog
as $$
declare
  v_org public.organization%rowtype;
  v_max_crit text;
  v_high_risk boolean;
  v_size text;
  v_class integer;
  v_register app.review_frequency;
  v_incidents app.review_frequency;
  v_committee app.review_frequency;
  v_direction app.review_frequency;
  v_reasons text[] := '{}';
begin
  select * into v_org from public.organization where id = p_organization_id;
  if v_org.id is null or not app.has_tenant_access(v_org.tenant_id) then return null; end if;

  -- La criticité la plus haute des usages qui ne sont ni retirés ni refusés.
  select coalesce(max(case u.criticality when 'critical' then 4 when 'high' then 3 when 'moderate' then 2 when 'low' then 1 end), 0)
    into v_max_crit from public.ai_use_case u
   where u.organization_id = p_organization_id and u.status not in ('RETIRED', 'REJECTED');
  select exists (
    select 1 from public.regulatory_classification c join public.ai_use_case u on u.id = c.use_case_id
     where u.organization_id = p_organization_id and c.is_current
       and ('high_risk_potential' = any (c.flags) or 'prohibited_practice_suspected' = any (c.flags))
  ) into v_high_risk;
  v_size := case
    when v_org.headcount is null then 'inconnue'
    when v_org.headcount >= 5000 then 'grande entreprise'
    when v_org.headcount >= 250 then 'ETI'
    when v_org.headcount >= 10 then 'PME'
    else 'TPE' end;

  -- La classe : la criticité et le haut risque priment, puis le rôle.
  if v_max_crit::integer >= 3 or v_high_risk then
    v_class := 1;
    v_reasons := v_reasons || case when v_high_risk then 'un cas d''usage qualifié à haut risque potentiel' else 'un cas d''usage de criticité élevée ou critique' end;
  elsif v_max_crit::integer = 2 or v_org.ai_activity_profile in ('model_developer', 'integrator_consultant', 'infrastructure_host') then
    v_class := 2;
    v_reasons := v_reasons || case when v_max_crit::integer = 2 then 'un cas d''usage de criticité modérée' else 'un rôle de fournisseur, d''intégrateur ou d''hébergeur' end;
  else
    v_class := 3;
    v_reasons := v_reasons || 'des usages de faible criticité, en simple utilisateur';
  end if;

  -- La cadence, par classe ; la taille tempère la classe 1.
  if v_class = 1 then
    v_register := case when v_size in ('grande entreprise', 'ETI') then 'monthly' else 'quarterly' end;
    v_incidents := 'monthly';
    v_committee := 'quarterly';
    v_direction := 'annual';
  elsif v_class = 2 then
    v_register := 'quarterly';
    v_incidents := 'quarterly';
    v_committee := 'semiannual';
    v_direction := 'annual';
  else
    v_register := 'annual';
    v_incidents := 'annual';
    v_committee := 'annual';
    v_direction := 'annual';
  end if;

  return jsonb_build_object(
    'class', v_class,
    'class_label', case v_class when 1 then 'Criticité élevée / systèmes à haut risque'
                                when 2 then 'Criticité modérée / fournisseur ou intégrateur'
                                else 'Criticité faible / simple utilisateur' end,
    'size', v_size,
    'profile', v_org.ai_activity_profile,
    'max_criticality', case v_max_crit::integer when 4 then 'critical' when 3 then 'high' when 2 then 'moderate' when 1 then 'low' else null end,
    'high_risk', v_high_risk,
    'reasons', to_jsonb(v_reasons),
    'register', v_register, 'incidents', v_incidents, 'committee', v_committee, 'direction', v_direction
  );
end;
$$;

create or replace function public.review_cadence(p_organization_id uuid)
returns jsonb language sql stable security invoker
set search_path = app, public, pg_catalog
as $$ select app.review_cadence(p_organization_id); $$;

grant execute on function public.review_cadence(uuid) to authenticated;

-- Le nombre de mois d'une cadence, pour proposer la prochaine date.
create or replace function app.frequency_months(p app.review_frequency)
returns integer language sql immutable as $$
  select case p when 'continuous' then 1 when 'monthly' then 1 when 'quarterly' then 3 when 'semiannual' then 6 else 12 end;
$$;

-- -----------------------------------------------------------------------------
-- 2. La revue de gouvernance
-- -----------------------------------------------------------------------------
create type app.review_kind as enum ('committee', 'direction');
create type app.review_status as enum ('planned', 'held', 'cancelled');

create table public.governance_review (
  id               uuid primary key default gen_random_uuid(),
  tenant_id        uuid not null references public.tenant (id) on delete cascade,
  organization_id  uuid not null references public.organization (id) on delete cascade,
  business_ref     text not null,
  kind             app.review_kind not null default 'committee',
  scheduled_on     date not null,
  held_at          timestamptz,
  status           app.review_status not null default 'planned',
  chaired_by       uuid references public.user_profile (id) on delete set null,
  attendees        text[],
  period_from      date,
  agenda           jsonb not null default '{}'::jsonb,
  minutes          text,
  decisions_taken  text,
  next_review_on   date,
  evidence_id      uuid references public.evidence (id) on delete set null,
  created_by       uuid references public.user_profile (id) on delete set null,
  created_at       timestamptz not null default now(),
  updated_at       timestamptz not null default now(),
  unique (tenant_id, business_ref),
  check (status <> 'held' or (held_at is not null and btrim(coalesce(minutes, '')) <> ''))
);

comment on table public.governance_review is
  'Revue de gouvernance de l''IA (comité, ou revue de direction § 9.3). Planifiée à la cadence attendue ; tenue, elle porte présents, compte rendu, décisions prises, et dépose sa preuve.';

create index governance_review_org_idx on public.governance_review (organization_id, status, scheduled_on);

create trigger governance_review_touch_updated_at before update on public.governance_review
  for each row execute function app.touch_updated_at();
create trigger governance_review_assert_tenant before insert or update on public.governance_review
  for each row execute function app.assert_tenant_consistency();

create or replace function app.set_review_business_ref()
returns trigger language plpgsql security definer
set search_path = app, public, pg_catalog as $$
begin
  if new.business_ref is null or btrim(new.business_ref) = '' then
    new.business_ref := app.next_business_ref(new.tenant_id, 'REV');
  end if;
  if new.created_by is null then new.created_by := app.current_user_id(); end if;
  return new;
end; $$;

create trigger governance_review_set_business_ref before insert on public.governance_review
  for each row execute function app.set_review_business_ref();

alter table public.governance_review enable row level security;
alter table public.governance_review force  row level security;

create policy governance_review_select on public.governance_review
  for select to authenticated using (app.has_tenant_access(tenant_id));
create policy governance_review_write on public.governance_review
  for all to authenticated
  using (app.has_tenant_role(tenant_id, app.roles_write_governance()))
  with check (app.has_tenant_role(tenant_id, app.roles_write_governance()));

grant select, insert, update, delete on public.governance_review to authenticated;
revoke all on public.governance_review from anon;

create trigger governance_review_audit after insert or update or delete on public.governance_review
  for each row execute function app.audit_business();

-- L'ordre du jour : ce qui s'est passé depuis la dernière revue, et ce qui
-- attend. Généré à la planification, rafraîchi à la tenue.
create or replace function app.review_agenda(p_organization_id uuid, p_since date)
returns jsonb
language sql
stable
security definer
set search_path = app, public, pg_catalog
as $$
  select jsonb_build_object(
    'since', p_since,
    'decisions', coalesce((
      select jsonb_agg(jsonb_build_object('business_ref', d.business_ref, 'subject', d.subject, 'type', d.decision_type,
                                          'status', d.status, 'at', coalesce(d.approved_at, d.submitted_at, d.created_at)) order by coalesce(d.approved_at, d.submitted_at, d.created_at) desc)
      from public.governance_decision d
      where d.organization_id = p_organization_id and coalesce(d.approved_at, d.submitted_at, d.created_at) >= p_since), '[]'::jsonb),
    'pending_decisions', (select count(*) from public.governance_decision d where d.organization_id = p_organization_id and d.status in ('draft', 'submitted')),
    'open_capa', coalesce((
      select jsonb_agg(jsonb_build_object('business_ref', c.business_ref, 'incident', i.business_ref, 'title', i.title,
                                          'corrective_action', c.corrective_action, 'due_date', c.due_date, 'status', c.status) order by c.due_date nulls last)
      from public.capa c join public.incident i on i.id = c.incident_id
      where i.organization_id = p_organization_id and c.status not in ('closed')), '[]'::jsonb),
    'open_incidents', (select count(*) from public.incident i where i.organization_id = p_organization_id and i.status <> 'CLOSED'),
    'incidents_since', (select count(*) from public.incident i where i.organization_id = p_organization_id and i.detected_at >= p_since),
    'high_open_risks', coalesce((
      select jsonb_agg(jsonb_build_object('business_ref', r.business_ref, 'title', r.title, 'level', coalesce(r.residual_level, r.inherent_level),
                                          'status', r.status, 'use_case', u.name) order by coalesce(r.residual_level, r.inherent_level) desc)
      from public.risk r join public.ai_use_case u on u.id = r.use_case_id
      where r.organization_id = p_organization_id
        and coalesce(r.residual_level, r.inherent_level) in ('high', 'critical') and not app.risk_is_settled(r)), '[]'::jsonb),
    'changes', coalesce((
      select jsonb_agg(jsonb_build_object('business_ref', c.business_ref, 'title', c.title, 'status', c.status,
                                          'verdict', (select coalesce(r.final_verdict, r.engine_verdict)::text from public.reassessment r where r.change_request_id = c.id order by r.created_at desc limit 1)) order by c.created_at desc)
      from public.change_request c where c.organization_id = p_organization_id and c.created_at >= p_since), '[]'::jsonb),
    'reviews_due', coalesce((
      select jsonb_agg(jsonb_build_object('business_ref', u.business_ref, 'name', u.name, 'next_review_at', u.next_review_at) order by u.next_review_at)
      from public.ai_use_case u where u.organization_id = p_organization_id and u.next_review_at is not null and u.next_review_at < current_date
        and u.status not in ('RETIRED', 'REJECTED')), '[]'::jsonb),
    'overdue_actions', (select count(*) from public.action a where a.organization_id = p_organization_id
                          and a.status not in ('done', 'cancelled') and a.due_date is not null and a.due_date < current_date),
    'stale_evidence', (select count(*) from public.evidence e where e.organization_id = p_organization_id
                         and e.validation_status = 'validated' and app.evidence_freshness(e.valid_until) in ('expired', 'expiring')),
    'vendors_due', coalesce((
      select jsonb_agg(jsonb_build_object('name', v.name, 'review_status', v.review_status, 'next_review_at', v.next_review_at) order by v.next_review_at)
      from public.vendor v where v.organization_id = p_organization_id
        and (v.review_status in ('not_started', 'in_progress', 'expired') or (v.next_review_at is not null and v.next_review_at < current_date))), '[]'::jsonb),
    'cadence', app.review_cadence(p_organization_id)
  );
$$;

create or replace function public.review_agenda(p_organization_id uuid, p_since date)
returns jsonb language sql stable security invoker
set search_path = app, public, pg_catalog
as $$ select app.review_agenda(p_organization_id, p_since); $$;

grant execute on function public.review_agenda(uuid, date) to authenticated;

-- Planifiée : l'ordre du jour se pose ; tenue : il se rafraîchit, la preuve se
-- dépose, la prochaine date se propose à la cadence. Les présents attendus
-- sont avertis, et rappelés le jour même.
create or replace function app.on_governance_review()
returns trigger
language plpgsql
security definer
set search_path = app, public, pg_catalog
as $$
declare
  v_since date;
  v_cadence jsonb;
  v_freq app.review_frequency;
  v_evidence uuid;
  v_org public.organization%rowtype;
  r record;
begin
  select * into v_org from public.organization where id = new.organization_id;
  if new.period_from is null then
    select coalesce(max(g.held_at)::date, new.scheduled_on - interval '3 months')
      into v_since from public.governance_review g
     where g.organization_id = new.organization_id and g.status = 'held' and g.id <> new.id;
    new.period_from := v_since;
  end if;
  if tg_op = 'INSERT' or (new.status = 'held' and old.status is distinct from 'held') then
    new.agenda := app.review_agenda(new.organization_id, new.period_from);
  end if;

  if new.status = 'held' and (tg_op = 'INSERT' or old.status is distinct from 'held') then
    if new.held_at is null then new.held_at := now(); end if;
    v_cadence := new.agenda -> 'cadence';
    v_freq := coalesce((v_cadence ->> (case new.kind when 'direction' then 'direction' else 'committee' end))::app.review_frequency, 'quarterly');
    if new.next_review_on is null then
      new.next_review_on := new.held_at::date + (app.frequency_months(v_freq) || ' months')::interval;
    end if;
    -- Le compte rendu est la preuve : déposé, nominatif, à valider.
    if new.evidence_id is null then
      insert into public.evidence (tenant_id, organization_id, title, evidence_type, source, owner_user_id, validation_status, valid_until)
      values (new.tenant_id, new.organization_id,
              format('Compte rendu — %s du %s', case new.kind when 'direction' then 'revue de direction' else 'comité de gouvernance de l''IA' end, app.fr_date(new.held_at::date)),
              'declarative', format('Revue de gouvernance %s (AIGMS)', new.business_ref),
              coalesce(new.chaired_by, app.current_user_id()), 'pending',
              new.held_at::date + (app.frequency_months(v_freq) || ' months')::interval)
      returning id into v_evidence;
      new.evidence_id := v_evidence;
    end if;
  end if;
  return new;
end;
$$;

create trigger governance_review_before before insert or update of status on public.governance_review
  for each row execute function app.on_governance_review();

-- Alertes : à la planification, aux personnes qui siègent (Comité de
-- direction, AI Governance Officer, président) ; rappel le jour même.
create or replace function app.notify_governance_review()
returns trigger
language plpgsql
security definer
set search_path = app, public, pg_catalog
as $$
declare
  v_org public.organization%rowtype;
  r record;
  v_label text;
begin
  select * into v_org from public.organization where id = new.organization_id;
  v_label := case new.kind when 'direction' then 'Revue de direction' else 'Comité de gouvernance de l''IA' end;
  if new.status = 'cancelled' then
    perform app.drop_pending_notifications(new.id, array['oversight_review', 'oversight_review_due']::app.notification_kind[]);
    return new;
  end if;
  if new.status = 'planned' and (tg_op = 'INSERT' or new.scheduled_on is distinct from old.scheduled_on) then
    for r in
      select distinct m.user_id
      from public.membership m
      where m.tenant_id = new.tenant_id and m.status = 'active'
        and (m.role in ('governance_officer', 'client_admin', 'executive_viewer') or m.user_id = new.chaired_by)
    loop
      perform app.notify(new.tenant_id, new.organization_id, r.user_id, 'oversight_review',
        format('%s planifié le %s — %s', v_label, app.fr_date(new.scheduled_on), v_org.name),
        format('%s. L''ordre du jour est prêt : décisions de la période, CAPA ouvertes, risques élevés, changements, revues échues.', new.business_ref),
        format('/admin/organizations/%s/revues/%s', new.organization_id, new.id), 'governance_review', new.id);
      perform app.notify(new.tenant_id, new.organization_id, r.user_id, 'oversight_review_due',
        format('%s aujourd''hui — %s', v_label, v_org.name),
        format('%s. Tenir la revue, consigner présents, compte rendu et décisions : le compte rendu devient la preuve.', new.business_ref),
        format('/admin/organizations/%s/revues/%s', new.organization_id, new.id), 'governance_review', new.id,
        new.scheduled_on::timestamptz);
    end loop;
  end if;
  if new.status = 'held' then
    perform app.drop_pending_notifications(new.id, array['oversight_review_due']::app.notification_kind[]);
  end if;
  return new;
end;
$$;

create trigger governance_review_notify after insert or update of status, scheduled_on on public.governance_review
  for each row execute function app.notify_governance_review();

-- Le calendrier tenu, face au calendrier attendu.
create or replace function public.review_calendar(p_organization_id uuid)
returns jsonb
language sql
stable
security invoker
set search_path = app, public, pg_catalog
as $$
  select jsonb_build_object(
    'cadence', app.review_cadence(p_organization_id),
    'last_committee', (select max(held_at) from public.governance_review where organization_id = p_organization_id and kind = 'committee' and status = 'held'),
    'last_direction', (select max(held_at) from public.governance_review where organization_id = p_organization_id and kind = 'direction' and status = 'held'),
    'next_committee', (select min(scheduled_on) from public.governance_review where organization_id = p_organization_id and kind = 'committee' and status = 'planned'),
    'next_direction', (select min(scheduled_on) from public.governance_review where organization_id = p_organization_id and kind = 'direction' and status = 'planned'),
    'held_count', (select count(*) from public.governance_review where organization_id = p_organization_id and status = 'held')
  );
$$;

grant execute on function public.review_calendar(uuid) to authenticated;

do $$
begin
  if exists (select 1 from app.audit_coverage_gaps()) then
    raise exception 'Couverture d''audit incomplète : %', (select string_agg(table_name, ', ') from app.audit_coverage_gaps());
  end if;
end;
$$;

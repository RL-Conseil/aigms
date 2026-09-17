-- =============================================================================
-- AIGMS — 0053 — Alertes nominatives, et ce que la fiche d'un cas d'usage
--                 déclenche d'elle-même
-- =============================================================================
-- La fiche d'un cas d'usage devient un poste de travail : on y désigne un
-- responsable de risque, on y fixe une revue de surveillance, on y soumet une
-- décision, on y prévoit un changement. Chacun de ces actes engage QUELQU'UN à
-- une DATE — et jusqu'ici, personne n'en était averti.
--
-- 1. Une table `notification`, nominative : chacun ne lit que les siennes.
--    Une alerte porte une date de visibilité (`due_at`) : un rappel daté attend
--    son jour, sans planificateur — il apparaît quand la date est là.
--    Les alertes ne sont pas des faits de gouvernance : elles ne sont pas
--    journalisées (le journal trace l'acte qui les produit, pas l'avis).
--
-- 2. Des déclencheurs, en base, pour que le chemin d'écriture n'importe pas :
--      * risque       → son responsable est averti qu'il l'est ;
--      * action       → son responsable est averti, et rappelé à l'échéance ;
--      * supervision  → le responsable est averti de la date de revue, et
--                       rappelé ce jour-là ;
--      * décision     → la personne qui a soumis est avertie, celle qui est
--                       appelée à statuer aussi ; rappel à la date d'effet ;
--      * changement   → la personne qui l'a demandé est avertie, et rappelée
--                       à la date prévue ;
--      * évaluation d'impact achevée → une ACTION s'ouvre pour déposer la
--                       preuve de l'évaluation (et l'AIPD si elle est due).
--
-- 3. La répartition des risques se lit aussi par activité, pas seulement par
--    processus : `risk_heatmap_by_activity`.
-- =============================================================================

-- -----------------------------------------------------------------------------
-- 1. Notifications
-- -----------------------------------------------------------------------------
create type app.notification_kind as enum (
  'risk_owner',            -- vous êtes responsable de ce risque
  'action_owner',          -- une action vous est confiée
  'action_due',            -- son échéance est là
  'oversight_review',      -- la revue de surveillance est fixée
  'oversight_review_due',  -- elle est due aujourd'hui
  'decision_submitted',    -- votre décision est soumise
  'decision_to_approve',   -- vous êtes appelé à statuer
  'decision_effective',    -- date d'effet atteinte
  'change_planned',        -- le changement est enregistré
  'change_due',            -- sa date prévue est là
  'impact_completed'       -- l'évaluation est achevée, la preuve est à déposer
);

create table public.notification (
  id                uuid primary key default gen_random_uuid(),
  tenant_id         uuid not null references public.tenant (id) on delete cascade,
  organization_id   uuid references public.organization (id) on delete cascade,
  recipient_user_id uuid not null references public.user_profile (id) on delete cascade,
  kind              app.notification_kind not null,
  title             text not null check (btrim(title) <> ''),
  body              text,
  href              text,
  entity_type       text,
  entity_id         uuid,
  -- Visible à partir de : un rappel daté attend son jour.
  due_at            timestamptz not null default now(),
  created_at        timestamptz not null default now(),
  read_at           timestamptz
);

comment on table public.notification is
  'Alerte nominative. `due_at` est la date à partir de laquelle elle se montre : un rappel daté attend son jour. Non journalisée : le journal trace l''acte, pas l''avis.';

create index notification_recipient_idx
  on public.notification (recipient_user_id, due_at desc)
  where read_at is null;
create index notification_entity_idx on public.notification (entity_id) where entity_id is not null;

alter table public.notification enable row level security;
alter table public.notification force  row level security;

-- Chacun ne lit que les siennes ; il ne peut que les marquer lues.
create policy notification_select on public.notification
  for select to authenticated
  using (recipient_user_id = app.current_user_id());

create policy notification_update on public.notification
  for update to authenticated
  using (recipient_user_id = app.current_user_id())
  with check (recipient_user_id = app.current_user_id());

grant select, update (read_at) on public.notification to authenticated;

-- Une alerte ne se réécrit pas : seule sa lecture se marque.
create or replace function app.guard_notification_update()
returns trigger
language plpgsql
set search_path = app, public, pg_catalog
as $$
begin
  if new.title is distinct from old.title or new.body is distinct from old.body
     or new.href is distinct from old.href or new.kind is distinct from old.kind
     or new.recipient_user_id is distinct from old.recipient_user_id
     or new.due_at is distinct from old.due_at or new.entity_id is distinct from old.entity_id then
    raise exception 'Une alerte ne se modifie pas : elle se marque lue.' using errcode = 'check_violation';
  end if;
  return new;
end;
$$;

create trigger notification_guard_update before update on public.notification
  for each row execute function app.guard_notification_update();

-- Les alertes ne sont pas un fait de gouvernance : hors du périmètre d'audit.
create or replace function app.audit_coverage_gaps()
returns table (table_name text)
language sql
stable
security definer
set search_path = app, public, pg_catalog
as $$
  select c.relname::text
  from pg_class c
  join pg_namespace n on n.oid = c.relnamespace
  where n.nspname = 'public'
    and c.relkind = 'r'
    and (
      exists (
        select 1 from information_schema.columns col
        where col.table_schema = 'public' and col.table_name = c.relname
          and col.column_name = 'tenant_id'
      )
      or c.relname in ('tenant', 'user_profile', 'catalog_version')
    )
    and c.relname not in ('audit_log', 'governance_event', 'connector_sync_run', 'notification')
    and not exists (
      select 1 from pg_trigger t
      where t.tgrelid = c.oid
        and not t.tgisinternal
        and t.tgname like '%\_audit'
    );
$$;

-- Émettre une alerte. Une alerte non lue de même nature sur la même pièce est
-- remplacée : re-enregistrer un plan ne doit pas empiler les rappels.
create or replace function app.notify(
  p_tenant_id uuid, p_organization_id uuid, p_recipient uuid, p_kind app.notification_kind,
  p_title text, p_body text, p_href text, p_entity_type text, p_entity_id uuid,
  p_due_at timestamptz default now()
)
returns void
language plpgsql
security definer
set search_path = app, public, pg_catalog
as $$
begin
  if p_recipient is null then return; end if;
  delete from public.notification
   where recipient_user_id = p_recipient and kind = p_kind
     and entity_id is not distinct from p_entity_id and read_at is null;
  insert into public.notification (
    tenant_id, organization_id, recipient_user_id, kind, title, body, href,
    entity_type, entity_id, due_at
  ) values (
    p_tenant_id, p_organization_id, p_recipient, p_kind, p_title, p_body, p_href,
    p_entity_type, p_entity_id, coalesce(p_due_at, now())
  );
end;
$$;

-- Les rappels non lus attachés à une pièce close n'ont plus lieu d'être.
create or replace function app.drop_pending_notifications(p_entity_id uuid, p_kinds app.notification_kind[])
returns void
language sql
security definer
set search_path = app, public, pg_catalog
as $$
  delete from public.notification
   where entity_id = p_entity_id and kind = any (p_kinds) and read_at is null;
$$;

create or replace function app.person_name(p_user_id uuid)
returns text
language sql stable
set search_path = app, public, pg_catalog
as $$
  select coalesce(nullif(u.full_name, ''), u.email) from public.user_profile u where u.id = p_user_id;
$$;

create or replace function app.fr_date(p_date date)
returns text
language sql immutable
as $$ select to_char(p_date, 'DD/MM/YYYY'); $$;

-- -----------------------------------------------------------------------------
-- 2a. Risque : son responsable en est averti
-- -----------------------------------------------------------------------------
create or replace function app.notify_risk_owner()
returns trigger
language plpgsql
security definer
set search_path = app, public, pg_catalog
as $$
declare
  v_uc public.ai_use_case%rowtype;
begin
  if new.owner_user_id is null then return new; end if;
  if tg_op = 'UPDATE' and new.owner_user_id is not distinct from old.owner_user_id then return new; end if;
  select * into v_uc from public.ai_use_case where id = new.use_case_id;
  perform app.notify(
    new.tenant_id, new.organization_id, new.owner_user_id, 'risk_owner',
    format('Vous êtes responsable du risque %s', new.business_ref),
    format('« %s » — %s. Vous en portez le traitement ou l''acceptation.%s',
           new.title, coalesce(v_uc.name, 'cas d''usage'),
           case when new.next_review_at is not null
                then format(' Revue prévue le %s.', app.fr_date(new.next_review_at)) else '' end),
    format('/admin/use-cases/%s?onglet=risques', new.use_case_id),
    'risk', new.id
  );
  return new;
end;
$$;

create trigger risk_notify_owner after insert or update of owner_user_id on public.risk
  for each row execute function app.notify_risk_owner();

-- -----------------------------------------------------------------------------
-- 2b. Action : son responsable en est averti, et rappelé à l'échéance
-- -----------------------------------------------------------------------------
create or replace function app.notify_action_owner()
returns trigger
language plpgsql
security definer
set search_path = app, public, pg_catalog
as $$
declare
  v_href text;
begin
  v_href := case when new.use_case_id is not null
                 then format('/admin/use-cases/%s?onglet=actions', new.use_case_id)
                 else format('/admin/organizations/%s/suivi', new.organization_id) end;

  -- Close ou annulée : plus rien à rappeler.
  if new.status in ('done', 'cancelled') then
    perform app.drop_pending_notifications(new.id, array['action_owner', 'action_due']::app.notification_kind[]);
    return new;
  end if;

  if new.owner_user_id is null then return new; end if;

  if tg_op = 'INSERT' or new.owner_user_id is distinct from old.owner_user_id then
    perform app.notify(
      new.tenant_id, new.organization_id, new.owner_user_id, 'action_owner',
      format('Une action vous est confiée : %s', new.title),
      format('%s · %s%s', new.business_ref,
             case when new.due_date is null then 'sans échéance'
                  else format('échéance le %s', app.fr_date(new.due_date)) end,
             case when new.is_blocking then ' · bloque la mise en production' else '' end),
      v_href, 'action', new.id
    );
  end if;

  if new.due_date is not null
     and (tg_op = 'INSERT' or new.due_date is distinct from old.due_date
          or new.owner_user_id is distinct from old.owner_user_id) then
    perform app.notify(
      new.tenant_id, new.organization_id, new.owner_user_id, 'action_due',
      format('Échéance aujourd''hui : %s', new.title),
      format('%s · prévue le %s. Clore l''action, ou la replanifier en le disant.',
             new.business_ref, app.fr_date(new.due_date)),
      v_href, 'action', new.id, new.due_date::timestamptz
    );
  elsif new.due_date is null and tg_op = 'UPDATE' and old.due_date is not null then
    perform app.drop_pending_notifications(new.id, array['action_due']::app.notification_kind[]);
  end if;
  return new;
end;
$$;

create trigger action_notify_owner
  after insert or update of owner_user_id, due_date, status on public.action
  for each row execute function app.notify_action_owner();

-- -----------------------------------------------------------------------------
-- 2c. Supervision humaine : la revue de surveillance a une date, et quelqu'un
-- -----------------------------------------------------------------------------
create or replace function app.notify_oversight_review()
returns trigger
language plpgsql
security definer
set search_path = app, public, pg_catalog
as $$
declare
  v_uc public.ai_use_case%rowtype;
  v_recipient uuid;
begin
  select * into v_uc from public.ai_use_case where id = new.use_case_id;
  -- Le responsable de la supervision ; à défaut, celui du cas d'usage.
  v_recipient := coalesce(new.accountable_user_id, v_uc.owner_user_id, v_uc.accountable_user_id);
  if v_recipient is null then return new; end if;

  if new.next_review_at is null then
    perform app.drop_pending_notifications(new.id, array['oversight_review', 'oversight_review_due']::app.notification_kind[]);
    return new;
  end if;

  if tg_op = 'INSERT' or new.next_review_at is distinct from old.next_review_at
     or new.accountable_user_id is distinct from old.accountable_user_id then
    perform app.notify(
      new.tenant_id, new.organization_id, v_recipient, 'oversight_review',
      format('Revue de surveillance de « %s » fixée au %s', v_uc.name, app.fr_date(new.next_review_at)),
      format('Plan de supervision %s · cadence : %s. Vous en êtes responsable.',
             new.business_ref, rtrim(coalesce(new.monitoring_cadence, 'non précisée'), '. ')),
      format('/admin/use-cases/%s?onglet=supervision', new.use_case_id),
      'human_oversight_plan', new.id
    );
    perform app.notify(
      new.tenant_id, new.organization_id, v_recipient, 'oversight_review_due',
      format('Revue de surveillance due aujourd''hui : « %s »', v_uc.name),
      format('Plan %s. Conduire la revue et déposer la preuve attendue%s.',
             new.business_ref,
             case when new.expected_evidence is not null then format(' (%s)', rtrim(new.expected_evidence, '. ')) else '' end),
      format('/admin/use-cases/%s?onglet=supervision', new.use_case_id),
      'human_oversight_plan', new.id, new.next_review_at::timestamptz
    );
  end if;
  return new;
end;
$$;

create trigger oversight_notify_review
  after insert or update of next_review_at, accountable_user_id on public.human_oversight_plan
  for each row execute function app.notify_oversight_review();

-- -----------------------------------------------------------------------------
-- 2d. Décision : qui a soumis, qui doit statuer, et la date d'effet
-- -----------------------------------------------------------------------------
create or replace function app.notify_decision()
returns trigger
language plpgsql
security definer
set search_path = app, public, pg_catalog
as $$
declare
  v_href text;
  v_submitter uuid;
  v_approver_name text;
begin
  v_href := case when new.use_case_id is not null
                 then format('/admin/use-cases/%s?onglet=decisions', new.use_case_id)
                 else format('/admin/organizations/%s/decisions', new.organization_id) end;
  v_submitter := coalesce(new.submitted_by, app.current_user_id());
  v_approver_name := app.person_name(new.expected_approver_user_id);

  if new.status = 'submitted' and (tg_op = 'INSERT' or old.status is distinct from 'submitted') then
    perform app.notify(
      new.tenant_id, new.organization_id, v_submitter, 'decision_submitted',
      format('Décision %s soumise : %s', new.business_ref, new.subject),
      format('Elle attend %s.%s',
             case when v_approver_name is null then 'une approbation' else format('l''avis de %s', v_approver_name) end,
             case when new.effective_from is not null
                  then format(' Date d''effet prévue le %s : vous serez rappelé ce jour-là.', app.fr_date(new.effective_from)) else '' end),
      v_href, 'governance_decision', new.id
    );
    if new.expected_approver_user_id is not null then
      perform app.notify(
        new.tenant_id, new.organization_id, new.expected_approver_user_id, 'decision_to_approve',
        format('Vous êtes appelé à statuer : %s', new.subject),
        format('Décision %s, soumise par %s.', new.business_ref, coalesce(app.person_name(v_submitter), 'un membre')),
        v_href, 'governance_decision', new.id
      );
    end if;
  end if;

  -- Rappel à la date d'effet, pour la personne qui a soumis : vérifier que la
  -- décision est actée, et déposer la preuve qui en découle. Le rappel se
  -- réécrit quand la décision est approuvée : son texte n'est plus le même.
  if new.effective_from is not null
     and new.status not in ('rejected', 'revoked', 'superseded')
     and (tg_op = 'INSERT' or new.effective_from is distinct from old.effective_from
          or (new.status in ('approved', 'approved_with_conditions') and old.status is distinct from new.status)) then
    perform app.notify(
      new.tenant_id, new.organization_id, v_submitter, 'decision_effective',
      format('Date d''effet atteinte : %s', new.subject),
      case when new.status in ('approved', 'approved_with_conditions')
           then format('Décision %s, approuvée%s. Déposer la preuve qui en découle.',
                       new.business_ref,
                       case when new.status = 'approved_with_conditions' then ' sous conditions' else '' end)
           else format('Décision %s. Vérifier que %s a statué, puis déposer la preuve qui en découle.',
                       new.business_ref, coalesce(v_approver_name, 'la personne appelée à statuer')) end,
      v_href, 'governance_decision', new.id, new.effective_from::timestamptz
    );
  end if;

  if new.status in ('rejected', 'revoked', 'superseded') then
    perform app.drop_pending_notifications(new.id, array['decision_to_approve', 'decision_effective']::app.notification_kind[]);
  elsif new.status in ('approved', 'approved_with_conditions') and tg_op = 'UPDATE' and old.status is distinct from new.status then
    perform app.drop_pending_notifications(new.id, array['decision_to_approve']::app.notification_kind[]);
  end if;
  return new;
end;
$$;

create trigger decision_notify
  after insert or update of status, effective_from, expected_approver_user_id on public.governance_decision
  for each row execute function app.notify_decision();

-- -----------------------------------------------------------------------------
-- 2e. Changement : qui l'a demandé, et la date prévue
-- -----------------------------------------------------------------------------
create or replace function app.notify_change_request()
returns trigger
language plpgsql
security definer
set search_path = app, public, pg_catalog
as $$
declare
  v_requester uuid;
  v_href text;
begin
  v_requester := coalesce(new.requested_by, app.current_user_id());
  v_href := format('/admin/use-cases/%s?onglet=changements', new.use_case_id);

  if new.status in ('REJECTED', 'VERIFIED', 'CANCELLED') then
    perform app.drop_pending_notifications(new.id, array['change_due']::app.notification_kind[]);
    return new;
  end if;

  if tg_op = 'INSERT' then
    perform app.notify(
      new.tenant_id, new.organization_id, v_requester, 'change_planned',
      format('Changement %s enregistré : %s', new.business_ref, new.title),
      case when new.planned_at is null
           then 'Sans date prévue. La réévaluation dit ce qu''il rouvre.'
           else format('Prévu le %s : vous serez rappelé ce jour-là pour l''action qui le met en œuvre.', app.fr_date(new.planned_at)) end,
      v_href, 'change_request', new.id
    );
  end if;

  if new.planned_at is not null and (tg_op = 'INSERT' or new.planned_at is distinct from old.planned_at) then
    perform app.notify(
      new.tenant_id, new.organization_id, v_requester, 'change_due',
      format('Changement prévu aujourd''hui : %s', new.title),
      format('%s. L''action qui le met en œuvre est-elle ouverte et suivie ?', new.business_ref),
      v_href, 'change_request', new.id, new.planned_at::timestamptz
    );
  end if;
  return new;
end;
$$;

create trigger change_request_notify
  after insert or update of planned_at, status on public.change_request
  for each row execute function app.notify_change_request();

-- -----------------------------------------------------------------------------
-- 2f. Évaluation d'impact achevée : la preuve est à déposer — c'est une action
-- -----------------------------------------------------------------------------
-- Une évaluation achevée ne vaut que par la pièce qui l'atteste. Une action
-- s'ouvre, confiée à la personne qui l'a conduite, avec 30 jours ; le dépôt
-- de la preuve la clôt (voir le dépôt, qui accepte l'action à solder).
create or replace function app.open_impact_evidence_action()
returns trigger
language plpgsql
security definer
set search_path = app, public, pg_catalog
as $$
declare
  v_uc public.ai_use_case%rowtype;
  v_owner uuid;
begin
  if new.status <> 'completed' then return new; end if;
  if tg_op = 'UPDATE' and old.status = 'completed' then return new; end if;
  if app.action_already_open(new.use_case_id, 'impact_finding', new.id) then return new; end if;

  select * into v_uc from public.ai_use_case where id = new.use_case_id;
  v_owner := coalesce(new.performed_by, v_uc.owner_user_id, app.current_user_id());

  insert into public.action (
    tenant_id, organization_id, use_case_id, title, description, source, source_id,
    owner_user_id, due_date, is_blocking
  ) values (
    new.tenant_id, new.organization_id, new.use_case_id,
    case when new.dpia_required
         then format('Déposer l''évaluation d''impact %s et l''AIPD %s', new.business_ref, coalesce(new.dpia_reference, ''))
         else format('Déposer la preuve de l''évaluation d''impact %s', new.business_ref) end,
    format('L''évaluation d''impact de « %s » est achevée (%s). Le rapport qui l''atteste se dépose au registre des preuves%s.',
           v_uc.name, new.methodology,
           case when new.dpia_required then ', avec l''analyse d''impact relative à la protection des données' else '' end),
    'impact_finding', new.id, v_owner, current_date + 30, false
  );
  return new;
end;
$$;

create trigger impact_assessment_open_evidence_action
  after insert or update of status on public.impact_assessment
  for each row execute function app.open_impact_evidence_action();

-- -----------------------------------------------------------------------------
-- 3. Répartition des risques par activité
-- -----------------------------------------------------------------------------
create or replace function app.risk_heatmap_by_activity(p_organization_id uuid)
returns table (
  process_id     uuid,
  process_name   text,
  process_order  integer,
  activity_id    uuid,
  activity_name  text,
  activity_order integer,
  risk_level     app.risk_level,
  risk_count     integer,
  open_count     integer,
  accepted_count integer
)
language sql
stable
security definer
set search_path = app, public, pg_catalog
as $$
  with scope as (
    select o.id from public.organization o
    where o.id = p_organization_id and app.has_tenant_access(o.tenant_id)
  ),
  levels as (select unnest(enum_range(null::app.risk_level)) as level),
  risks as (
    select u.activity_id, coalesce(r.residual_level, r.inherent_level) as level, r.status
    from public.risk r
    join public.ai_use_case u on u.id = r.use_case_id
    join scope s on s.id = r.organization_id
    where u.activity_id is not null
  ),
  activities as (
    select a.id, a.name, a.display_order, p.id as process_id, p.name as process_name, p.display_order as process_order
    from public.activity a
    join public.process p on p.id = a.process_id
    join scope s on s.id = a.organization_id
  )
  select
    a.process_id, a.process_name, a.process_order, a.id, a.name, a.display_order, l.level,
    coalesce(count(risks.level), 0)::integer,
    coalesce(count(risks.level) filter (where risks.status not in ('accepted', 'mitigated', 'closed')), 0)::integer,
    coalesce(count(risks.level) filter (where risks.status = 'accepted'), 0)::integer
  from activities a
  cross join levels l
  left join risks on risks.activity_id = a.id and risks.level = l.level
  group by a.process_id, a.process_name, a.process_order, a.id, a.name, a.display_order, l.level
  order by a.process_order, a.display_order, array_position(enum_range(null::app.risk_level), l.level);
$$;

create or replace function public.risk_heatmap_by_activity(p_organization_id uuid)
returns table (
  process_id uuid, process_name text, process_order integer,
  activity_id uuid, activity_name text, activity_order integer,
  risk_level app.risk_level, risk_count integer, open_count integer, accepted_count integer
)
language sql stable security invoker
set search_path = app, public, pg_catalog
as $$ select * from app.risk_heatmap_by_activity(p_organization_id); $$;

revoke all on function public.risk_heatmap_by_activity(uuid) from public, anon;
grant execute on function public.risk_heatmap_by_activity(uuid) to authenticated;

-- -----------------------------------------------------------------------------
-- 4. Lecture des alertes : les siennes, dues, non lues d'abord
-- -----------------------------------------------------------------------------
create or replace function public.my_notifications(p_limit integer default 50)
returns table (
  id uuid, organization_id uuid, kind app.notification_kind, title text, body text, href text,
  entity_type text, entity_id uuid, due_at timestamptz, created_at timestamptz, read_at timestamptz
)
language sql stable security invoker
set search_path = app, public, pg_catalog
as $$
  select n.id, n.organization_id, n.kind, n.title, n.body, n.href, n.entity_type, n.entity_id,
         n.due_at, n.created_at, n.read_at
  from public.notification n
  where n.recipient_user_id = app.current_user_id() and n.due_at <= now()
  order by (n.read_at is null) desc, n.due_at desc
  limit greatest(1, least(p_limit, 200));
$$;

create or replace function public.my_unread_notifications()
returns integer
language sql stable security invoker
set search_path = app, public, pg_catalog
as $$
  select count(*)::integer from public.notification n
  where n.recipient_user_id = app.current_user_id() and n.due_at <= now() and n.read_at is null;
$$;

revoke all on function public.my_notifications(integer) from public, anon;
revoke all on function public.my_unread_notifications() from public, anon;
grant execute on function public.my_notifications(integer) to authenticated;
grant execute on function public.my_unread_notifications() to authenticated;

-- =============================================================================
-- AIGMS — 0063 — Décisions et changements se répondent
-- =============================================================================
-- Une DÉCISION est un acte de gouvernance : autorisation, production,
-- acceptation d'un risque, exception, changement significatif, suspension,
-- retrait. Un CHANGEMENT est un fait sur le système — modèle, données,
-- finalité, fournisseur, autonomie, population, territoire, sécurité,
-- déploiement — que le moteur de réévaluation lit. Les deux vivaient côte à
-- côte sans se parler.
--
--   1. CHANGEMENT ⇒ DÉCISION. Quand la réévaluation d'un changement conclut
--      « partielle » ou « complète », une décision « changement significatif »
--      s'ouvre d'elle-même — soumise par qui a demandé le changement, liée à
--      lui — et le changement ne peut pas être approuvé ni mis en œuvre tant
--      qu'elle n'est pas approuvée. Un changement sans réévaluation reste un
--      fait tracé.
--   2. DÉCISION ⇒ CHANGEMENT. Une décision de type changement significatif,
--      suspension ou retrait porte « ce qui change » : l'application crée le
--      changement lié à la soumission (voir submitDecision), et la
--      réévaluation tourne. Le lien existant, aucune seconde décision ne
--      s'ouvre : c'est le garde du point 1.
--   3. Une lecture unique — décisions et changements mêlés, dans l'ordre —
--      pour la fiche et pour le registre.
-- =============================================================================

-- La décision qui porte un changement, s'il y en a une.
create or replace function app.change_decision(p_change_request_id uuid)
returns public.governance_decision
language sql stable
set search_path = app, public, pg_catalog
as $$
  select d.* from public.decision_link l
  join public.governance_decision d on d.id = l.decision_id
  where l.target_type = 'change_request' and l.target_id = p_change_request_id
    and d.status not in ('rejected', 'revoked', 'superseded')
  order by d.created_at desc limit 1;
$$;

-- -----------------------------------------------------------------------------
-- 1. Changement ⇒ décision
-- -----------------------------------------------------------------------------
create or replace function app.open_change_decision()
returns trigger
language plpgsql
security definer
set search_path = app, public, pg_catalog
as $$
declare
  v_ch public.change_request%rowtype;
  v_verdict app.reassessment_verdict;
  v_decision uuid;
  v_submitter uuid;
begin
  v_verdict := coalesce(new.final_verdict, new.engine_verdict);
  if v_verdict = 'NO_REASSESSMENT' then return new; end if;
  select * into v_ch from public.change_request where id = new.change_request_id;
  if v_ch.id is null then return new; end if;
  -- Une décision porte déjà ce changement (celle qui l'a créé, ou une
  -- ouverture précédente) : on n'en ouvre pas une seconde.
  if (app.change_decision(v_ch.id)).id is not null then return new; end if;

  v_submitter := coalesce(v_ch.requested_by, app.current_user_id());
  insert into public.governance_decision (
    tenant_id, organization_id, use_case_id, decision_type, subject, context, decision_statement, rationale,
    status, submitted_by, submitted_at
  ) values (
    v_ch.tenant_id, v_ch.organization_id, v_ch.use_case_id, 'significant_change',
    format('Changement %s — %s', v_ch.business_ref, v_ch.title),
    v_ch.description,
    format('Le changement %s est mis en œuvre, sous réserve de la réévaluation %s (%s).',
           v_ch.business_ref,
           case v_verdict when 'FULL_REASSESSMENT' then 'complète' else 'partielle' end,
           coalesce(array_to_string(new.scope, ', '), 'périmètre à préciser')),
    format('La réévaluation conclut : %s. %s',
           case v_verdict when 'FULL_REASSESSMENT' then 'réévaluation complète' else 'réévaluation partielle' end,
           coalesce((select string_agg(x, ' ') from jsonb_array_elements_text(coalesce(new.engine_rationale, '[]'::jsonb)) x), '')),
    'submitted', v_submitter, now()
  ) returning id into v_decision;
  insert into public.decision_link (tenant_id, decision_id, target_type, target_id, note)
  values (v_ch.tenant_id, v_decision, 'change_request', v_ch.id, 'Le changement qui appelle cette décision.');
  return new;
end;
$$;

create trigger reassessment_open_decision after insert or update of final_verdict on public.reassessment
  for each row execute function app.open_change_decision();

-- Un changement qui appelle une décision ne s'approuve ni ne se met en œuvre
-- sans elle.
create or replace function app.guard_change_progress()
returns trigger
language plpgsql
security definer
set search_path = app, public, pg_catalog
as $$
declare
  v_needs boolean;
  v_decision public.governance_decision;
begin
  if app.current_user_id() is null then return new; end if;
  if new.status not in ('APPROVED', 'IMPLEMENTED', 'VERIFIED') or new.status is not distinct from old.status then
    return new;
  end if;
  select exists (select 1 from public.reassessment r where r.change_request_id = new.id
                  and coalesce(r.final_verdict, r.engine_verdict) <> 'NO_REASSESSMENT') into v_needs;
  if not v_needs then return new; end if;
  v_decision := app.change_decision(new.id);
  if v_decision.id is null or v_decision.status not in ('approved', 'approved_with_conditions') then
    raise exception 'Le changement % appelle une décision « changement significatif » approuvée avant d''être %.',
      new.business_ref, case new.status when 'APPROVED' then 'approuvé' when 'IMPLEMENTED' then 'mis en œuvre' else 'vérifié' end
      using errcode = 'check_violation';
  end if;
  return new;
end;
$$;

create trigger change_request_guard_progress before update of status on public.change_request
  for each row execute function app.guard_change_progress();

-- Une décision de changement approuvée fait avancer le changement, si rien
-- d'autre ne l'a fait : approuvé, prêt à être mis en œuvre.
create or replace function app.apply_change_decision()
returns trigger
language plpgsql
security definer
set search_path = app, public, pg_catalog
as $$
begin
  if new.status in ('approved', 'approved_with_conditions')
     and (tg_op = 'INSERT' or old.status not in ('approved', 'approved_with_conditions')) then
    update public.change_request c
       set status = 'APPROVED'
      from public.decision_link l
     where l.decision_id = new.id and l.target_type = 'change_request' and l.target_id = c.id
       and c.status in ('DRAFT', 'IMPACT_SCREENING', 'REVIEW');
  elsif new.status = 'rejected' and tg_op = 'UPDATE' and old.status is distinct from 'rejected' then
    update public.change_request c
       set status = 'REJECTED'
      from public.decision_link l
     where l.decision_id = new.id and l.target_type = 'change_request' and l.target_id = c.id
       and c.status in ('DRAFT', 'IMPACT_SCREENING', 'REVIEW');
  end if;
  return new;
end;
$$;

create trigger governance_decision_apply_change after insert or update of status on public.governance_decision
  for each row execute function app.apply_change_decision();

-- -----------------------------------------------------------------------------
-- 3. Une lecture unique : décisions et changements, dans l'ordre
-- -----------------------------------------------------------------------------
create or replace function public.decisions_and_changes(p_organization_id uuid, p_use_case_id uuid default null)
returns jsonb
language sql
stable
security invoker
set search_path = app, public, pg_catalog
as $$
  with decisions as (
    select d.id, 'decision'::text as kind, d.business_ref, d.decision_type::text as type, d.subject as title,
           d.decision_statement as body, d.conditions, d.status::text as status, d.use_case_id,
           coalesce(d.submitted_at, d.created_at) as at, d.approved_at, d.effective_from, d.review_due_at,
           (select coalesce(nullif(u.full_name, ''), u.email) from public.user_profile u where u.id = d.expected_approver_user_id) as expected_approver,
           (select coalesce(nullif(u.full_name, ''), u.email) from public.user_profile u where u.id = d.approver_user_id) as approver,
           (select l.target_id from public.decision_link l where l.decision_id = d.id and l.target_type = 'change_request' limit 1) as change_request_id,
           null::text as verdict, null::text[] as scope, null::date as planned_at, null::text[] as change_types
    from public.governance_decision d
    where d.organization_id = p_organization_id and (p_use_case_id is null or d.use_case_id = p_use_case_id)
  ),
  changes as (
    select c.id, 'change'::text as kind, c.business_ref, null::text as type, c.title, c.description as body,
           null::text as conditions, c.status::text as status, c.use_case_id, c.created_at as at,
           null::timestamptz as approved_at, null::date as effective_from, null::date as review_due_at,
           null::text as expected_approver, null::text as approver,
           null::uuid as change_request_id,
           (select coalesce(r.final_verdict, r.engine_verdict)::text from public.reassessment r
             where r.change_request_id = c.id order by r.created_at desc limit 1) as verdict,
           (select r.scope from public.reassessment r where r.change_request_id = c.id order by r.created_at desc limit 1) as scope,
           c.planned_at, c.change_types::text[]
    from public.change_request c
    where c.organization_id = p_organization_id and (p_use_case_id is null or c.use_case_id = p_use_case_id)
  ),
  merged as (select * from decisions union all select * from changes)
  select coalesce(jsonb_agg(jsonb_build_object(
    'id', m.id, 'kind', m.kind, 'business_ref', m.business_ref, 'type', m.type, 'title', m.title, 'body', m.body,
    'conditions', m.conditions, 'status', m.status, 'use_case_id', m.use_case_id,
    'use_case', (select u.name from public.ai_use_case u where u.id = m.use_case_id),
    'at', m.at, 'approved_at', m.approved_at, 'effective_from', m.effective_from, 'review_due_at', m.review_due_at,
    'expected_approver', m.expected_approver, 'approver', m.approver,
    'change_request_id', m.change_request_id,
    'decision', case when m.kind = 'change' then (select jsonb_build_object('id', d.id, 'business_ref', d.business_ref, 'status', d.status)
                                                  from public.governance_decision d
                                                  where d.id = (app.change_decision(m.id)).id) end,
    'verdict', m.verdict, 'scope', to_jsonb(m.scope), 'planned_at', m.planned_at, 'change_types', to_jsonb(m.change_types)
  ) order by m.at desc), '[]'::jsonb)
  from merged m;
$$;

grant execute on function public.decisions_and_changes(uuid, uuid) to authenticated;

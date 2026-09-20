-- =============================================================================
-- AIGMS — 0065 — Un jalon engageant est une décision
-- =============================================================================
-- Trois portes se recouvraient : « faire évoluer » franchissait Approuvé,
-- Pilote, Retiré sans décision ; « soumettre une décision » vivait dans le
-- registre, et il fallait ensuite refaire évoluer ; la suspension n'existait
-- pas comme statut.
--
--   1. SUSPENDU devient un jalon : depuis Pilote, Production, Surveillance ;
--      vers Production (reprise), Revue, Retiré.
--   2. Une décision approuvée FRANCHIT le jalon qu'elle porte : autorisation →
--      Approuvé (sous conditions → Approuvé sous conditions), pilote → Pilote,
--      production → Production, suspension → Suspendu, retrait → Retiré ; un
--      refus d'autorisation → Refusé. Tout de suite si la date d'effet est
--      passée, sinon à la date d'effet — appliquée par `apply_due_decisions`,
--      que la fiche appelle. Le gate reste le juge : s'il refuse, la décision
--      reste approuvée, la transition attend, et qui a soumis est averti.
--   3. Une décision de production s'appuie sur au moins une preuve validée ;
--      contexte et justification sont exigés (l'application le fait, la base
--      exige la preuve à l'approbation).
-- =============================================================================

alter table public.governance_decision
  add column if not exists applied_at timestamptz;

comment on column public.governance_decision.applied_at is
  'Quand la décision a franchi le jalon qu''elle porte (0064). NULL : rien à franchir, ou pas encore.';

-- -----------------------------------------------------------------------------
-- 1. Suspendu, dans les transitions
-- -----------------------------------------------------------------------------
create or replace function app.allowed_use_case_transitions(p_from app.use_case_status)
returns app.use_case_status[]
language sql
immutable
set search_path = pg_catalog
as $$
  select case p_from
    when 'DRAFT'                then array['TRIAGE', 'RETIRED']
    when 'TRIAGE'               then array['ASSESSMENT', 'DRAFT', 'RETIRED']
    when 'ASSESSMENT'           then array['REVIEW', 'TRIAGE', 'RETIRED']
    when 'REVIEW'               then array['APPROVED', 'CONDITIONAL_APPROVAL', 'REJECTED', 'ASSESSMENT']
    when 'APPROVED'             then array['PILOT', 'PRODUCTION', 'RETIRED']
    when 'CONDITIONAL_APPROVAL' then array['PILOT', 'RETIRED']
    when 'REJECTED'             then array['DRAFT', 'RETIRED']
    when 'PILOT'                then array['PRODUCTION', 'REVIEW', 'SUSPENDED', 'RETIRED']
    when 'PRODUCTION'           then array['MONITORING', 'REVIEW', 'SUSPENDED', 'RETIRED']
    when 'MONITORING'           then array['PRODUCTION', 'REVIEW', 'SUSPENDED', 'RETIRED']
    when 'SUSPENDED'            then array['PRODUCTION', 'REVIEW', 'RETIRED']
    when 'RETIRED'              then array[]::text[]
    else array[]::text[]
  end::app.use_case_status[];
$$;

-- -----------------------------------------------------------------------------
-- 2. Le jalon que porte une décision
-- -----------------------------------------------------------------------------
create or replace function app.decision_milestone(p_type app.decision_type, p_status app.decision_status)
returns app.use_case_status
language sql immutable set search_path = pg_catalog as $$
  select case
    when p_type = 'use_case_authorization' and p_status = 'approved' then 'APPROVED'
    when p_type = 'use_case_authorization' and p_status = 'approved_with_conditions' then 'CONDITIONAL_APPROVAL'
    when p_type = 'use_case_authorization' and p_status = 'rejected' then 'REJECTED'
    when p_type = 'pilot_approval' and p_status in ('approved', 'approved_with_conditions') then 'PILOT'
    when p_type = 'go_production' and p_status in ('approved', 'approved_with_conditions') then 'PRODUCTION'
    when p_type = 'suspension' and p_status in ('approved', 'approved_with_conditions') then 'SUSPENDED'
    when p_type = 'retirement' and p_status in ('approved', 'approved_with_conditions') then 'RETIRED'
    else null end::app.use_case_status;
$$;

comment on function app.decision_milestone is
  'Le statut que franchit un cas d''usage quand une décision de ce type prend cet état. NULL : la décision ne porte pas de jalon.';


-- Appliquer une décision : franchir son jalon, ou dire pourquoi pas.
create or replace function app.apply_decision(p_decision_id uuid)
returns jsonb
language plpgsql
security definer
set search_path = app, public, pg_catalog
as $$
declare
  v_d public.governance_decision%rowtype;
  v_uc public.ai_use_case%rowtype;
  v_target app.use_case_status;
  v_result jsonb;
begin
  select * into v_d from public.governance_decision where id = p_decision_id;
  if v_d.id is null or v_d.use_case_id is null or v_d.applied_at is not null then return null; end if;
  v_target := app.decision_milestone(v_d.decision_type, v_d.status);
  if v_target is null then return null; end if;
  if v_d.effective_from is not null and v_d.effective_from > current_date then
    return jsonb_build_object('applied', false, 'reason', 'NOT_YET_EFFECTIVE');
  end if;
  select * into v_uc from public.ai_use_case where id = v_d.use_case_id;
  if v_uc.status = v_target then
    update public.governance_decision set applied_at = now() where id = v_d.id;
    return jsonb_build_object('applied', true, 'reason', 'ALREADY_THERE');
  end if;

  perform set_config('aigms.decision_transition', 'on', true);
  v_result := app.transition_use_case(v_d.use_case_id,
                                      v_target,
                                      format('Décision %s — %s', v_d.business_ref, v_d.subject));
  perform set_config('aigms.decision_transition', 'off', true);

  if (v_result ->> 'transitioned')::boolean then
    update public.governance_decision set applied_at = now() where id = v_d.id;
    return v_result || jsonb_build_object('applied', true);
  end if;

  -- Le gate a refusé, ou la transition n'est pas permise d'ici : la décision
  -- reste ce qu'elle est, la transition attend, et qui a soumis le sait.
  perform app.notify(
    v_d.tenant_id, v_d.organization_id, coalesce(v_d.submitted_by, app.current_user_id()), 'decision_blocked',
    format('Décision %s approuvée, jalon non franchi : %s', v_d.business_ref, v_result ->> 'message'),
    format('Le cas d''usage reste « %s ». Ce qui manque se lit sur le jalon ; le passage se fera dès que les préconditions seront réunies.', v_uc.status::text),
    format('/admin/use-cases/%s?onglet=decisions', v_d.use_case_id),
    'governance_decision', v_d.id
  );
  return v_result || jsonb_build_object('applied', false);
end;
$$;

-- A l'approbation (ou au refus d'une autorisation), tout de suite.
create or replace function app.apply_decision_on_status()
returns trigger
language plpgsql
security definer
set search_path = app, public, pg_catalog
as $$
begin
  -- L'amorçage et les reprises posent des décisions déjà prises : elles ne
  -- refont pas l'histoire du cas d'usage.
  if current_setting('aigms.seed', true) = 'on' then return new; end if;
  if tg_op = 'UPDATE' and new.status is distinct from old.status
     and app.decision_milestone(new.decision_type, new.status) is not null then
    perform app.apply_decision(new.id);
  end if;
  return new;
end;
$$;

create trigger governance_decision_apply_milestone after update of status on public.governance_decision
  for each row execute function app.apply_decision_on_status();

-- Les décisions dont la date d'effet est arrivée : la fiche les applique.
create or replace function public.apply_due_decisions(p_use_case_id uuid)
returns jsonb
language plpgsql
volatile
security definer
set search_path = app, public, pg_catalog
as $$
declare
  v_uc public.ai_use_case%rowtype;
  d record;
  v_applied jsonb := '[]'::jsonb;
  v_r jsonb;
begin
  select * into v_uc from public.ai_use_case where id = p_use_case_id;
  if v_uc.id is null or not app.has_tenant_access(v_uc.tenant_id) then return '[]'::jsonb; end if;
  for d in
    select id from public.governance_decision
     where use_case_id = p_use_case_id and applied_at is null
       and status in ('approved', 'approved_with_conditions', 'rejected')
       and app.decision_milestone(decision_type, status) is not null
       and (effective_from is null or effective_from <= current_date)
     order by coalesce(approved_at, updated_at)
  loop
    v_r := app.apply_decision(d.id);
    if v_r is not null then v_applied := v_applied || jsonb_build_object('decision_id', d.id, 'result', v_r); end if;
  end loop;
  return v_applied;
end;
$$;

grant execute on function public.apply_due_decisions(uuid) to authenticated;

-- -----------------------------------------------------------------------------
-- 3. Une mise en production s'appuie sur une preuve validée
-- -----------------------------------------------------------------------------
create or replace function app.guard_decision_evidence()
returns trigger
language plpgsql
security definer
set search_path = app, public, pg_catalog
as $$
begin
  if app.current_user_id() is null or current_setting('aigms.seed', true) = 'on' then return new; end if;
  if new.decision_type = 'go_production'
     and new.status in ('approved', 'approved_with_conditions')
     and (tg_op = 'INSERT' or old.status not in ('approved', 'approved_with_conditions'))
     and not exists (
       select 1 from public.decision_link l join public.evidence e on e.id = l.target_id
        where l.decision_id = new.id and l.target_type = 'evidence' and e.validation_status = 'validated') then
    raise exception 'Une mise en production s''appuie sur au moins une preuve validée, rattachée à la décision.'
      using errcode = 'check_violation';
  end if;
  return new;
end;
$$;

create trigger governance_decision_guard_evidence before insert or update of status on public.governance_decision
  for each row execute function app.guard_decision_evidence();

-- -----------------------------------------------------------------------------
-- 4. transition_use_case : la décision approuvée franchit sans rôle d'écriture
-- -----------------------------------------------------------------------------
create or replace function app.transition_use_case(
  p_use_case_id uuid,
  p_target      app.use_case_status,
  p_rationale   text default null
)
returns jsonb
language plpgsql
security definer
set search_path = app, public, pg_catalog
as $$
declare
  v_uc      public.ai_use_case;
  v_allowed app.use_case_status[];
  v_gate    jsonb;
begin
  select * into v_uc from public.ai_use_case where id = p_use_case_id;

  if v_uc.id is null then
    raise exception 'Cas d''usage % introuvable', p_use_case_id using errcode = 'no_data_found';
  end if;

  -- Le SECURITY DEFINER contourne la RLS : l'habilitation est revérifiée ici.
  -- Sauf quand c'est une DÉCISION APPROUVÉE qui franchit le jalon (0064) :
  -- l'acte a déjà été porté par qui devait le porter.
  if current_setting('aigms.decision_transition', true) is distinct from 'on'
     and not app.has_organization_role(v_uc.organization_id, app.roles_write_governance()) then
    raise exception 'Habilitation insuffisante pour faire évoluer le cas d''usage %.', v_uc.business_ref
      using errcode = 'insufficient_privilege';
  end if;

  if p_target = v_uc.status then
    return jsonb_build_object(
      'transitioned', false,
      'from', v_uc.status,
      'to', p_target,
      'reason', 'ALREADY_IN_STATUS',
      'message', format('Le cas d''usage est déjà au statut %s.', p_target),
      'gate', null
    );
  end if;

  v_allowed := app.allowed_use_case_transitions(v_uc.status);

  -- Un refus metier ne leve pas d'exception : une exception annulerait la
  -- transaction, et avec elle la trace du refus. La fonction retourne donc un
  -- resultat structure, journalise, que l'appelant presente a l'utilisateur.
  -- Seules les erreurs de securite et d'integrite lèvent.
  if not (p_target = any (v_allowed)) then
    perform app.log_audit(
      v_uc.tenant_id, 'gate_blocked', 'ai_use_case', v_uc.id, v_uc.business_ref,
      format('Transition interdite %s -> %s', v_uc.status, p_target),
      null, null,
      jsonb_build_object('from', v_uc.status, 'to', p_target, 'reason', 'transition_not_allowed')
    );

    return jsonb_build_object(
      'transitioned', false,
      'from', v_uc.status,
      'to', p_target,
      'reason', 'TRANSITION_NOT_ALLOWED',
      'message', format('Transition interdite : %s -> %s. Transitions possibles : %s.',
                        v_uc.status, p_target,
                        coalesce(nullif(array_to_string(v_allowed, ', '), ''), 'aucune')),
      'allowed_transitions', to_jsonb(v_allowed),
      'gate', null
    );
  end if;

  v_gate := app.evaluate_gate(p_use_case_id, p_target);

  if not (v_gate ->> 'satisfied')::boolean then
    perform app.log_audit(
      v_uc.tenant_id, 'gate_blocked', 'ai_use_case', v_uc.id, v_uc.business_ref,
      format('Gate %s non satisfait', p_target),
      null, null,
      jsonb_build_object('from', v_uc.status, 'to', p_target, 'gate', v_gate)
    );

    if p_target = 'PRODUCTION' then
      perform app.emit_event(v_uc.tenant_id, 'ProductionGateBlocked', 'ai_use_case', v_uc.id, v_gate);
    end if;

    return jsonb_build_object(
      'transitioned', false,
      'from', v_uc.status,
      'to', p_target,
      'reason', 'GATE_NOT_SATISFIED',
      'message', format('Préconditions non satisfaites pour le passage en %s.', p_target),
      'gate', v_gate
    );
  end if;

  -- Le trigger de garde n'accepte l'écriture que dans cette fenêtre.
  perform set_config('aigms.allow_status_change', 'on', true);

  update public.ai_use_case
     set status = p_target,
         status_changed_at = now(),
         retired_at = case when p_target = 'RETIRED' then now() else retired_at end,
         next_review_at = case when p_target = 'SUSPENDED' then next_review_at else next_review_at end
   where id = p_use_case_id;

  perform set_config('aigms.allow_status_change', 'off', true);

  perform app.log_audit(
    v_uc.tenant_id, 'status_transition', 'ai_use_case', v_uc.id, v_uc.business_ref,
    format('Transition %s -> %s', v_uc.status, p_target),
    jsonb_build_object('status', v_uc.status),
    jsonb_build_object('status', p_target),
    jsonb_build_object('rationale', p_rationale, 'gate', v_gate)
  );

  -- Événements métier associés à la transition.
  if p_target = 'TRIAGE' then
    perform app.emit_event(v_uc.tenant_id, 'UseCaseSubmitted', 'ai_use_case', v_uc.id, jsonb_build_object('from', v_uc.status));
  elsif p_target = 'PRODUCTION' then
    perform app.emit_event(v_uc.tenant_id, 'ProductionGatePassed', 'ai_use_case', v_uc.id, v_gate);
  end if;

  return jsonb_build_object(
    'transitioned', true,
    'from', v_uc.status,
    'to', p_target,
    'reason', 'OK',
    'message', format('Transition %s -> %s effectuée.', v_uc.status, p_target),
    'gate', v_gate
  );
end;
$$;


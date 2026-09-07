-- =============================================================================
-- AIGMS — 0011 — Gates de gouvernance et transitions de cycle de vie
-- Vertical slice — Sprint 9
-- =============================================================================
-- Aucune transition critique n'est décidée côté client. `app.transition_use_case`
-- est l'unique point d'entrée : elle vérifie que la transition est autorisée,
-- évalue les préconditions, journalise le résultat et émet un événement.
-- Un gate refusé produit une trace (gate_blocked) au même titre qu'un succès.
-- =============================================================================

-- -----------------------------------------------------------------------------
-- Transitions autorisées — Domain Model V1 §3
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
    when 'PILOT'                then array['PRODUCTION', 'REVIEW', 'RETIRED']
    when 'PRODUCTION'           then array['MONITORING', 'REVIEW', 'RETIRED']
    when 'MONITORING'           then array['PRODUCTION', 'REVIEW', 'RETIRED']
    when 'RETIRED'              then array[]::text[]
    else array[]::text[]
  end::app.use_case_status[];
$$;

comment on function app.allowed_use_case_transitions is
  'Transitions sortantes autorisées depuis un statut. RETIRED est terminal.';

-- -----------------------------------------------------------------------------
-- L'AIIA est-il requis ?
-- -----------------------------------------------------------------------------
create or replace function app.impact_assessment_required(p_use_case_id uuid)
returns boolean
language sql
stable
security definer
set search_path = app, public, pg_catalog
as $$
  select exists (
    select 1
    from public.ai_use_case u
    left join public.regulatory_classification c
           on c.use_case_id = u.id and c.is_current
    where u.id = p_use_case_id
      and (
        u.involves_personal_data
        or u.involves_vulnerable_persons
        or u.autonomy_level in ('L3', 'L4')
        or u.criticality in ('high', 'critical')
        or 'high_risk_potential' = any (coalesce(c.flags, '{}'))
        or 'privacy_impact'      = any (coalesce(c.flags, '{}'))
      )
  );
$$;

comment on function app.impact_assessment_required is
  'Un AIIA est requis dès qu''il y a données personnelles, personnes vulnérables, autonomie L3+, criticité haute ou drapeau haut risque / vie privée.';

-- -----------------------------------------------------------------------------
-- Évaluation du gate PRODUCTION
-- -----------------------------------------------------------------------------
create or replace function app.evaluate_production_gate(p_use_case_id uuid)
returns jsonb
language plpgsql
stable
security definer
set search_path = app, public, pg_catalog
as $$
declare
  v_uc            public.ai_use_case;
  v_checks        jsonb := '[]'::jsonb;
  v_satisfied     boolean := true;

  v_untreated_risks    integer;
  v_aiia_required      boolean;
  v_aiia_ok            boolean;
  v_vendor_count       integer;
  v_vendor_pending     integer;
  v_oversight_ok       boolean;
  v_controls_total     integer;
  v_controls_unassigned integer;
  v_decision_ok        boolean;
  v_blocking_actions   integer;
  v_classification_ok  boolean;

begin
  select * into v_uc from public.ai_use_case where id = p_use_case_id;

  if v_uc.id is null then
    raise exception 'Cas d''usage % introuvable', p_use_case_id
      using errcode = 'no_data_found';
  end if;

  -- 1. Classification réglementaire complète -----------------------------------
  v_classification_ok := app.classification_is_complete(p_use_case_id);
  v_checks := v_checks || jsonb_build_object(
    'code', 'CLASSIFICATION_COMPLETE',
    'label', 'Classification réglementaire complète et validée',
    'satisfied', v_classification_ok,
    'detail', case when v_classification_ok
                then 'Classification courante exploitable.'
                else 'Classification absente, incomplète, marquée à confirmer, signalant une pratique interdite suspectée, ou revue juridique non close.' end
  );

  -- 2. Aucun risque critique sans traitement ni acceptation --------------------
  select count(*) into v_untreated_risks
  from public.risk r
  where r.use_case_id = p_use_case_id
    and coalesce(r.residual_level, r.inherent_level) in ('high', 'critical')
    and r.status not in ('accepted', 'mitigated', 'closed')
    and not exists (
      select 1 from public.risk_treatment t
      where t.risk_id = r.id and t.status in ('implemented', 'verified')
    );

  v_checks := v_checks || jsonb_build_object(
    'code', 'RISKS_TREATED',
    'label', 'Aucun risque élevé ou critique sans traitement ni acceptation',
    'satisfied', v_untreated_risks = 0,
    'detail', format('%s risque(s) élevé(s)/critique(s) sans traitement effectif ni acceptation humaine.', v_untreated_risks)
  );

  -- 3. AIIA requis et terminé ---------------------------------------------------
  v_aiia_required := app.impact_assessment_required(p_use_case_id);
  select exists (
    select 1 from public.impact_assessment ia
    where ia.use_case_id = p_use_case_id and ia.status = 'completed'
  ) into v_aiia_ok;

  v_checks := v_checks || jsonb_build_object(
    'code', 'IMPACT_ASSESSMENT',
    'label', 'AI Impact Assessment terminé lorsqu''il est requis',
    'satisfied', (not v_aiia_required) or v_aiia_ok,
    'detail', case
                when not v_aiia_required then 'AIIA non requis pour ce cas d''usage.'
                when v_aiia_ok then 'AIIA terminé.'
                else 'AIIA requis mais non terminé.' end
  );

  -- 4. Revue fournisseur si un tiers est impliqué -------------------------------
  select count(*) into v_vendor_count
  from public.use_case_vendor_link l where l.use_case_id = p_use_case_id;

  select count(*) into v_vendor_pending
  from public.use_case_vendor_link l
  join public.vendor v on v.id = l.vendor_id
  where l.use_case_id = p_use_case_id
    and v.review_status not in ('approved', 'approved_with_conditions');

  v_checks := v_checks || jsonb_build_object(
    'code', 'VENDOR_REVIEW',
    'label', 'Revue fournisseur close pour chaque tiers impliqué',
    'satisfied', v_vendor_count = 0 or v_vendor_pending = 0,
    'detail', case
                when v_vendor_count = 0 then 'Aucun fournisseur tiers rattaché.'
                when v_vendor_pending = 0 then format('%s fournisseur(s) revu(s).', v_vendor_count)
                else format('%s fournisseur(s) sans revue approuvée.', v_vendor_pending) end
  );

  -- 5. Plan de supervision humaine approuvé ou non applicable justifié ----------
  select exists (
    select 1 from public.human_oversight_plan h
    where h.use_case_id = p_use_case_id
      and (h.status = 'approved'
           or (h.status = 'not_applicable' and btrim(coalesce(h.not_applicable_rationale, '')) <> ''))
  ) into v_oversight_ok;

  v_checks := v_checks || jsonb_build_object(
    'code', 'HUMAN_OVERSIGHT',
    'label', 'Supervision humaine approuvée, ou non applicable et justifiée',
    'satisfied', v_oversight_ok,
    'detail', case when v_oversight_ok
                then 'Plan de supervision en vigueur.'
                else 'Aucun plan de supervision approuvé ni exclusion justifiée.' end
  );

  -- 6. Contrôles obligatoires affectés ------------------------------------------
  select count(*) into v_controls_total
  from public.control c
  where c.organization_id = v_uc.organization_id and c.is_mandatory;

  select count(*) into v_controls_unassigned
  from public.control c
  where c.organization_id = v_uc.organization_id
    and c.is_mandatory
    and not exists (
      select 1 from public.control_applicability ca
      where ca.control_id = c.id
        and ca.use_case_id = p_use_case_id
        and ca.status in ('applicable', 'not_applicable')
    );

  v_checks := v_checks || jsonb_build_object(
    'code', 'MANDATORY_CONTROLS',
    'label', 'Applicabilité statuée pour tous les contrôles obligatoires',
    'satisfied', v_controls_unassigned = 0,
    'detail', format('%s contrôle(s) obligatoire(s) sur %s sans décision d''applicabilité.', v_controls_unassigned, v_controls_total)
  );

  -- 7. Décision GO production approuvée ----------------------------------------
  select exists (
    select 1 from public.governance_decision d
    where d.use_case_id = p_use_case_id
      and d.decision_type = 'go_production'
      and d.status in ('approved', 'approved_with_conditions')
      and d.effective_from <= current_date
  ) into v_decision_ok;

  v_checks := v_checks || jsonb_build_object(
    'code', 'PRODUCTION_DECISION',
    'label', 'Décision GO production approuvée et en vigueur',
    'satisfied', v_decision_ok,
    'detail', case when v_decision_ok
                then 'Décision GO production en vigueur.'
                else 'Aucune décision GO production approuvée et effective à ce jour.' end
  );

  -- 8. Actions bloquantes closes ------------------------------------------------
  select count(*) into v_blocking_actions
  from public.action a
  where a.use_case_id = p_use_case_id
    and a.is_blocking
    and a.status not in ('done', 'cancelled');

  v_checks := v_checks || jsonb_build_object(
    'code', 'BLOCKING_ACTIONS',
    'label', 'Aucune action bloquante ouverte',
    'satisfied', v_blocking_actions = 0,
    'detail', format('%s action(s) bloquante(s) encore ouverte(s).', v_blocking_actions)
  );

  -- Synthèse --------------------------------------------------------------------
  select bool_and((c ->> 'satisfied')::boolean) into v_satisfied
  from jsonb_array_elements(v_checks) c;

  return jsonb_build_object(
    'use_case_id', p_use_case_id,
    'target_status', 'PRODUCTION',
    'satisfied', coalesce(v_satisfied, false),
    'evaluated_at', now(),
    'checks', v_checks
  );
end;
$$;

comment on function app.evaluate_production_gate is
  'Évalue les huit préconditions du passage en production (Domain Model V1 §3). Retourne le détail de chaque contrôle, y compris ceux qui échouent.';

-- -----------------------------------------------------------------------------
-- Gates des transitions amont
-- -----------------------------------------------------------------------------
create or replace function app.evaluate_gate(p_use_case_id uuid, p_target app.use_case_status)
returns jsonb
language plpgsql
stable
security definer
set search_path = app, public, pg_catalog
as $$
declare
  v_uc     public.ai_use_case;
  v_checks jsonb := '[]'::jsonb;
  v_ok     boolean;
begin
  if p_target = 'PRODUCTION' then
    return app.evaluate_production_gate(p_use_case_id);
  end if;

  select * into v_uc from public.ai_use_case where id = p_use_case_id;
  if v_uc.id is null then
    raise exception 'Cas d''usage % introuvable', p_use_case_id using errcode = 'no_data_found';
  end if;

  case p_target
    when 'TRIAGE' then
      v_ok := btrim(coalesce(v_uc.purpose, '')) <> ''
          and v_uc.owner_user_id is not null
          and v_uc.accountable_user_id is not null;
      v_checks := v_checks || jsonb_build_object(
        'code', 'INTAKE_COMPLETE',
        'label', 'Finalité renseignée, owner et responsable redevable désignés',
        'satisfied', v_ok,
        'detail', case when v_ok then 'Fiche d''intake complète.'
                       else 'Finalité, owner ou responsable redevable manquant.' end);

    when 'ASSESSMENT' then
      v_ok := v_uc.criticality is not null;
      v_checks := v_checks || jsonb_build_object(
        'code', 'TRIAGE_COMPLETE',
        'label', 'Triage réalisé : criticité déterminée',
        'satisfied', v_ok,
        'detail', case when v_ok then format('Criticité : %s.', v_uc.criticality)
                       else 'Criticité non déterminée.' end);

    when 'REVIEW' then
      v_ok := exists (select 1 from public.regulatory_classification c
                      where c.use_case_id = p_use_case_id and c.is_current);
      v_checks := v_checks || jsonb_build_object(
        'code', 'CLASSIFICATION_PRESENT',
        'label', 'Pré-classification réglementaire réalisée',
        'satisfied', v_ok,
        'detail', case when v_ok then 'Classification courante présente.'
                       else 'Aucune classification réglementaire.' end);

      v_ok := exists (select 1 from public.risk r where r.use_case_id = p_use_case_id);
      v_checks := v_checks || jsonb_build_object(
        'code', 'RISKS_IDENTIFIED',
        'label', 'Au moins un risque identifié',
        'satisfied', v_ok,
        'detail', case when v_ok then 'Registre des risques alimenté.'
                       else 'Aucun risque identifié : l''évaluation ne peut être revue.' end);

    when 'APPROVED', 'CONDITIONAL_APPROVAL' then
      v_ok := exists (
        select 1 from public.governance_decision d
        where d.use_case_id = p_use_case_id
          and d.decision_type = 'use_case_authorization'
          and d.status in ('approved', 'approved_with_conditions'));
      v_checks := v_checks || jsonb_build_object(
        'code', 'AUTHORIZATION_DECISION',
        'label', 'Décision d''autorisation du cas d''usage approuvée',
        'satisfied', v_ok,
        'detail', case when v_ok then 'Décision d''autorisation enregistrée.'
                       else 'Aucune décision d''autorisation approuvée.' end);

    when 'PILOT' then
      v_ok := exists (
        select 1 from public.governance_decision d
        where d.use_case_id = p_use_case_id
          and d.decision_type = 'pilot_approval'
          and d.status in ('approved', 'approved_with_conditions'));
      v_checks := v_checks || jsonb_build_object(
        'code', 'PILOT_DECISION',
        'label', 'Décision d''autorisation de pilote approuvée',
        'satisfied', v_ok,
        'detail', case when v_ok then 'Décision pilote enregistrée.'
                       else 'Aucune décision d''autorisation de pilote approuvée.' end);

    when 'RETIRED' then
      v_ok := exists (
        select 1 from public.governance_decision d
        where d.use_case_id = p_use_case_id
          and d.decision_type in ('retirement', 'suspension')
          and d.status in ('approved', 'approved_with_conditions'));
      v_checks := v_checks || jsonb_build_object(
        'code', 'RETIREMENT_DECISION',
        'label', 'Décision de retrait ou de suspension approuvée',
        'satisfied', v_ok,
        'detail', case when v_ok then 'Décision de retrait enregistrée.'
                       else 'Le retrait exige une décision approuvée : la trace de gouvernance doit rester complète.' end);

    else
      -- Transitions de retour en arrière (REVIEW -> ASSESSMENT, REJECTED -> DRAFT…) :
      -- pas de précondition, mais la transition reste journalisée.
      v_checks := v_checks || jsonb_build_object(
        'code', 'NO_PRECONDITION',
        'label', 'Aucune précondition pour cette transition',
        'satisfied', true,
        'detail', 'Transition de reprise ou de suivi.');
  end case;

  select bool_and((c ->> 'satisfied')::boolean) into v_ok
  from jsonb_array_elements(v_checks) c;

  return jsonb_build_object(
    'use_case_id', p_use_case_id,
    'target_status', p_target,
    'satisfied', coalesce(v_ok, false),
    'evaluated_at', now(),
    'checks', v_checks
  );
end;
$$;

comment on function app.evaluate_gate is
  'Évalue les préconditions d''une transition. Aiguille vers evaluate_production_gate pour PRODUCTION.';

-- -----------------------------------------------------------------------------
-- Transition — unique point d'écriture du statut
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
  if not app.has_organization_role(v_uc.organization_id, app.roles_write_governance()) then
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
         retired_at = case when p_target = 'RETIRED' then now() else retired_at end
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

comment on function app.transition_use_case is
  'Unique point de modification du statut d''un cas d''usage : vérifie l''habilitation, la transition, les gates, journalise et émet l''événement. Un refus métier retourne transitioned=false avec son motif (et non une exception, qui annulerait la trace du refus) ; seuls un cas d''usage introuvable ou une habilitation insuffisante lèvent.';

revoke all on function app.evaluate_production_gate(uuid)                             from public;
revoke all on function app.evaluate_gate(uuid, app.use_case_status)                   from public;
revoke all on function app.transition_use_case(uuid, app.use_case_status, text)       from public;
revoke all on function app.impact_assessment_required(uuid)                           from public;
revoke all on function app.allowed_use_case_transitions(app.use_case_status)          from public;

grant execute on function app.evaluate_production_gate(uuid)                       to authenticated, service_role;
grant execute on function app.evaluate_gate(uuid, app.use_case_status)             to authenticated, service_role;
grant execute on function app.transition_use_case(uuid, app.use_case_status, text) to authenticated, service_role;
grant execute on function app.impact_assessment_required(uuid)                     to authenticated, service_role;
grant execute on function app.allowed_use_case_transitions(app.use_case_status)    to authenticated, service_role;

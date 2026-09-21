-- =============================================================================
-- AIGMS — 0072 — Le plan de supervision s'adosse aux contrôles HUM
-- =============================================================================
-- Le plan décrivait en texte libre ce que des contrôles-types exigent déjà :
-- HUM-002 validation humaine, HUM-004 reprise de la main, HUM-005 escalade et
-- arrêt, HUM-003 compétence du validateur. Deux registres de « ce qu'on
-- attend de la supervision » finissaient par diverger. Chaque rubrique du plan
-- désigne maintenant le contrôle qui la porte ; enregistrer le plan rend ces
-- contrôles applicables au cas d'usage — ils rejoignent la Déclaration
-- d'Applicabilité — et, quand l'autonomie dépasse L2 ou qu'un risque élevé est
-- ouvert, le gate Production exige les contrôles de reprise et d'arrêt
-- opérants et prouvés. Les preuves attendues sont exigées : la supervision se
-- démontre.
-- =============================================================================

alter table public.human_oversight_plan
  add column if not exists trigger_control_id    uuid references public.control (id) on delete set null,
  add column if not exists override_control_id   uuid references public.control (id) on delete set null,
  add column if not exists stop_control_id       uuid references public.control (id) on delete set null,
  add column if not exists competence_control_id uuid references public.control (id) on delete set null;

comment on column public.human_oversight_plan.override_control_id is 'Le contrôle qui porte la procédure de reprise en main (HUM-004 au référentiel de l''éditeur).';
comment on column public.human_oversight_plan.stop_control_id is 'Le contrôle qui porte la procédure d''arrêt et l''autorité d''arrêt (HUM-005).';

-- Les contrôles que le plan désigne deviennent applicables au cas d'usage.
create or replace function app.apply_oversight_controls()
returns trigger
language plpgsql
security definer
set search_path = app, public, pg_catalog
as $$
declare
  v_pairs text[][] := array[
    [coalesce(new.trigger_control_id::text, ''), 'déclencheurs d''intervention'],
    [coalesce(new.override_control_id::text, ''), 'procédure de reprise en main'],
    [coalesce(new.stop_control_id::text, ''), 'procédure et autorité d''arrêt'],
    [coalesce(new.competence_control_id::text, ''), 'compétence des superviseurs']
  ];
  i integer;
begin
  for i in 1 .. 4 loop
    if v_pairs[i][1] <> '' then
      insert into public.control_applicability (tenant_id, use_case_id, control_id, status, justification)
      values (new.tenant_id, new.use_case_id, v_pairs[i][1]::uuid, 'applicable',
              format('Porté par le plan de supervision humaine %s — %s.', new.business_ref, v_pairs[i][2]))
      on conflict (control_id, use_case_id) do update
        set status = 'applicable',
            justification = case when public.control_applicability.status = 'applicable'
                                 then public.control_applicability.justification
                                 else excluded.justification end;
    end if;
  end loop;
  return new;
end;
$$;

create trigger human_oversight_plan_apply_controls
  after insert or update of trigger_control_id, override_control_id, stop_control_id, competence_control_id on public.human_oversight_plan
  for each row execute function app.apply_oversight_controls();

-- Un contrôle tenu : opérant, et prouvé par une preuve validée non échue.
create or replace function app.control_is_held(p_control_id uuid)
returns boolean
language sql stable
set search_path = app, public, pg_catalog
as $$
  select exists (
    select 1 from public.control c
    where c.id = p_control_id and c.status = 'operating'
      and exists (select 1 from public.control_evidence ce join public.evidence e on e.id = ce.evidence_id
                   where ce.control_id = c.id and e.validation_status = 'validated'
                     and app.evidence_freshness(e.valid_until) <> 'expired'));
$$;

-- Ce qui manque à la supervision d'un cas d'usage qui l'exige — NULL si rien.
create or replace function app.oversight_controls_detail(p_use_case_id uuid)
returns text
language plpgsql stable
set search_path = app, public, pg_catalog
as $$
declare
  v_uc public.ai_use_case%rowtype;
  v_plan public.human_oversight_plan%rowtype;
  v_demanding boolean;
  v_missing text[] := '{}';
begin
  select * into v_uc from public.ai_use_case where id = p_use_case_id;
  select * into v_plan from public.human_oversight_plan where use_case_id = p_use_case_id;
  if v_plan.id is null or v_plan.status <> 'approved' then return null; end if;
  v_demanding := v_uc.autonomy_level in ('L3', 'L4')
    or exists (select 1 from public.risk r where r.use_case_id = p_use_case_id
                 and coalesce(r.residual_level, r.inherent_level) in ('high', 'critical') and not app.risk_is_settled(r));
  if not v_demanding then return null; end if;
  if v_plan.override_control_id is null then v_missing := array_append(v_missing, 'reprise en main : aucun contrôle désigné');
  elsif not app.control_is_held(v_plan.override_control_id) then v_missing := array_append(v_missing, 'reprise en main : contrôle non opérant ou sans preuve validée'); end if;
  if v_plan.stop_control_id is null then v_missing := array_append(v_missing, 'arrêt : aucun contrôle désigné');
  elsif not app.control_is_held(v_plan.stop_control_id) then v_missing := array_append(v_missing, 'arrêt : contrôle non opérant ou sans preuve validée'); end if;
  if cardinality(v_missing) = 0 then return null; end if;
  return format('Autonomie ou risque élevé : %s.', array_to_string(v_missing, ' ; '));
end;
$$;

-- Les contrôles-types HUM publiés, pour que le plan les retienne d'un clic.
create or replace function public.oversight_catalog_controls(p_organization_id uuid)
returns jsonb
language sql
stable
security invoker
set search_path = app, public, pg_catalog
as $$
  select coalesce(jsonb_agg(jsonb_build_object(
    'catalog_control_id', cc.id, 'code', cc.control_code, 'title', cc.title, 'objective', cc.objective,
    'expected_evidence', cc.expected_evidence,
    'control_id', (select c.id from public.control c where c.organization_id = p_organization_id and c.catalog_control_id = cc.id limit 1)
  ) order by cc.control_code), '[]'::jsonb)
  from public.catalog_control cc
  join public.catalog_domain d on d.id = cc.domain_id
  join public.catalog_version v on v.id = cc.version_id
  join public.catalog_framework f on f.id = v.framework_id
  join public.organization o on o.id = p_organization_id
  where d.code = 'HUM' and v.status = 'published' and (f.tenant_id is null or f.tenant_id = o.tenant_id)
    and cc.id = (select cc2.id from public.catalog_control cc2 join public.catalog_version v2 on v2.id = cc2.version_id
                  where cc2.control_code = cc.control_code and v2.status = 'published' and v2.framework_id = v.framework_id
                  order by v2.created_at desc limit 1);
$$;

grant execute on function public.oversight_catalog_controls(uuid) to authenticated;

-- -----------------------------------------------------------------------------
-- Le gate lit la supervision ainsi
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
  v_oversight_detail   text;
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
  -- Un risque élevé ou critique est « soldé » quand son traitement est
  -- effectif — et, s'il est transféré, quand le tiers qui le porte a passé sa
  -- revue — ou quand son acceptation est actée par une décision approuvée
  -- (voir app.risk_is_settled, 0059).
  select count(*) into v_untreated_risks
  from public.risk r
  where r.use_case_id = p_use_case_id
    and coalesce(r.residual_level, r.inherent_level) in ('high', 'critical')
    and not app.risk_is_settled(r);

  v_checks := v_checks || jsonb_build_object(
    'code', 'RISKS_TREATED',
    'label', 'Aucun risque élevé ou critique sans traitement effectif ni acceptation décidée',
    'satisfied', v_untreated_risks = 0,
    'detail', format('%s risque(s) élevé(s)/critique(s) sans traitement effectif (transfert : revue du tiers passée) ni acceptation actée par une décision approuvée.', v_untreated_risks)
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
  -- Et, quand l'autonomie dépasse L2 ou qu'un risque élevé ou critique est
  -- ouvert, les contrôles de reprise en main et d'arrêt que le plan désigne
  -- sont opérants et prouvés (0072) : une procédure écrite ne suffit pas.
  select exists (
    select 1 from public.human_oversight_plan h
    where h.use_case_id = p_use_case_id
      and (h.status = 'approved'
           or (h.status = 'not_applicable' and btrim(coalesce(h.not_applicable_rationale, '')) <> ''))
  ) into v_oversight_ok;

  v_oversight_detail := case when v_oversight_ok then 'Plan de supervision en vigueur.' else 'Aucun plan de supervision approuvé ni exclusion justifiée.' end;
  if v_oversight_ok then
    v_oversight_detail := app.oversight_controls_detail(p_use_case_id);
    if v_oversight_detail is not null then v_oversight_ok := false; else v_oversight_detail := 'Plan de supervision en vigueur, contrôles de reprise et d''arrêt tenus.'; end if;
  end if;

  v_checks := v_checks || jsonb_build_object(
    'code', 'HUMAN_OVERSIGHT',
    'label', 'Supervision humaine approuvée — reprise en main et arrêt tenus quand l''autonomie ou le risque l''exigent',
    'satisfied', v_oversight_ok,
    'detail', v_oversight_detail
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


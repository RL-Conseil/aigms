-- =============================================================================
-- AIGMS — 0059 — La stratégie de traitement a des conséquences
-- =============================================================================
-- La stratégie d'un traitement (réduire, éviter, transférer) était une
-- étiquette : rien ne la lisait. Elle décide maintenant de ce que le système
-- attend, et de ce qu'il fait de lui-même :
--
--   * RÉDUIRE  — un contrôle est désigné, obligatoirement ; il devient
--                applicable au cas d'usage (il rejoint la Déclaration
--                d'Applicabilité) ; le traitement compte quand il est effectif.
--   * ÉVITER   — on renonce à l'usage ou à la fonctionnalité : une action
--                s'ouvre pour le responsable, « traduire l'évitement en demande
--                de changement ou en suspension » ; aucun contrôle attendu.
--   * TRANSFÉRER — un tiers porte le risque : le traitement ne compte comme
--                effectif que si un fournisseur rattaché au cas d'usage a passé
--                sa revue (approuvée, même sous conditions).
--   * ACCEPTER n'est plus une stratégie de traitement : accepter est un acte
--                nominatif à part (0058). Et l'acceptation d'un risque élevé ou
--                critique ouvre une décision « acceptation de risque », soumise,
--                que quelqu'un d'autre doit approuver pour que le risque compte
--                comme soldé au gate PRODUCTION.
--
-- Tout traitement d'un risque élevé ou critique ouvre une action pour son
-- responsable, à l'échéance du traitement — l'alerte du traitement est alors
-- portée par l'action, pas doublée.
--
-- Et pour trouver le contrôle qui traite : `search_controls` cherche dans les
-- contrôles de l'organisation et dans les référentiels publiés, à partir de
-- ce que l'utilisateur a écrit — intitulé, scénario.
--
-- Registre des contrôles : un contrôle a toujours un responsable (à défaut,
-- celui qui le crée), et porte preuves attendues et questions d'évaluation —
-- reprises du contrôle-type, ou saisies pour un contrôle libre.
-- =============================================================================

create extension if not exists pg_trgm with schema extensions;
create extension if not exists unaccent with schema extensions;

-- -----------------------------------------------------------------------------
-- 0. Le registre des contrôles : responsable, preuves attendues, questions
-- -----------------------------------------------------------------------------
alter table public.control
  add column if not exists expected_evidence    text[],
  add column if not exists assessment_questions text[];

comment on column public.control.expected_evidence is
  'Les pièces qui démontrent le contrôle. Reprises du contrôle-type, ou saisies pour un contrôle libre.';
comment on column public.control.assessment_questions is
  'Les questions qu''un évaluateur pose pour juger le contrôle. Reprises du contrôle-type, ou saisies pour un contrôle libre.';

create or replace function app.complete_control_from_catalog()
returns trigger
language plpgsql
security definer
set search_path = app, public, pg_catalog
as $$
declare v_cc public.catalog_control%rowtype;
begin
  -- Un contrôle a toujours un responsable : à défaut, celui qui le crée.
  if new.owner_user_id is null then new.owner_user_id := app.current_user_id(); end if;
  if new.catalog_control_id is not null then
    select * into v_cc from public.catalog_control where id = new.catalog_control_id;
    if new.expected_evidence is null and jsonb_typeof(v_cc.expected_evidence) = 'array' then
      select array_agg(x) into new.expected_evidence from jsonb_array_elements_text(v_cc.expected_evidence) x;
    end if;
    if new.assessment_questions is null and jsonb_typeof(v_cc.assessment_questions) = 'array' then
      select array_agg(x) into new.assessment_questions from jsonb_array_elements_text(v_cc.assessment_questions) x;
    end if;
    if new.test_procedure is null and jsonb_typeof(v_cc.tests) = 'array' and jsonb_array_length(v_cc.tests) > 0 then
      select string_agg(coalesce(t ->> 'description', t ->> 'name', t #>> '{}'), E'\n') into new.test_procedure
      from jsonb_array_elements(v_cc.tests) t;
    end if;
  end if;
  return new;
end;
$$;

create trigger control_complete_from_catalog before insert on public.control
  for each row execute function app.complete_control_from_catalog();

-- Les contrôles déjà instanciés reprennent ce qui leur manque.
update public.control c
   set expected_evidence = (select array_agg(x) from jsonb_array_elements_text(cc.expected_evidence) x),
       assessment_questions = (select array_agg(x) from jsonb_array_elements_text(cc.assessment_questions) x)
  from public.catalog_control cc
 where cc.id = c.catalog_control_id
   and c.expected_evidence is null
   and jsonb_typeof(cc.expected_evidence) = 'array';

-- -----------------------------------------------------------------------------
-- 1. La stratégie, gardée
-- -----------------------------------------------------------------------------
create or replace function app.guard_treatment_strategy()
returns trigger
language plpgsql
set search_path = app, public, pg_catalog
as $$
begin
  if app.current_user_id() is null then return new; end if;
  if new.strategy = 'accept' then
    raise exception 'Accepter n''est pas un traitement : c''est un acte à part, nominatif, réservé au responsable du risque.'
      using errcode = 'check_violation';
  end if;
  if new.strategy = 'reduce' and new.control_id is null then
    raise exception 'Réduire un risque, c''est désigner le contrôle qui le fait : sans lui, le traitement reste une intention.'
      using errcode = 'check_violation';
  end if;
  return new;
end;
$$;

create trigger risk_treatment_guard_strategy before insert or update of strategy, control_id on public.risk_treatment
  for each row execute function app.guard_treatment_strategy();

-- Le contrôle désigné devient applicable au cas d'usage : il rejoint la
-- Déclaration d'Applicabilité, avec le risque qu'il traite pour motif.
create or replace function app.apply_treatment_control()
returns trigger
language plpgsql
security definer
set search_path = app, public, pg_catalog
as $$
declare v_risk public.risk%rowtype;
begin
  if new.control_id is null then return new; end if;
  if tg_op = 'UPDATE' and new.control_id is not distinct from old.control_id then return new; end if;
  select * into v_risk from public.risk where id = new.risk_id;
  insert into public.control_applicability (tenant_id, use_case_id, control_id, status, justification)
  values (new.tenant_id, v_risk.use_case_id, new.control_id, 'applicable',
          format('Traite le risque %s — %s.', v_risk.business_ref, v_risk.title))
  on conflict (use_case_id, control_id) do update
    set status = 'applicable',
        justification = case
          when public.control_applicability.status = 'applicable' then public.control_applicability.justification
          else format('Traite le risque %s — %s.', v_risk.business_ref, v_risk.title) end;
  return new;
end;
$$;

create trigger risk_treatment_apply_control after insert or update of control_id on public.risk_treatment
  for each row execute function app.apply_treatment_control();

-- -----------------------------------------------------------------------------
-- 2. Ce que le traitement ouvre pour son responsable
-- -----------------------------------------------------------------------------
-- Éviter → une action pour traduire l'évitement. Élevé ou critique → une
-- action de mise en œuvre, à l'échéance. Sinon → l'alerte du traitement (0058).
create or replace function app.notify_treatment_owner()
returns trigger
language plpgsql
security definer
set search_path = app, public, pg_catalog
as $$
declare
  v_risk public.risk%rowtype;
  v_href text;
  v_level app.risk_level;
begin
  select * into v_risk from public.risk where id = new.risk_id;
  v_href := format('/admin/use-cases/%s?onglet=risques', v_risk.use_case_id);
  v_level := coalesce(v_risk.residual_level, v_risk.inherent_level);

  if new.status in ('implemented', 'verified', 'abandoned') then
    perform app.drop_pending_notifications(new.id, array['treatment_owner', 'treatment_due']::app.notification_kind[]);
    -- L'action ouverte pour ce traitement se clôt avec lui.
    update public.action set status = 'done', closed_at = now(),
           closure_note = format('Traitement du risque %s %s.', v_risk.business_ref,
                                 case when new.status = 'abandoned' then 'abandonné' else 'effectif' end)
     where source = 'risk' and source_id = new.id and status not in ('done', 'cancelled');
    return new;
  end if;
  if new.owner_user_id is null then return new; end if;

  if tg_op = 'INSERT' and (new.strategy = 'avoid' or v_level in ('high', 'critical'))
     and not app.action_already_open(v_risk.use_case_id, 'risk', new.id) then
    insert into public.action (tenant_id, organization_id, use_case_id, title, description, source, source_id,
                               owner_user_id, due_date, is_blocking)
    values (
      new.tenant_id, v_risk.organization_id, v_risk.use_case_id,
      case when new.strategy = 'avoid'
           then format('Traduire l''évitement du risque %s en changement ou suspension', v_risk.business_ref)
           else format('Mettre en œuvre le traitement du risque %s', v_risk.business_ref) end,
      case when new.strategy = 'avoid'
           then format('« %s ». Éviter, c''est renoncer à l''usage ou à la fonctionnalité qui porte le risque : formaliser une demande de changement de périmètre, ou une suspension. %s', v_risk.title, new.description)
           else format('« %s » — %s. %s', v_risk.title, new.description,
                       case when new.strategy = 'transfer'
                            then 'Transfert : le traitement ne comptera qu''une fois la revue du fournisseur passée.'
                            else 'Une fois le contrôle opérant, recoter le risque.' end) end,
      'risk', new.id, new.owner_user_id, new.due_date,
      v_level in ('high', 'critical')
    );
    return new;
  end if;

  if tg_op = 'INSERT' or new.owner_user_id is distinct from old.owner_user_id then
    perform app.notify(
      new.tenant_id, v_risk.organization_id, new.owner_user_id, 'treatment_owner',
      format('Vous portez le traitement du risque %s', v_risk.business_ref),
      format('« %s » — %s. %s%s', v_risk.title, new.description,
             case when new.due_date is null then 'Sans échéance.'
                  else format('Échéance le %s.', app.fr_date(new.due_date)) end,
             case when new.control_id is not null then '' else ' Aucun contrôle ne le met en œuvre pour l''instant.' end),
      v_href, 'risk_treatment', new.id
    );
  end if;

  if new.due_date is not null
     and (tg_op = 'INSERT' or new.due_date is distinct from old.due_date
          or new.owner_user_id is distinct from old.owner_user_id) then
    perform app.notify(
      new.tenant_id, v_risk.organization_id, new.owner_user_id, 'treatment_due',
      format('Échéance aujourd''hui : traitement du risque %s', v_risk.business_ref),
      format('« %s » — %s. Recoter le risque une fois le traitement en place, ou replanifier en le disant.',
             v_risk.title, new.description),
      v_href, 'risk_treatment', new.id, new.due_date::timestamptz
    );
  elsif new.due_date is null and tg_op = 'UPDATE' and old.due_date is not null then
    perform app.drop_pending_notifications(new.id, array['treatment_due']::app.notification_kind[]);
  end if;
  return new;
end;
$$;

-- -----------------------------------------------------------------------------
-- 3. Accepter un risque élevé ou critique ouvre une décision
-- -----------------------------------------------------------------------------
create or replace function app.open_acceptance_decision()
returns trigger
language plpgsql
security definer
set search_path = app, public, pg_catalog
as $$
declare v_decision uuid;
begin
  if new.status <> 'accepted' or (tg_op = 'UPDATE' and old.status = 'accepted') then return new; end if;
  if coalesce(new.residual_level, new.inherent_level) not in ('high', 'critical') then return new; end if;
  if exists (select 1 from public.decision_link l join public.governance_decision d on d.id = l.decision_id
              where l.target_type = 'risk' and l.target_id = new.id
                and d.decision_type = 'risk_acceptance' and d.status in ('submitted', 'approved', 'approved_with_conditions')) then
    return new;
  end if;
  insert into public.governance_decision (
    tenant_id, organization_id, use_case_id, decision_type, subject, context, decision_statement, rationale,
    status, submitted_by, submitted_at, review_due_at
  ) values (
    new.tenant_id, new.organization_id, new.use_case_id, 'risk_acceptance',
    format('Acceptation du risque %s — %s', new.business_ref, new.title),
    new.scenario,
    format('Le risque %s (%s) est accepté par %s, avec revue le %s.', new.business_ref,
           coalesce(new.residual_level, new.inherent_level)::text, coalesce(app.person_name(new.accepted_by), 'son responsable'),
           app.fr_date(new.acceptance_review_at)),
    new.acceptance_rationale,
    'submitted', new.accepted_by, now(), new.acceptance_review_at
  ) returning id into v_decision;
  insert into public.decision_link (tenant_id, decision_id, target_type, target_id, note)
  values (new.tenant_id, v_decision, 'risk', new.id, 'Le risque accepté.');
  return new;
end;
$$;

create trigger risk_open_acceptance_decision after insert or update of status on public.risk
  for each row execute function app.open_acceptance_decision();

-- -----------------------------------------------------------------------------
-- 4. Un risque soldé, au sens du gate
-- -----------------------------------------------------------------------------
create or replace function app.risk_is_settled(r public.risk)
returns boolean
language sql
stable
set search_path = app, public, pg_catalog
as $$
  select r.status in ('mitigated', 'closed')
      -- Accepté : la décision d'acceptation est approuvée — ou le risque n'est
      -- pas élevé/critique, et l'acceptation nominative suffit.
      or (r.status = 'accepted' and (
            coalesce(r.residual_level, r.inherent_level) not in ('high', 'critical')
            or exists (select 1 from public.decision_link l join public.governance_decision d on d.id = l.decision_id
                        where l.target_type = 'risk' and l.target_id = r.id
                          and d.decision_type = 'risk_acceptance'
                          and d.status in ('approved', 'approved_with_conditions'))))
      -- Traité : effectif, et le transfert suppose un tiers revu.
      or exists (select 1 from public.risk_treatment t
                  where t.risk_id = r.id and t.status in ('implemented', 'verified')
                    and (t.strategy <> 'transfer'
                         or exists (select 1 from public.use_case_vendor_link vl
                                    join public.vendor v on v.id = vl.vendor_id
                                    where vl.use_case_id = r.use_case_id
                                      and v.review_status in ('approved', 'approved_with_conditions'))));
$$;

comment on function app.risk_is_settled is
  'Un risque est soldé quand il est traité (effectif ; transfert : tiers revu), accepté (décision approuvée s''il est élevé/critique), atténué ou clos.';


-- -----------------------------------------------------------------------------
-- 5. Chercher le contrôle qui traite, à partir de ce qu'on a écrit
-- -----------------------------------------------------------------------------
-- Dans les contrôles de l'organisation d'abord — ceux qu'on peut désigner tout
-- de suite — puis dans les référentiels publiés que l'organisation peut lire
-- (l'éditeur, le sien). Plein texte en français sur titre, objectif, risques
-- et questions ; similarité de trigrammes en secours pour un mot approximatif.
create or replace function app.search_controls(p_organization_id uuid, p_use_case_id uuid, p_query text, p_limit integer default 8)
returns table (
  source text, control_id uuid, catalog_control_id uuid, code text, name text, objective text,
  status text, applicable boolean, rank real, why text
)
language sql
stable
security definer
set search_path = app, public, extensions, pg_catalog
as $$
  with scope as (
    select o.id, o.tenant_id from public.organization o
    where o.id = p_organization_id and app.has_tenant_access(o.tenant_id)
  ),
  q as (
    select websearch_to_tsquery('french', unaccent(coalesce(p_query, ''))) as tsq,
           unaccent(lower(coalesce(p_query, ''))) as raw
  ),
  own as (
    select 'control'::text as source, c.id as control_id, c.catalog_control_id, c.code, c.name, c.objective,
           c.status::text as status,
           exists (select 1 from public.control_applicability ca
                    where ca.control_id = c.id and ca.use_case_id = p_use_case_id and ca.status = 'applicable') as applicable,
           to_tsvector('french', unaccent(coalesce(c.name, '') || ' ' || coalesce(c.objective, '') || ' ' ||
                       coalesce(array_to_string(c.assessment_questions, ' '), ''))) as doc,
           unaccent(lower(c.name)) as title
    from public.control c join scope s on s.id = c.organization_id
    where c.status <> 'retired'
  ),
  cat as (
    select 'catalog'::text as source, null::uuid as control_id, cc.id as catalog_control_id,
           cc.control_code as code, cc.title as name, cc.objective, 'catalog'::text as status, false as applicable,
           to_tsvector('french', unaccent(coalesce(cc.title, '') || ' ' || coalesce(cc.objective, '') || ' ' ||
                       coalesce(cc.risks::text, '') || ' ' || coalesce(cc.assessment_questions::text, ''))) as doc,
           unaccent(lower(cc.title)) as title
    from public.catalog_control cc
    join public.catalog_version v on v.id = cc.version_id
    join public.catalog_framework f on f.id = v.framework_id
    cross join scope s
    where v.status = 'published'
      and (f.tenant_id is null or f.tenant_id = s.tenant_id)
      -- Un contrôle-type déjà instancié se lit par son contrôle, pas deux fois.
      and not exists (select 1 from public.control c where c.organization_id = s.id and c.catalog_control_id = cc.id)
      -- Une seule version par code : la plus récente publiée.
      and cc.id = (select cc2.id from public.catalog_control cc2 join public.catalog_version v2 on v2.id = cc2.version_id
                    where cc2.control_code = cc.control_code and v2.status = 'published' and v2.framework_id = v.framework_id
                    order by v2.created_at desc limit 1)
  ),
  all_rows as (select * from own union all select * from cat),
  scored as (
    select a.*,
           (ts_rank_cd(a.doc, q.tsq) * 4 + greatest(similarity(a.title, q.raw), 0))::real as score,
           ts_headline('french', coalesce(a.objective, ''), q.tsq,
                       'MaxWords=24, MinWords=10, StartSel=«, StopSel=», MaxFragments=1') as why
    from all_rows a, q
    where (btrim(q.raw) <> '' and (a.doc @@ q.tsq or similarity(a.title, q.raw) > 0.15))
  )
  select source, control_id, catalog_control_id, code, name, objective, status, applicable, score, why
  from scored
  order by applicable desc, score desc, code
  limit greatest(1, least(p_limit, 20));
$$;

create or replace function public.search_controls(p_organization_id uuid, p_use_case_id uuid, p_query text, p_limit integer default 8)
returns table (
  source text, control_id uuid, catalog_control_id uuid, code text, name text, objective text,
  status text, applicable boolean, rank real, why text
)
language sql stable security invoker
set search_path = app, public, extensions, pg_catalog
as $$ select * from app.search_controls(p_organization_id, p_use_case_id, p_query, p_limit); $$;

revoke all on function public.search_controls(uuid, uuid, text, integer) from public, anon;
grant execute on function public.search_controls(uuid, uuid, text, integer) to authenticated;

-- -----------------------------------------------------------------------------
-- 6. Le gate PRODUCTION lit « soldé » ainsi
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


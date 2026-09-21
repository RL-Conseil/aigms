-- =============================================================================
-- AIGMS — 0078 — L'étude d'impact IA se conduit, se lit d'un trait, se remédie
-- =============================================================================
-- Les tables existaient depuis 0008 — évaluation, parties prenantes, constats
-- par domaine — sans qu'aucune interface ne les serve : l'AIIA se réduisait à
-- six champs sur la fiche. Elle devient une conduite, structurée comme le
-- modèle ISO/IEC 42005 de l'organisation : cadrage, parties prenantes,
-- analyse croisée bénéfices / préjudices par domaine, plan de remédiation.
--
--   1. Un constat défavorable grave porte une mesure (contrainte de 0008) ;
--      il porte désormais aussi un responsable et une échéance, et OUVRE
--      l'action qui la met en œuvre — liée au constat, suivie comme les autres.
--   2. Deux lectures d'un trait : les études d'une organisation (exigée ?
--      conduite ? achevée ?) et une étude complète, pour l'écran, l'impression
--      et l'export.
-- =============================================================================

alter table public.impact_finding
  add column if not exists mitigation_due_date date,
  add column if not exists action_id uuid references public.action (id) on delete set null;

comment on column public.impact_finding.action_id is
  'L''action qui met en œuvre la mesure de réduction, ouverte par le constat.';

-- -----------------------------------------------------------------------------
-- 1. Un constat défavorable grave ouvre son action de remédiation
-- -----------------------------------------------------------------------------
create or replace function app.open_finding_action()
returns trigger
language plpgsql
security definer
set search_path = app, public, pg_catalog
as $$
declare
  v_ia public.impact_assessment%rowtype;
  v_uc public.ai_use_case%rowtype;
  v_action uuid;
begin
  if not new.is_adverse or new.severity not in ('significant', 'severe') then return new; end if;
  if btrim(coalesce(new.mitigation, '')) = '' then return new; end if;
  select * into v_ia from public.impact_assessment where id = new.impact_assessment_id;
  if v_ia.id is null then return new; end if;
  select * into v_uc from public.ai_use_case where id = v_ia.use_case_id;

  if new.action_id is not null then
    -- La mesure, son responsable ou son échéance ont changé : l'action suit,
    -- tant qu'elle est ouverte.
    update public.action a
       set title = left(new.mitigation, 200),
           owner_user_id = coalesce(new.owner_user_id, a.owner_user_id),
           due_date = coalesce(new.mitigation_due_date, a.due_date)
     where a.id = new.action_id and a.status not in ('done', 'cancelled');
    return new;
  end if;

  insert into public.action (
    tenant_id, organization_id, use_case_id, title, description, source, source_id,
    owner_user_id, due_date, is_blocking
  ) values (
    new.tenant_id, v_ia.organization_id, v_ia.use_case_id,
    left(new.mitigation, 200),
    format('Mesure de réduction issue de l''étude d''impact %s — constat « %s » (%s, gravité %s).',
           v_ia.business_ref, left(new.description, 160), new.domain, new.severity),
    'impact_finding', new.id,
    coalesce(new.owner_user_id, v_ia.performed_by, v_uc.owner_user_id),
    coalesce(new.mitigation_due_date, current_date + 60),
    new.severity = 'severe'
  ) returning id into v_action;
  new.action_id := v_action;
  return new;
end;
$$;

create trigger impact_finding_open_action
  before insert or update of mitigation, owner_user_id, mitigation_due_date, severity, is_adverse on public.impact_finding
  for each row execute function app.open_finding_action();

-- -----------------------------------------------------------------------------
-- 2. Lectures d'un trait
-- -----------------------------------------------------------------------------
-- Les études d'une organisation : par cas d'usage, exigée ou non (0011), et
-- la dernière étude conduite.
create or replace function public.impact_studies(p_organization_id uuid)
returns jsonb
language sql
stable
security invoker
set search_path = app, public, pg_catalog
as $$
  select coalesce(jsonb_agg(jsonb_build_object(
    'use_case_id', u.id, 'business_ref', u.business_ref, 'name', u.name, 'status', u.status,
    'criticality', u.criticality,
    'required', app.impact_assessment_required(u.id),
    'study', (select jsonb_build_object('id', ia.id, 'business_ref', ia.business_ref, 'status', ia.status,
                                        'dpia_required', ia.dpia_required, 'completed_at', ia.completed_at,
                                        'next_review_at', ia.next_review_at, 'updated_at', ia.updated_at,
                                        'findings', (select count(*) from public.impact_finding f where f.impact_assessment_id = ia.id),
                                        'severe', (select count(*) from public.impact_finding f where f.impact_assessment_id = ia.id
                                                     and f.is_adverse and f.severity in ('significant', 'severe')))
                from public.impact_assessment ia
               where ia.use_case_id = u.id and ia.status <> 'superseded'
               order by ia.created_at desc limit 1)
  ) order by app.impact_assessment_required(u.id) desc, u.business_ref), '[]'::jsonb)
  from public.ai_use_case u
  where u.organization_id = p_organization_id and u.status not in ('RETIRED', 'REJECTED');
$$;

grant execute on function public.impact_studies(uuid) to authenticated;

-- Une étude complète : cadrage, cas d'usage (criticité, qualification,
-- responsables), parties prenantes, constats avec leur action, signatures.
create or replace function public.impact_study(p_id uuid)
returns jsonb
language sql
stable
security invoker
set search_path = app, public, pg_catalog
as $$
  select jsonb_build_object(
    'id', ia.id, 'business_ref', ia.business_ref, 'status', ia.status,
    'scope_description', ia.scope_description, 'methodology', ia.methodology, 'lifecycle_phase', ia.lifecycle_phase,
    'dpia_required', ia.dpia_required, 'dpia_reference', ia.dpia_reference,
    'conclusion', ia.conclusion, 'completed_at', ia.completed_at, 'next_review_at', ia.next_review_at,
    'reopened_reason', ia.reopened_reason, 'created_at', ia.created_at, 'updated_at', ia.updated_at,
    'organization_id', ia.organization_id,
    'performed_by', (select coalesce(nullif(p.full_name, ''), p.email) from public.user_profile p where p.id = ia.performed_by),
    'approved_by', (select coalesce(nullif(p.full_name, ''), p.email) from public.user_profile p where p.id = ia.approved_by),
    'use_case', (select jsonb_build_object(
        'id', u.id, 'business_ref', u.business_ref, 'name', u.name, 'purpose', u.purpose, 'status', u.status,
        'criticality', u.criticality, 'autonomy_level', u.autonomy_level,
        'users_description', u.users_description, 'affected_persons', u.affected_persons, 'data_description', u.data_description,
        'involves_personal_data', u.involves_personal_data, 'involves_vulnerable_persons', u.involves_vulnerable_persons,
        'owner', (select coalesce(nullif(p.full_name, ''), p.email) from public.user_profile p where p.id = u.owner_user_id),
        'accountable', (select coalesce(nullif(p.full_name, ''), p.email) from public.user_profile p where p.id = u.accountable_user_id),
        'required', app.impact_assessment_required(u.id),
        'classification', (select jsonb_build_object('organization_role', c.organization_role, 'flags', to_jsonb(c.flags))
                             from public.regulatory_classification c where c.use_case_id = u.id and c.is_current limit 1),
        'assets', (select coalesce(jsonb_agg(jsonb_build_object('name', a.name, 'kind', a.kind, 'version', a.version) order by a.name), '[]'::jsonb)
                     from public.use_case_asset_link l join public.ai_asset a on a.id = l.asset_id where l.use_case_id = u.id)
      ) from public.ai_use_case u where u.id = ia.use_case_id),
    'stakeholders', (select coalesce(jsonb_agg(jsonb_build_object(
        'id', s.id, 'label', s.label, 'is_vulnerable_group', s.is_vulnerable_group, 'estimated_population', s.estimated_population,
        'consulted', s.consulted, 'consultation_method', s.consultation_method) order by s.created_at), '[]'::jsonb)
      from public.impact_stakeholder s where s.impact_assessment_id = ia.id),
    'findings', (select coalesce(jsonb_agg(jsonb_build_object(
        'id', f.id, 'domain', f.domain, 'description', f.description, 'is_adverse', f.is_adverse,
        'severity', f.severity, 'likelihood', f.likelihood, 'mitigation', f.mitigation, 'residual_severity', f.residual_severity,
        'mitigation_due_date', f.mitigation_due_date,
        'stakeholder', (select s.label from public.impact_stakeholder s where s.id = f.stakeholder_id),
        'stakeholder_id', f.stakeholder_id,
        'owner', (select coalesce(nullif(p.full_name, ''), p.email) from public.user_profile p where p.id = f.owner_user_id),
        'owner_user_id', f.owner_user_id,
        'linked_risk', (select jsonb_build_object('id', r.id, 'business_ref', r.business_ref, 'title', r.title) from public.risk r where r.id = f.linked_risk_id),
        'linked_risk_id', f.linked_risk_id,
        'action', (select jsonb_build_object('id', a.id, 'business_ref', a.business_ref, 'status', a.status, 'due_date', a.due_date)
                     from public.action a where a.id = f.action_id)
      ) order by f.is_adverse desc, array_position(enum_range(null::app.impact_severity), f.severity) desc, f.created_at), '[]'::jsonb)
      from public.impact_finding f where f.impact_assessment_id = ia.id),
    'evidence', (select coalesce(jsonb_agg(jsonb_build_object('id', e.id, 'business_ref', e.business_ref, 'title', e.title,
                                                              'validation_status', e.validation_status) order by e.created_at desc), '[]'::jsonb)
                   from public.evidence e where e.source = format('Étude d''impact %s (AIGMS)', ia.business_ref)),
    'pending_action', (select jsonb_build_object('id', a.id, 'business_ref', a.business_ref, 'title', a.title)
                         from public.action a where a.source = 'impact_finding' and a.source_id = ia.id
                          and a.status not in ('done', 'cancelled') limit 1)
  )
  from public.impact_assessment ia
  where ia.id = p_id;
$$;

grant execute on function public.impact_study(uuid) to authenticated;

-- La règle du gate, lisible depuis la fiche : l'étude est-elle exigée ?
create or replace function public.impact_assessment_required(p_use_case_id uuid)
returns boolean language sql stable security invoker
set search_path = app, public, pg_catalog
as $$ select app.impact_assessment_required(p_use_case_id); $$;

grant execute on function public.impact_assessment_required(uuid) to authenticated;

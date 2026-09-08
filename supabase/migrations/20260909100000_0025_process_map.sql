-- =============================================================================
-- AIGMS — 0025 — Process & Risk Map : agrégats et santé de la gouvernance
-- Incrément 2 de la cartographie orientée process
-- =============================================================================
-- Deux fonctions de lecture, toutes deux soumises à l'habilitation :
--
--   * `process_map` — l'arbre annoté : pour chaque activité, ce qui s'y joue.
--   * `governance_health` — un indice de SANTÉ DE LA GOUVERNANCE, accompagné
--     de ses causes.
--
-- ---------------------------------------------------------------------------
-- CE QUE L'INDICE EST, ET CE QU'IL N'EST PAS
-- ---------------------------------------------------------------------------
-- Il mesure l'entretien du dispositif : des risques élevés laissés sans
-- traitement, des preuves échues, des revues en retard, des contrôles dont
-- l'applicabilité n'a jamais été statuée.
--
-- Il ne mesure PAS la conformité, et ne doit jamais être présenté comme tel.
-- Un nombre sur cent dans un outil de gouvernance se lit spontanément comme un
-- taux de conformité : chaque affichage doit donc le nommer « santé de la
-- gouvernance » et montrer ses causes à côté de lui. Une organisation
-- irréprochable sur l'entretien de son dispositif peut rester non conforme,
-- et l'inverse est vrai.
--
-- Les pénalités sont fixes, nommées et bornées : l'indice doit pouvoir être
-- recalculé de tête à partir des causes affichées.
-- =============================================================================

-- -----------------------------------------------------------------------------
-- L'arbre annoté
-- -----------------------------------------------------------------------------
create or replace function app.process_map(p_organization_id uuid)
returns table (
  process_id        uuid,
  process_code      text,
  process_name      text,
  process_category  app.process_category,
  process_order     integer,
  activity_id       uuid,
  activity_ref      text,
  activity_name     text,
  activity_order    integer,
  use_case_count    integer,
  in_service_count  integer,
  max_risk_level    app.risk_level,
  open_high_risks   integer,
  controls_total    integer,
  controls_operating integer,
  evidence_total    integer,
  evidence_stale    integer,
  open_incidents    integer,
  overdue_actions   integer,
  reviews_due       integer
)
language sql
stable
security definer
set search_path = app, public, pg_catalog
as $$
  with scope as (
    select o.id, o.tenant_id
    from public.organization o
    where o.id = p_organization_id
      and app.has_tenant_access(o.tenant_id)
  ),
  -- Les contrôles et les preuves relèvent de l'organisation, pas de l'activité :
  -- on les rattache par les cas d'usage auxquels ils s'appliquent.
  per_use_case as (
    select
      u.id            as use_case_id,
      u.activity_id,
      u.status,
      u.next_review_at,
      (select max(coalesce(r.residual_level, r.inherent_level))
         from public.risk r where r.use_case_id = u.id)                    as max_risk,
      (select count(*) from public.risk r
        where r.use_case_id = u.id
          and coalesce(r.residual_level, r.inherent_level) in ('high', 'critical')
          and r.status not in ('accepted', 'mitigated', 'closed'))         as open_high,
      (select count(*) from public.control_applicability ca
        where ca.use_case_id = u.id and ca.status = 'applicable')          as controls,
      (select count(*) from public.control_applicability ca
        join public.control c on c.id = ca.control_id
        where ca.use_case_id = u.id and ca.status = 'applicable'
          and c.status = 'operating')                                      as controls_ok,
      (select count(*) from public.control_applicability ca
        join public.control_evidence ce on ce.control_id = ca.control_id
        where ca.use_case_id = u.id and ca.status = 'applicable')          as evidences,
      (select count(*) from public.control_applicability ca
        join public.control_evidence ce on ce.control_id = ca.control_id
        join public.evidence e on e.id = ce.evidence_id
        where ca.use_case_id = u.id and ca.status = 'applicable'
          and app.evidence_freshness(e.valid_until) in ('expired', 'expiring'))
                                                                           as evidences_stale,
      (select count(*) from public.incident i
        where i.use_case_id = u.id and i.status <> 'CLOSED')               as incidents,
      (select count(*) from public.action a
        where a.use_case_id = u.id
          and a.status not in ('done', 'cancelled')
          and a.due_date is not null and a.due_date < current_date)        as actions_late
    from public.ai_use_case u
    join scope s on s.id = u.organization_id
  )
  select
    p.id, p.code, p.name, p.category, p.display_order,
    a.id, a.business_ref, a.name, a.display_order,
    coalesce(count(uc.use_case_id), 0)::integer,
    coalesce(count(uc.use_case_id) filter (where uc.status in ('PRODUCTION', 'MONITORING')), 0)::integer,
    max(uc.max_risk),
    coalesce(sum(uc.open_high), 0)::integer,
    coalesce(sum(uc.controls), 0)::integer,
    coalesce(sum(uc.controls_ok), 0)::integer,
    coalesce(sum(uc.evidences), 0)::integer,
    coalesce(sum(uc.evidences_stale), 0)::integer,
    coalesce(sum(uc.incidents), 0)::integer,
    coalesce(sum(uc.actions_late), 0)::integer,
    coalesce(count(uc.use_case_id) filter (
      where uc.next_review_at is not null and uc.next_review_at < current_date), 0)::integer
  from public.process p
  join scope s on s.id = p.organization_id
  left join public.activity a on a.process_id = p.id
  left join per_use_case uc on uc.activity_id = a.id
  group by p.id, p.code, p.name, p.category, p.display_order,
           a.id, a.business_ref, a.name, a.display_order
  order by p.display_order, p.name, a.display_order nulls first, a.name;
$$;

comment on function app.process_map is
  'Arbre processus / activité annoté de ce qui s''y joue : usages, risques, contrôles, preuves, incidents, retards.';

-- -----------------------------------------------------------------------------
-- Santé de la gouvernance
-- -----------------------------------------------------------------------------
create or replace function app.governance_health(
  p_organization_id uuid,
  p_activity_id     uuid default null
)
returns jsonb
language plpgsql
stable
security definer
set search_path = app, public, pg_catalog
as $$
declare
  v_score    integer := 100;
  v_causes   jsonb := '[]'::jsonb;
  r          record;
  v_penalty  integer;
begin
  if not exists (
    select 1 from public.organization o
    where o.id = p_organization_id and app.has_tenant_access(o.tenant_id)
  ) then
    return jsonb_build_object('available', false);
  end if;

  select
    coalesce(sum(open_high_risks), 0)          as open_high,
    coalesce(sum(evidence_stale), 0)           as stale,
    coalesce(sum(open_incidents), 0)           as incidents,
    coalesce(sum(overdue_actions), 0)          as actions_late,
    coalesce(sum(reviews_due), 0)              as reviews,
    coalesce(sum(use_case_count), 0)           as use_cases,
    coalesce(sum(controls_total), 0)           as controls,
    coalesce(sum(controls_operating), 0)       as controls_ok
  into r
  from app.process_map(p_organization_id)
  where p_activity_id is null or activity_id = p_activity_id;

  -- Sans usage d'IA déclaré, il n'y a rien à entretenir : un indice serait
  -- trompeur, on n'en produit pas.
  if r.use_cases = 0 then
    return jsonb_build_object(
      'available', false,
      'reason', 'Aucun usage d’IA déclaré sur ce périmètre.'
    );
  end if;

  -- Chaque pénalité est nommée, plafonnée, et rattachée à sa cause.
  if r.open_high > 0 then
    v_penalty := least(r.open_high * 12, 36);
    v_score := v_score - v_penalty;
    v_causes := v_causes || jsonb_build_object(
      'code', 'OPEN_HIGH_RISKS', 'count', r.open_high, 'penalty', v_penalty,
      'label', format('%s risque(s) élevé(s) sans traitement abouti ni acceptation', r.open_high));
  end if;

  if r.stale > 0 then
    v_penalty := least(r.stale * 6, 24);
    v_score := v_score - v_penalty;
    v_causes := v_causes || jsonb_build_object(
      'code', 'STALE_EVIDENCE', 'count', r.stale, 'penalty', v_penalty,
      'label', format('%s preuve(s) échue(s) ou proche(s) de l''échéance', r.stale));
  end if;

  if r.actions_late > 0 then
    v_penalty := least(r.actions_late * 5, 15);
    v_score := v_score - v_penalty;
    v_causes := v_causes || jsonb_build_object(
      'code', 'OVERDUE_ACTIONS', 'count', r.actions_late, 'penalty', v_penalty,
      'label', format('%s action(s) échue(s)', r.actions_late));
  end if;

  if r.reviews > 0 then
    v_penalty := least(r.reviews * 8, 16);
    v_score := v_score - v_penalty;
    v_causes := v_causes || jsonb_build_object(
      'code', 'REVIEWS_DUE', 'count', r.reviews, 'penalty', v_penalty,
      'label', format('%s revue(s) de cas d''usage en retard', r.reviews));
  end if;

  if r.incidents > 0 then
    v_penalty := least(r.incidents * 7, 14);
    v_score := v_score - v_penalty;
    v_causes := v_causes || jsonb_build_object(
      'code', 'OPEN_INCIDENTS', 'count', r.incidents, 'penalty', v_penalty,
      'label', format('%s incident(s) non clos', r.incidents));
  end if;

  -- Des contrôles déclarés mais jamais rendus opérants : le dispositif existe
  -- sur le papier sans fonctionner.
  if r.controls > 0 and r.controls_ok < r.controls then
    v_penalty := least(((r.controls - r.controls_ok) * 100 / r.controls) / 5, 15);
    if v_penalty > 0 then
      v_score := v_score - v_penalty;
      v_causes := v_causes || jsonb_build_object(
        'code', 'CONTROLS_NOT_OPERATING', 'count', r.controls - r.controls_ok, 'penalty', v_penalty,
        'label', format('%s contrôle(s) applicable(s) non opérant(s) sur %s', r.controls - r.controls_ok, r.controls));
    end if;
  end if;

  v_score := greatest(v_score, 0);

  return jsonb_build_object(
    'available', true,
    'score', v_score,
    'band', case
      when v_score >= 85 then 'sound'
      when v_score >= 65 then 'attention'
      else 'action_required'
    end,
    'use_cases', r.use_cases,
    'causes', v_causes,
    'measures', 'entretien du dispositif de gouvernance',
    'not_a_measure_of', 'conformité réglementaire'
  );
end;
$$;

comment on function app.governance_health is
  'Indice de santé de la gouvernance : ce qui n''est pas entretenu. Ne mesure pas la conformité et ne doit jamais être présenté comme un taux de conformité.';

-- -----------------------------------------------------------------------------
-- Surface d'API
-- -----------------------------------------------------------------------------
create or replace function public.process_map(p_organization_id uuid)
returns table (
  process_id uuid, process_code text, process_name text,
  process_category app.process_category, process_order integer,
  activity_id uuid, activity_ref text, activity_name text, activity_order integer,
  use_case_count integer, in_service_count integer, max_risk_level app.risk_level,
  open_high_risks integer, controls_total integer, controls_operating integer,
  evidence_total integer, evidence_stale integer, open_incidents integer,
  overdue_actions integer, reviews_due integer
)
language sql stable security invoker
set search_path = app, public, pg_catalog
as $$ select * from app.process_map(p_organization_id); $$;

create or replace function public.governance_health(
  p_organization_id uuid,
  p_activity_id uuid default null
)
returns jsonb language sql stable security invoker
set search_path = app, public, pg_catalog
as $$ select app.governance_health(p_organization_id, p_activity_id); $$;

revoke all on function public.process_map(uuid)              from public, anon;
revoke all on function public.governance_health(uuid, uuid)  from public, anon;
grant execute on function public.process_map(uuid)             to authenticated;
grant execute on function public.governance_health(uuid, uuid) to authenticated;

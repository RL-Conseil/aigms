-- =============================================================================
-- AIGMS — 0026 — Couverture des contrôles et carte thermique des risques
-- Incrément 3 de la cartographie orientée process
-- =============================================================================
-- Deux lectures supplémentaires du même modèle, comme le prévoit
-- SPEC_PROCESS : « le même modèle de données fournit différentes lectures ».
--
--   * `control_coverage` — on ne regarde plus le processus mais la couverture :
--     combien de contrôles, combien tiennent réellement, depuis quand ils n'ont
--     pas été testés.
--
--   * `risk_heatmap` — la répartition des risques par processus et par niveau,
--     pour voir d'un coup d'œil où se concentre l'exposition.
--
-- Le taux de couverture est délibérément exigeant : un contrôle ne compte que
-- s'il est OPÉRANT et PROUVÉ par une preuve encore valide. Un contrôle déclaré
-- mais sans preuve ne protège personne, et c'est précisément ce qu'un auditeur
-- vient vérifier.
-- =============================================================================

create or replace function app.control_coverage(p_organization_id uuid)
returns table (
  process_id        uuid,
  process_name      text,
  activity_id       uuid,
  activity_name     text,
  use_case_count    integer,
  max_risk_level    app.risk_level,
  controls_total    integer,
  controls_operating integer,
  controls_evidenced integer,
  coverage_percent  integer,
  mandatory_total   integer,
  mandatory_settled integer,
  last_tested_at    date,
  days_since_test   integer
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
  -- Un contrôle est rattaché à une activité par les cas d'usage auxquels il
  -- s'applique. Il peut donc compter dans plusieurs activités : c'est voulu,
  -- une même mesure sert souvent plusieurs endroits.
  applied as (
    select distinct
      u.activity_id,
      c.id            as control_id,
      c.status,
      c.is_mandatory,
      c.last_tested_at,
      ca.status       as applicability,
      exists (
        select 1
        from public.control_evidence ce
        join public.evidence e on e.id = ce.evidence_id
        where ce.control_id = c.id
          and e.validation_status = 'validated'
          and app.evidence_freshness(e.valid_until) not in ('expired')
      )               as evidenced
    from public.control_applicability ca
    join public.control c   on c.id = ca.control_id
    join public.ai_use_case u on u.id = ca.use_case_id
    join scope s on s.id = u.organization_id
    where u.activity_id is not null
  ),
  risk_by_activity as (
    select u.activity_id,
           max(coalesce(r.residual_level, r.inherent_level)) as max_level,
           count(distinct u.id) as use_cases
    from public.ai_use_case u
    join scope s on s.id = u.organization_id
    left join public.risk r on r.use_case_id = u.id
    where u.activity_id is not null
    group by u.activity_id
  )
  select
    p.id, p.name, a.id, a.name,
    coalesce(rba.use_cases, 0)::integer,
    rba.max_level,
    count(ap.control_id) filter (where ap.applicability = 'applicable')::integer,
    count(ap.control_id) filter (where ap.applicability = 'applicable' and ap.status = 'operating')::integer,
    count(ap.control_id) filter (
      where ap.applicability = 'applicable' and ap.status = 'operating' and ap.evidenced)::integer,
    case
      when count(ap.control_id) filter (where ap.applicability = 'applicable') = 0 then null
      else (count(ap.control_id) filter (
              where ap.applicability = 'applicable' and ap.status = 'operating' and ap.evidenced) * 100
            / count(ap.control_id) filter (where ap.applicability = 'applicable'))::integer
    end,
    count(ap.control_id) filter (where ap.is_mandatory)::integer,
    count(ap.control_id) filter (
      where ap.is_mandatory and ap.applicability in ('applicable', 'not_applicable'))::integer,
    max(ap.last_tested_at),
    case
      when max(ap.last_tested_at) is null then null
      else (current_date - max(ap.last_tested_at))::integer
    end
  from public.activity a
  join public.process p on p.id = a.process_id
  join scope s on s.id = a.organization_id
  left join applied ap on ap.activity_id = a.id
  left join risk_by_activity rba on rba.activity_id = a.id
  group by p.id, p.name, p.display_order, a.id, a.name, a.display_order,
           rba.max_level, rba.use_cases
  order by p.display_order, a.display_order;
$$;

comment on function app.control_coverage is
  'Couverture des contrôles par activité. Un contrôle ne compte comme couvrant que s''il est opérant ET prouvé par une preuve validée non échue.';

-- -----------------------------------------------------------------------------
-- Carte thermique des risques
-- -----------------------------------------------------------------------------
create or replace function app.risk_heatmap(p_organization_id uuid)
returns table (
  process_id     uuid,
  process_name   text,
  process_order  integer,
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
    select o.id, o.tenant_id
    from public.organization o
    where o.id = p_organization_id
      and app.has_tenant_access(o.tenant_id)
  ),
  levels as (
    select unnest(enum_range(null::app.risk_level)) as level
  ),
  risks as (
    select
      p.id   as process_id,
      p.name as process_name,
      p.display_order,
      coalesce(r.residual_level, r.inherent_level) as level,
      r.status
    from public.risk r
    join public.ai_use_case u on u.id = r.use_case_id
    join public.activity a    on a.id = u.activity_id
    join public.process p     on p.id = a.process_id
    join scope s on s.id = r.organization_id
  ),
  processes as (
    select p.id, p.name, p.display_order
    from public.process p
    join scope s on s.id = p.organization_id
  )
  select
    pr.id, pr.name, pr.display_order, l.level,
    coalesce(count(risks.level), 0)::integer,
    coalesce(count(risks.level) filter (
      where risks.status not in ('accepted', 'mitigated', 'closed')), 0)::integer,
    coalesce(count(risks.level) filter (where risks.status = 'accepted'), 0)::integer
  from processes pr
  cross join levels l
  left join risks on risks.process_id = pr.id and risks.level = l.level
  group by pr.id, pr.name, pr.display_order, l.level
  order by pr.display_order, array_position(enum_range(null::app.risk_level), l.level);
$$;

comment on function app.risk_heatmap is
  'Répartition des risques par processus et par niveau. Distingue ce qui reste ouvert de ce qui a été accepté : deux situations qui n''appellent pas la même réponse.';

-- -----------------------------------------------------------------------------
-- Surface d'API
-- -----------------------------------------------------------------------------
create or replace function public.control_coverage(p_organization_id uuid)
returns table (
  process_id uuid, process_name text, activity_id uuid, activity_name text,
  use_case_count integer, max_risk_level app.risk_level,
  controls_total integer, controls_operating integer, controls_evidenced integer,
  coverage_percent integer, mandatory_total integer, mandatory_settled integer,
  last_tested_at date, days_since_test integer
)
language sql stable security invoker
set search_path = app, public, pg_catalog
as $$ select * from app.control_coverage(p_organization_id); $$;

create or replace function public.risk_heatmap(p_organization_id uuid)
returns table (
  process_id uuid, process_name text, process_order integer,
  risk_level app.risk_level, risk_count integer, open_count integer, accepted_count integer
)
language sql stable security invoker
set search_path = app, public, pg_catalog
as $$ select * from app.risk_heatmap(p_organization_id); $$;

revoke all on function public.control_coverage(uuid) from public, anon;
revoke all on function public.risk_heatmap(uuid)     from public, anon;
grant execute on function public.control_coverage(uuid) to authenticated;
grant execute on function public.risk_heatmap(uuid)     to authenticated;

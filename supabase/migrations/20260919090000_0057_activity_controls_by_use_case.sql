-- =============================================================================
-- AIGMS — 0057 — Les contrôles d'une activité, par cas d'usage
-- =============================================================================
-- Le panneau d'une activité disait « contrôles 3/13 » et listait ceux qui
-- n'étaient pas opérants — sans dire pour quel cas d'usage. Une activité porte
-- plusieurs usages ; chacun a ses contrôles applicables, et c'est par usage
-- qu'on agit. `activity_stakes` rend maintenant, en plus, les contrôles
-- applicables de chaque cas d'usage de l'activité, avec leur état.
-- Le reste de la fonction est inchangé (0040).
-- =============================================================================

create or replace function app.activity_stakes(p_activity_id uuid)
returns jsonb
language sql
stable
security definer
set search_path = app, public, pg_catalog
as $$
  with scope as (
    select a.id as activity_id, o.id as organization_id
    from public.activity a
    join public.organization o on o.id = a.organization_id
    where a.id = p_activity_id
      and app.has_tenant_access(o.tenant_id)
  ),
  uc as (
    select u.id, u.name, u.business_ref, u.status, u.next_review_at
    from public.ai_use_case u
    join scope s on s.activity_id = u.activity_id
  )
  select jsonb_build_object(
    'available', exists (select 1 from scope),

    -- Tous les risques de l'activité, ouverts en tête : le panneau nomme le
    -- plus élevé et liste ceux qui restent sans traitement abouti.
    'risks', coalesce((
      select jsonb_agg(jsonb_build_object(
        'id', r.id, 'ref', r.business_ref, 'title', r.title,
        'level', coalesce(r.residual_level, r.inherent_level),
        'status', r.status,
        'open', coalesce(r.residual_level, r.inherent_level) in ('high', 'critical')
                and r.status not in ('accepted', 'mitigated', 'closed'),
        'use_case_id', u.id, 'use_case', u.name
      ) order by
        case coalesce(r.residual_level, r.inherent_level)
          when 'critical' then 0 when 'high' then 1 when 'moderate' then 2 else 3 end,
        r.business_ref)
      from public.risk r join uc u on u.id = r.use_case_id
    ), '[]'::jsonb),

    'controls_not_operating', coalesce((
      select jsonb_agg(distinct jsonb_build_object(
        'id', c.id, 'code', c.code, 'name', c.name, 'status', c.status
      ))
      from public.control_applicability ca
      join public.control c on c.id = ca.control_id
      join uc u on u.id = ca.use_case_id
      where ca.status = 'applicable' and c.status <> 'operating'
    ), '[]'::jsonb),

    -- Les contrôles applicables, PAR CAS D'USAGE : le compteur dit combien,
    -- pas lesquels ni pour quel usage. Chaque contrôle porte son état —
    -- proposé, mis en place, opérant — et l'usage qui l'attend.
    'controls_by_use_case', coalesce((
      select jsonb_agg(jsonb_build_object(
        'use_case_id', u.id, 'use_case', u.name, 'ref', u.business_ref,
        'controls', coalesce((
          select jsonb_agg(jsonb_build_object(
            'id', c.id, 'code', c.code, 'name', c.name, 'status', c.status,
            'is_mandatory', c.is_mandatory
          ) order by c.code)
          from public.control_applicability ca
          join public.control c on c.id = ca.control_id
          where ca.use_case_id = u.id and ca.status = 'applicable'
        ), '[]'::jsonb)
      ) order by u.business_ref)
      from uc u
    ), '[]'::jsonb),

    'stale_evidence', coalesce((
      select jsonb_agg(distinct jsonb_build_object(
        'id', e.id, 'ref', e.business_ref, 'title', e.title,
        'valid_until', e.valid_until,
        'freshness', app.evidence_freshness(e.valid_until),
        'control_code', c.code
      ))
      from public.control_applicability ca
      join public.control c on c.id = ca.control_id
      join public.control_evidence ce on ce.control_id = ca.control_id
      join public.evidence e on e.id = ce.evidence_id
      join uc u on u.id = ca.use_case_id
      where ca.status = 'applicable'
        and app.evidence_freshness(e.valid_until) in ('expired', 'expiring')
    ), '[]'::jsonb),

    'open_incidents', coalesce((
      select jsonb_agg(jsonb_build_object(
        'id', i.id, 'ref', i.business_ref, 'title', i.title,
        'severity', i.severity, 'status', i.status,
        'use_case_id', u.id, 'use_case', u.name
      ) order by i.business_ref)
      from public.incident i join uc u on u.id = i.use_case_id
      where i.status <> 'CLOSED'
    ), '[]'::jsonb),

    'overdue_actions', coalesce((
      select jsonb_agg(jsonb_build_object(
        'id', a.id, 'ref', a.business_ref, 'title', a.title,
        'due_date', a.due_date, 'status', a.status,
        'use_case_id', u.id, 'use_case', u.name
      ) order by a.due_date)
      from public.action a join uc u on u.id = a.use_case_id
      where a.status not in ('done', 'cancelled')
        and a.due_date is not null and a.due_date < current_date
    ), '[]'::jsonb),

    'reviews_due', coalesce((
      select jsonb_agg(jsonb_build_object(
        'use_case_id', u.id, 'use_case', u.name, 'ref', u.business_ref,
        'next_review_at', u.next_review_at
      ) order by u.next_review_at)
      from uc u
      where u.next_review_at is not null and u.next_review_at < current_date
    ), '[]'::jsonb)
  );
$$;

comment on function app.activity_stakes is
  'Les pièces derrière chaque compteur de app.process_map pour une activité : risques, contrôles (par cas d''usage), preuves à renouveler, incidents, actions échues, revues en retard. Mêmes prédicats que process_map.';

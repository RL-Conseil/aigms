-- =============================================================================
-- AIGMS — 0089 — Le graphe montre ce que l'IA emploie, et avec quoi ça tient
-- =============================================================================
-- Le graphe de gouvernance avait six couches : processus, activité, cas
-- d'usage, risque, contrôle, preuve. Deux choses manquaient, et ce sont
-- justement celles qui SE PARTAGENT — la raison d'être du graphe :
--
--   * les ACTIFS d'IA. Un modèle employé par deux cas d'usage n'apparaissait
--     nulle part ; les mesures techniques, qui se posent sur l'actif (0060),
--     semblaient sortir de nulle part. L'actif porte aussi son fournisseur :
--     un tiers non revu se voit d'un coup d'œil.
--   * l'OUTILLAGE (0088). Un produit qui tient cinq contrôles est un point de
--     concentration : s'il tombe, cinq contrôles tombent. Cela ne se lisait
--     nulle part.
--
-- Huit couches : processus · activité · cas d'usage · actif · risque ·
-- contrôle · outillage · preuve. Trois liens de plus : « emploie », « mesure
-- technique posée sur », « se tient avec ».
-- =============================================================================

CREATE OR REPLACE FUNCTION app.control_graph(p_organization_id uuid, p_activity_id uuid DEFAULT NULL::uuid)
 RETURNS jsonb
 LANGUAGE sql
 STABLE SECURITY DEFINER
 SET search_path TO 'app', 'public', 'pg_catalog'
AS $function$
  with scope as (
    select o.id, o.tenant_id
    from public.organization o
    where o.id = p_organization_id
      and app.has_tenant_access(o.tenant_id)
  ),
  -- Cas d'usage retenus. Le filtre par activité restreint tout le graphe :
  -- au-delà d'une trentaine de nœuds, une vue d'ensemble ne se lit plus.
  uc as (
    select u.*
    from public.ai_use_case u
    join scope s on s.id = u.organization_id
    where u.activity_id is not null
      and (p_activity_id is null or u.activity_id = p_activity_id)
  ),
  act as (
    select a.* from public.activity a
    join scope s on s.id = a.organization_id
    where p_activity_id is null or a.id = p_activity_id
  ),
  proc as (
    select distinct p.*
    from public.process p
    join act a on a.process_id = p.id
  ),
  rsk as (
    select r.* from public.risk r
    join uc on uc.id = r.use_case_id
  ),
  -- Un contrôle entre dans le graphe par deux portes : il s'applique à un cas
  -- d'usage du périmètre, ou il a été désigné pour traiter l'un de ses risques.
  -- La seconde porte compte : un contrôle désigné dont personne n'a statué
  -- l'applicabilité doit rester visible, pas disparaître.
  ctl as (
    select distinct c.*
    from public.control c
    where exists (
      select 1 from public.control_applicability ca
      join uc on uc.id = ca.use_case_id
      where ca.control_id = c.id and ca.status = 'applicable'
    )
    or exists (
      select 1 from public.risk_treatment t
      join rsk on rsk.id = t.risk_id
      where t.control_id = c.id and t.status <> 'abandoned'
    )
  ),
  ctl_evidenced as (
    select c.id,
           exists (
             select 1 from public.control_evidence ce
             join public.evidence e on e.id = ce.evidence_id
             where ce.control_id = c.id
               and e.validation_status = 'validated'
               and app.evidence_freshness(e.valid_until) <> 'expired'
           ) as evidenced
    from ctl c
  ),
  ev as (
    select distinct e.*
    from public.evidence e
    join public.control_evidence ce on ce.evidence_id = e.id
    join ctl c on c.id = ce.control_id
  ),
  -- Les actifs employes par les cas d'usage du perimetre : c'est la que la
  -- gouvernance touche la technique, et c'est la qu'un modele partage entre
  -- deux usages se voit.
  ast as (
    select distinct a.*
    from public.ai_asset a
    join public.use_case_asset_link l on l.asset_id = a.id
    join uc on uc.id = l.use_case_id
  ),
  -- Avec quoi les controles se tiennent, chez cette organisation (0088).
  tooling as (
    select distinct ot.*
    from public.organization_tooling ot
    join public.control_tooling ct on ct.tooling_id = ot.id
    join ctl c on c.id = ct.control_id
  ),
  nodes as (
    select jsonb_build_object(
      'id', 'process:' || p.id, 'layer', 'process', 'entity_id', p.id,
      'ref', p.code, 'label', p.name,
      'meta', jsonb_build_object('category', p.category), 'tone', 'neutral'
    ) as node, 0 as ord, p.display_order as sub, p.name as lbl
    from proc p
    union all
    select jsonb_build_object(
      'id', 'activity:' || a.id, 'layer', 'activity', 'entity_id', a.id,
      'ref', a.business_ref, 'label', a.name,
      'meta', '{}'::jsonb, 'tone', 'neutral'
    ), 1, a.display_order, a.name
    from act a
    union all
    select jsonb_build_object(
      'id', 'use_case:' || u.id, 'layer', 'use_case', 'entity_id', u.id,
      'ref', u.business_ref, 'label', u.name,
      'meta', jsonb_build_object('status', u.status, 'criticality', u.criticality),
      'tone', case when u.status in ('PRODUCTION', 'MONITORING') then 'live' else 'neutral' end
    ), 2, 0, u.name
    from uc u
    union all
    select jsonb_build_object(
      'id', 'risk:' || r.id, 'layer', 'risk', 'entity_id', r.id,
      'ref', r.business_ref, 'label', r.title,
      'meta', jsonb_build_object(
        'level', coalesce(r.residual_level, r.inherent_level),
        'status', r.status,
        'accepted', r.status = 'accepted'),
      'tone', case
        when coalesce(r.residual_level, r.inherent_level) in ('critical', 'high')
             and r.status not in ('mitigated', 'closed', 'accepted') then 'stop'
        when coalesce(r.residual_level, r.inherent_level) = 'moderate' then 'warn'
        else 'neutral' end
    ), 4, 0, r.title
    from rsk r
    union all
    select jsonb_build_object(
      'id', 'control:' || c.id, 'layer', 'control', 'entity_id', c.id,
      'ref', c.code, 'label', c.name,
      'meta', jsonb_build_object(
        'status', c.status, 'mandatory', c.is_mandatory,
        'evidenced', ce.evidenced, 'last_tested_at', c.last_tested_at),
      -- Un contrôle n'est « tenu » que s'il est opérant ET prouvé : c'est la
      -- même exigence que le taux de couverture, elle ne varie pas d'un écran
      -- à l'autre.
      'tone', case
        when c.status = 'operating' and ce.evidenced then 'ok'
        when c.status = 'operating' then 'warn'
        else 'stop' end
    ), 5, 0, c.name
    from ctl c
    join ctl_evidenced ce on ce.id = c.id
    union all
    select jsonb_build_object(
      'id', 'evidence:' || e.id, 'layer', 'evidence', 'entity_id', e.id,
      'ref', e.business_ref, 'label', e.title,
      'meta', jsonb_build_object(
        'validation_status', e.validation_status,
        'freshness', app.evidence_freshness(e.valid_until),
        'valid_until', e.valid_until),
      'tone', case
        when e.validation_status <> 'validated' then 'stop'
        when app.evidence_freshness(e.valid_until) = 'expired' then 'stop'
        when app.evidence_freshness(e.valid_until) = 'expiring' then 'warn'
        else 'ok' end
    ), 7, 0, e.title
    from ev e
    union all
    select jsonb_build_object(
      'id', 'asset:' || a.id, 'layer', 'asset', 'entity_id', a.id,
      'ref', a.business_ref, 'label', a.name,
      'meta', jsonb_build_object(
        'kind', a.kind, 'version', a.version, 'hosting_location', a.hosting_location,
        'contains_personal_data', a.contains_personal_data,
        'vendor', (select v.name from public.vendor v where v.id = a.vendor_id),
        'vendor_review_status', (select v.review_status from public.vendor v where v.id = a.vendor_id)),
      'tone', case
        when exists (select 1 from public.vendor v where v.id = a.vendor_id
                      and v.review_status not in ('approved', 'approved_with_conditions')) then 'stop'
        when not exists (select 1 from public.asset_control ac where ac.asset_id = a.id) then 'warn'
        else 'ok' end
    ), 3, 0, a.name
    from ast a
    union all
    select jsonb_build_object(
      'id', 'tooling:' || t.id, 'layer', 'tooling', 'entity_id', t.id,
      'ref', t.tool_code, 'label', t.product,
      'meta', jsonb_build_object(
        'family', (select ct.tool_service from public.catalog_tool ct where ct.code = t.tool_code limit 1),
        'vendor', (select v.name from public.vendor v where v.id = t.vendor_id),
        'connector', (select gc.display_name from public.governance_connector gc where gc.id = t.connector_id)),
      'tone', case
        when exists (select 1 from public.vendor v where v.id = t.vendor_id
                      and v.review_status not in ('approved', 'approved_with_conditions')) then 'warn'
        else 'neutral' end
    ), 6, 0, t.product
    from tooling t
  ),
  edges as (
    select jsonb_build_object(
      'id', 'structure:' || a.process_id || ':' || a.id,
      'source', 'process:' || a.process_id, 'target', 'activity:' || a.id,
      'kind', 'structure') as edge
    from act a
    join proc p on p.id = a.process_id
    union all
    select jsonb_build_object(
      'id', 'structure:' || u.activity_id || ':' || u.id,
      'source', 'activity:' || u.activity_id, 'target', 'use_case:' || u.id,
      'kind', 'structure')
    from uc u
    union all
    select jsonb_build_object(
      'id', 'exposure:' || r.use_case_id || ':' || r.id,
      'source', 'use_case:' || r.use_case_id, 'target', 'risk:' || r.id,
      'kind', 'exposure')
    from rsk r
    union all
    -- Applicabilité : ce contrôle a été jugé applicable à ce cas d'usage.
    select distinct jsonb_build_object(
      'id', 'applicability:' || ca.use_case_id || ':' || ca.control_id,
      'source', 'use_case:' || ca.use_case_id, 'target', 'control:' || ca.control_id,
      'kind', 'applicability')
    from public.control_applicability ca
    join uc on uc.id = ca.use_case_id
    join ctl c on c.id = ca.control_id
    where ca.status = 'applicable'
    union all
    -- Traitement : ce contrôle a été DÉSIGNÉ pour réduire ce risque. C'est un
    -- lien déclaré par un humain, pas une proximité déduite.
    select distinct jsonb_build_object(
      'id', 'mitigation:' || t.risk_id || ':' || t.control_id,
      'source', 'risk:' || t.risk_id, 'target', 'control:' || t.control_id,
      'kind', 'mitigation',
      'meta', jsonb_build_object('strategy', t.strategy, 'status', t.status))
    from public.risk_treatment t
    join rsk r on r.id = t.risk_id
    join ctl c on c.id = t.control_id
    where t.control_id is not null
    union all
    select distinct jsonb_build_object(
      'id', 'evidence:' || ce.control_id || ':' || ce.evidence_id,
      'source', 'control:' || ce.control_id, 'target', 'evidence:' || ce.evidence_id,
      'kind', 'evidence')
    from public.control_evidence ce
    join ctl c on c.id = ce.control_id
    join ev e on e.id = ce.evidence_id
    union all
    -- Ce que le cas d'usage emploie : un actif partage entre deux usages se
    -- voit croiser, et c'est la raison d'etre de cette couche.
    select distinct jsonb_build_object(
      'id', 'employment:' || l.use_case_id || ':' || l.asset_id,
      'source', 'use_case:' || l.use_case_id, 'target', 'asset:' || l.asset_id,
      'kind', 'employment',
      'meta', jsonb_build_object('relation', l.relation))
    from public.use_case_asset_link l
    join uc on uc.id = l.use_case_id
    join ast a on a.id = l.asset_id
    union all
    -- Une mesure technique se pose sur un actif, et se prouve la (0060).
    select distinct jsonb_build_object(
      'id', 'measure:' || ac.asset_id || ':' || ac.control_id,
      'source', 'asset:' || ac.asset_id, 'target', 'control:' || ac.control_id,
      'kind', 'measure',
      'meta', jsonb_build_object('status', ac.status))
    from public.asset_control ac
    join ast a on a.id = ac.asset_id
    join ctl c on c.id = ac.control_id
    union all
    -- Avec quoi ce controle se tient : le produit employe ici, pas la famille.
    select distinct jsonb_build_object(
      'id', 'tooling:' || ct.control_id || ':' || ct.tooling_id,
      'source', 'control:' || ct.control_id, 'target', 'tooling:' || ct.tooling_id,
      'kind', 'tooling')
    from public.control_tooling ct
    join ctl c on c.id = ct.control_id
    join tooling t on t.id = ct.tooling_id
  )
  select case
    when not exists (select 1 from scope) then jsonb_build_object('available', false)
    else jsonb_build_object(
      'available', true,
      'nodes', coalesce((select jsonb_agg(node order by ord, sub, lbl) from nodes), '[]'::jsonb),
      'edges', coalesce((select jsonb_agg(edge) from edges), '[]'::jsonb))
  end;
$function$;

comment on function app.control_graph is
  'Graphe de gouvernance à huit couches : processus, activité, cas d''usage, actif, risque, contrôle, outillage, preuve. Il montre ce qui se partage — un contrôle servant plusieurs usages, un actif employé par deux cas, un produit tenant cinq contrôles.';

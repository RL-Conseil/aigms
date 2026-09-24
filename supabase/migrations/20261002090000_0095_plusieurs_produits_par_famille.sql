-- =============================================================================
-- AIGMS — 0095 — Une famille d'outillage peut porter plusieurs produits
-- =============================================================================
-- 0088 imposait `unique (organization_id, tool_code)` : un seul produit par
-- famille. C'était une erreur, et `connector_id` la rend visible.
--
-- Le connecteur est porté PAR LA LIGNE. Deux produits écrasés en un seul
-- libellé — « Datadog + Grafana » — ne peuvent en porter qu'un : le second
-- devient inatteignable, et le signal « preuve automatisable » (0094) ment.
--
-- Les cas que la contrainte interdisait sont ordinaires : observabilité tenue
-- par un produit en production et un autre ailleurs, deux CSPM pendant une
-- migration, un SIEM groupe et un SIEM filiale.
--
-- CE N'EST TOUJOURS PAS UNE CMDB. Ce qui en ferait une, ce sont les instances,
-- les dépendances et le cycle de vie — pas le nombre de produits. La nouvelle
-- contrainte interdit le doublon exact, et rien de plus.
--
-- Conséquence sur les lectures : `declared` cesse d'être un objet et devient
-- une liste. Les écrans suivent.
-- =============================================================================

alter table public.organization_tooling
  drop constraint organization_tooling_organization_id_tool_code_key,
  add constraint organization_tooling_produit_unique unique (organization_id, tool_code, product);

comment on constraint organization_tooling_produit_unique on public.organization_tooling is
  'Plusieurs produits par famille, mais pas deux fois le même (0095).';

-- -----------------------------------------------------------------------------
-- La carte : les produits en liste, et les contrôles que chaque famille sert
-- -----------------------------------------------------------------------------
create or replace function public.organization_tooling_map(p_organization_id uuid)
returns jsonb
language sql
stable
security invoker
set search_path = app, public, pg_catalog
as $$
  with scope as (
    select o.id, o.tenant_id from public.organization o
    where o.id = p_organization_id and app.has_tenant_access(o.tenant_id)
  ),
  -- Les familles que le référentiel rattache aux contrôles de l'organisation,
  -- et LESQUELS : « 7 contrôles attendent cette famille » ne dit pas où aller.
  expected as (
    select distinct t.id as tool_id, t.code, t.acronym, t.tool_service, t.domain,
           t.phase::text as phase, t.definition, t.tool_examples, t.expected_evidence
    from public.catalog_tool t
    join public.catalog_tool_control m on m.tool_id = t.id
    cross join scope s
    where (t.tenant_id is null or t.tenant_id = s.tenant_id)
  ),
  served as (
    select e.code,
           jsonb_agg(jsonb_build_object(
             'id', c.id, 'code', c.code, 'name', c.name,
             'status', c.status, 'measure_kind', c.measure_kind,
             'retained', exists (select 1 from public.control_tooling ct where ct.control_id = c.id)
           ) order by c.code) as controls,
           count(*) as n
    from expected e
    join public.catalog_tool_control m2 on m2.tool_id = e.tool_id
    join public.catalog_control cc on cc.control_code = m2.control_code
    join public.control c on c.catalog_control_id = cc.id
    where c.organization_id = (select id from scope)
    group by e.code
  ),
  signals as (
    select
      count(*) filter (where app.control_needs_tooling(c.id))         as technical_without_tooling,
      count(*) filter (where app.control_evidence_automatable(c.id))  as evidence_automatable
    from public.control c
    where c.organization_id = (select id from scope)
  )
  select jsonb_build_object(
    'signals', (select jsonb_build_object(
        'technical_without_tooling', s.technical_without_tooling,
        'evidence_automatable', s.evidence_automatable) from signals s),
    'families', coalesce((
      select jsonb_agg(jsonb_build_object(
        'code', e.code, 'acronym', e.acronym, 'name', e.tool_service, 'domain', e.domain, 'phase', e.phase,
        'definition', e.definition, 'examples', e.tool_examples, 'expected_evidence', e.expected_evidence,
        'controls', coalesce((select sv.n from served sv where sv.code = e.code), 0),
        'served_controls', coalesce((select sv.controls from served sv where sv.code = e.code), '[]'::jsonb),
        -- Plusieurs produits possibles : une liste, toujours — vide comprise.
        'declared', coalesce((select jsonb_agg(jsonb_build_object(
              'id', ot.id, 'product', ot.product, 'note', ot.note, 'role', ot.role,
              'vendor', (select jsonb_build_object('id', v.id, 'name', v.name, 'review_status', v.review_status)
                           from public.vendor v where v.id = ot.vendor_id),
              'asset', (select jsonb_build_object('id', a.id, 'name', a.name, 'business_ref', a.business_ref, 'kind', a.kind)
                          from public.ai_asset a where a.id = ot.asset_id),
              'connector', (select jsonb_build_object('id', gc.id, 'name', gc.display_name, 'status', gc.status)
                              from public.governance_connector gc where gc.id = ot.connector_id),
              'used_by', (select count(*) from public.control_tooling ct where ct.tooling_id = ot.id))
            order by ot.product)
            from public.organization_tooling ot
            where ot.organization_id = (select id from scope) and ot.tool_code = e.code), '[]'::jsonb)
      ) order by coalesce((select sv.n from served sv where sv.code = e.code), 0) desc, e.tool_service)
      from expected e), '[]'::jsonb)
  );
$$;

comment on function public.organization_tooling_map is
  'La carte d''outillage : par famille, les produits déclarés, les contrôles servis, et les deux signaux (0095).';

-- La vue par contrôle : `declared` y devient également une liste.
create or replace function public.control_tooling_view(p_control_id uuid)
returns jsonb
language sql
stable
security invoker
set search_path = app, public, pg_catalog
as $$
  with ctl as (
    select c.* from public.control c
    where c.id = p_control_id and app.has_tenant_access(c.tenant_id)
  ),
  suggested as (
    select t.code, t.acronym, t.tool_service, t.tool_examples
    from ctl
    join public.catalog_control cc on cc.id = ctl.catalog_control_id
    join public.catalog_tool_control m on m.control_code = cc.control_code
    join public.catalog_tool t on t.id = m.tool_id
  )
  select jsonb_build_object(
    'control_id', (select id from ctl),
    'signal', (select jsonb_build_object(
        'measure_kind', c.measure_kind,
        'needs_tooling', app.control_needs_tooling(c.id),
        'evidence_automatable', app.control_evidence_automatable(c.id))
      from ctl c),
    'suggested', coalesce((select jsonb_agg(jsonb_build_object(
        'code', s.code, 'acronym', s.acronym, 'name', s.tool_service, 'examples', s.tool_examples,
        'declared', coalesce((select jsonb_agg(jsonb_build_object('id', ot.id, 'product', ot.product) order by ot.product)
                       from public.organization_tooling ot
                      where ot.organization_id = (select organization_id from ctl) and ot.tool_code = s.code), '[]'::jsonb)
      ) order by s.tool_service) from suggested s), '[]'::jsonb),
    'retained', coalesce((select jsonb_agg(jsonb_build_object(
        'id', ct.id, 'tooling_id', ot.id, 'tool_code', ot.tool_code, 'product', ot.product,
        'role', ot.role,
        'family', (select t.tool_service from public.catalog_tool t where t.code = ot.tool_code limit 1),
        'rationale', ct.rationale,
        'vendor', (select jsonb_build_object('id', v.id, 'name', v.name, 'review_status', v.review_status)
                     from public.vendor v where v.id = ot.vendor_id),
        'asset', (select jsonb_build_object('id', a.id, 'name', a.name, 'business_ref', a.business_ref, 'kind', a.kind)
                    from public.ai_asset a where a.id = ot.asset_id),
        'connector', (select jsonb_build_object('id', gc.id, 'name', gc.display_name, 'status', gc.status)
                        from public.governance_connector gc where gc.id = ot.connector_id)
      ) order by ot.product)
      from public.control_tooling ct
      join public.organization_tooling ot on ot.id = ct.tooling_id
      where ct.control_id = p_control_id), '[]'::jsonb),
    'available', coalesce((select jsonb_agg(jsonb_build_object(
        'id', ot.id, 'tool_code', ot.tool_code, 'product', ot.product, 'role', ot.role,
        'family', (select t.tool_service from public.catalog_tool t where t.code = ot.tool_code limit 1))
      order by ot.product)
      from public.organization_tooling ot
      where ot.organization_id = (select organization_id from ctl)), '[]'::jsonb)
  );
$$;

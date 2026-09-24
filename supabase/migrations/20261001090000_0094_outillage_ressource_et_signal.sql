-- =============================================================================
-- AIGMS — 0094 — L'outillage a deux natures, et il se signale
-- =============================================================================
-- 0088 a posé une seule idée : l'outil par lequel un CONTRÔLE se tient. Les
-- textes en portent une seconde, que le modèle ne savait pas dire.
--
--   * ISO/IEC 42001 A.4.4 « Tooling resources » : l'outillage est une
--     RESSOURCE DU SYSTÈME D'IA, à documenter par système. L'annexe IV de
--     l'AI Act demande la même chose pour la documentation technique — avec
--     quoi le système a été développé, entraîné, validé.
--   * ISO/IEC 27002:2022 et RGPD art. 32 : la mesure porte elle-même sa
--     nature, technique ou organisationnelle. L'outil est l'INSTRUMENT du
--     contrôle, pas un objet gouverné.
--
-- Un même produit peut relever des deux — une passerelle d'appels IA tient un
-- contrôle de supervision ET constitue un actif d'IA à gouverner. Sans le
-- dire, il fallait le saisir deux fois, sans lien.
--
--   1. `tooling_role` : instrument du contrôle, ressource du système, ou les
--      deux.
--   2. `asset_id` : quand l'outil EST un actif d'IA déclaré, le registre et la
--      carte d'outillage cessent de s'ignorer.
--   3. Deux signaux, lus par les écrans :
--        — un contrôle de nature technique dont aucun outillage n'est retenu
--          ne se prouve pas ;
--        — un outil dont le connecteur est branché, sur un contrôle sans
--          preuve validée fraîche, est une collecte qui pourrait être
--          automatique.
--
-- CE QUE CE N'EST TOUJOURS PAS : un inventaire du SI. Une ligne par famille,
-- le produit employé, et c'est tout. Pas d'instances, pas de dépendances, pas
-- de cycle de vie — interdiction du CLAUDE.md, réaffirmée ici parce que les
-- deux colonnes ajoutées donnent envie de la franchir.
-- =============================================================================

create type app.tooling_role as enum ('control_instrument', 'system_resource', 'both');

comment on type app.tooling_role is
  'À quel titre l''outil est déclaré : instrument d''un contrôle (ISO 27002, RGPD art. 32), ressource d''un système d''IA (ISO 42001 A.4.4), ou les deux.';

alter table public.organization_tooling
  add column role     app.tooling_role not null default 'control_instrument',
  add column asset_id uuid references public.ai_asset (id) on delete set null;

comment on column public.organization_tooling.role is
  'Instrument du contrôle, ressource du système d''IA (42001 A.4.4), ou les deux.';
comment on column public.organization_tooling.asset_id is
  'Renseigné quand l''outil est lui-même un actif d''IA déclaré — passerelle d''appels, juge LLM, assistant de code. Le registre et la carte d''outillage cessent alors de s''ignorer.';

-- L'actif désigné doit être celui de l'organisation : le garde générique ne
-- voit que `organization_id`, il ne rapproche pas deux tables.
create or replace function app.assert_tooling_asset()
returns trigger
language plpgsql
security definer
set search_path = app, public, pg_catalog
as $$
declare v_asset_org uuid;
begin
  if new.asset_id is null then return new; end if;
  select organization_id into v_asset_org from public.ai_asset where id = new.asset_id;
  if v_asset_org is distinct from new.organization_id then
    raise exception 'L''actif d''IA désigné doit appartenir à la même organisation que l''outillage.'
      using errcode = 'check_violation';
  end if;
  return new;
end;
$$;

create trigger organization_tooling_assert_asset before insert or update on public.organization_tooling
  for each row execute function app.assert_tooling_asset();

-- -----------------------------------------------------------------------------
-- Les signaux
-- -----------------------------------------------------------------------------

-- Un contrôle de nature technique sans outillage retenu ne se prouve pas : il
-- dit qu'on fait quelque chose, sans dire avec quoi.
create or replace function app.control_needs_tooling(p_control_id uuid)
returns boolean
language sql
stable
security definer
set search_path = app, public, pg_catalog
as $$
  select c.measure_kind = 'technical'
     and not exists (select 1 from public.control_tooling ct where ct.control_id = c.id)
  from public.control c
  where c.id = p_control_id;
$$;

comment on function app.control_needs_tooling is
  'Contrôle technique dont aucun outillage n''est retenu : il énonce un moyen sans le nommer (0094).';

-- Une preuve qui pourrait être automatique et ne l'est pas : le contrôle
-- retient un outil dont le connecteur est branché, et n'a pourtant aucune
-- preuve validée et fraîche.
create or replace function app.control_evidence_automatable(p_control_id uuid)
returns boolean
language sql
stable
security definer
set search_path = app, public, pg_catalog
as $$
  select exists (
      select 1
      from public.control_tooling ct
      join public.organization_tooling ot on ot.id = ct.tooling_id
      join public.governance_connector gc on gc.id = ot.connector_id
      where ct.control_id = p_control_id and gc.status in ('active', 'degraded'))
     and not exists (
      select 1 from public.control_evidence ce
      join public.evidence e on e.id = ce.evidence_id
      where ce.control_id = p_control_id
        and e.validation_status = 'validated'
        and app.evidence_freshness(e.valid_until) <> 'expired');
$$;

comment on function app.control_evidence_automatable is
  'Le contrôle retient un outil dont le connecteur est actif, et n''a aucune preuve validée fraîche : la collecte pourrait être automatique (0094).';

-- -----------------------------------------------------------------------------
-- Les deux lectures, étendues
-- -----------------------------------------------------------------------------

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
    -- Ce que le contrôle engage, et ce qui lui manque pour se prouver.
    'signal', (select jsonb_build_object(
        'measure_kind', c.measure_kind,
        'needs_tooling', app.control_needs_tooling(c.id),
        'evidence_automatable', app.control_evidence_automatable(c.id))
      from ctl c),
    -- La typologie du référentiel : une suggestion, jamais modifiée ici.
    'suggested', coalesce((select jsonb_agg(jsonb_build_object(
        'code', s.code, 'acronym', s.acronym, 'name', s.tool_service, 'examples', s.tool_examples,
        'declared', (select jsonb_build_object('id', ot.id, 'product', ot.product)
                       from public.organization_tooling ot
                      where ot.organization_id = (select organization_id from ctl) and ot.tool_code = s.code)
      ) order by s.tool_service) from suggested s), '[]'::jsonb),
    -- Ce qui est retenu pour ce contrôle.
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
    -- Tout ce que l'organisation a posé : pour en retenir un autre.
    'available', coalesce((select jsonb_agg(jsonb_build_object(
        'id', ot.id, 'tool_code', ot.tool_code, 'product', ot.product, 'role', ot.role,
        'family', (select t.tool_service from public.catalog_tool t where t.code = ot.tool_code limit 1))
      order by ot.product)
      from public.organization_tooling ot
      where ot.organization_id = (select organization_id from ctl)), '[]'::jsonb)
  );
$$;

comment on function public.control_tooling_view is
  'Pour un contrôle : ce que le référentiel suggère, ce qui est retenu, ce qui est disponible, et ce qui manque pour le prouver (0094).';

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
  -- Les familles que le référentiel rattache aux contrôles de l'organisation.
  expected as (
    select distinct t.code, t.acronym, t.tool_service, t.domain, t.phase::text as phase,
           t.definition, t.tool_examples, t.expected_evidence,
           (select count(*) from public.control c
             join public.catalog_control cc on cc.id = c.catalog_control_id
             join public.catalog_tool_control m2 on m2.control_code = cc.control_code and m2.tool_id = t.id
            where c.organization_id = (select id from scope)) as controls
    from public.catalog_tool t
    join public.catalog_tool_control m on m.tool_id = t.id
    cross join scope s
    where (t.tenant_id is null or t.tenant_id = s.tenant_id)
  ),
  -- Ce qui appelle une action, sur l'ensemble des contrôles de l'organisation.
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
        'controls', e.controls,
        'declared', (select jsonb_build_object(
              'id', ot.id, 'product', ot.product, 'note', ot.note, 'role', ot.role,
              'vendor', (select jsonb_build_object('id', v.id, 'name', v.name, 'review_status', v.review_status)
                           from public.vendor v where v.id = ot.vendor_id),
              'asset', (select jsonb_build_object('id', a.id, 'name', a.name, 'business_ref', a.business_ref, 'kind', a.kind)
                          from public.ai_asset a where a.id = ot.asset_id),
              'connector', (select jsonb_build_object('id', gc.id, 'name', gc.display_name, 'status', gc.status)
                              from public.governance_connector gc where gc.id = ot.connector_id),
              'used_by', (select count(*) from public.control_tooling ct where ct.tooling_id = ot.id))
            from public.organization_tooling ot
            where ot.organization_id = (select id from scope) and ot.tool_code = e.code)
      ) order by e.controls desc, e.tool_service)
      from expected e), '[]'::jsonb)
  );
$$;

comment on function public.organization_tooling_map is
  'La carte d''outillage d''une organisation, ses deux signaux, et le lien vers l''actif quand l''outil en est un (0094).';

-- =============================================================================
-- AIGMS — 0088 — Avec quoi un contrôle se tient, chez nous
-- =============================================================================
-- Le référentiel dit « ce contrôle se tient avec une passerelle d'appels IA,
-- un CSPM, un outil d'observabilité » : une TYPOLOGIE d'outillage (60
-- familles, `catalog_tool`), utile pour savoir où chercher. Elle ne dit pas
-- ce que l'organisation emploie réellement — et un contrôle qui « se tient
-- avec la famille observabilité » est moins probant qu'un contrôle qui se
-- tient « avec Datadog, chez nous ».
--
-- Ce que ce n'est PAS : un inventaire du SI. AIGMS ne construit pas de CMDB
-- (interdictions du CLAUDE.md) — une ligne par famille, le produit employé,
-- et c'est tout. Pas d'instances, pas de dépendances, pas de cycle de vie.
--
--   1. `organization_tooling` : par famille du référentiel, le produit que
--      l'organisation emploie — et, s'ils existent, le fournisseur du
--      registre et le connecteur qui en lit les preuves.
--   2. `control_tooling` : ce que l'AI Governance Officer retient POUR CE
--      CONTRÔLE-LÀ. Le référentiel propose, l'humain retient — comme pour
--      l'applicabilité. Le contrôle-type n'est jamais modifié : sa
--      correspondance est une donnée d'éditeur, versionnée.
--   3. Une lecture par contrôle : ce que le référentiel suggère, ce que
--      l'organisation a posé, ce qui est retenu.
-- =============================================================================

create table public.organization_tooling (
  id               uuid primary key default gen_random_uuid(),
  tenant_id        uuid not null references public.tenant (id) on delete cascade,
  organization_id  uuid not null references public.organization (id) on delete cascade,
  -- La famille du référentiel, par son code : le catalogue peut être
  -- réimporté sans casser ce que l'organisation a déclaré.
  tool_code        text not null check (btrim(tool_code) <> ''),
  product          text not null check (btrim(product) <> ''),
  vendor_id        uuid references public.vendor (id) on delete set null,
  connector_id     uuid references public.governance_connector (id) on delete set null,
  note             text,
  created_at       timestamptz not null default now(),
  updated_at       timestamptz not null default now(),
  unique (organization_id, tool_code)
);

comment on table public.organization_tooling is
  'Avec quoi l''organisation tient ses contrôles : une ligne par famille d''outillage du référentiel, le produit employé. Ce n''est pas un inventaire du SI — pas d''instances, pas de dépendances.';
comment on column public.organization_tooling.connector_id is
  'Le connecteur qui lit les preuves chez ce produit, quand il existe. Sinon, le produit reste un candidat.';

create index organization_tooling_org_idx on public.organization_tooling (organization_id, tool_code);

create trigger organization_tooling_touch_updated_at before update on public.organization_tooling
  for each row execute function app.touch_updated_at();
create trigger organization_tooling_assert_tenant before insert or update on public.organization_tooling
  for each row execute function app.assert_tenant_consistency();
create trigger organization_tooling_audit after insert or update or delete on public.organization_tooling
  for each row execute function app.audit_business();

-- Ce que l'officer retient pour un contrôle donné.
create table public.control_tooling (
  id          uuid primary key default gen_random_uuid(),
  tenant_id   uuid not null references public.tenant (id) on delete cascade,
  control_id  uuid not null references public.control (id) on delete cascade,
  tooling_id  uuid not null references public.organization_tooling (id) on delete cascade,
  rationale   text,
  created_at  timestamptz not null default now(),
  unique (control_id, tooling_id)
);

comment on table public.control_tooling is
  'Avec quoi CE contrôle se tient, retenu par une main. Le référentiel propose une typologie ; il n''est jamais modifié.';

-- Le garde generique lit `organization_id` : cette table n'en porte pas. Son
-- espace est celui du controle, et l'outil doit venir de la meme organisation.
create or replace function app.assert_control_tooling_tenant()
returns trigger
language plpgsql
security definer
set search_path = app, public, pg_catalog
as $$
declare v_control_org uuid; v_tool_org uuid; v_tenant uuid;
begin
  select c.organization_id, c.tenant_id into v_control_org, v_tenant
    from public.control c where c.id = new.control_id;
  select ot.organization_id into v_tool_org
    from public.organization_tooling ot where ot.id = new.tooling_id;
  if v_control_org is null or v_tool_org is null or v_control_org <> v_tool_org then
    raise exception 'Un contrôle ne se tient qu''avec un outil de son organisation.'
      using errcode = 'check_violation';
  end if;
  new.tenant_id := v_tenant;
  return new;
end;
$$;

create trigger control_tooling_assert_tenant before insert or update on public.control_tooling
  for each row execute function app.assert_control_tooling_tenant();
create trigger control_tooling_audit after insert or update or delete on public.control_tooling
  for each row execute function app.audit_business();

alter table public.organization_tooling enable row level security;
alter table public.organization_tooling force row level security;
alter table public.control_tooling enable row level security;
alter table public.control_tooling force row level security;

create policy organization_tooling_select on public.organization_tooling
  for select to authenticated using (app.has_tenant_access(tenant_id));
create policy organization_tooling_write on public.organization_tooling
  for all to authenticated
  using (app.has_tenant_role(tenant_id, app.roles_contribute()))
  with check (app.has_tenant_role(tenant_id, app.roles_contribute()));

create policy control_tooling_select on public.control_tooling
  for select to authenticated using (app.has_tenant_access(tenant_id));
create policy control_tooling_write on public.control_tooling
  for all to authenticated
  using (app.has_tenant_role(tenant_id, app.roles_contribute()))
  with check (app.has_tenant_role(tenant_id, app.roles_contribute()));

-- -----------------------------------------------------------------------------
-- 3. Lectures
-- -----------------------------------------------------------------------------
-- L'outillage d'une organisation, familles du référentiel comprises : ce
-- qu'elle a posé, et ce qui reste à poser pour les contrôles qu'elle tient.
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
  )
  select jsonb_build_object(
    'families', coalesce((
      select jsonb_agg(jsonb_build_object(
        'code', e.code, 'acronym', e.acronym, 'name', e.tool_service, 'domain', e.domain, 'phase', e.phase,
        'definition', e.definition, 'examples', e.tool_examples, 'expected_evidence', e.expected_evidence,
        'controls', e.controls,
        'declared', (select jsonb_build_object(
              'id', ot.id, 'product', ot.product, 'note', ot.note,
              'vendor', (select jsonb_build_object('id', v.id, 'name', v.name, 'review_status', v.review_status)
                           from public.vendor v where v.id = ot.vendor_id),
              'connector', (select jsonb_build_object('id', gc.id, 'name', gc.display_name, 'status', gc.status)
                              from public.governance_connector gc where gc.id = ot.connector_id),
              'used_by', (select count(*) from public.control_tooling ct where ct.tooling_id = ot.id))
            from public.organization_tooling ot
            where ot.organization_id = (select id from scope) and ot.tool_code = e.code)
      ) order by e.controls desc, e.tool_service)
      from expected e), '[]'::jsonb)
  );
$$;

grant execute on function public.organization_tooling_map(uuid) to authenticated;

-- Avec quoi CE contrôle se tient : ce que le référentiel suggère, ce que
-- l'organisation a posé, ce qui est retenu.
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
        'family', (select t.tool_service from public.catalog_tool t where t.code = ot.tool_code limit 1),
        'rationale', ct.rationale,
        'vendor', (select jsonb_build_object('id', v.id, 'name', v.name, 'review_status', v.review_status)
                     from public.vendor v where v.id = ot.vendor_id),
        'connector', (select jsonb_build_object('id', gc.id, 'name', gc.display_name, 'status', gc.status)
                        from public.governance_connector gc where gc.id = ot.connector_id)
      ) order by ot.product)
      from public.control_tooling ct
      join public.organization_tooling ot on ot.id = ct.tooling_id
      where ct.control_id = p_control_id), '[]'::jsonb),
    -- Tout ce que l'organisation a posé : pour en retenir un autre.
    'available', coalesce((select jsonb_agg(jsonb_build_object(
        'id', ot.id, 'tool_code', ot.tool_code, 'product', ot.product,
        'family', (select t.tool_service from public.catalog_tool t where t.code = ot.tool_code limit 1))
      order by ot.product)
      from public.organization_tooling ot
      where ot.organization_id = (select organization_id from ctl)), '[]'::jsonb)
  );
$$;

grant execute on function public.control_tooling_view(uuid) to authenticated;

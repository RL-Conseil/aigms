-- =============================================================================
-- AIGMS — 0103 — Avec quoi un actif d'IA a été construit
-- =============================================================================
-- 0094 a nommé les deux natures de l'outillage — instrument d'un contrôle,
-- ressource d'un système d'IA — et posé `asset_id` pour le cas où l'outil EST
-- lui-même un actif déclaré. Il manquait le lien inverse, et c'est celui que
-- les textes réclament :
--
--   * ISO/IEC 42001 **A.4.4 « Tooling resources »** demande de documenter, PAR
--     SYSTÈME, l'outillage employé pour le développer et l'exploiter ;
--   * l'**annexe IV de l'AI Act** demande la même chose dans la documentation
--     technique — avec quoi le système a été développé, entraîné, validé.
--
-- `asset_id` répond à « cet outil est un actif ». Il ne répond pas à « ce
-- système a été entraîné avec MLflow et DVC », qui est la question de
-- l'auditeur.
--
-- CE N'EST TOUJOURS PAS UNE CMDB. Un couple actif × outillage, une phase, une
-- note. Pas d'instances, pas de versions, pas de dépendances — la règle tient
-- depuis 0088 et les deux tables ajoutées depuis ne l'ont pas entamée.
-- =============================================================================

create type app.tooling_phase as enum ('design', 'data', 'training', 'validation', 'deployment', 'operation');

comment on type app.tooling_phase is
  'À quel moment du cycle de vie l''outil a servi. Les phases d''ISO/IEC 42001 A.6, dans l''ordre où elles se suivent.';

create table public.asset_tooling (
  id          uuid primary key default gen_random_uuid(),
  tenant_id   uuid not null references public.tenant (id) on delete cascade,
  asset_id    uuid not null references public.ai_asset (id) on delete cascade,
  tooling_id  uuid not null references public.organization_tooling (id) on delete cascade,
  phase       app.tooling_phase not null default 'operation',
  note        text,
  created_at  timestamptz not null default now(),
  updated_at  timestamptz not null default now(),
  unique (asset_id, tooling_id, phase)
);

comment on table public.asset_tooling is
  'Avec quoi cet actif d''IA a été construit, entraîné, validé ou exploité — ISO/IEC 42001 A.4.4, annexe IV de l''AI Act (0103).';
comment on column public.asset_tooling.phase is
  'Un même outil peut servir à deux moments : une ligne par phase, sinon on perd l''un des deux.';

create index asset_tooling_tooling_idx on public.asset_tooling (tooling_id);

create trigger asset_tooling_touch_updated_at before update on public.asset_tooling
  for each row execute function app.touch_updated_at();
create trigger asset_tooling_audit after insert or update or delete on public.asset_tooling
  for each row execute function app.audit_business();

-- L'actif et l'outil viennent de la même organisation. Le garde générique lit
-- `organization_id` ; cette table n'en porte pas, son espace est celui de
-- l'actif.
create or replace function app.assert_asset_tooling_tenant()
returns trigger
language plpgsql
security definer
set search_path = app, public, pg_catalog
as $$
declare v_asset_org uuid; v_tool_org uuid; v_tenant uuid;
begin
  select organization_id, tenant_id into v_asset_org, v_tenant from public.ai_asset where id = new.asset_id;
  select organization_id into v_tool_org from public.organization_tooling where id = new.tooling_id;
  if v_asset_org is null or v_tool_org is distinct from v_asset_org then
    raise exception 'L''outillage doit appartenir à la même organisation que l''actif.'
      using errcode = 'check_violation';
  end if;
  new.tenant_id := v_tenant;
  return new;
end;
$$;

create trigger asset_tooling_assert_tenant before insert or update on public.asset_tooling
  for each row execute function app.assert_asset_tooling_tenant();

-- -----------------------------------------------------------------------------
-- RLS : la même que les autres tables de gouvernance
-- -----------------------------------------------------------------------------
alter table public.asset_tooling enable row level security;
alter table public.asset_tooling force row level security;

create policy asset_tooling_select on public.asset_tooling
  for select to authenticated
  using (app.has_tenant_access(tenant_id));

create policy asset_tooling_write on public.asset_tooling
  for all to authenticated
  using (app.has_tenant_access(tenant_id) and app.has_tenant_role(tenant_id, app.roles_write_governance()))
  with check (app.has_tenant_access(tenant_id) and app.has_tenant_role(tenant_id, app.roles_write_governance()));

-- -----------------------------------------------------------------------------
-- La lecture : ce que la fiche d'un actif affiche
-- -----------------------------------------------------------------------------
create or replace function public.asset_tooling_view(p_asset_id uuid)
returns jsonb
language sql
stable
security invoker
set search_path = app, public, pg_catalog
as $$
  with asset as (
    select a.* from public.ai_asset a
    join public.organization o on o.id = a.organization_id
    where a.id = p_asset_id and app.has_tenant_access(o.tenant_id)
  )
  select jsonb_build_object(
    'asset_id', (select id from asset),
    'declared', coalesce((select jsonb_agg(jsonb_build_object(
        'id', at.id, 'tooling_id', ot.id, 'product', ot.product, 'phase', at.phase,
        'note', at.note, 'role', ot.role,
        'family', (select t.tool_service from public.catalog_tool t where t.code = ot.tool_code limit 1),
        'vendor', (select jsonb_build_object('id', v.id, 'name', v.name, 'review_status', v.review_status)
                     from public.vendor v where v.id = ot.vendor_id))
      order by at.phase, ot.product)
      from public.asset_tooling at
      join public.organization_tooling ot on ot.id = at.tooling_id
      where at.asset_id = p_asset_id), '[]'::jsonb),
    -- Tout l'outillage de l'organisation : pour en désigner un.
    'available', coalesce((select jsonb_agg(jsonb_build_object(
        'id', ot.id, 'product', ot.product, 'role', ot.role,
        'family', (select t.tool_service from public.catalog_tool t where t.code = ot.tool_code limit 1))
      order by ot.product)
      from public.organization_tooling ot
      where ot.organization_id = (select organization_id from asset)), '[]'::jsonb)
  );
$$;

comment on function public.asset_tooling_view is
  'Avec quoi cet actif a été fait, et ce que l''organisation peut encore y rattacher (0103).';

revoke all on function public.asset_tooling_view(uuid) from public, anon;
grant execute on function public.asset_tooling_view(uuid) to authenticated;

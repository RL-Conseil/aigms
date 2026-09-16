-- =============================================================================
-- AIGMS — 0041 — Le journal couvre aussi ce qui n'a pas de tenant_id
-- =============================================================================
-- Le déclencheur générique (0033) lit le tenant dans la colonne `tenant_id`.
-- Trois tables n'en ont pas et lui échappaient :
--
--   * `tenant`          — la marque blanche (0036) se changeait sans trace ;
--   * `user_profile`    — nom, fonction, organisation courante ;
--   * `catalog_version` — la publication d'un référentiel (l'import, lui,
--                          est journalisé par sa propre fonction).
--
-- Chacune connaît son tenant autrement : par sa propre clé, par l'appartenance,
-- par le travail d'import qui l'a produite. Un déclencheur par cas, et la
-- fonction de couverture élargie pour que le trou ne se rouvre pas.
-- =============================================================================

-- -----------------------------------------------------------------------------
-- tenant : le tenant, c'est la ligne elle-même
-- -----------------------------------------------------------------------------
create or replace function app.audit_tenant()
returns trigger
language plpgsql
security definer
set search_path = app, public, pg_catalog
as $$
declare
  v_id uuid := coalesce(new.id, old.id);
begin
  perform app.log_audit(
    v_id,
    case tg_op when 'INSERT' then 'create' when 'DELETE' then 'delete' else 'update' end::app.audit_action,
    'tenant',
    v_id,
    coalesce(new.slug, old.slug),
    case tg_op
      when 'INSERT' then format('Tenant « %s » créé', new.name)
      when 'DELETE' then format('Tenant « %s » supprimé', old.name)
      else format('Tenant « %s » modifié', new.name)
    end,
    case when tg_op = 'INSERT' then null else to_jsonb(old) end,
    case when tg_op = 'DELETE' then null else to_jsonb(new) end
  );
  return coalesce(new, old);
end;
$$;

create trigger tenant_audit
  after insert or update or delete on public.tenant
  for each row execute function app.audit_tenant();

-- -----------------------------------------------------------------------------
-- user_profile : le tenant par l'appartenance active
-- -----------------------------------------------------------------------------
-- Une personne appartient a un tenant (unique par couple tenant/user, et en
-- pratique un seul tenant par personne). Sans appartenance — profil cree a
-- l'inscription, avant rattachement — il n'y a pas encore de tenant a qui
-- rendre compte : on n'ecrit rien.
create or replace function app.audit_user_profile()
returns trigger
language plpgsql
security definer
set search_path = app, public, pg_catalog
as $$
declare
  v_id     uuid := coalesce(new.id, old.id);
  v_tenant uuid;
begin
  select m.tenant_id into v_tenant
  from public.membership m
  where m.user_id = v_id and m.status = 'active'
  order by m.created_at
  limit 1;

  if v_tenant is null then
    return coalesce(new, old);
  end if;

  perform app.log_audit(
    v_tenant,
    case tg_op when 'INSERT' then 'create' when 'DELETE' then 'delete' else 'update' end::app.audit_action,
    'user_profile',
    v_id,
    coalesce(new.email, old.email),
    case tg_op
      when 'DELETE' then format('Profil « %s » supprimé', old.email)
      else format('Profil « %s » modifié', coalesce(new.full_name, new.email))
    end,
    case when tg_op = 'INSERT' then null else to_jsonb(old) end,
    case when tg_op = 'DELETE' then null else to_jsonb(new) end
  );
  return coalesce(new, old);
end;
$$;

create trigger user_profile_audit
  after insert or update or delete on public.user_profile
  for each row execute function app.audit_user_profile();

-- -----------------------------------------------------------------------------
-- catalog_version : le tenant par le travail d'import qui l'a produite
-- -----------------------------------------------------------------------------
create or replace function app.audit_catalog_version()
returns trigger
language plpgsql
security definer
set search_path = app, public, pg_catalog
as $$
declare
  v_id     uuid := coalesce(new.id, old.id);
  v_tenant uuid;
begin
  select j.tenant_id into v_tenant
  from public.catalog_import_job j
  where j.version_id = v_id
  order by j.uploaded_at desc
  limit 1;

  if v_tenant is null then
    return coalesce(new, old);
  end if;

  perform app.log_audit(
    v_tenant,
    case tg_op when 'INSERT' then 'create' when 'DELETE' then 'delete' else 'update' end::app.audit_action,
    'catalog_version',
    v_id,
    coalesce(new.version, old.version),
    case tg_op
      when 'DELETE' then format('Version %s du référentiel supprimée', old.version)
      when 'UPDATE' then
        case when new.status is distinct from old.status
          then format('Version %s du référentiel : %s → %s', new.version, old.status, new.status)
          else format('Version %s du référentiel modifiée', new.version)
        end
      else format('Version %s du référentiel créée', new.version)
    end,
    case when tg_op = 'INSERT' then null else to_jsonb(old) end,
    case when tg_op = 'DELETE' then null else to_jsonb(new) end
  );
  return coalesce(new, old);
end;
$$;

create trigger catalog_version_audit
  after insert or update or delete on public.catalog_version
  for each row execute function app.audit_catalog_version();

-- -----------------------------------------------------------------------------
-- La couverture inclut ces trois tables
-- -----------------------------------------------------------------------------
-- Les tables sans tenant_id qui doivent neanmoins etre journalisees sont
-- nommees ici ; la fonction refuse qu'elles perdent leur declencheur.
create or replace function app.audit_coverage_gaps()
returns table (table_name text)
language sql
stable
security definer
set search_path = app, public, pg_catalog
as $$
  select c.relname::text
  from pg_class c
  join pg_namespace n on n.oid = c.relnamespace
  where n.nspname = 'public'
    and c.relkind = 'r'
    and (
      exists (
        select 1 from information_schema.columns col
        where col.table_schema = 'public' and col.table_name = c.relname
          and col.column_name = 'tenant_id'
      )
      or c.relname in ('tenant', 'user_profile', 'catalog_version')
    )
    and c.relname not in ('audit_log', 'governance_event', 'connector_sync_run')
    and not exists (
      select 1 from pg_trigger t
      where t.tgrelid = c.oid
        and not t.tgisinternal
        and t.tgname like '%\_audit'
    );
$$;

-- -----------------------------------------------------------------------------
-- Lecture paginée pour l'écran d'administration
-- -----------------------------------------------------------------------------
-- La RLS du journal decide de ce qui est visible ; cette fonction ne fait que
-- filtrer et paginer ce que la RLS laisse passer (SECURITY INVOKER).
create or replace function public.audit_log_page(
  p_since        timestamptz default null,
  p_until        timestamptz default null,
  p_action       text        default null,
  p_entity_type  text        default null,
  p_actor        text        default null,
  p_search       text        default null,
  p_limit        integer     default 200,
  p_offset       integer     default 0
)
returns setof public.audit_log
language sql
stable
security invoker
set search_path = app, public, pg_catalog
as $$
  select *
  from public.audit_log a
  where (p_since is null or a.occurred_at >= p_since)
    and (p_until is null or a.occurred_at < p_until)
    and (p_action is null or a.action::text = p_action)
    and (p_entity_type is null or a.entity_type = p_entity_type)
    and (p_actor is null or a.actor_email ilike '%' || p_actor || '%')
    and (p_search is null
         or a.summary ilike '%' || p_search || '%'
         or a.entity_ref ilike '%' || p_search || '%')
  order by a.occurred_at desc, a.id desc
  limit least(greatest(p_limit, 1), 5000)
  offset greatest(p_offset, 0);
$$;

grant execute on function public.audit_log_page(timestamptz, timestamptz, text, text, text, text, integer, integer)
  to authenticated;

-- Les valeurs distinctes, pour les filtres.
create or replace function public.audit_log_facets()
returns jsonb
language sql
stable
security invoker
set search_path = app, public, pg_catalog
as $$
  select jsonb_build_object(
    'actions',      (select coalesce(jsonb_agg(distinct action::text), '[]'::jsonb) from public.audit_log),
    'entity_types', (select coalesce(jsonb_agg(distinct entity_type), '[]'::jsonb) from public.audit_log),
    'actors',       (select coalesce(jsonb_agg(distinct actor_email), '[]'::jsonb) from public.audit_log where actor_email is not null),
    'total',        (select count(*) from public.audit_log)
  );
$$;

grant execute on function public.audit_log_facets() to authenticated;

-- -----------------------------------------------------------------------------
-- L'export est lui-même journalisé
-- -----------------------------------------------------------------------------
-- Telecharger le journal est un acte sensible : on sait qui l'a fait, quand,
-- avec quels filtres, et combien de lignes sont sorties.
create or replace function public.log_audit_export(
  p_tenant_id uuid,
  p_count     integer,
  p_filters   jsonb default '{}'::jsonb
)
returns void
language plpgsql
security definer
set search_path = app, public, pg_catalog
as $$
begin
  if not app.has_tenant_role(p_tenant_id, app.roles_administer()) then
    raise exception 'L''export du journal relève de l''administration.' using errcode = 'insufficient_privilege';
  end if;
  perform app.log_audit(
    p_tenant_id, 'export', 'audit_log', null, null,
    format('Export du journal d''audit : %s entrée(s)', p_count),
    null, null,
    jsonb_build_object('filters', p_filters, 'count', p_count)
  );
end;
$$;

grant execute on function public.log_audit_export(uuid, integer, jsonb) to authenticated;

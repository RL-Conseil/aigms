-- =============================================================================
-- AIGMS — 0005 — Row Level Security
-- Sprint 0 — Exit gate : le tenant A ne peut ni lire ni écrire le tenant B.
-- =============================================================================
-- Conventions :
--   * RLS activée ET forcée sur toute table de `public` ;
--   * `anon` ne dispose d'aucun droit : AIGMS n'a pas de surface publique ;
--   * lecture = app.has_tenant_access(tenant_id) ;
--   * écriture = rôle habilité, contrôlé à la fois en USING et en WITH CHECK
--     (sans WITH CHECK, un UPDATE pourrait déplacer une ligne vers un autre tenant).
-- =============================================================================

alter table public.tenant           enable row level security;
alter table public.user_profile     enable row level security;
alter table public.membership       enable row level security;
alter table public.organization     enable row level security;
alter table public.business_unit    enable row level security;
alter table public.role_assignment  enable row level security;
alter table public.audit_log        enable row level security;
alter table public.governance_event enable row level security;

-- `force` : le propriétaire des tables reste soumis aux policies.
alter table public.tenant           force row level security;
alter table public.user_profile     force row level security;
alter table public.membership       force row level security;
alter table public.organization     force row level security;
alter table public.business_unit    force row level security;
alter table public.role_assignment  force row level security;
alter table public.audit_log        force row level security;
alter table public.governance_event force row level security;

-- -----------------------------------------------------------------------------
-- Aucun accès anonyme.
-- -----------------------------------------------------------------------------
revoke all on all tables    in schema public from anon;
revoke all on all sequences in schema public from anon;
revoke all on all functions in schema public from anon;

alter default privileges in schema public revoke all on tables    from anon;
alter default privileges in schema public revoke all on sequences from anon;

-- -----------------------------------------------------------------------------
-- tenant
-- -----------------------------------------------------------------------------
create policy tenant_select on public.tenant
  for select to authenticated
  using (app.has_tenant_access(id));

-- La création d'un tenant est un acte plateforme, hors parcours applicatif.
create policy tenant_insert on public.tenant
  for insert to authenticated
  with check (app.is_platform_admin());

create policy tenant_update on public.tenant
  for update to authenticated
  using (app.has_tenant_role(id, array['platform_admin', 'client_admin']::app.app_role[]))
  with check (app.has_tenant_role(id, array['platform_admin', 'client_admin']::app.app_role[]));

-- Pas de policy DELETE : un tenant s'archive (status = 'archived'), il ne se supprime pas.

-- -----------------------------------------------------------------------------
-- user_profile
-- -----------------------------------------------------------------------------
-- Un utilisateur voit son profil et celui des personnes avec qui il partage un tenant.
create policy user_profile_select on public.user_profile
  for select to authenticated
  using (
    id = app.current_user_id()
    or app.is_platform_admin()
    or exists (
      select 1
      from public.membership mine
      join public.membership theirs on theirs.tenant_id = mine.tenant_id
      where mine.user_id   = app.current_user_id()
        and mine.status    = 'active'
        and theirs.user_id = public.user_profile.id
        and theirs.status  = 'active'
    )
  );

create policy user_profile_update_self on public.user_profile
  for update to authenticated
  using (id = app.current_user_id() or app.is_platform_admin())
  with check (id = app.current_user_id() or app.is_platform_admin());

-- Le privilège plateforme ne s'auto-attribue pas.
create or replace function app.guard_platform_admin_flag()
returns trigger
language plpgsql
security definer
set search_path = app, public, pg_catalog
as $$
begin
  if new.is_platform_admin is distinct from old.is_platform_admin then
    -- current_user_id() vaut NULL en contexte service_role (bootstrap, seed).
    if app.current_user_id() is not null
       and not (app.is_platform_admin() and app.current_user_id() <> old.id) then
      raise exception 'is_platform_admin ne peut être modifié que par un autre administrateur plateforme'
        using errcode = 'insufficient_privilege';
    end if;
  end if;
  return new;
end;
$$;

create trigger user_profile_guard_platform_admin
  before update on public.user_profile
  for each row execute function app.guard_platform_admin_flag();

-- -----------------------------------------------------------------------------
-- membership
-- -----------------------------------------------------------------------------
create policy membership_select on public.membership
  for select to authenticated
  using (app.has_tenant_access(tenant_id));

create policy membership_write on public.membership
  for all to authenticated
  using (app.has_tenant_role(tenant_id, app.roles_write_governance()))
  with check (app.has_tenant_role(tenant_id, app.roles_write_governance()));

-- -----------------------------------------------------------------------------
-- organization
-- -----------------------------------------------------------------------------
create policy organization_select on public.organization
  for select to authenticated
  using (app.has_tenant_access(tenant_id));

create policy organization_insert on public.organization
  for insert to authenticated
  with check (app.has_tenant_role(tenant_id, app.roles_write_governance()));

create policy organization_update on public.organization
  for update to authenticated
  using (
    app.has_tenant_access(tenant_id)
    and app.has_organization_role(id, app.roles_write_governance())
  )
  with check (
    app.has_tenant_role(tenant_id, app.roles_write_governance())
  );

-- Pas de policy DELETE : archivage uniquement (traces d'audit conservées).

-- -----------------------------------------------------------------------------
-- business_unit
-- -----------------------------------------------------------------------------
create policy business_unit_select on public.business_unit
  for select to authenticated
  using (app.has_tenant_access(tenant_id));

create policy business_unit_write on public.business_unit
  for all to authenticated
  using (
    app.has_tenant_access(tenant_id)
    and app.has_organization_role(organization_id, app.roles_write_governance())
  )
  with check (
    app.has_tenant_role(tenant_id, app.roles_write_governance())
  );

-- -----------------------------------------------------------------------------
-- role_assignment
-- -----------------------------------------------------------------------------
create policy role_assignment_select on public.role_assignment
  for select to authenticated
  using (app.has_tenant_access(tenant_id));

create policy role_assignment_write on public.role_assignment
  for all to authenticated
  using (app.has_tenant_role(tenant_id, app.roles_write_governance()))
  with check (app.has_tenant_role(tenant_id, app.roles_write_governance()));

-- -----------------------------------------------------------------------------
-- audit_log — lecture restreinte, écriture exclusivement via app.log_audit
-- -----------------------------------------------------------------------------
create policy audit_log_select on public.audit_log
  for select to authenticated
  using (
    app.has_tenant_access(tenant_id)
    and app.has_tenant_role(
          tenant_id,
          array['platform_admin', 'governance_officer', 'client_admin', 'auditor']::app.app_role[]
        )
  );

-- Aucune policy INSERT / UPDATE / DELETE : les écritures directes sont refusées.

-- -----------------------------------------------------------------------------
-- governance_event — lecture tenant, écriture via app.emit_event
-- -----------------------------------------------------------------------------
create policy governance_event_select on public.governance_event
  for select to authenticated
  using (app.has_tenant_access(tenant_id));

-- -----------------------------------------------------------------------------
-- Droits de table explicites
-- -----------------------------------------------------------------------------
grant select                         on public.tenant           to authenticated;
grant insert, update                 on public.tenant           to authenticated;
grant select, update                 on public.user_profile     to authenticated;
grant select, insert, update, delete on public.membership       to authenticated;
grant select, insert, update         on public.organization     to authenticated;
grant select, insert, update, delete on public.business_unit    to authenticated;
grant select, insert, update, delete on public.role_assignment  to authenticated;
grant select                         on public.audit_log        to authenticated;
grant select                         on public.governance_event to authenticated;

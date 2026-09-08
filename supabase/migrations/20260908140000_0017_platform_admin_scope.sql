-- =============================================================================
-- AIGMS — 0017 — Périmètre du rôle d'administration plateforme
-- =============================================================================
-- Jusqu'ici `app.is_platform_admin()` court-circuitait tous les contrôles de
-- rôle : l'administrateur pouvait tout faire partout. C'est le contraire de ce
-- qu'on attend de lui.
--
-- L'administration de la plateforme ouvre l'accès ; elle ne gouverne pas.
-- Elle crée des organisations, déclare des comptes et attribue des rôles.
-- Elle ne déclare pas de cas d'usage, ne cote pas de risque, n'approuve aucune
-- décision et ne fait passer aucun système en production : ces actes engagent
-- une responsabilité métier, qui appartient aux rôles de gouvernance.
--
-- Le privilège transverse conservé est la LECTURE : un exploitant de plateforme
-- doit pouvoir constater l'état d'un portefeuille pour l'administrer. Cette
-- lecture reste journalisée comme toute autre.
-- =============================================================================

-- -----------------------------------------------------------------------------
-- Ensembles de rôles : l'administration sort des rôles de gouvernance
-- -----------------------------------------------------------------------------
create or replace function app.roles_administer()
returns app.app_role[]
language sql immutable set search_path = pg_catalog as $$
  select array['platform_admin']::app.app_role[];
$$;

comment on function app.roles_administer is
  'Rôle d''administration de la plateforme : organisations, comptes et attributions de rôles. Aucun acte de gouvernance.';

create or replace function app.roles_write_governance()
returns app.app_role[]
language sql immutable set search_path = pg_catalog as $$
  select array['governance_officer', 'client_admin']::app.app_role[];
$$;

comment on function app.roles_write_governance is
  'Rôles habilités à créer et modifier les objets structurants de gouvernance. L''administration plateforme en est exclue depuis la migration 0017.';

create or replace function app.roles_contribute()
returns app.app_role[]
language sql immutable set search_path = pg_catalog as $$
  select array['governance_officer', 'client_admin', 'system_owner']::app.app_role[];
$$;

create or replace function app.roles_risk()
returns app.app_role[]
language sql immutable set search_path = pg_catalog as $$
  select array['governance_officer', 'client_admin', 'risk_owner']::app.app_role[];
$$;

create or replace function app.roles_review()
returns app.app_role[]
language sql immutable set search_path = pg_catalog as $$
  select array['governance_officer', 'client_admin', 'reviewer']::app.app_role[];
$$;

grant execute on function app.roles_administer() to authenticated, service_role;

-- -----------------------------------------------------------------------------
-- Les prédicats de rôle ne court-circuitent plus sur le privilège plateforme
-- -----------------------------------------------------------------------------
-- `has_tenant_access` le conserve : c'est la lecture, et elle est voulue.
-- `has_tenant_role` et `has_organization_role` ne l'ont plus : un administrateur
-- n'obtient un rôle de gouvernance que si quelqu'un le lui a explicitement
-- attribué, comme n'importe qui d'autre.
-- -----------------------------------------------------------------------------
create or replace function app.has_tenant_role(p_tenant_id uuid, p_roles app.app_role[])
returns boolean
language sql
stable
security definer
set search_path = app, public, pg_catalog
as $$
  select app.tenant_role(p_tenant_id) = any (p_roles);
$$;

comment on function app.has_tenant_role is
  'Vrai si le rôle porté par l''appartenance au tenant figure parmi ceux attendus. Le privilège plateforme n''y ouvre aucun droit implicite (migration 0017).';

create or replace function app.has_organization_role(p_organization_id uuid, p_roles app.app_role[])
returns boolean
language sql
stable
security definer
set search_path = app, public, pg_catalog
as $$
  select app.organization_roles(p_organization_id) && p_roles;
$$;

comment on function app.has_organization_role is
  'Vrai si l''un des rôles effectifs sur l''organisation figure parmi ceux attendus. Sans court-circuit plateforme (migration 0017).';

-- -----------------------------------------------------------------------------
-- Politiques d'administration
-- -----------------------------------------------------------------------------
-- Organisations : création et modification par l'administration ; les rôles de
-- gouvernance conservent la mise à jour des données de contexte de leur client.
drop policy if exists organization_insert on public.organization;
create policy organization_insert on public.organization
  for insert to authenticated
  with check (app.has_tenant_role(tenant_id, app.roles_administer()));

drop policy if exists organization_update on public.organization;
create policy organization_update on public.organization
  for update to authenticated
  using (
    app.has_tenant_access(tenant_id)
    and (
      app.has_tenant_role(tenant_id, app.roles_administer())
      or app.has_organization_role(id, app.roles_write_governance())
    )
  )
  with check (
    app.has_tenant_role(tenant_id, app.roles_administer())
    or app.has_tenant_role(tenant_id, app.roles_write_governance())
  );

-- Comptes et attributions de rôles : administration seule.
drop policy if exists membership_write on public.membership;
create policy membership_write on public.membership
  for all to authenticated
  using (app.has_tenant_role(tenant_id, app.roles_administer()))
  with check (app.has_tenant_role(tenant_id, app.roles_administer()));

drop policy if exists role_assignment_write on public.role_assignment;
create policy role_assignment_write on public.role_assignment
  for all to authenticated
  using (app.has_tenant_role(tenant_id, app.roles_administer()))
  with check (app.has_tenant_role(tenant_id, app.roles_administer()));

-- Les entités d'une organisation relèvent de la gouvernance, pas de l'administration.
drop policy if exists business_unit_write on public.business_unit;
create policy business_unit_write on public.business_unit
  for all to authenticated
  using (
    app.has_tenant_access(tenant_id)
    and app.has_organization_role(organization_id, app.roles_write_governance())
  )
  with check (app.has_tenant_role(tenant_id, app.roles_write_governance()));

-- Tenant : seule l'administration le modifie.
drop policy if exists tenant_update on public.tenant;
create policy tenant_update on public.tenant
  for update to authenticated
  using (app.has_tenant_role(id, app.roles_administer()))
  with check (app.has_tenant_role(id, app.roles_administer()));

-- -----------------------------------------------------------------------------
-- Rôles attribuables par l'administration
-- -----------------------------------------------------------------------------
-- L'administration ne se recrute pas elle-même : `platform_admin` ne figure pas
-- dans cette liste, pas plus que `client_admin`, qui porte des droits de
-- gouvernance étendus. Ces deux-là s'attribuent hors application.
create or replace function app.assignable_roles()
returns app.app_role[]
language sql immutable set search_path = pg_catalog as $$
  select array[
    'governance_officer',
    'system_owner',
    'risk_owner',
    'reviewer',
    'auditor',
    'executive_viewer'
  ]::app.app_role[];
$$;

comment on function app.assignable_roles is
  'Rôles qu''un administrateur peut attribuer depuis l''application. Exclut platform_admin et client_admin, qui s''octroieraient des pouvoirs.';

grant execute on function app.assignable_roles() to authenticated, service_role;

create or replace function app.guard_assignable_role()
returns trigger
language plpgsql
security definer
set search_path = app, public, pg_catalog
as $$
begin
  -- Un administrateur plateforme peut attribuer les rôles opérationnels, pas
  -- ceux qui étendraient son propre pouvoir. La contrainte ne s'applique pas
  -- au contexte service_role (amorçage, jeux de données).
  if app.current_user_id() is not null
     and not (new.role = any (app.assignable_roles()))
     and app.tenant_role(new.tenant_id) = 'platform_admin' then
    raise exception 'Le rôle % ne peut pas être attribué depuis l''application.', new.role
      using errcode = 'insufficient_privilege';
  end if;
  return new;
end;
$$;

create trigger membership_guard_assignable_role
  before insert or update on public.membership
  for each row execute function app.guard_assignable_role();

create trigger role_assignment_guard_assignable_role
  before insert or update on public.role_assignment
  for each row execute function app.guard_assignable_role();

-- =============================================================================
-- AIGMS — 0003 — Helpers RLS
-- Sprint 0
-- =============================================================================
-- Toutes les policies s'appuient sur ces fonctions SECURITY DEFINER. Elles
-- contournent volontairement la RLS pour lire `membership` et `role_assignment`
-- sans provoquer de récursion infinie dans les policies de ces mêmes tables.
--
-- Règle : aucune policy ne fait de SELECT direct sur membership/role_assignment.
-- =============================================================================

-- -----------------------------------------------------------------------------
-- Identité courante
-- -----------------------------------------------------------------------------
create or replace function app.current_user_id()
returns uuid
language sql
stable
set search_path = pg_catalog
as $$
  -- Le claim peut etre absent ou vide (acces anonyme) : le cast en jsonb doit
  -- etre protege, sinon une requete anonyme leve une erreur au lieu de ne rien
  -- voir.
  select nullif(
           nullif(current_setting('request.jwt.claims', true), '')::jsonb ->> 'sub',
           ''
         )::uuid;
$$;

comment on function app.current_user_id is
  'Identifiant de l''utilisateur authentifié, ou NULL en accès anonyme.';

create or replace function app.is_platform_admin()
returns boolean
language sql
stable
security definer
set search_path = app, public, pg_catalog
as $$
  select coalesce(
    (select p.is_platform_admin
     from public.user_profile p
     where p.id = app.current_user_id()),
    false
  );
$$;

comment on function app.is_platform_admin is
  'Vrai si l''utilisateur courant porte le privilège plateforme. Un platform_admin traverse les tenants : chacun de ses accès est journalisé.';

-- -----------------------------------------------------------------------------
-- Portée tenant
-- -----------------------------------------------------------------------------
create or replace function app.has_tenant_access(p_tenant_id uuid)
returns boolean
language sql
stable
security definer
set search_path = app, public, pg_catalog
as $$
  select p_tenant_id is not null
     and (
       app.is_platform_admin()
       or exists (
         select 1
         from public.membership m
         where m.tenant_id = p_tenant_id
           and m.user_id   = app.current_user_id()
           and m.status    = 'active'
       )
     );
$$;

comment on function app.has_tenant_access is
  'Prédicat d''isolation central : appartenance active au tenant. Utilisé par la clause USING de toute policy métier.';

create or replace function app.tenant_role(p_tenant_id uuid)
returns app.app_role
language sql
stable
security definer
set search_path = app, public, pg_catalog
as $$
  select m.role
  from public.membership m
  where m.tenant_id = p_tenant_id
    and m.user_id   = app.current_user_id()
    and m.status    = 'active';
$$;

comment on function app.tenant_role is
  'Rôle par défaut de l''utilisateur courant sur un tenant, NULL s''il n''y appartient pas.';

create or replace function app.has_tenant_role(p_tenant_id uuid, p_roles app.app_role[])
returns boolean
language sql
stable
security definer
set search_path = app, public, pg_catalog
as $$
  select app.is_platform_admin()
      or app.tenant_role(p_tenant_id) = any (p_roles);
$$;

comment on function app.has_tenant_role is
  'Vrai si l''utilisateur détient l''un des rôles attendus sur le tenant.';

-- -----------------------------------------------------------------------------
-- Portée organisation
-- -----------------------------------------------------------------------------
create or replace function app.organization_roles(p_organization_id uuid)
returns app.app_role[]
language sql
stable
security definer
set search_path = app, public, pg_catalog
as $$
  select coalesce(
    array_agg(distinct r.role),
    case
      when o.tenant_id is not null and app.tenant_role(o.tenant_id) is not null
        then array[app.tenant_role(o.tenant_id)]
      else array[]::app.app_role[]
    end
  )
  from public.organization o
  left join public.role_assignment r
         on r.organization_id = o.id
        and r.user_id         = app.current_user_id()
        and r.valid_from     <= now()
        and (r.valid_until is null or r.valid_until > now())
  where o.id = p_organization_id
  group by o.tenant_id;
$$;

comment on function app.organization_roles is
  'Rôles effectifs sur une organisation : affectations explicites, à défaut le rôle tenant par défaut.';

create or replace function app.has_organization_role(p_organization_id uuid, p_roles app.app_role[])
returns boolean
language sql
stable
security definer
set search_path = app, public, pg_catalog
as $$
  select app.is_platform_admin()
      or app.organization_roles(p_organization_id) && p_roles;
$$;

comment on function app.has_organization_role is
  'Vrai si l''utilisateur détient au moins un des rôles attendus sur l''organisation.';

-- -----------------------------------------------------------------------------
-- Rôles agrégés réutilisés par les policies
-- -----------------------------------------------------------------------------
create or replace function app.roles_write_governance()
returns app.app_role[]
language sql
immutable
set search_path = pg_catalog
as $$
  select array['platform_admin', 'governance_officer', 'client_admin']::app.app_role[];
$$;

comment on function app.roles_write_governance is
  'Rôles habilités à créer et modifier les objets structurants de gouvernance.';

create or replace function app.roles_read_only()
returns app.app_role[]
language sql
immutable
set search_path = pg_catalog
as $$
  select array['auditor', 'executive_viewer']::app.app_role[];
$$;

comment on function app.roles_read_only is
  'Rôles en lecture seule stricte : ne doivent jamais satisfaire une clause WITH CHECK.';

-- -----------------------------------------------------------------------------
-- Droits d'exécution
-- -----------------------------------------------------------------------------
revoke all on function
  app.current_user_id(),
  app.is_platform_admin(),
  app.has_tenant_access(uuid),
  app.tenant_role(uuid),
  app.has_tenant_role(uuid, app.app_role[]),
  app.organization_roles(uuid),
  app.has_organization_role(uuid, app.app_role[]),
  app.roles_write_governance(),
  app.roles_read_only()
from public;

grant execute on function
  app.current_user_id(),
  app.is_platform_admin(),
  app.has_tenant_access(uuid),
  app.tenant_role(uuid),
  app.has_tenant_role(uuid, app.app_role[]),
  app.organization_roles(uuid),
  app.has_organization_role(uuid, app.app_role[]),
  app.roles_write_governance(),
  app.roles_read_only()
to authenticated, service_role;

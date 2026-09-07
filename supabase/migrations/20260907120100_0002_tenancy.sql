-- =============================================================================
-- AIGMS — 0002 — Tenancy & Accountability
-- Sprint 0 / prépare Sprint 1
-- =============================================================================
-- Frontière d'isolation = `tenant` (cabinet, MSP, DSI externalisée).
-- Un tenant pilote N `organization` (ses clients), chacune découpée en
-- `business_unit`. Toute table métier porte `tenant_id` : l'isolation RLS est
-- vérifiée sur une seule colonne, ce qui rend les politiques auditables.
-- =============================================================================

-- -----------------------------------------------------------------------------
-- Énumérations
-- -----------------------------------------------------------------------------
create type app.tenant_status as enum ('active', 'suspended', 'archived');

create type app.organization_status as enum ('prospect', 'pilot', 'active', 'archived');

-- Rôles — référentiel fonctionnel V4, module M02.
create type app.app_role as enum (
  'platform_admin',
  'governance_officer',
  'client_admin',
  'system_owner',
  'risk_owner',
  'reviewer',
  'auditor',
  'executive_viewer'
);

create type app.membership_status as enum ('invited', 'active', 'suspended', 'revoked');

-- -----------------------------------------------------------------------------
-- tenant
-- -----------------------------------------------------------------------------
create table public.tenant (
  id           uuid primary key default gen_random_uuid(),
  slug         text not null unique
                 check (slug ~ '^[a-z0-9]([a-z0-9-]{1,48}[a-z0-9])$'),
  name         text not null check (btrim(name) <> ''),
  status       app.tenant_status not null default 'active',
  created_at   timestamptz not null default now(),
  updated_at   timestamptz not null default now()
);

comment on table public.tenant is
  'Frontière d''isolation AIGMS. Un tenant = un cabinet / MSP / DSI externalisée pilotant un portefeuille de clients.';

create trigger tenant_touch_updated_at
  before update on public.tenant
  for each row execute function app.touch_updated_at();

-- -----------------------------------------------------------------------------
-- user_profile — projection applicative de auth.users
-- -----------------------------------------------------------------------------
create table public.user_profile (
  id            uuid primary key references auth.users (id) on delete cascade,
  email         text not null,
  full_name     text,
  job_title     text,
  is_platform_admin boolean not null default false,
  created_at    timestamptz not null default now(),
  updated_at    timestamptz not null default now()
);

comment on table public.user_profile is
  'Profil applicatif adossé à auth.users. is_platform_admin est un privilège plateforme, jamais modifiable par le porteur du compte (voir policies).';

create trigger user_profile_touch_updated_at
  before update on public.user_profile
  for each row execute function app.touch_updated_at();

-- Création automatique du profil à l'inscription.
create or replace function app.handle_new_auth_user()
returns trigger
language plpgsql
security definer
set search_path = app, public, pg_catalog
as $$
begin
  insert into public.user_profile (id, email, full_name)
  values (
    new.id,
    new.email,
    nullif(btrim(coalesce(new.raw_user_meta_data ->> 'full_name', '')), '')
  )
  on conflict (id) do nothing;
  return new;
end;
$$;

create trigger on_auth_user_created
  after insert on auth.users
  for each row execute function app.handle_new_auth_user();

-- -----------------------------------------------------------------------------
-- membership — appartenance d'un utilisateur à un tenant
-- -----------------------------------------------------------------------------
create table public.membership (
  id           uuid primary key default gen_random_uuid(),
  tenant_id    uuid not null references public.tenant (id) on delete cascade,
  user_id      uuid not null references public.user_profile (id) on delete cascade,
  role         app.app_role not null,
  status       app.membership_status not null default 'active',
  invited_by   uuid references public.user_profile (id) on delete set null,
  created_at   timestamptz not null default now(),
  updated_at   timestamptz not null default now(),
  unique (tenant_id, user_id)
);

comment on table public.membership is
  'Appartenance utilisateur ↔ tenant, avec le rôle par défaut au niveau du tenant. Une seule appartenance par couple (tenant, user).';

create index membership_user_idx   on public.membership (user_id) where status = 'active';
create index membership_tenant_idx on public.membership (tenant_id, status);

create trigger membership_touch_updated_at
  before update on public.membership
  for each row execute function app.touch_updated_at();

-- -----------------------------------------------------------------------------
-- organization — client final piloté par le tenant
-- -----------------------------------------------------------------------------
create table public.organization (
  id            uuid primary key default gen_random_uuid(),
  tenant_id     uuid not null references public.tenant (id) on delete cascade,
  business_ref  text not null,
  name          text not null check (btrim(name) <> ''),
  legal_name    text,
  sector        text,
  country_code  char(2),
  headcount     integer check (headcount is null or headcount >= 0),
  status        app.organization_status not null default 'prospect',
  created_at    timestamptz not null default now(),
  updated_at    timestamptz not null default now(),
  unique (tenant_id, business_ref)
);

comment on table public.organization is
  'Organisation cliente gouvernée au sein d''un tenant. Porte le périmètre du système de management de l''IA.';

create index organization_tenant_idx on public.organization (tenant_id, status);

create trigger organization_touch_updated_at
  before update on public.organization
  for each row execute function app.touch_updated_at();

create or replace function app.set_organization_business_ref()
returns trigger
language plpgsql
security definer
set search_path = app, public, pg_catalog
as $$
begin
  if new.business_ref is null or btrim(new.business_ref) = '' then
    new.business_ref := app.next_business_ref(new.tenant_id, 'ORG');
  end if;
  return new;
end;
$$;

create trigger organization_set_business_ref
  before insert on public.organization
  for each row execute function app.set_organization_business_ref();

-- -----------------------------------------------------------------------------
-- business_unit — découpage interne d'une organisation
-- -----------------------------------------------------------------------------
create table public.business_unit (
  id               uuid primary key default gen_random_uuid(),
  tenant_id        uuid not null references public.tenant (id) on delete cascade,
  organization_id  uuid not null references public.organization (id) on delete cascade,
  name             text not null check (btrim(name) <> ''),
  parent_id        uuid references public.business_unit (id) on delete set null,
  created_at       timestamptz not null default now(),
  updated_at       timestamptz not null default now(),
  check (parent_id is null or parent_id <> id)
);

comment on table public.business_unit is
  'Entité / direction / filiale au sein d''une organisation cliente.';

create index business_unit_org_idx on public.business_unit (organization_id);

create trigger business_unit_touch_updated_at
  before update on public.business_unit
  for each row execute function app.touch_updated_at();

-- -----------------------------------------------------------------------------
-- role_assignment — rôle scopé à une organisation
-- -----------------------------------------------------------------------------
-- Le rôle porté par `membership` est le rôle par défaut sur le tenant.
-- `role_assignment` le raffine par organisation : un même consultant peut être
-- governance_officer chez un client et auditor chez un autre.
-- -----------------------------------------------------------------------------
create table public.role_assignment (
  id               uuid primary key default gen_random_uuid(),
  tenant_id        uuid not null references public.tenant (id) on delete cascade,
  organization_id  uuid not null references public.organization (id) on delete cascade,
  user_id          uuid not null references public.user_profile (id) on delete cascade,
  role             app.app_role not null,
  valid_from       timestamptz not null default now(),
  valid_until      timestamptz,
  granted_by       uuid references public.user_profile (id) on delete set null,
  created_at       timestamptz not null default now(),
  updated_at       timestamptz not null default now(),
  unique (organization_id, user_id, role),
  check (valid_until is null or valid_until > valid_from)
);

comment on table public.role_assignment is
  'Rôle d''un utilisateur sur une organisation donnée. valid_until permet la délégation temporaire (M02).';

create index role_assignment_lookup_idx
  on public.role_assignment (user_id, organization_id);

create trigger role_assignment_touch_updated_at
  before update on public.role_assignment
  for each row execute function app.touch_updated_at();

-- -----------------------------------------------------------------------------
-- Cohérence tenant : une affectation ne peut pas franchir la frontière de tenant.
-- -----------------------------------------------------------------------------
create or replace function app.assert_tenant_consistency()
returns trigger
language plpgsql
security definer
set search_path = app, public, pg_catalog
as $$
declare
  v_org_tenant uuid;
begin
  select tenant_id into v_org_tenant
  from public.organization
  where id = new.organization_id;

  if v_org_tenant is null then
    raise exception 'organization % introuvable', new.organization_id
      using errcode = 'foreign_key_violation';
  end if;

  if v_org_tenant <> new.tenant_id then
    raise exception 'incohérence de tenant : organization % appartient au tenant %, ligne rattachée au tenant %',
      new.organization_id, v_org_tenant, new.tenant_id
      using errcode = 'check_violation';
  end if;

  return new;
end;
$$;

comment on function app.assert_tenant_consistency is
  'Interdit qu''une ligne portant tenant_id référence une organisation d''un autre tenant.';

create trigger business_unit_assert_tenant
  before insert or update on public.business_unit
  for each row execute function app.assert_tenant_consistency();

create trigger role_assignment_assert_tenant
  before insert or update on public.role_assignment
  for each row execute function app.assert_tenant_consistency();

-- =============================================================================
-- AIGMS — 0006 — AI Portfolio : registre des actifs et cas d'usage
-- Vertical slice — Sprint 2
-- =============================================================================

-- -----------------------------------------------------------------------------
-- Énumérations du portefeuille
-- -----------------------------------------------------------------------------
create type app.use_case_status as enum (
  'DRAFT', 'TRIAGE', 'ASSESSMENT', 'REVIEW',
  'APPROVED', 'CONDITIONAL_APPROVAL', 'REJECTED',
  'PILOT', 'PRODUCTION', 'MONITORING', 'RETIRED'
);

comment on type app.use_case_status is
  'Cycle de vie du cas d''usage — Domain Model V1 §3. Les transitions sont contrôlées côté serveur.';

create type app.criticality as enum ('low', 'moderate', 'high', 'critical');

create type app.autonomy_level as enum ('L0', 'L1', 'L2', 'L3', 'L4');

comment on type app.autonomy_level is
  'L0 advisory, L1 propose, L2 execute after approval, L3 execute within limits, L4 highly autonomous.';

create type app.vendor_criticality as enum ('low', 'moderate', 'high', 'critical');

create type app.vendor_review_status as enum ('not_started', 'in_progress', 'approved', 'approved_with_conditions', 'rejected', 'expired');

create type app.asset_kind as enum ('ai_system', 'ai_model', 'ai_agent', 'dataset');

-- -----------------------------------------------------------------------------
-- vendor
-- -----------------------------------------------------------------------------
create table public.vendor (
  id                    uuid primary key default gen_random_uuid(),
  tenant_id             uuid not null references public.tenant (id) on delete cascade,
  organization_id       uuid not null references public.organization (id) on delete cascade,
  business_ref          text not null,
  name                  text not null check (btrim(name) <> ''),
  is_model_provider     boolean not null default false,
  criticality           app.vendor_criticality not null default 'moderate',
  country_code          char(2),
  dpa_signed            boolean not null default false,
  security_assessed     boolean not null default false,
  reversibility_documented boolean not null default false,
  subprocessors         text,
  review_status         app.vendor_review_status not null default 'not_started',
  reviewed_at           timestamptz,
  next_review_at        date,
  notes                 text,
  created_at            timestamptz not null default now(),
  updated_at            timestamptz not null default now(),
  unique (tenant_id, business_ref)
);

comment on table public.vendor is
  'Fournisseur IA ou tiers concourant à un cas d''usage. review_status alimente le gate PRODUCTION lorsqu''un tiers est impliqué.';

create index vendor_org_idx on public.vendor (organization_id);
create trigger vendor_touch_updated_at before update on public.vendor
  for each row execute function app.touch_updated_at();
create trigger vendor_assert_tenant before insert or update on public.vendor
  for each row execute function app.assert_tenant_consistency();

-- Référence métier automatique.
create or replace function app.set_vendor_business_ref()
returns trigger language plpgsql security definer
set search_path = app, public, pg_catalog as $$
begin
  if new.business_ref is null or btrim(new.business_ref) = '' then
    new.business_ref := app.next_business_ref(new.tenant_id, 'VND');
  end if;
  return new;
end; $$;

create trigger vendor_set_business_ref before insert on public.vendor
  for each row execute function app.set_vendor_business_ref();

-- -----------------------------------------------------------------------------
-- ai_asset — table unique pour systèmes, modèles, agents et datasets
-- -----------------------------------------------------------------------------
-- Ces quatre objets partagent identité, propriété et rattachement fournisseur.
-- Une table discriminée par `kind` évite quatre tables quasi identiques et
-- quatre jeux de policies à maintenir en cohérence.
-- -----------------------------------------------------------------------------
create table public.ai_asset (
  id               uuid primary key default gen_random_uuid(),
  tenant_id        uuid not null references public.tenant (id) on delete cascade,
  organization_id  uuid not null references public.organization (id) on delete cascade,
  business_ref     text not null,
  kind             app.asset_kind not null,
  name             text not null check (btrim(name) <> ''),
  description      text,
  vendor_id        uuid references public.vendor (id) on delete set null,
  version          text,
  owner_user_id    uuid references public.user_profile (id) on delete set null,
  -- Spécifique dataset : présence de données à caractère personnel.
  contains_personal_data boolean not null default false,
  hosting_location text,
  created_at       timestamptz not null default now(),
  updated_at       timestamptz not null default now(),
  unique (tenant_id, business_ref)
);

comment on table public.ai_asset is
  'Actif IA : système, modèle, agent ou dataset. Discriminé par `kind`.';

create index ai_asset_org_kind_idx on public.ai_asset (organization_id, kind);
create trigger ai_asset_touch_updated_at before update on public.ai_asset
  for each row execute function app.touch_updated_at();
create trigger ai_asset_assert_tenant before insert or update on public.ai_asset
  for each row execute function app.assert_tenant_consistency();

create or replace function app.set_asset_business_ref()
returns trigger language plpgsql security definer
set search_path = app, public, pg_catalog as $$
begin
  if new.business_ref is null or btrim(new.business_ref) = '' then
    new.business_ref := app.next_business_ref(
      new.tenant_id,
      case new.kind
        when 'ai_system' then 'SYS'
        when 'ai_model'  then 'MOD'
        when 'ai_agent'  then 'AGT'
        when 'dataset'   then 'DTS'
      end);
  end if;
  return new;
end; $$;

create trigger ai_asset_set_business_ref before insert on public.ai_asset
  for each row execute function app.set_asset_business_ref();

-- -----------------------------------------------------------------------------
-- ai_use_case — objet pivot (principe « use-case first »)
-- -----------------------------------------------------------------------------
create table public.ai_use_case (
  id                     uuid primary key default gen_random_uuid(),
  tenant_id              uuid not null references public.tenant (id) on delete cascade,
  organization_id        uuid not null references public.organization (id) on delete cascade,
  business_unit_id       uuid references public.business_unit (id) on delete set null,
  business_ref           text not null,

  name                   text not null check (btrim(name) <> ''),
  purpose                text not null check (btrim(purpose) <> ''),
  business_process       text,
  expected_benefit       text,

  owner_user_id          uuid references public.user_profile (id) on delete set null,
  accountable_user_id    uuid references public.user_profile (id) on delete set null,

  users_description      text,
  affected_persons       text,
  data_description       text,
  involves_personal_data boolean not null default false,
  involves_vulnerable_persons boolean not null default false,

  autonomy_level         app.autonomy_level not null default 'L0',
  decision_impact        text,
  criticality            app.criticality,

  status                 app.use_case_status not null default 'DRAFT',
  status_changed_at      timestamptz not null default now(),
  next_review_at         date,
  retired_at             timestamptz,

  created_by             uuid references public.user_profile (id) on delete set null,
  created_at             timestamptz not null default now(),
  updated_at             timestamptz not null default now(),

  unique (tenant_id, business_ref)
);

comment on table public.ai_use_case is
  'Cas d''usage IA : point d''entrée de toute la gouvernance. Le statut n''est jamais modifié directement par le client (voir app.transition_use_case).';
comment on column public.ai_use_case.accountable_user_id is
  'Responsable redevable (accountable). Distinct de l''owner opérationnel : exigence de human accountability.';

create index ai_use_case_org_status_idx on public.ai_use_case (organization_id, status);
create index ai_use_case_review_idx     on public.ai_use_case (tenant_id, next_review_at)
  where next_review_at is not null;

create trigger ai_use_case_touch_updated_at before update on public.ai_use_case
  for each row execute function app.touch_updated_at();
create trigger ai_use_case_assert_tenant before insert or update on public.ai_use_case
  for each row execute function app.assert_tenant_consistency();

-- Référence métier automatique.
create or replace function app.set_use_case_business_ref()
returns trigger
language plpgsql
security definer
set search_path = app, public, pg_catalog
as $$
begin
  if new.business_ref is null or btrim(new.business_ref) = '' then
    new.business_ref := app.next_business_ref(new.tenant_id, 'UC');
  end if;
  return new;
end;
$$;

create trigger ai_use_case_set_business_ref
  before insert on public.ai_use_case
  for each row execute function app.set_use_case_business_ref();

-- Le statut se pilote par la fonction de transition, jamais par un UPDATE direct.
create or replace function app.guard_use_case_status()
returns trigger
language plpgsql
as $$
begin
  if new.status is distinct from old.status
     and coalesce(current_setting('aigms.allow_status_change', true), 'off') <> 'on' then
    raise exception 'Le statut d''un cas d''usage se modifie via app.transition_use_case(), pas par un UPDATE direct.'
      using errcode = 'insufficient_privilege';
  end if;
  return new;
end;
$$;

comment on function app.guard_use_case_status is
  'Interdit toute modification du statut hors de la fonction de transition, qui seule évalue les gates.';

create trigger ai_use_case_guard_status
  before update on public.ai_use_case
  for each row execute function app.guard_use_case_status();

-- -----------------------------------------------------------------------------
-- use_case_asset_link — rattachement N:N cas d'usage ↔ actifs
-- -----------------------------------------------------------------------------
create table public.use_case_asset_link (
  id             uuid primary key default gen_random_uuid(),
  tenant_id      uuid not null references public.tenant (id) on delete cascade,
  use_case_id    uuid not null references public.ai_use_case (id) on delete cascade,
  asset_id       uuid not null references public.ai_asset (id) on delete cascade,
  relation       text not null default 'uses',
  created_at     timestamptz not null default now(),
  unique (use_case_id, asset_id)
);

comment on table public.use_case_asset_link is
  'Rattachement des actifs IA à un cas d''usage. Permet de savoir quels modèles et datasets sont concernés par un changement.';

create index use_case_asset_link_asset_idx on public.use_case_asset_link (asset_id);

-- -----------------------------------------------------------------------------
-- use_case_vendor_link — fournisseurs impliqués dans un cas d'usage
-- -----------------------------------------------------------------------------
create table public.use_case_vendor_link (
  id           uuid primary key default gen_random_uuid(),
  tenant_id    uuid not null references public.tenant (id) on delete cascade,
  use_case_id  uuid not null references public.ai_use_case (id) on delete cascade,
  vendor_id    uuid not null references public.vendor (id) on delete cascade,
  created_at   timestamptz not null default now(),
  unique (use_case_id, vendor_id)
);

comment on table public.use_case_vendor_link is
  'Fournisseurs tiers d''un cas d''usage. Déclenche la précondition « vendor review » du gate PRODUCTION.';

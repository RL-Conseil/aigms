-- =============================================================================
-- AIGMS — 0024 — Processus et activités
-- Incrément 1 de la cartographie orientée process
-- =============================================================================
-- Le modèle cible devient :
--
--   Organisation → Processus → Activité → Cas d'usage IA → Risque → Contrôle
--                → Preuve → Décision → Action / Revue
--
-- Jusqu'ici, `ai_use_case.business_process` était un champ de texte libre. On
-- pouvait l'écrire, pas l'interroger : impossible d'agréger un niveau de risque
-- par processus, de compter les cas d'usage d'une activité, ou de dessiner la
-- moindre cartographie. C'est ce chaînon manquant que cette migration pose.
--
-- Le champ texte est conservé, rétrogradé en note de contexte : il porte
-- l'intitulé d'origine, quand le rattachement structuré n'a pas encore été fait.
-- =============================================================================

-- Typologie classique des cartographies de processus, celle que reconnaîtra
-- une organisation déjà certifiée.
create type app.process_category as enum ('management', 'core', 'support');

comment on type app.process_category is
  'Pilotage, réalisation, support — la typologie usuelle d''une cartographie de processus.';

-- -----------------------------------------------------------------------------
-- process
-- -----------------------------------------------------------------------------
create table public.process (
  id               uuid primary key default gen_random_uuid(),
  tenant_id        uuid not null references public.tenant (id) on delete cascade,
  organization_id  uuid not null references public.organization (id) on delete cascade,
  business_ref     text not null,

  code             text,
  name             text not null check (btrim(name) <> ''),
  description      text,
  category         app.process_category not null default 'core',
  owner_user_id    uuid references public.user_profile (id) on delete set null,
  display_order    integer not null default 100,

  created_by       uuid references public.user_profile (id) on delete set null,
  created_at       timestamptz not null default now(),
  updated_at       timestamptz not null default now(),

  unique (tenant_id, business_ref),
  unique (organization_id, name)
);

comment on table public.process is
  'Macro-processus métier d''une organisation. Point de départ de la cartographie : on gouverne des usages d''IA parce qu''ils servent une activité, pas l''inverse.';

create index process_org_idx on public.process (organization_id, category, display_order);

create trigger process_touch_updated_at before update on public.process
  for each row execute function app.touch_updated_at();
create trigger process_assert_tenant before insert or update on public.process
  for each row execute function app.assert_tenant_consistency();

create or replace function app.set_process_business_ref()
returns trigger language plpgsql security definer
set search_path = app, public, pg_catalog as $$
begin
  if new.business_ref is null or btrim(new.business_ref) = '' then
    new.business_ref := app.next_business_ref(new.tenant_id, 'PRC');
  end if;
  return new;
end; $$;

create trigger process_set_business_ref before insert on public.process
  for each row execute function app.set_process_business_ref();

-- -----------------------------------------------------------------------------
-- activity
-- -----------------------------------------------------------------------------
create table public.activity (
  id               uuid primary key default gen_random_uuid(),
  tenant_id        uuid not null references public.tenant (id) on delete cascade,
  organization_id  uuid not null references public.organization (id) on delete cascade,
  process_id       uuid not null references public.process (id) on delete cascade,
  business_ref     text not null,

  name             text not null check (btrim(name) <> ''),
  description      text,
  owner_user_id    uuid references public.user_profile (id) on delete set null,
  business_unit_id uuid references public.business_unit (id) on delete set null,
  display_order    integer not null default 100,

  created_by       uuid references public.user_profile (id) on delete set null,
  created_at       timestamptz not null default now(),
  updated_at       timestamptz not null default now(),

  unique (tenant_id, business_ref),
  unique (process_id, name)
);

comment on table public.activity is
  'Activité au sein d''un processus. C''est le niveau où se rattachent les cas d''usage d''IA, et celui auquel se lit la santé de la gouvernance.';

create index activity_process_idx on public.activity (process_id, display_order);
create index activity_org_idx     on public.activity (organization_id);

create trigger activity_touch_updated_at before update on public.activity
  for each row execute function app.touch_updated_at();
create trigger activity_assert_tenant before insert or update on public.activity
  for each row execute function app.assert_tenant_consistency();

create or replace function app.set_activity_business_ref()
returns trigger language plpgsql security definer
set search_path = app, public, pg_catalog as $$
begin
  if new.business_ref is null or btrim(new.business_ref) = '' then
    new.business_ref := app.next_business_ref(new.tenant_id, 'ACT-P');
  end if;
  return new;
end; $$;

create trigger activity_set_business_ref before insert on public.activity
  for each row execute function app.set_activity_business_ref();

-- Une activité appartient au processus de la même organisation : sans ce
-- contrôle, la cartographie pourrait mélanger deux clients.
create or replace function app.assert_activity_process()
returns trigger
language plpgsql
security definer
set search_path = app, public, pg_catalog
as $$
declare
  v_org uuid;
begin
  select organization_id into v_org from public.process where id = new.process_id;

  if v_org is null then
    raise exception 'Processus % introuvable', new.process_id using errcode = 'foreign_key_violation';
  end if;
  if v_org <> new.organization_id then
    raise exception 'L''activité et son processus doivent relever de la même organisation.'
      using errcode = 'check_violation';
  end if;
  return new;
end;
$$;

create trigger activity_assert_process before insert or update on public.activity
  for each row execute function app.assert_activity_process();

-- -----------------------------------------------------------------------------
-- Rattachement du cas d'usage
-- -----------------------------------------------------------------------------
alter table public.ai_use_case
  add column activity_id uuid references public.activity (id) on delete set null;

comment on column public.ai_use_case.activity_id is
  'Activité que sert ce cas d''usage. Nul tant que le rattachement n''est pas fait : la cartographie signale alors le cas d''usage comme non rattaché plutôt que de l''omettre.';
comment on column public.ai_use_case.business_process is
  'Intitulé de processus saisi en texte libre, conservé comme note de contexte. Le rattachement structuré passe par activity_id.';

create index ai_use_case_activity_idx on public.ai_use_case (activity_id)
  where activity_id is not null;

create or replace function app.assert_use_case_activity()
returns trigger
language plpgsql
security definer
set search_path = app, public, pg_catalog
as $$
declare
  v_org uuid;
begin
  if new.activity_id is null then
    return new;
  end if;

  select organization_id into v_org from public.activity where id = new.activity_id;

  if v_org is distinct from new.organization_id then
    raise exception 'Le cas d''usage et son activité doivent relever de la même organisation.'
      using errcode = 'check_violation';
  end if;
  return new;
end;
$$;

create trigger ai_use_case_assert_activity before insert or update on public.ai_use_case
  for each row execute function app.assert_use_case_activity();

-- -----------------------------------------------------------------------------
-- RLS : la cartographie métier relève de la gouvernance
-- -----------------------------------------------------------------------------
alter table public.process  enable row level security;
alter table public.process  force  row level security;
alter table public.activity enable row level security;
alter table public.activity force  row level security;

create policy process_select on public.process
  for select to authenticated using (app.has_tenant_access(tenant_id));

create policy process_write on public.process
  for all to authenticated
  using (app.has_tenant_role(tenant_id, app.roles_write_governance()))
  with check (app.has_tenant_role(tenant_id, app.roles_write_governance()));

create policy activity_select on public.activity
  for select to authenticated using (app.has_tenant_access(tenant_id));

create policy activity_write on public.activity
  for all to authenticated
  using (app.has_tenant_role(tenant_id, app.roles_write_governance()))
  with check (app.has_tenant_role(tenant_id, app.roles_write_governance()));

grant select, insert, update, delete on public.process  to authenticated;
grant select, insert, update, delete on public.activity to authenticated;
revoke all on public.process  from anon;
revoke all on public.activity from anon;

-- -----------------------------------------------------------------------------
-- Décisions : compléments issus de la spécification Process
-- -----------------------------------------------------------------------------
-- Une décision peut désormais viser un processus, une activité, un fournisseur
-- ou un actif — ce que `decision_link` permettait déjà structurellement, sans
-- que l'énuméré ne le nomme.
alter type app.decision_link_target add value if not exists 'process';
alter type app.decision_link_target add value if not exists 'activity';
alter type app.decision_link_target add value if not exists 'vendor';
alter type app.decision_link_target add value if not exists 'ai_asset';

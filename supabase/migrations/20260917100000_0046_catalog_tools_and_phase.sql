-- =============================================================================
-- AIGMS — 0046 — Couche outillage et phase de mise en place
-- =============================================================================
-- Un contrôle-type dit QUOI maîtriser. Il manquait AVEC QUOI : par quel outil
-- ou service du SI un contrôle se tient, s'il est automatisable, ce qu'il
-- contrôle, quelle preuve il produit. C'est ce que porte le classeur
-- « Outils IT, supervision et contrôles IA » — 61 lignes — et c'est la
-- fondation de l'assistant qui proposera contrôles ET outils.
--
-- La PHASE (DISCOVERY, GOVERN, BUILD, CONNECT, OPERATE) entre ici comme
-- métadonnée : sur un outil, sur un contrôle-type. Jamais un jalon, jamais un
-- axe de navigation — elle dit quand une chose se met typiquement en place.
--
-- Même règle de propriété que les référentiels : tenant_id NULL pour
-- l'outillage de l'éditeur, visible de tous ; renseigné pour celui d'un tenant.
-- =============================================================================

create type app.aigms_phase as enum ('DISCOVERY', 'GOVERN', 'BUILD', 'CONNECT', 'OPERATE');

alter table public.catalog_control
  add column phase app.aigms_phase;

comment on column public.catalog_control.phase is
  'Phase de mise en place typique. Métadonnée : ordonne les propositions de l''assistant, ne conditionne rien.';

-- -----------------------------------------------------------------------------
-- Les outils
-- -----------------------------------------------------------------------------
create table public.catalog_tool (
  id                uuid primary key default gen_random_uuid(),
  tenant_id         uuid references public.tenant (id) on delete cascade,
  code              text not null check (btrim(code) <> ''),
  phase             app.aigms_phase,
  domain            text,
  acronym           text,
  tool_service      text not null,
  definition        text,
  tool_examples     jsonb not null default '[]'::jsonb,
  controlled_object text,
  control_question  text,
  expected_evidence jsonb not null default '[]'::jsonb,
  nature            text,
  automation        text,
  frequency         text,
  owner_role        text,
  risk_addressed    text,
  iso42001_refs     jsonb not null default '[]'::jsonb,
  iso27001_refs     jsonb not null default '[]'::jsonb,
  other_frameworks  jsonb not null default '[]'::jsonb,
  priority          text,
  applicability     text,
  comments          text,
  created_at        timestamptz not null default now(),
  updated_at        timestamptz not null default now()
);

comment on table public.catalog_tool is
  'Outil ou service du SI par lequel un contrôle se tient. tenant_id NULL : outillage de l''éditeur, visible de tous.';

create unique index catalog_tool_editor_code_idx on public.catalog_tool (code) where tenant_id is null;
create unique index catalog_tool_tenant_code_idx on public.catalog_tool (tenant_id, code) where tenant_id is not null;

create trigger catalog_tool_touch_updated_at before update on public.catalog_tool
  for each row execute function app.touch_updated_at();

-- Le rattachement se fait par CODE de contrôle-type, pas par identifiant : il
-- survit aux versions du référentiel.
create table public.catalog_tool_control (
  tool_id        uuid not null references public.catalog_tool (id) on delete cascade,
  framework_code text not null,
  control_code   text not null,
  primary key (tool_id, framework_code, control_code)
);

comment on table public.catalog_tool_control is
  'Quel outil instrumente quel contrôle-type, par code : un outil tient plusieurs contrôles, un contrôle se tient par plusieurs outils.';

create index catalog_tool_control_code_idx on public.catalog_tool_control (framework_code, control_code);

-- -----------------------------------------------------------------------------
-- RLS : même règle que les référentiels
-- -----------------------------------------------------------------------------
alter table public.catalog_tool enable row level security;
alter table public.catalog_tool force row level security;
alter table public.catalog_tool_control enable row level security;
alter table public.catalog_tool_control force row level security;

create policy catalog_tool_select on public.catalog_tool
  for select to authenticated
  using (tenant_id is null or app.has_tenant_access(tenant_id));

create policy catalog_tool_write on public.catalog_tool
  for all to authenticated
  using (tenant_id is not null and app.has_tenant_role(tenant_id, app.roles_administer()))
  with check (tenant_id is not null and app.has_tenant_role(tenant_id, app.roles_administer()));

create policy catalog_tool_control_select on public.catalog_tool_control
  for select to authenticated
  using (exists (select 1 from public.catalog_tool t where t.id = tool_id
                   and (t.tenant_id is null or app.has_tenant_access(t.tenant_id))));

create policy catalog_tool_control_write on public.catalog_tool_control
  for all to authenticated
  using (exists (select 1 from public.catalog_tool t where t.id = tool_id
                   and t.tenant_id is not null and app.has_tenant_role(t.tenant_id, app.roles_administer())))
  with check (exists (select 1 from public.catalog_tool t where t.id = tool_id
                   and t.tenant_id is not null and app.has_tenant_role(t.tenant_id, app.roles_administer())));

grant select, insert, update, delete on public.catalog_tool, public.catalog_tool_control to authenticated;

create trigger catalog_tool_audit
  after insert or update or delete on public.catalog_tool
  for each row execute function app.audit_business();

-- -----------------------------------------------------------------------------
-- Les outils d'un contrôle-type
-- -----------------------------------------------------------------------------
create or replace function public.tools_for_control(p_framework_code text, p_control_code text)
returns table (
  tool_id uuid, code text, acronym text, tool_service text, definition text,
  tool_examples jsonb, automation text, nature text, phase text, is_editor boolean
)
language sql stable security invoker
set search_path = app, public, pg_catalog
as $$
  select t.id, t.code, t.acronym, t.tool_service, t.definition, t.tool_examples,
         t.automation, t.nature, t.phase::text, t.tenant_id is null
  from public.catalog_tool_control m
  join public.catalog_tool t on t.id = m.tool_id
  where m.framework_code = p_framework_code and m.control_code = p_control_code
  order by t.tenant_id is not null, t.code;
$$;

grant execute on function public.tools_for_control(text, text) to authenticated;

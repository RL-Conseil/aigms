-- =============================================================================
-- AIGMS — 0020 — Catalogue de contrôles et imports de référentiel
-- =============================================================================
-- Met en œuvre IMPORT_SPEC.md du paquet AIGMS Control Framework.
--
-- Deux notions à ne pas confondre, d'où le préfixe `catalog_` :
--   * `framework` / `requirement` (migration 0009) : les référentiels
--     NORMATIFS externes — ISO/IEC 42001, AI Act, RGPD — et leurs exigences ;
--   * `catalog_*` : la BIBLIOTHÈQUE DE CONTRÔLES-TYPES d'AIGMS, importée depuis
--     un paquet versionné, dont on instancie des `control` chez un client.
--
-- Règles de la spécification, toutes portées par le schéma :
--   * une baseline publiée est immuable ;
--   * `control_id + version` et `framework_id + version` sont uniques ;
--   * un contrôle rattaché à un domaine inconnu est rejeté ;
--   * le nombre de contrôles déclaré doit correspondre au nombre importé ;
--   * l'import est atomique ;
--   * le fichier source, son SHA-256 et son auteur sont conservés.
-- =============================================================================

create type app.catalog_version_status as enum ('draft', 'frozen', 'published', 'superseded');

create type app.import_job_status as enum (
  'UPLOADED', 'VALIDATED', 'REVIEWED', 'IMPORTED', 'PUBLISHED', 'REJECTED'
);

-- -----------------------------------------------------------------------------
-- Le référentiel et ses versions
-- -----------------------------------------------------------------------------
create table public.catalog_framework (
  id           uuid primary key default gen_random_uuid(),
  code         text not null unique check (btrim(code) <> ''),
  name         text not null,
  description  text,
  created_at   timestamptz not null default now(),
  updated_at   timestamptz not null default now()
);

comment on table public.catalog_framework is
  'Référentiel de contrôles-types, identifié par son code (ex. AIGMS-CF).';

create trigger catalog_framework_touch_updated_at
  before update on public.catalog_framework
  for each row execute function app.touch_updated_at();

create table public.catalog_version (
  id                uuid primary key default gen_random_uuid(),
  framework_id      uuid not null references public.catalog_framework (id) on delete cascade,
  version           text not null,
  status            app.catalog_version_status not null default 'draft',
  language          text,
  description       text,
  design_principle  text,
  maturity_scale    text,
  declared_domain_count  integer,
  declared_control_count integer,

  -- Provenance : exigée par la spécification.
  source_filename   text,
  source_sha256     char(64) check (source_sha256 is null or source_sha256 ~ '^[0-9a-f]{64}$'),
  imported_by       uuid references public.user_profile (id) on delete set null,
  imported_at       timestamptz,
  published_at      timestamptz,

  created_at        timestamptz not null default now(),
  updated_at        timestamptz not null default now(),

  unique (framework_id, version),
  check (status <> 'published' or published_at is not null)
);

comment on table public.catalog_version is
  'Version d''un référentiel de contrôles. Une version publiée est immuable (voir app.guard_published_catalog).';

create trigger catalog_version_touch_updated_at
  before update on public.catalog_version
  for each row execute function app.touch_updated_at();

-- -----------------------------------------------------------------------------
-- Domaines, contrôles, profils, cas d'usage de référence
-- -----------------------------------------------------------------------------
create table public.catalog_domain (
  id             uuid primary key default gen_random_uuid(),
  version_id     uuid not null references public.catalog_version (id) on delete cascade,
  code           text not null check (code ~ '^[A-Z]{2,8}$'),
  name           text not null,
  control_count  integer,
  display_order  integer,
  unique (version_id, code)
);

comment on table public.catalog_domain is
  'Domaine du référentiel (GOV, INV, USE…). Un contrôle rattaché à un domaine absent est rejeté à l''import.';

create table public.catalog_control (
  id                   uuid primary key default gen_random_uuid(),
  version_id           uuid not null references public.catalog_version (id) on delete cascade,
  domain_id            uuid not null references public.catalog_domain (id) on delete cascade,

  control_code         text not null check (btrim(control_code) <> ''),
  control_version      text not null,
  title                text not null check (btrim(title) <> ''),
  status               text,
  control_type         text,
  objective            text,
  owner_role           text,
  review_frequency     text,

  -- Champs volontairement vides en V0.1, enrichis par vagues. Conservés en
  -- jsonb : leur forme évoluera avec le référentiel, pas avec le schéma.
  applicability        jsonb not null default '{}'::jsonb,
  risks                jsonb not null default '[]'::jsonb,
  requirements         jsonb not null default '[]'::jsonb,
  assessment_questions jsonb not null default '[]'::jsonb,
  expected_evidence    jsonb not null default '[]'::jsonb,
  tests                jsonb not null default '[]'::jsonb,
  maturity_model       jsonb not null default '{}'::jsonb,
  framework_mappings   jsonb not null default '[]'::jsonb,
  remediation_guidance jsonb not null default '[]'::jsonb,

  -- Identifiants du même contrôle chez des outils tiers : c'est le pont vers
  -- Vanta, OneTrust ou ServiceNow, alimenté par les connecteurs.
  external_refs        jsonb not null default '{}'::jsonb,

  created_at           timestamptz not null default now(),
  unique (version_id, control_code, control_version)
);

comment on table public.catalog_control is
  'Contrôle-type du référentiel. `external_refs` porte ses identifiants chez les outils tiers, ce qui rend le rapprochement possible.';
comment on column public.catalog_control.framework_mappings is
  'Correspondances vers les référentiels normatifs. Des données, jamais des règles codées en dur.';

create index catalog_control_version_idx on public.catalog_control (version_id, domain_id);
create index catalog_control_code_idx    on public.catalog_control (control_code);

create table public.catalog_profile (
  id           uuid primary key default gen_random_uuid(),
  version_id   uuid not null references public.catalog_version (id) on delete cascade,
  profile_code text not null,
  name         text not null,
  description  text,
  unique (version_id, profile_code)
);

comment on table public.catalog_profile is
  'Profil d''usage type (ex. « Employee GenAI ») servant à présélectionner un jeu de contrôles.';

create table public.catalog_reference_use_case (
  id           uuid primary key default gen_random_uuid(),
  version_id   uuid not null references public.catalog_version (id) on delete cascade,
  use_case_code text not null,
  name         text not null,
  example      text,
  unique (version_id, use_case_code)
);

comment on table public.catalog_reference_use_case is
  'Cas d''usage de référence du paquet : aide au cadrage, sans lien avec les cas d''usage réels d''un client.';

-- -----------------------------------------------------------------------------
-- Immutabilité d'une baseline publiée
-- -----------------------------------------------------------------------------
create or replace function app.guard_published_catalog()
returns trigger
language plpgsql
as $$
declare
  v_status app.catalog_version_status;
  v_version_id uuid;
begin
  v_version_id := coalesce(
    (to_jsonb(coalesce(new, old)) ->> 'version_id')::uuid,
    (to_jsonb(coalesce(new, old)) ->> 'id')::uuid
  );

  select status into v_status
  from public.catalog_version
  where id = v_version_id;

  -- Publier une version, ou la marquer remplacée, reste possible : c'est le
  -- CONTENU d'une baseline publiée qui est gelé.
  if tg_table_name = 'catalog_version' and tg_op = 'UPDATE' then
    if old.status = 'published'
       and (new.version is distinct from old.version
            or new.source_sha256 is distinct from old.source_sha256
            or new.declared_control_count is distinct from old.declared_control_count) then
      raise exception 'Une baseline publiée est immuable : créez une nouvelle version.'
        using errcode = 'insufficient_privilege';
    end if;
    return new;
  end if;

  if v_status = 'published' then
    raise exception 'Une baseline publiée est immuable : % refusé sur %.', tg_op, tg_table_name
      using errcode = 'insufficient_privilege';
  end if;

  return coalesce(new, old);
end;
$$;

comment on function app.guard_published_catalog is
  'Gèle le contenu d''une version publiée. Toute évolution passe par une nouvelle version — règle du paquet de référentiel.';

create trigger catalog_version_guard_published
  before update on public.catalog_version
  for each row execute function app.guard_published_catalog();

create trigger catalog_domain_guard_published
  before insert or update or delete on public.catalog_domain
  for each row execute function app.guard_published_catalog();

create trigger catalog_control_guard_published
  before insert or update or delete on public.catalog_control
  for each row execute function app.guard_published_catalog();

create trigger catalog_profile_guard_published
  before insert or update or delete on public.catalog_profile
  for each row execute function app.guard_published_catalog();

create trigger catalog_reference_use_case_guard_published
  before insert or update or delete on public.catalog_reference_use_case
  for each row execute function app.guard_published_catalog();

-- -----------------------------------------------------------------------------
-- Travaux d'import
-- -----------------------------------------------------------------------------
create table public.catalog_import_job (
  id               uuid primary key default gen_random_uuid(),
  tenant_id        uuid not null references public.tenant (id) on delete cascade,
  status           app.import_job_status not null default 'UPLOADED',

  source_filename  text not null,
  source_sha256    char(64) not null check (source_sha256 ~ '^[0-9a-f]{64}$'),
  payload          jsonb not null,

  framework_code   text,
  framework_version text,
  declared_control_count integer,
  imported_control_count integer,

  version_id       uuid references public.catalog_version (id) on delete set null,
  rejected_reason  text,

  uploaded_by      uuid references public.user_profile (id) on delete set null,
  uploaded_at      timestamptz not null default now(),
  validated_at     timestamptz,
  imported_at      timestamptz,
  published_at     timestamptz,

  check (status <> 'REJECTED' or btrim(coalesce(rejected_reason, '')) <> '')
);

comment on table public.catalog_import_job is
  'Un import de référentiel, de son dépôt à sa publication. Conserve le fichier source, son empreinte et son auteur.';
comment on column public.catalog_import_job.payload is
  'Contenu du fichier tel que déposé. Conservé pour rejouer, comparer et rendre l''import réversible.';

create index catalog_import_job_tenant_idx on public.catalog_import_job (tenant_id, uploaded_at desc);

create table public.catalog_import_error (
  id          uuid primary key default gen_random_uuid(),
  job_id      uuid not null references public.catalog_import_job (id) on delete cascade,
  path        text,
  code        text not null,
  message     text not null,
  created_at  timestamptz not null default now()
);

comment on table public.catalog_import_error is
  'Constats de validation d''un import : chemin dans le document, code et message. Ce qui est refusé est expliqué.';

create index catalog_import_error_job_idx on public.catalog_import_error (job_id);

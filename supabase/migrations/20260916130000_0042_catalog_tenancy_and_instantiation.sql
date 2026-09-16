-- =============================================================================
-- AIGMS — 0042 — Référentiels de l'éditeur et des tenants ; instanciation
-- =============================================================================
-- Deux choses que le catalogue ne savait pas faire.
--
-- 1. À QUI APPARTIENT UN RÉFÉRENTIEL. La lecture était globale : ce qu'un
--    cabinet importait, tous les autres le voyaient. `catalog_framework.tenant_id`
--    tranche : NULL, c'est le référentiel de l'éditeur, visible de tous ;
--    renseigné, c'est celui d'un tenant, privé. Un tenant importe toujours
--    pour lui ; le référentiel de l'éditeur n'arrive que par migration.
--
-- 2. INSTANCIER UN CONTRÔLE-TYPE. `control.catalog_control_id` existait sans
--    que rien ne l'écrive. `app.instantiate_catalog_control` crée le contrôle
--    opérationnel d'une organisation à partir d'un contrôle-type : code, nom,
--    objectif, fréquence repris ; lien conservé ; et les correspondances vers
--    des exigences chargées dans AIGMS (ISO/IEC 42001) deviennent des
--    rattachements — la Déclaration d'Applicabilité en profite aussitôt.
-- =============================================================================

-- -----------------------------------------------------------------------------
-- 1. Propriété du référentiel
-- -----------------------------------------------------------------------------
alter table public.catalog_framework
  add column tenant_id uuid references public.tenant (id) on delete cascade;

comment on column public.catalog_framework.tenant_id is
  'NULL : référentiel de l''éditeur, visible de tous les tenants. Renseigné : référentiel privé du tenant qui l''a importé.';

-- Le code n'est unique que dans son espace : l'éditeur, ou un tenant.
alter table public.catalog_framework drop constraint catalog_framework_code_key;
create unique index catalog_framework_editor_code_idx
  on public.catalog_framework (code) where tenant_id is null;
create unique index catalog_framework_tenant_code_idx
  on public.catalog_framework (tenant_id, code) where tenant_id is not null;

-- Un référentiel de tenant est journalisé comme le reste ; celui de l'éditeur,
-- sans tenant, n'arrive que par migration.
create trigger catalog_framework_audit
  after insert or update or delete on public.catalog_framework
  for each row execute function app.audit_business();

-- Lecture : l'éditeur pour tous, le tenant pour les siens.
create or replace function app.catalog_visible(p_framework_id uuid)
returns boolean
language sql stable security definer
set search_path = app, public, pg_catalog
as $$
  select exists (
    select 1 from public.catalog_framework f
    where f.id = p_framework_id
      and (f.tenant_id is null or app.has_tenant_access(f.tenant_id))
  );
$$;

drop policy if exists catalog_framework_select on public.catalog_framework;
create policy catalog_framework_select on public.catalog_framework
  for select to authenticated
  using (tenant_id is null or app.has_tenant_access(tenant_id));

drop policy if exists catalog_version_select on public.catalog_version;
create policy catalog_version_select on public.catalog_version
  for select to authenticated
  using (app.catalog_visible(framework_id));

drop policy if exists catalog_domain_select on public.catalog_domain;
create policy catalog_domain_select on public.catalog_domain
  for select to authenticated
  using (exists (select 1 from public.catalog_version v where v.id = version_id and app.catalog_visible(v.framework_id)));

drop policy if exists catalog_control_select on public.catalog_control;
create policy catalog_control_select on public.catalog_control
  for select to authenticated
  using (exists (select 1 from public.catalog_version v where v.id = version_id and app.catalog_visible(v.framework_id)));

drop policy if exists catalog_profile_select on public.catalog_profile;
create policy catalog_profile_select on public.catalog_profile
  for select to authenticated
  using (exists (select 1 from public.catalog_version v where v.id = version_id and app.catalog_visible(v.framework_id)));

drop policy if exists catalog_reference_use_case_select on public.catalog_reference_use_case;
create policy catalog_reference_use_case_select on public.catalog_reference_use_case
  for select to authenticated
  using (exists (select 1 from public.catalog_version v where v.id = version_id and app.catalog_visible(v.framework_id)));

-- Écriture : l'administration d'un tenant, sur les référentiels de ce tenant
-- seulement. Le référentiel de l'éditeur ne s'écrit que par migration.
drop policy if exists catalog_framework_write on public.catalog_framework;
create policy catalog_framework_write on public.catalog_framework
  for all to authenticated
  using (tenant_id is not null and app.has_tenant_role(tenant_id, app.roles_administer()))
  with check (tenant_id is not null and app.has_tenant_role(tenant_id, app.roles_administer()));

create or replace function app.catalog_writable(p_framework_id uuid)
returns boolean
language sql stable security definer
set search_path = app, public, pg_catalog
as $$
  select exists (
    select 1 from public.catalog_framework f
    where f.id = p_framework_id
      and f.tenant_id is not null
      and app.has_tenant_role(f.tenant_id, app.roles_administer())
  );
$$;

drop policy if exists catalog_version_write on public.catalog_version;
create policy catalog_version_write on public.catalog_version
  for all to authenticated
  using (app.catalog_writable(framework_id))
  with check (app.catalog_writable(framework_id));

drop policy if exists catalog_domain_write on public.catalog_domain;
create policy catalog_domain_write on public.catalog_domain
  for all to authenticated
  using (exists (select 1 from public.catalog_version v where v.id = version_id and app.catalog_writable(v.framework_id)))
  with check (exists (select 1 from public.catalog_version v where v.id = version_id and app.catalog_writable(v.framework_id)));

drop policy if exists catalog_control_write on public.catalog_control;
create policy catalog_control_write on public.catalog_control
  for all to authenticated
  using (exists (select 1 from public.catalog_version v where v.id = version_id and app.catalog_writable(v.framework_id)))
  with check (exists (select 1 from public.catalog_version v where v.id = version_id and app.catalog_writable(v.framework_id)));

drop policy if exists catalog_profile_write on public.catalog_profile;
create policy catalog_profile_write on public.catalog_profile
  for all to authenticated
  using (exists (select 1 from public.catalog_version v where v.id = version_id and app.catalog_writable(v.framework_id)))
  with check (exists (select 1 from public.catalog_version v where v.id = version_id and app.catalog_writable(v.framework_id)));

drop policy if exists catalog_reference_use_case_write on public.catalog_reference_use_case;
create policy catalog_reference_use_case_write on public.catalog_reference_use_case
  for all to authenticated
  using (exists (select 1 from public.catalog_version v where v.id = version_id and app.catalog_writable(v.framework_id)))
  with check (exists (select 1 from public.catalog_version v where v.id = version_id and app.catalog_writable(v.framework_id)));

-- L'import écrit le référentiel dans l'espace du tenant qui importe.
create or replace function app.commit_catalog_import(p_job_id uuid)
returns jsonb
language plpgsql
security definer
set search_path = app, public, pg_catalog
as $$
declare
  v_job          public.catalog_import_job;
  v_payload      jsonb;
  v_framework_id uuid;
  v_version_id   uuid;
  v_imported     integer;
begin
  select * into v_job from public.catalog_import_job where id = p_job_id;
  if v_job.id is null then
    raise exception 'Import % introuvable', p_job_id using errcode = 'no_data_found';
  end if;

  if not app.has_tenant_role(v_job.tenant_id, app.roles_administer()) then
    raise exception 'L''import d''un référentiel relève de l''administration de la plateforme.'
      using errcode = 'insufficient_privilege';
  end if;

  if v_job.status not in ('VALIDATED', 'REVIEWED') then
    raise exception 'Un import ne se confirme qu''après validation (statut courant : %).', v_job.status
      using errcode = 'check_violation';
  end if;

  v_payload := v_job.payload;

  -- Un tenant ne peut pas reprendre le code d'un référentiel de l'éditeur :
  -- deux « AIGMS-CF » se confondraient dans les écrans.
  if exists (select 1 from public.catalog_framework f
              where f.tenant_id is null and f.code = v_payload #>> '{framework,id}') then
    raise exception 'Le code « % » est celui d''un référentiel de l''éditeur : choisissez un code propre à votre cabinet.', v_payload #>> '{framework,id}'
      using errcode = 'unique_violation';
  end if;

  select id into v_framework_id from public.catalog_framework
   where tenant_id = v_job.tenant_id and code = v_payload #>> '{framework,id}';
  if v_framework_id is null then
    insert into public.catalog_framework (tenant_id, code, name, description)
    values (v_job.tenant_id, v_payload #>> '{framework,id}',
            coalesce(v_payload #>> '{framework,name}', v_payload #>> '{framework,id}'),
            v_payload #>> '{framework,description}')
    returning id into v_framework_id;
  else
    update public.catalog_framework
       set name = coalesce(v_payload #>> '{framework,name}', code)
     where id = v_framework_id;
  end if;

  delete from public.catalog_version
   where framework_id = v_framework_id
     and version = v_payload #>> '{framework,version}';

  insert into public.catalog_version (
    framework_id, version, status, language, description, design_principle,
    maturity_scale, declared_domain_count, declared_control_count,
    source_filename, source_sha256, imported_by, imported_at
  )
  values (
    v_framework_id,
    v_payload #>> '{framework,version}',
    'frozen',
    v_payload #>> '{framework,language}',
    v_payload #>> '{framework,description}',
    v_payload #>> '{framework,design_principle}',
    v_payload #>> '{framework,maturity_scale}',
    nullif(v_payload #>> '{framework,domain_count}', '')::integer,
    nullif(v_payload #>> '{framework,control_count}', '')::integer,
    v_job.source_filename,
    v_job.source_sha256,
    app.current_user_id(),
    now()
  )
  returning id into v_version_id;

  insert into public.catalog_domain (version_id, code, name, control_count, display_order)
  select v_version_id,
         d ->> 'code',
         coalesce(d ->> 'name', d ->> 'code'),
         nullif(d ->> 'control_count', '')::integer,
         nullif(d ->> 'order', '')::integer
  from jsonb_array_elements(v_payload -> 'domains') d;

  insert into public.catalog_control (
    version_id, domain_id, control_code, control_version, title, status, control_type, objective,
    owner_role, review_frequency, applicability, risks, requirements,
    assessment_questions, expected_evidence, tests, maturity_model,
    framework_mappings, remediation_guidance
  )
  select
    v_version_id,
    dom.id,
    c ->> 'id',
    coalesce(c ->> 'version', v_payload #>> '{framework,version}'),
    c ->> 'title',
    c ->> 'status',
    c ->> 'control_type',
    c ->> 'objective',
    c ->> 'owner_role',
    c ->> 'review_frequency',
    coalesce(c -> 'applicability', '{}'::jsonb),
    coalesce(c -> 'risks', '[]'::jsonb),
    coalesce(c -> 'requirements', '[]'::jsonb),
    coalesce(c -> 'assessment_questions', '[]'::jsonb),
    coalesce(c -> 'expected_evidence', '[]'::jsonb),
    coalesce(c -> 'tests', '[]'::jsonb),
    coalesce(c -> 'maturity_model', '{}'::jsonb),
    coalesce(c -> 'framework_mappings', '[]'::jsonb),
    coalesce(c -> 'remediation_guidance', '[]'::jsonb)
  from jsonb_array_elements(v_payload -> 'controls') c
  join public.catalog_domain dom
    on dom.version_id = v_version_id and dom.code = c ->> 'domain';

  get diagnostics v_imported = row_count;
  if v_imported <> jsonb_array_length(v_payload -> 'controls') then
    raise exception 'Import incohérent : % contrôle(s) importé(s) sur % attendu(s).',
      v_imported, jsonb_array_length(v_payload -> 'controls')
      using errcode = 'check_violation';
  end if;

  insert into public.catalog_profile (version_id, profile_code, name, description)
  select v_version_id, p ->> 'id', coalesce(p ->> 'name', p ->> 'id'), p ->> 'description'
  from jsonb_array_elements(coalesce(v_payload -> 'control_profiles', '[]'::jsonb)) p;

  insert into public.catalog_reference_use_case (version_id, use_case_code, name, example)
  select v_version_id, u ->> 'id', coalesce(u ->> 'name', u ->> 'id'), u ->> 'example'
  from jsonb_array_elements(coalesce(v_payload -> 'reference_use_cases', '[]'::jsonb)) u;

  update public.catalog_import_job
     set status = 'IMPORTED', version_id = v_version_id,
         imported_control_count = v_imported, imported_at = now()
   where id = p_job_id;

  perform app.log_audit(
    v_job.tenant_id, 'create', 'catalog_version', v_version_id,
    (v_payload #>> '{framework,id}') || ' ' || (v_payload #>> '{framework,version}'),
    format('Référentiel %s version %s importé : %s contrôle(s)',
           v_payload #>> '{framework,id}', v_payload #>> '{framework,version}', v_imported),
    null, null, jsonb_build_object('job_id', p_job_id, 'sha256', v_job.source_sha256)
  );

  return jsonb_build_object(
    'status', 'IMPORTED',
    'version_id', v_version_id,
    'controls', v_imported,
    'domains', jsonb_array_length(v_payload -> 'domains')
  );
end;
$$;

-- -----------------------------------------------------------------------------
-- 2. Instancier un contrôle-type chez une organisation
-- -----------------------------------------------------------------------------
create or replace function app.instantiate_catalog_control(
  p_organization_id     uuid,
  p_catalog_control_id  uuid,
  p_code                text default null,
  p_owner_user_id       uuid default null
)
returns jsonb
language plpgsql
security definer
set search_path = app, public, pg_catalog
as $$
declare
  v_org      public.organization;
  v_cc       public.catalog_control;
  v_version  public.catalog_version;
  v_code     text;
  v_control  uuid;
  v_mapped   integer := 0;
  v_unmapped text[] := '{}';
  m          jsonb;
  v_req      uuid;
begin
  select * into v_org from public.organization where id = p_organization_id;
  if v_org.id is null then
    raise exception 'Organisation introuvable' using errcode = 'no_data_found';
  end if;
  if not app.has_organization_role(p_organization_id, app.roles_write_governance()) then
    raise exception 'Instancier un contrôle relève des rôles de gouvernance.' using errcode = 'insufficient_privilege';
  end if;

  select * into v_cc from public.catalog_control where id = p_catalog_control_id;
  if v_cc.id is null then
    raise exception 'Contrôle-type introuvable' using errcode = 'no_data_found';
  end if;
  select * into v_version from public.catalog_version where id = v_cc.version_id;
  if not app.catalog_visible(v_version.framework_id) then
    raise exception 'Ce référentiel n''est pas visible de votre tenant.' using errcode = 'insufficient_privilege';
  end if;
  if v_version.status <> 'published' then
    raise exception 'Seule une version publiée s''instancie (statut : %).', v_version.status using errcode = 'check_violation';
  end if;

  -- Un contrôle-type ne s'instancie qu'une fois par organisation : deux
  -- instances du même modèle se contrediraient dans la couverture.
  if exists (select 1 from public.control c
              where c.organization_id = p_organization_id and c.catalog_control_id = p_catalog_control_id) then
    raise exception 'Le contrôle-type % est déjà instancié chez cette organisation.', v_cc.control_code
      using errcode = 'unique_violation';
  end if;

  v_code := coalesce(nullif(btrim(p_code), ''), v_cc.control_code);

  insert into public.control (
    tenant_id, organization_id, code, name, objective, owner_user_id,
    status, is_mandatory, frequency, catalog_control_id
  ) values (
    v_org.tenant_id, p_organization_id, v_code, v_cc.title, v_cc.objective, p_owner_user_id,
    'proposed',
    coalesce(v_cc.applicability ->> 'default', '') = 'mandatory',
    v_cc.review_frequency,
    v_cc.id
  )
  returning id into v_control;

  -- Les correspondances vers des exigences chargées dans AIGMS deviennent des
  -- rattachements. Celles vers un référentiel absent sont nommées, pas perdues.
  for m in select * from jsonb_array_elements(coalesce(v_cc.framework_mappings, '[]'::jsonb)) loop
    select r.id into v_req
    from public.requirement r
    join public.framework f on f.id = r.framework_id
    where f.code = m ->> 'framework'
      and (m ->> 'version' is null or f.version = m ->> 'version')
      and r.requirement_reference = m ->> 'reference';
    if v_req is not null then
      insert into public.control_requirement_map (tenant_id, control_id, requirement_id, coverage_note)
      values (v_org.tenant_id, v_control, v_req, format('Correspondance du référentiel %s', v_cc.control_code))
      on conflict do nothing;
      v_mapped := v_mapped + 1;
    else
      v_unmapped := v_unmapped || format('%s %s', m ->> 'framework', m ->> 'reference');
    end if;
    v_req := null;
  end loop;

  return jsonb_build_object(
    'control_id', v_control,
    'code', v_code,
    'mapped_requirements', v_mapped,
    'unmapped_references', to_jsonb(v_unmapped)
  );
end;
$$;

comment on function app.instantiate_catalog_control is
  'Crée le contrôle opérationnel d''une organisation à partir d''un contrôle-type publié, lien conservé, correspondances ISO 42001 rattachées.';

create or replace function public.instantiate_catalog_control(
  p_organization_id uuid, p_catalog_control_id uuid, p_code text default null, p_owner_user_id uuid default null
)
returns jsonb
language sql security invoker
set search_path = app, public, pg_catalog
as $$ select app.instantiate_catalog_control(p_organization_id, p_catalog_control_id, p_code, p_owner_user_id); $$;

grant execute on function public.instantiate_catalog_control(uuid, uuid, text, uuid) to authenticated;

-- Les contrôles-types disponibles pour une organisation : versions publiées
-- visibles, avec ce qui est déjà instancié.
create or replace function public.catalog_controls_for(p_organization_id uuid)
returns table (
  catalog_control_id uuid, framework_code text, framework_name text, is_editor boolean,
  version text, domain_code text, domain_name text, code text, title text,
  objective text, control_type text, default_applicability text, review_frequency text,
  owner_role text, mapping_count integer, instantiated_control_id uuid
)
language sql stable security invoker
set search_path = app, public, pg_catalog
as $$
  select cc.id, f.code, f.name, f.tenant_id is null,
         v.version, d.code, d.name, cc.control_code, cc.title,
         cc.objective, cc.control_type, cc.applicability ->> 'default', cc.review_frequency,
         cc.owner_role, jsonb_array_length(coalesce(cc.framework_mappings, '[]'::jsonb)),
         (select c.id from public.control c
           where c.organization_id = p_organization_id and c.catalog_control_id = cc.id limit 1)
  from public.catalog_control cc
  join public.catalog_version v on v.id = cc.version_id
  join public.catalog_framework f on f.id = v.framework_id
  join public.catalog_domain d on d.id = cc.domain_id
  where v.status = 'published'
  order by f.tenant_id is not null, f.code, d.display_order, cc.control_code;
$$;

grant execute on function public.catalog_controls_for(uuid) to authenticated;

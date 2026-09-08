-- =============================================================================
-- AIGMS — 0021 — Validation, import et publication d'un référentiel
-- =============================================================================
-- Le flux de IMPORT_SPEC.md :
--   UPLOADED -> VALIDATED -> REVIEWED -> IMPORTED -> PUBLISHED
--   UPLOADED -> REJECTED
--
-- La validation et l'import vivent en base, comme les gates de gouvernance :
-- un import est un acte transactionnel, et rien ne doit pouvoir le contourner
-- en s'adressant directement à l'API.
-- =============================================================================

-- -----------------------------------------------------------------------------
-- Pont vers les contrôles instanciés chez un client
-- -----------------------------------------------------------------------------
alter table public.control
  add column catalog_control_id uuid references public.catalog_control (id) on delete set null;

comment on column public.control.catalog_control_id is
  'Contrôle-type du catalogue dont ce contrôle est l''instance chez un client. Nul lorsque le contrôle a été écrit sur mesure.';

create index control_catalog_idx on public.control (catalog_control_id)
  where catalog_control_id is not null;

-- -----------------------------------------------------------------------------
-- Validation
-- -----------------------------------------------------------------------------
create or replace function app.validate_catalog_import(p_job_id uuid)
returns jsonb
language plpgsql
security definer
set search_path = app, public, pg_catalog
as $$
declare
  v_job      public.catalog_import_job;
  v_payload  jsonb;
  v_errors   integer := 0;
  v_domains  text[];
  v_declared integer;
  v_actual   integer;
  r          record;
begin
  select * into v_job from public.catalog_import_job where id = p_job_id;
  if v_job.id is null then
    raise exception 'Import % introuvable', p_job_id using errcode = 'no_data_found';
  end if;

  if not app.has_tenant_role(v_job.tenant_id, app.roles_administer()) then
    raise exception 'L''import d''un référentiel relève de l''administration de la plateforme.'
      using errcode = 'insufficient_privilege';
  end if;

  if v_job.status <> 'UPLOADED' then
    raise exception 'Un import ne se valide qu''au statut UPLOADED (statut courant : %).', v_job.status
      using errcode = 'check_violation';
  end if;

  delete from public.catalog_import_error where job_id = p_job_id;
  v_payload := v_job.payload;

  -- --- Structure attendue ---------------------------------------------------
  if v_payload -> 'framework' is null or jsonb_typeof(v_payload -> 'framework') <> 'object' then
    insert into public.catalog_import_error (job_id, path, code, message)
    values (p_job_id, 'framework', 'MISSING_FRAMEWORK', 'Le document ne porte pas d''objet « framework ».');
    v_errors := v_errors + 1;
  end if;

  if jsonb_typeof(v_payload -> 'domains') <> 'array' then
    insert into public.catalog_import_error (job_id, path, code, message)
    values (p_job_id, 'domains', 'MISSING_DOMAINS', 'Le document ne porte pas de tableau « domains ».');
    v_errors := v_errors + 1;
  end if;

  if jsonb_typeof(v_payload -> 'controls') <> 'array' then
    insert into public.catalog_import_error (job_id, path, code, message)
    values (p_job_id, 'controls', 'MISSING_CONTROLS', 'Le document ne porte pas de tableau « controls ».');
    v_errors := v_errors + 1;
  end if;

  if v_errors > 0 then
    update public.catalog_import_job
       set status = 'REJECTED',
           rejected_reason = 'Structure du document invalide.'
     where id = p_job_id;
    return jsonb_build_object('status', 'REJECTED', 'errors', v_errors);
  end if;

  -- --- Clé naturelle du référentiel ----------------------------------------
  if coalesce(btrim(v_payload #>> '{framework,id}'), '') = ''
     or coalesce(btrim(v_payload #>> '{framework,version}'), '') = '' then
    insert into public.catalog_import_error (job_id, path, code, message)
    values (p_job_id, 'framework', 'MISSING_NATURAL_KEY',
            'La clé naturelle « framework.id + framework.version » est incomplète.');
    v_errors := v_errors + 1;
  end if;

  -- Une version déjà publiée ne se réimporte pas.
  if exists (
    select 1
    from public.catalog_version cv
    join public.catalog_framework cf on cf.id = cv.framework_id
    where cf.code = v_payload #>> '{framework,id}'
      and cv.version = v_payload #>> '{framework,version}'
      and cv.status = 'published'
  ) then
    insert into public.catalog_import_error (job_id, path, code, message)
    values (p_job_id, 'framework.version', 'PUBLISHED_BASELINE',
            'Cette version est déjà publiée : une baseline publiée est immuable. Créez une nouvelle version.');
    v_errors := v_errors + 1;
  end if;

  -- --- Domaines --------------------------------------------------------------
  select array_agg(d ->> 'code') into v_domains
  from jsonb_array_elements(v_payload -> 'domains') d;

  if (select count(distinct d ->> 'code') from jsonb_array_elements(v_payload -> 'domains') d)
     <> jsonb_array_length(v_payload -> 'domains') then
    insert into public.catalog_import_error (job_id, path, code, message)
    values (p_job_id, 'domains', 'DUPLICATE_DOMAIN', 'Deux domaines portent le même code.');
    v_errors := v_errors + 1;
  end if;

  -- --- Contrôles : domaine connu, pas de doublon de clé naturelle ------------
  for r in
    select c ->> 'id' as code, c ->> 'domain' as domain, c ->> 'version' as version,
           c ->> 'title' as title, ordinality as idx
    from jsonb_array_elements(v_payload -> 'controls') with ordinality as t(c, ordinality)
  loop
    if r.domain is null or not (r.domain = any (v_domains)) then
      insert into public.catalog_import_error (job_id, path, code, message)
      values (p_job_id, format('controls[%s]', r.idx), 'UNKNOWN_DOMAIN',
              format('Le contrôle %s référence le domaine « %s », absent du document.',
                     coalesce(r.code, '?'), coalesce(r.domain, '∅')));
      v_errors := v_errors + 1;
    end if;

    if coalesce(btrim(r.code), '') = '' or coalesce(btrim(r.version), '') = '' then
      insert into public.catalog_import_error (job_id, path, code, message)
      values (p_job_id, format('controls[%s]', r.idx), 'MISSING_NATURAL_KEY',
              'La clé naturelle « control.id + control.version » est incomplète.');
      v_errors := v_errors + 1;
    end if;

    if coalesce(btrim(r.title), '') = '' then
      insert into public.catalog_import_error (job_id, path, code, message)
      values (p_job_id, format('controls[%s]', r.idx), 'MISSING_TITLE',
              format('Le contrôle %s n''a pas de titre.', coalesce(r.code, '?')));
      v_errors := v_errors + 1;
    end if;
  end loop;

  if (select count(distinct (c ->> 'id') || '@' || (c ->> 'version'))
      from jsonb_array_elements(v_payload -> 'controls') c)
     <> jsonb_array_length(v_payload -> 'controls') then
    insert into public.catalog_import_error (job_id, path, code, message)
    values (p_job_id, 'controls', 'DUPLICATE_CONTROL',
            'Deux contrôles partagent la même clé « id + version ».');
    v_errors := v_errors + 1;
  end if;

  -- --- Le compte déclaré doit correspondre au compte réel --------------------
  v_declared := nullif(v_payload #>> '{framework,control_count}', '')::integer;
  v_actual   := jsonb_array_length(v_payload -> 'controls');

  if v_declared is not null and v_declared <> v_actual then
    insert into public.catalog_import_error (job_id, path, code, message)
    values (p_job_id, 'framework.control_count', 'CONTROL_COUNT_MISMATCH',
            format('Le document déclare %s contrôles et en porte %s.', v_declared, v_actual));
    v_errors := v_errors + 1;
  end if;

  -- --- Verdict ---------------------------------------------------------------
  if v_errors > 0 then
    update public.catalog_import_job
       set status = 'REJECTED',
           rejected_reason = format('%s constat(s) de validation.', v_errors)
     where id = p_job_id;

    return jsonb_build_object('status', 'REJECTED', 'errors', v_errors);
  end if;

  update public.catalog_import_job
     set status = 'VALIDATED',
         validated_at = now(),
         framework_code = v_payload #>> '{framework,id}',
         framework_version = v_payload #>> '{framework,version}',
         declared_control_count = v_actual
   where id = p_job_id;

  return jsonb_build_object(
    'status', 'VALIDATED',
    'errors', 0,
    'framework', v_payload #>> '{framework,id}',
    'version', v_payload #>> '{framework,version}',
    'domains', jsonb_array_length(v_payload -> 'domains'),
    'controls', v_actual
  );
end;
$$;

comment on function app.validate_catalog_import is
  'Valide un import déposé : structure, clés naturelles, domaines référencés, doublons, compte de contrôles. Consigne chaque constat plutôt que d''échouer au premier.';

-- -----------------------------------------------------------------------------
-- Import atomique
-- -----------------------------------------------------------------------------
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

  -- Le référentiel : créé s'il n'existe pas, jamais dupliqué.
  insert into public.catalog_framework (code, name, description)
  values (
    v_payload #>> '{framework,id}',
    coalesce(v_payload #>> '{framework,name}', v_payload #>> '{framework,id}'),
    v_payload #>> '{framework,description}'
  )
  on conflict (code) do update set name = excluded.name
  returning id into v_framework_id;

  -- La version : remplacée si elle existait en brouillon, refusée si publiée
  -- (le trigger d'immutabilité veille).
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
    version_id, domain_id, control_code, control_version, title, status, control_type,
    objective, owner_role, review_frequency, applicability, risks, requirements,
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

  -- Filet : le compte importé doit correspondre au document. Une erreur ici
  -- annule tout, l'import étant transactionnel.
  if v_imported <> jsonb_array_length(v_payload -> 'controls') then
    raise exception 'Import incomplet : % contrôle(s) importé(s) pour % dans le document.',
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
     set status = 'IMPORTED',
         imported_at = now(),
         version_id = v_version_id,
         imported_control_count = v_imported
   where id = p_job_id;

  perform app.log_audit(
    v_job.tenant_id, 'create', 'catalog_version', v_version_id,
    format('%s %s', v_payload #>> '{framework,id}', v_payload #>> '{framework,version}'),
    format('Référentiel importé : %s contrôle(s)', v_imported),
    null,
    jsonb_build_object('sha256', v_job.source_sha256, 'controls', v_imported),
    jsonb_build_object('job_id', p_job_id)
  );

  return jsonb_build_object(
    'status', 'IMPORTED',
    'version_id', v_version_id,
    'controls', v_imported,
    'domains', jsonb_array_length(v_payload -> 'domains')
  );
end;
$$;

comment on function app.commit_catalog_import is
  'Importe un référentiel validé, d''un seul tenant. Vérifie que le nombre de contrôles importés correspond au document, faute de quoi tout est annulé.';

-- -----------------------------------------------------------------------------
-- Publication
-- -----------------------------------------------------------------------------
create or replace function app.publish_catalog_version(p_version_id uuid)
returns jsonb
language plpgsql
security definer
set search_path = app, public, pg_catalog
as $$
declare
  v_version public.catalog_version;
  v_tenant  uuid;
begin
  select * into v_version from public.catalog_version where id = p_version_id;
  if v_version.id is null then
    raise exception 'Version % introuvable', p_version_id using errcode = 'no_data_found';
  end if;

  select tenant_id into v_tenant
  from public.catalog_import_job where version_id = p_version_id
  order by imported_at desc limit 1;

  if v_tenant is null or not app.has_tenant_role(v_tenant, app.roles_administer()) then
    raise exception 'La publication d''un référentiel relève de l''administration de la plateforme.'
      using errcode = 'insufficient_privilege';
  end if;

  if v_version.status = 'published' then
    return jsonb_build_object('status', 'PUBLISHED', 'already', true);
  end if;

  -- Les versions antérieures du même référentiel sont marquées remplacées :
  -- l'historique est conservé, la version courante est sans ambiguïté.
  update public.catalog_version
     set status = 'superseded'
   where framework_id = v_version.framework_id
     and id <> p_version_id
     and status = 'published';

  update public.catalog_version
     set status = 'published', published_at = now()
   where id = p_version_id;

  update public.catalog_import_job
     set status = 'PUBLISHED', published_at = now()
   where version_id = p_version_id;

  perform app.log_audit(
    v_tenant, 'update', 'catalog_version', p_version_id, v_version.version,
    'Référentiel publié', null, jsonb_build_object('status', 'published'), '{}'::jsonb
  );

  return jsonb_build_object('status', 'PUBLISHED', 'version_id', p_version_id);
end;
$$;

comment on function app.publish_catalog_version is
  'Publie une version importée et marque les précédentes comme remplacées. Une fois publiée, la baseline est gelée.';

-- -----------------------------------------------------------------------------
-- RLS : catalogue lisible par tous, écrit par l'administration
-- -----------------------------------------------------------------------------
do $$
declare
  t text;
begin
  foreach t in array array[
    'catalog_framework', 'catalog_version', 'catalog_domain',
    'catalog_control', 'catalog_profile', 'catalog_reference_use_case'
  ] loop
    execute format('alter table public.%I enable row level security', t);
    execute format('alter table public.%I force  row level security', t);

    -- Le catalogue ne contient aucune donnée client : il est lisible par tout
    -- utilisateur authentifié, comme les référentiels normatifs.
    execute format($p$
      create policy %2$I on public.%1$I
        for select to authenticated using (true)
    $p$, t, t || '_select');

    execute format($p$
      create policy %2$I on public.%1$I
        for all to authenticated
        using (app.is_platform_admin())
        with check (app.is_platform_admin())
    $p$, t, t || '_write');

    execute format('grant select, insert, update, delete on public.%I to authenticated', t);
    execute format('revoke all on public.%I from anon', t);
  end loop;
end;
$$;

-- Les travaux d'import portent le fichier source : ils restent dans le tenant.
alter table public.catalog_import_job   enable row level security;
alter table public.catalog_import_job   force  row level security;
alter table public.catalog_import_error enable row level security;
alter table public.catalog_import_error force  row level security;

create policy catalog_import_job_select on public.catalog_import_job
  for select to authenticated
  using (app.has_tenant_role(tenant_id, app.roles_administer()));

create policy catalog_import_job_write on public.catalog_import_job
  for all to authenticated
  using (app.has_tenant_role(tenant_id, app.roles_administer()))
  with check (app.has_tenant_role(tenant_id, app.roles_administer()));

create policy catalog_import_error_select on public.catalog_import_error
  for select to authenticated
  using (exists (
    select 1 from public.catalog_import_job j
    where j.id = catalog_import_error.job_id
      and app.has_tenant_role(j.tenant_id, app.roles_administer())
  ));

grant select, insert, update, delete on public.catalog_import_job   to authenticated;
grant select                        on public.catalog_import_error to authenticated;
revoke all on public.catalog_import_job   from anon;
revoke all on public.catalog_import_error from anon;

-- -----------------------------------------------------------------------------
-- Surface d'API
-- -----------------------------------------------------------------------------
create or replace function public.validate_catalog_import(p_job_id uuid)
returns jsonb language sql volatile security invoker
set search_path = app, public, pg_catalog
as $$ select app.validate_catalog_import(p_job_id); $$;

create or replace function public.commit_catalog_import(p_job_id uuid)
returns jsonb language sql volatile security invoker
set search_path = app, public, pg_catalog
as $$ select app.commit_catalog_import(p_job_id); $$;

create or replace function public.publish_catalog_version(p_version_id uuid)
returns jsonb language sql volatile security invoker
set search_path = app, public, pg_catalog
as $$ select app.publish_catalog_version(p_version_id); $$;

revoke all on function public.validate_catalog_import(uuid)  from public, anon;
revoke all on function public.commit_catalog_import(uuid)    from public, anon;
revoke all on function public.publish_catalog_version(uuid)  from public, anon;
grant execute on function public.validate_catalog_import(uuid)  to authenticated;
grant execute on function public.commit_catalog_import(uuid)    to authenticated;
grant execute on function public.publish_catalog_version(uuid)  to authenticated;

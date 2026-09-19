-- =============================================================================
-- AIGMS — 0061 — Importer des actifs d'IA et des fournisseurs
-- =============================================================================
-- Un inventaire d'actifs existe presque toujours ailleurs — CMDB de l'ITSM,
-- registre des traitements, tableur — et un registre des fournisseurs aussi.
-- Les ressaisir un à un est ce qui fait qu'un registre reste vide.
--
-- Deux fonctions d'import, à partir de lignes déjà lues (CSV traduit par
-- l'application, ou connecteur). Elles RAPPROCHENT par nom, dans
-- l'organisation : une ligne dont le nom existe met à jour ce qu'elle apporte,
-- une ligne nouvelle crée. Rien ne se supprime. Chaque ligne rend compte —
-- créée, mise à jour, refusée et pourquoi.
--
-- L'administration de la plateforme peut importer : c'est une reprise de
-- données, comme un référentiel, pas un acte de gouvernance. Les rôles de
-- gouvernance qui écrivent ces objets le peuvent aussi.
-- =============================================================================

create or replace function app.can_import_registry(p_organization_id uuid)
returns boolean
language sql stable
set search_path = app, public, pg_catalog
as $$
  select app.is_platform_admin()
      or app.has_organization_role(p_organization_id, app.roles_contribute());
$$;

-- -----------------------------------------------------------------------------
-- Actifs d'IA
-- -----------------------------------------------------------------------------
-- Colonnes attendues (jsonb par ligne) : name*, kind (ai_system | ai_model |
-- ai_agent | dataset, ou en clair), description, version, vendor (nom),
-- hosting_location, contains_personal_data (oui/non), owner_email.
create or replace function app.import_ai_assets(p_organization_id uuid, p_rows jsonb)
returns jsonb
language plpgsql
security definer
set search_path = app, public, pg_catalog
as $$
declare
  v_org public.organization%rowtype;
  r jsonb;
  v_line integer := 0;
  v_created integer := 0;
  v_updated integer := 0;
  v_issues jsonb := '[]'::jsonb;
  v_name text; v_kind app.asset_kind; v_kind_raw text; v_vendor uuid; v_owner uuid; v_existing uuid;
  v_pd boolean;
begin
  select * into v_org from public.organization where id = p_organization_id;
  if v_org.id is null or not app.has_tenant_access(v_org.tenant_id) then
    raise exception 'Organisation introuvable.' using errcode = 'no_data_found';
  end if;
  if not app.can_import_registry(p_organization_id) then
    raise exception 'L''import des actifs relève de l''administration ou d''un rôle qui déclare les actifs.'
      using errcode = 'insufficient_privilege';
  end if;
  if jsonb_typeof(p_rows) <> 'array' then
    raise exception 'Lignes attendues sous forme de liste.' using errcode = 'check_violation';
  end if;

  for r in select * from jsonb_array_elements(p_rows) loop
    v_line := v_line + 1;
    v_name := nullif(btrim(coalesce(r ->> 'name', '')), '');
    if v_name is null then
      v_issues := v_issues || jsonb_build_object('line', v_line, 'message', 'Nom manquant.');
      continue;
    end if;

    v_kind_raw := lower(btrim(coalesce(r ->> 'kind', '')));
    v_kind := case
      when v_kind_raw in ('ai_system', 'système', 'systeme', 'system', 'application', 'service') then 'ai_system'
      when v_kind_raw in ('ai_model', 'modèle', 'modele', 'model', 'llm') then 'ai_model'
      when v_kind_raw in ('ai_agent', 'agent') then 'ai_agent'
      when v_kind_raw in ('dataset', 'jeu de données', 'jeu de donnees', 'données', 'donnees', 'data') then 'dataset'
      when v_kind_raw = '' then 'ai_system'
      else null end;
    if v_kind is null then
      v_issues := v_issues || jsonb_build_object('line', v_line, 'message', format('Nature inconnue « %s » : système, modèle, agent ou jeu de données.', r ->> 'kind'));
      continue;
    end if;

    v_vendor := null;
    if nullif(btrim(coalesce(r ->> 'vendor', '')), '') is not null then
      select v.id into v_vendor from public.vendor v
       where v.organization_id = p_organization_id and lower(v.name) = lower(btrim(r ->> 'vendor')) limit 1;
      if v_vendor is null then
        -- Un fournisseur nommé mais inconnu est créé, à revoir : mieux vaut un
        -- tiers « revue non commencée » qu'un actif sans fournisseur.
        insert into public.vendor (tenant_id, organization_id, name, notes)
        values (v_org.tenant_id, p_organization_id, btrim(r ->> 'vendor'), 'Créé par l''import des actifs.')
        returning id into v_vendor;
      end if;
    end if;

    v_owner := null;
    if nullif(btrim(coalesce(r ->> 'owner_email', '')), '') is not null then
      select u.id into v_owner from public.user_profile u
       where lower(u.email) = lower(btrim(r ->> 'owner_email')) limit 1;
    end if;

    v_pd := lower(btrim(coalesce(r ->> 'contains_personal_data', ''))) in ('oui', 'yes', 'true', '1', 'x');

    select a.id into v_existing from public.ai_asset a
     where a.organization_id = p_organization_id and lower(a.name) = lower(v_name) limit 1;

    if v_existing is null then
      insert into public.ai_asset (tenant_id, organization_id, name, kind, description, version, vendor_id,
                                   hosting_location, contains_personal_data, owner_user_id)
      values (v_org.tenant_id, p_organization_id, v_name, v_kind, nullif(btrim(coalesce(r ->> 'description', '')), ''),
              nullif(btrim(coalesce(r ->> 'version', '')), ''), v_vendor,
              nullif(btrim(coalesce(r ->> 'hosting_location', '')), ''), v_pd, v_owner);
      v_created := v_created + 1;
    else
      update public.ai_asset a
         set kind = v_kind,
             description = coalesce(nullif(btrim(coalesce(r ->> 'description', '')), ''), a.description),
             version = coalesce(nullif(btrim(coalesce(r ->> 'version', '')), ''), a.version),
             vendor_id = coalesce(v_vendor, a.vendor_id),
             hosting_location = coalesce(nullif(btrim(coalesce(r ->> 'hosting_location', '')), ''), a.hosting_location),
             contains_personal_data = a.contains_personal_data or v_pd,
             owner_user_id = coalesce(v_owner, a.owner_user_id)
       where a.id = v_existing;
      v_updated := v_updated + 1;
    end if;
  end loop;

  perform app.log_audit(
    v_org.tenant_id, 'create', 'ai_asset', p_organization_id, v_org.business_ref,
    format('Import d''actifs : %s créé(s), %s mis à jour, %s refusé(s).', v_created, v_updated, jsonb_array_length(v_issues)),
    null, null, jsonb_build_object('import', 'ai_asset', 'created', v_created, 'updated', v_updated, 'issues', v_issues)
  );

  return jsonb_build_object('created', v_created, 'updated', v_updated, 'issues', v_issues);
end;
$$;

-- -----------------------------------------------------------------------------
-- Fournisseurs
-- -----------------------------------------------------------------------------
-- Colonnes : name*, is_model_provider (oui/non), criticality (low | moderate |
-- high | critical, ou en clair), country_code (FR, US…), dpa_signed,
-- security_assessed, reversibility_documented (oui/non), subprocessors, notes.
create or replace function app.import_vendors(p_organization_id uuid, p_rows jsonb)
returns jsonb
language plpgsql
security definer
set search_path = app, public, pg_catalog
as $$
declare
  v_org public.organization%rowtype;
  r jsonb;
  v_line integer := 0;
  v_created integer := 0;
  v_updated integer := 0;
  v_issues jsonb := '[]'::jsonb;
  v_name text; v_crit app.vendor_criticality; v_crit_raw text; v_existing uuid;
begin
  select * into v_org from public.organization where id = p_organization_id;
  if v_org.id is null or not app.has_tenant_access(v_org.tenant_id) then
    raise exception 'Organisation introuvable.' using errcode = 'no_data_found';
  end if;
  if not (app.is_platform_admin() or app.has_organization_role(p_organization_id, app.roles_write_governance())) then
    raise exception 'L''import des fournisseurs relève de l''administration ou de l''AI Governance Officer.'
      using errcode = 'insufficient_privilege';
  end if;
  if jsonb_typeof(p_rows) <> 'array' then
    raise exception 'Lignes attendues sous forme de liste.' using errcode = 'check_violation';
  end if;

  for r in select * from jsonb_array_elements(p_rows) loop
    v_line := v_line + 1;
    v_name := nullif(btrim(coalesce(r ->> 'name', '')), '');
    if v_name is null then
      v_issues := v_issues || jsonb_build_object('line', v_line, 'message', 'Nom manquant.');
      continue;
    end if;
    v_crit_raw := lower(btrim(coalesce(r ->> 'criticality', '')));
    v_crit := case
      when v_crit_raw in ('low', 'faible') then 'low'
      when v_crit_raw in ('moderate', 'modérée', 'moderee', 'moyenne', '') then 'moderate'
      when v_crit_raw in ('high', 'élevée', 'elevee', 'haute') then 'high'
      when v_crit_raw in ('critical', 'critique') then 'critical'
      else null end;
    if v_crit is null then
      v_issues := v_issues || jsonb_build_object('line', v_line, 'message', format('Criticité inconnue « %s » : faible, modérée, élevée ou critique.', r ->> 'criticality'));
      continue;
    end if;

    select v.id into v_existing from public.vendor v
     where v.organization_id = p_organization_id and lower(v.name) = lower(v_name) limit 1;

    if v_existing is null then
      insert into public.vendor (tenant_id, organization_id, name, is_model_provider, criticality, country_code,
                                 dpa_signed, security_assessed, reversibility_documented, subprocessors, notes)
      values (v_org.tenant_id, p_organization_id, v_name,
              lower(btrim(coalesce(r ->> 'is_model_provider', ''))) in ('oui', 'yes', 'true', '1', 'x'),
              v_crit, nullif(upper(btrim(coalesce(r ->> 'country_code', ''))), ''),
              lower(btrim(coalesce(r ->> 'dpa_signed', ''))) in ('oui', 'yes', 'true', '1', 'x'),
              lower(btrim(coalesce(r ->> 'security_assessed', ''))) in ('oui', 'yes', 'true', '1', 'x'),
              lower(btrim(coalesce(r ->> 'reversibility_documented', ''))) in ('oui', 'yes', 'true', '1', 'x'),
              nullif(btrim(coalesce(r ->> 'subprocessors', '')), ''), nullif(btrim(coalesce(r ->> 'notes', '')), ''));
      v_created := v_created + 1;
    else
      update public.vendor v
         set is_model_provider = v.is_model_provider or lower(btrim(coalesce(r ->> 'is_model_provider', ''))) in ('oui', 'yes', 'true', '1', 'x'),
             criticality = v_crit,
             country_code = coalesce(nullif(upper(btrim(coalesce(r ->> 'country_code', ''))), ''), v.country_code),
             dpa_signed = v.dpa_signed or lower(btrim(coalesce(r ->> 'dpa_signed', ''))) in ('oui', 'yes', 'true', '1', 'x'),
             security_assessed = v.security_assessed or lower(btrim(coalesce(r ->> 'security_assessed', ''))) in ('oui', 'yes', 'true', '1', 'x'),
             reversibility_documented = v.reversibility_documented or lower(btrim(coalesce(r ->> 'reversibility_documented', ''))) in ('oui', 'yes', 'true', '1', 'x'),
             subprocessors = coalesce(nullif(btrim(coalesce(r ->> 'subprocessors', '')), ''), v.subprocessors),
             notes = coalesce(nullif(btrim(coalesce(r ->> 'notes', '')), ''), v.notes)
       where v.id = v_existing;
      v_updated := v_updated + 1;
    end if;
  end loop;

  perform app.log_audit(
    v_org.tenant_id, 'create', 'vendor', p_organization_id, v_org.business_ref,
    format('Import de fournisseurs : %s créé(s), %s mis à jour, %s refusé(s).', v_created, v_updated, jsonb_array_length(v_issues)),
    null, null, jsonb_build_object('import', 'vendor', 'created', v_created, 'updated', v_updated, 'issues', v_issues)
  );

  return jsonb_build_object('created', v_created, 'updated', v_updated, 'issues', v_issues);
end;
$$;

create or replace function public.import_ai_assets(p_organization_id uuid, p_rows jsonb)
returns jsonb language sql volatile security invoker
set search_path = app, public, pg_catalog
as $$ select app.import_ai_assets(p_organization_id, p_rows); $$;

create or replace function public.import_vendors(p_organization_id uuid, p_rows jsonb)
returns jsonb language sql volatile security invoker
set search_path = app, public, pg_catalog
as $$ select app.import_vendors(p_organization_id, p_rows); $$;

revoke all on function public.import_ai_assets(uuid, jsonb) from public, anon;
revoke all on function public.import_vendors(uuid, jsonb) from public, anon;
grant execute on function public.import_ai_assets(uuid, jsonb) to authenticated;
grant execute on function public.import_vendors(uuid, jsonb) to authenticated;

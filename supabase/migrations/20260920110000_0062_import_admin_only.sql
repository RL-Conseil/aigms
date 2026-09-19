-- =============================================================================
-- AIGMS — 0062 — L'import des actifs et des fournisseurs relève de
--                 l'administration seule
-- =============================================================================
-- Verser un inventaire dans un registre est une reprise de données : elle
-- relève de l'administration de la plateforme, comme l'import d'un
-- référentiel — pas des rôles de gouvernance, qui déclarent un à un ce dont
-- ils répondent.
-- =============================================================================

create or replace function app.can_import_registry(p_organization_id uuid)
returns boolean
language sql stable
set search_path = app, public, pg_catalog
as $$
  select app.is_platform_admin();
$$;

comment on function app.can_import_registry is
  'Vrai pour l''administration de la plateforme seule : un import est une reprise de données (0062).';

-- Les fournisseurs : même règle.
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
  if not app.can_import_registry(p_organization_id) then
    raise exception 'L''import des fournisseurs relève de l''administration de la plateforme.'
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

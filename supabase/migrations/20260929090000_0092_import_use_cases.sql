-- =============================================================================
-- AIGMS — 0092 — Importer les cas d'usage
-- =============================================================================
-- Un atelier de découverte recense dix à trente usages d'IA en deux heures.
-- Les ressaisir un par un après coup coûte cinq à dix minutes chacun : c'est
-- ce qui fait déborder l'atelier, et c'est ce qui laisse un registre vide.
-- Les actifs et les fournisseurs s'importent depuis 0061 ; les usages, non.
--
-- Même mécanique, mêmes garanties :
--   * rapprochement PAR NOM dans l'organisation — une ligne connue met à jour
--     ce qu'elle apporte, une ligne nouvelle crée ; rien ne se supprime ;
--   * chaque ligne rend compte : créée, mise à jour, ou refusée et pourquoi ;
--   * le STATUT ne s'importe jamais. Un usage entre en brouillon et franchit
--     ses jalons par `app.transition_use_case`, qui seul évalue les gates ;
--   * l'activité, les actifs et les fournisseurs se rattachent PAR NOM, s'ils
--     existent déjà — sinon la ligne le dit, sans échouer.
--
-- Ce que l'import NE fait PAS : poser une criticité sans justification (la
-- colonne existe, elle est exigée avec), qualifier au regard du règlement
-- (c'est un acte de jugement), ni rien de ce qu'un gate contrôle.
-- =============================================================================

-- Colonnes attendues (jsonb par ligne) : name*, purpose*, business_process,
-- activity (nom), expected_benefit, users_description, affected_persons,
-- data_description, involves_personal_data, involves_sensitive_data,
-- involves_vulnerable_persons (oui/non), autonomy_level (L0…L4 ou en clair),
-- criticality (+ criticality_rationale), decision_impact, owner_email,
-- accountable_email, next_review_at, assets (noms séparés par des virgules),
-- vendors (idem).
create or replace function app.import_use_cases(p_organization_id uuid, p_rows jsonb)
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
  v_linked integer := 0;
  v_issues jsonb := '[]'::jsonb;
  v_name text; v_purpose text; v_existing uuid; v_id uuid;
  v_activity uuid; v_activity_raw text;
  v_owner uuid; v_accountable uuid;
  v_autonomy app.autonomy_level; v_autonomy_raw text;
  v_crit app.criticality; v_crit_raw text; v_rationale text;
  v_review date; v_review_raw text;
  v_label text; v_target uuid;
  v_flag boolean;

  -- « oui », « x », « 1 », « true » : ce qu'un tableur français écrit.
  function_true constant text[] := array['oui', 'yes', 'true', '1', 'x', 'vrai'];
begin
  select * into v_org from public.organization where id = p_organization_id;
  if v_org.id is null or not app.has_tenant_access(v_org.tenant_id) then
    raise exception 'Organisation introuvable.' using errcode = 'no_data_found';
  end if;
  if not app.can_import_registry(p_organization_id) then
    raise exception 'L''import des cas d''usage relève de l''administration de la plateforme : c''est une reprise de données, pas un acte de gouvernance (0062).'
      using errcode = 'insufficient_privilege';
  end if;
  if jsonb_typeof(p_rows) <> 'array' then
    raise exception 'Lignes attendues sous forme de liste.' using errcode = 'check_violation';
  end if;

  for r in select * from jsonb_array_elements(p_rows) loop
    v_line := v_line + 1;
    v_name := nullif(btrim(coalesce(r ->> 'name', '')), '');
    v_purpose := nullif(btrim(coalesce(r ->> 'purpose', '')), '');

    if v_name is null then
      v_issues := v_issues || jsonb_build_object('line', v_line, 'message', 'Nom manquant.');
      continue;
    end if;
    if v_purpose is null then
      v_issues := v_issues || jsonb_build_object('line', v_line,
        'message', format('« %s » : finalité manquante. Un usage sans finalité ne se gouverne pas.', v_name));
      continue;
    end if;

    -- L'activité, par son nom, dans cette organisation.
    v_activity := null;
    v_activity_raw := nullif(btrim(coalesce(r ->> 'activity', '')), '');
    if v_activity_raw is not null then
      select a.id into v_activity from public.activity a
       where a.organization_id = p_organization_id and lower(a.name) = lower(v_activity_raw)
       limit 1;
      if v_activity is null then
        v_issues := v_issues || jsonb_build_object('line', v_line,
          'message', format('« %s » : activité « %s » introuvable — l''usage est créé sans rattachement.', v_name, v_activity_raw));
      end if;
    end if;

    select u.id into v_owner from public.user_profile u
     where lower(u.email) = lower(nullif(btrim(coalesce(r ->> 'owner_email', '')), '')) limit 1;
    select u.id into v_accountable from public.user_profile u
     where lower(u.email) = lower(nullif(btrim(coalesce(r ->> 'accountable_email', '')), '')) limit 1;

    v_autonomy_raw := lower(btrim(coalesce(r ->> 'autonomy_level', '')));
    v_autonomy := case
      when v_autonomy_raw in ('l0', 'conseil', 'assiste', 'assisté') then 'L0'
      when v_autonomy_raw in ('l1', 'propose') then 'L1'
      when v_autonomy_raw in ('l2', 'execute apres approbation', 'exécute après approbation') then 'L2'
      when v_autonomy_raw in ('l3', 'limites', 'execute dans des limites') then 'L3'
      when v_autonomy_raw in ('l4', 'autonome') then 'L4'
      else 'L0' end;

    v_crit_raw := lower(btrim(coalesce(r ->> 'criticality', '')));
    v_crit := case
      when v_crit_raw in ('low', 'faible') then 'low'
      when v_crit_raw in ('moderate', 'modérée', 'moderee', 'moyenne') then 'moderate'
      when v_crit_raw in ('high', 'élevée', 'elevee', 'haute') then 'high'
      when v_crit_raw in ('critical', 'critique') then 'critical'
      else null end;
    v_rationale := nullif(btrim(coalesce(r ->> 'criticality_rationale', '')), '');
    -- La criticité commande l'évaluation d'impact et l'arbitrage : elle ne
    -- s'importe pas sans sa justification.
    if v_crit is not null and v_rationale is null then
      v_issues := v_issues || jsonb_build_object('line', v_line,
        'message', format('« %s » : criticité « %s » sans justification — elle n''est pas reprise, à poser depuis la fiche.', v_name, v_crit_raw));
      v_crit := null;
    end if;

    v_review_raw := nullif(btrim(coalesce(r ->> 'next_review_at', '')), '');
    begin
      v_review := v_review_raw::date;
    exception when others then
      v_review := null;
      if v_review_raw is not null then
        v_issues := v_issues || jsonb_build_object('line', v_line,
          'message', format('« %s » : date de revue « %s » illisible (attendu AAAA-MM-JJ).', v_name, v_review_raw));
      end if;
    end;

    select u.id into v_existing from public.ai_use_case u
     where u.organization_id = p_organization_id and lower(u.name) = lower(v_name) limit 1;

    if v_existing is null then
      insert into public.ai_use_case (
        tenant_id, organization_id, name, purpose, business_process, activity_id,
        expected_benefit, users_description, affected_persons, data_description,
        involves_personal_data, involves_sensitive_data, involves_vulnerable_persons,
        autonomy_level, criticality, criticality_rationale, decision_impact,
        owner_user_id, accountable_user_id, next_review_at, created_by
      ) values (
        v_org.tenant_id, p_organization_id, v_name, v_purpose,
        nullif(btrim(coalesce(r ->> 'business_process', '')), ''), v_activity,
        nullif(btrim(coalesce(r ->> 'expected_benefit', '')), ''),
        nullif(btrim(coalesce(r ->> 'users_description', '')), ''),
        nullif(btrim(coalesce(r ->> 'affected_persons', '')), ''),
        nullif(btrim(coalesce(r ->> 'data_description', '')), ''),
        lower(btrim(coalesce(r ->> 'involves_personal_data', ''))) = any (function_true),
        lower(btrim(coalesce(r ->> 'involves_sensitive_data', ''))) = any (function_true),
        lower(btrim(coalesce(r ->> 'involves_vulnerable_persons', ''))) = any (function_true),
        v_autonomy, v_crit, v_rationale,
        nullif(btrim(coalesce(r ->> 'decision_impact', '')), ''),
        coalesce(v_owner, app.current_user_id()), coalesce(v_accountable, v_owner, app.current_user_id()),
        v_review, app.current_user_id()
      ) returning id into v_id;
      v_created := v_created + 1;
    else
      v_id := v_existing;
      -- Une ligne connue complète ce qu'elle apporte : elle n'efface rien, et
      -- ne touche ni au statut, ni à la qualification.
      update public.ai_use_case u set
        purpose = v_purpose,
        business_process = coalesce(nullif(btrim(coalesce(r ->> 'business_process', '')), ''), u.business_process),
        activity_id = coalesce(v_activity, u.activity_id),
        expected_benefit = coalesce(nullif(btrim(coalesce(r ->> 'expected_benefit', '')), ''), u.expected_benefit),
        users_description = coalesce(nullif(btrim(coalesce(r ->> 'users_description', '')), ''), u.users_description),
        affected_persons = coalesce(nullif(btrim(coalesce(r ->> 'affected_persons', '')), ''), u.affected_persons),
        data_description = coalesce(nullif(btrim(coalesce(r ->> 'data_description', '')), ''), u.data_description),
        involves_personal_data = u.involves_personal_data or lower(btrim(coalesce(r ->> 'involves_personal_data', ''))) = any (function_true),
        involves_sensitive_data = u.involves_sensitive_data or lower(btrim(coalesce(r ->> 'involves_sensitive_data', ''))) = any (function_true),
        involves_vulnerable_persons = u.involves_vulnerable_persons or lower(btrim(coalesce(r ->> 'involves_vulnerable_persons', ''))) = any (function_true),
        decision_impact = coalesce(nullif(btrim(coalesce(r ->> 'decision_impact', '')), ''), u.decision_impact),
        owner_user_id = coalesce(v_owner, u.owner_user_id),
        accountable_user_id = coalesce(v_accountable, u.accountable_user_id),
        next_review_at = coalesce(v_review, u.next_review_at)
       where u.id = v_existing;
      v_updated := v_updated + 1;
    end if;

    -- Les actifs et les fournisseurs, par leurs noms, s'ils existent déjà.
    foreach v_label in array string_to_array(coalesce(r ->> 'assets', ''), ',') loop
      v_label := nullif(btrim(v_label), '');
      continue when v_label is null;
      select a.id into v_target from public.ai_asset a
       where a.organization_id = p_organization_id and lower(a.name) = lower(v_label) limit 1;
      if v_target is null then
        v_issues := v_issues || jsonb_build_object('line', v_line,
          'message', format('« %s » : actif « %s » introuvable — à rattacher depuis la fiche.', v_name, v_label));
      else
        insert into public.use_case_asset_link (tenant_id, use_case_id, asset_id)
        values (v_org.tenant_id, v_id, v_target)
        on conflict do nothing;
        v_linked := v_linked + 1;
      end if;
    end loop;

    foreach v_label in array string_to_array(coalesce(r ->> 'vendors', ''), ',') loop
      v_label := nullif(btrim(v_label), '');
      continue when v_label is null;
      select v.id into v_target from public.vendor v
       where v.organization_id = p_organization_id and lower(v.name) = lower(v_label) limit 1;
      if v_target is null then
        v_issues := v_issues || jsonb_build_object('line', v_line,
          'message', format('« %s » : fournisseur « %s » introuvable — à rattacher depuis la fiche.', v_name, v_label));
      else
        insert into public.use_case_vendor_link (tenant_id, use_case_id, vendor_id)
        values (v_org.tenant_id, v_id, v_target)
        on conflict do nothing;
        v_linked := v_linked + 1;
      end if;
    end loop;
  end loop;

  perform app.log_audit(
    v_org.tenant_id, 'create', 'ai_use_case', p_organization_id, v_org.business_ref,
    format('Import de cas d''usage : %s créé(s), %s mis à jour, %s rattachement(s), %s signalement(s).',
           v_created, v_updated, v_linked, jsonb_array_length(v_issues)),
    null, null,
    jsonb_build_object('import', 'ai_use_case', 'created', v_created, 'updated', v_updated,
                       'linked', v_linked, 'issues', v_issues)
  );

  return jsonb_build_object('created', v_created, 'updated', v_updated, 'linked', v_linked, 'issues', v_issues);
end;
$$;

create or replace function public.import_use_cases(p_organization_id uuid, p_rows jsonb)
returns jsonb language sql security invoker
set search_path = app, public, pg_catalog
as $$ select app.import_use_cases(p_organization_id, p_rows); $$;

grant execute on function public.import_use_cases(uuid, jsonb) to authenticated;

comment on function app.import_use_cases is
  'Reprise d''un inventaire d''usages d''IA : rapprochement par nom, statut jamais importé, criticité refusée sans justification, rattachements par nom. Chaque ligne rend compte.';

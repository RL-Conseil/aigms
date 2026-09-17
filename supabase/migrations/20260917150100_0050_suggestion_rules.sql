-- =============================================================================
-- AIGMS — 0050 — Règles de proposition pour la portée cas d'usage
-- =============================================================================
-- (séparée de 0049 : les nouvelles valeurs d'un enum ne s'utilisent pas dans
-- la transaction qui les crée.)
--
-- Une règle = un fait du cas d'usage, un contrôle-type, un motif rédigé pour
-- l'utilisateur. Les règles de 0048 sont reprises ici ; la table est vidée des
-- règles de l'éditeur et rechargée.
-- =============================================================================

delete from public.catalog_applicability_rule where tenant_id is null;

insert into public.catalog_applicability_rule (framework_code, control_code, condition, reason) values
  -- ---- Personnes et données ---------------------------------------------
  ('AIGMS-CF', 'AIGMS-USE-004', 'external_persons',   'Des personnes extérieures à l''organisation sont concernées : les parties prenantes se consultent.'),
  ('AIGMS-CF', 'AIGMS-USE-004', 'high_risk_potential', 'Un usage à haut risque potentiel consulte ses parties prenantes.'),
  ('AIGMS-CF', 'AIGMS-USE-005', 'in_service',          'Des utilisateurs sont en situation réelle : ils sont formés et savent signaler.'),
  ('AIGMS-CF', 'AIGMS-USE-003', 'criticality_high',    'L''effort de gouvernance d''un usage critique se justifie par sa valeur.'),
  ('AIGMS-CF', 'AIGMS-DAT-004', 'personal_data',       'Des données personnelles sont mobilisées.'),
  ('AIGMS-CF', 'AIGMS-DAT-005', 'vulnerable_persons',  'Des personnes vulnérables sont concernées : vérifier les catégories particulières de données.'),
  ('AIGMS-CF', 'AIGMS-DAT-005', 'privacy_impact',      'La classification retient un impact sur la vie privée : vérifier les catégories particulières.'),
  ('AIGMS-CF', 'AIGMS-DAT-006', 'privacy_impact',      'Impact sur la vie privée : si des données de santé sont en jeu, ce contrôle s''applique.'),
  ('AIGMS-CF', 'AIGMS-DAT-007', 'asset_dataset',       'Un jeu de données est rattaché : sa provenance se trace.'),
  ('AIGMS-CF', 'AIGMS-DAT-007', 'high_risk_potential', 'Un usage à haut risque documente la provenance de ses données.'),
  ('AIGMS-CF', 'AIGMS-DAT-008', 'high_risk_potential', 'Un usage à haut risque évalue la qualité et la représentativité de ses données.'),
  ('AIGMS-CF', 'AIGMS-DAT-008', 'asset_dataset',       'Un jeu de données est rattaché : sa qualité s''évalue.'),
  ('AIGMS-CF', 'AIGMS-DAT-008', 'vulnerable_persons',  'Des personnes vulnérables sont concernées : la représentativité des données compte.'),
  ('AIGMS-CF', 'AIGMS-DAT-009', 'personal_data',       'Des données personnelles sont mobilisées : ne transmettre que le nécessaire.'),
  ('AIGMS-CF', 'AIGMS-DAT-012', 'asset_own_model',     'Un modèle propre est rattaché : ses données d''entraînement se documentent.'),
  ('AIGMS-CF', 'AIGMS-DAT-012', 'role_developer',      'Vous entraînez ou réglez des modèles : leurs données d''entraînement se documentent.'),

  -- ---- Risques --------------------------------------------------------------
  ('AIGMS-CF', 'AIGMS-RSK-003', 'criticality_high',    'Usage critique ou élevé : la probabilité de chaque risque se cote et se justifie.'),
  ('AIGMS-CF', 'AIGMS-RSK-004', 'criticality_high',    'Usage critique ou élevé : l''impact de chaque risque se cote sur plusieurs dimensions.'),
  ('AIGMS-CF', 'AIGMS-RSK-004', 'external_persons',    'Des personnes extérieures sont affectées : l''impact se cote sur elles, pas seulement sur l''organisation.'),
  ('AIGMS-CF', 'AIGMS-RSK-008', 'criticality_high',    'Usage critique ou élevé : le risque résiduel se recote après traitement.'),
  ('AIGMS-CF', 'AIGMS-RSK-012', 'high_risk_potential', 'Haut risque potentiel : une évaluation d''impact est attendue.'),
  ('AIGMS-CF', 'AIGMS-RSK-012', 'external_persons',    'Des personnes extérieures sont affectées : une évaluation d''impact est attendue.'),
  ('AIGMS-CF', 'AIGMS-RSK-012', 'vulnerable_persons',  'Des personnes vulnérables sont concernées : une évaluation d''impact est attendue.'),

  -- ---- Supervision humaine --------------------------------------------------
  ('AIGMS-CF', 'AIGMS-HUM-002', 'autonomy_gte_l3',     'Au-delà de L2, une décision produite par le système exige une validation humaine effective.'),
  ('AIGMS-CF', 'AIGMS-HUM-002', 'vulnerable_persons',  'Des personnes vulnérables sont concernées : une validation humaine des décisions s''impose.'),
  ('AIGMS-CF', 'AIGMS-HUM-002', 'high_risk_potential', 'Haut risque potentiel : le contrôle humain des décisions est une obligation.'),
  ('AIGMS-CF', 'AIGMS-HUM-003', 'high_risk_potential', 'Haut risque potentiel : les personnes qui supervisent sont formées aux limites du système.'),
  ('AIGMS-CF', 'AIGMS-HUM-003', 'autonomy_gte_l3',     'Au-delà de L2, les validateurs connaissent les limites du système.'),
  ('AIGMS-CF', 'AIGMS-HUM-004', 'asset_agent',         'Un agent agit : il faut pouvoir reprendre la main sans délai.'),
  ('AIGMS-CF', 'AIGMS-HUM-004', 'autonomy_gte_l3',     'Au-delà de L2, la reprise de la main est un mécanisme, pas une intention.'),
  ('AIGMS-CF', 'AIGMS-HUM-005', 'asset_agent',         'Un agent agit : ses déclencheurs d''escalade et son arrêt se définissent et se testent.'),
  ('AIGMS-CF', 'AIGMS-HUM-005', 'autonomy_gte_l3',     'Au-delà de L2, une autorité d''arrêt nommée est exigée.'),

  -- ---- Sécurité -------------------------------------------------------------
  ('AIGMS-CF', 'AIGMS-SEC-003', 'asset_agent',         'Un agent agit : ses droits d''exécution se bornent et se revoient.'),
  ('AIGMS-CF', 'AIGMS-SEC-003', 'security_impact',     'La classification retient un impact sécurité : le moindre privilège s''applique au système.'),
  ('AIGMS-CF', 'AIGMS-SEC-007', 'gpai_dependency',     'Le système dépend d''un modèle à usage général : les injections de requêtes sont un risque propre.'),
  ('AIGMS-CF', 'AIGMS-SEC-007', 'model_provider',      'Un modèle de langage tiers est en jeu : les injections de requêtes sont un risque propre.'),
  ('AIGMS-CF', 'AIGMS-SEC-007', 'asset_agent',         'Un agent lit des contenus et agit : une injection peut déclencher une action.'),
  ('AIGMS-CF', 'AIGMS-SEC-008', 'personal_data',       'Des données personnelles sont mobilisées : le système ne doit pas les laisser sortir.'),
  ('AIGMS-CF', 'AIGMS-SEC-008', 'model_provider',      'Un modèle tiers reçoit des données : ce qui lui est soumis se contrôle.'),
  ('AIGMS-CF', 'AIGMS-SEC-009', 'external_persons',    'Des personnes extérieures accèdent au système : quotas et détection d''abus.'),
  ('AIGMS-CF', 'AIGMS-SEC-009', 'in_service',          'Le système est en service : ses API se protègent contre l''abus.'),
  ('AIGMS-CF', 'AIGMS-SEC-010', 'external_persons',    'Des personnes extérieures fournissent des entrées : elles se valident.'),
  ('AIGMS-CF', 'AIGMS-SEC-010', 'security_impact',     'Impact sécurité retenu : les entrées se valident.'),
  ('AIGMS-CF', 'AIGMS-SEC-011', 'asset_agent',         'Un agent agit sur ses sorties : elles se vérifient avant exécution.'),
  ('AIGMS-CF', 'AIGMS-SEC-011', 'gpai_dependency',     'Sorties d''un modèle génératif : elles se vérifient avant remise.'),
  ('AIGMS-CF', 'AIGMS-SEC-011', 'external_persons',    'Des personnes extérieures reçoivent les sorties : elles se vérifient avant remise.'),
  ('AIGMS-CF', 'AIGMS-SEC-012', 'high_risk_potential', 'Haut risque potentiel : des tests de sécurité spécifiques sont attendus.'),
  ('AIGMS-CF', 'AIGMS-SEC-012', 'security_impact',     'Impact sécurité retenu : tests de sécurité avant mise en service.'),
  ('AIGMS-CF', 'AIGMS-SEC-012', 'asset_agent',         'Un agent agit : ses contournements se testent avant mise en service.'),

  -- ---- Fournisseurs ---------------------------------------------------------
  ('AIGMS-CF', 'AIGMS-INV-007', 'external_vendor',     'Un tiers concourt à l''usage : ses dépendances se cartographient.'),
  ('AIGMS-CF', 'AIGMS-SUP-002', 'external_vendor',     'Un fournisseur concourt à l''usage : sa revue préalable conditionne la mise en service.'),
  ('AIGMS-CF', 'AIGMS-SUP-003', 'external_vendor',     'Un fournisseur traite des données : leur localisation se fixe.'),
  ('AIGMS-CF', 'AIGMS-SUP-005', 'model_provider',      'Un fournisseur de modèle reçoit des données : leur usage par lui se borne contractuellement.'),
  ('AIGMS-CF', 'AIGMS-SUP-005', 'personal_data',       'Des données personnelles transitent chez un fournisseur : leur usage se borne.'),
  ('AIGMS-CF', 'AIGMS-SUP-006', 'external_vendor',     'Un fournisseur concourt à l''usage : ses engagements de service se contractualisent.'),
  ('AIGMS-CF', 'AIGMS-SUP-009', 'model_provider',      'Un fournisseur de modèle : la dépendance s''évalue et se traite.'),
  ('AIGMS-CF', 'AIGMS-SUP-009', 'criticality_high',    'Usage critique : la dépendance à ses fournisseurs s''évalue.'),
  ('AIGMS-CF', 'AIGMS-SUP-010', 'criticality_high',    'Usage critique : la sortie se prépare avant d''en avoir besoin.'),
  ('AIGMS-CF', 'AIGMS-SUP-010', 'model_provider',      'Un fournisseur de modèle : la réversibilité se documente.'),

  -- ---- Exploitation et surveillance ----------------------------------------
  ('AIGMS-CF', 'AIGMS-OPS-003', 'asset_own_model',     'Un modèle propre : sa version se fige et se gère.'),
  ('AIGMS-CF', 'AIGMS-OPS-003', 'model_provider',      'Un modèle tiers : sa version se connaît et son changement se qualifie.'),
  ('AIGMS-CF', 'AIGMS-OPS-004', 'gpai_dependency',     'Un modèle à usage général : les prompts gouvernent son comportement, ils se versionnent.'),
  ('AIGMS-CF', 'AIGMS-OPS-004', 'asset_agent',         'Un agent : ses instructions se versionnent comme du code.'),
  ('AIGMS-CF', 'AIGMS-OPS-005', 'in_service',          'Le système est en service : sa configuration de référence se décrit.'),
  ('AIGMS-CF', 'AIGMS-OPS-007', 'in_service',          'Le système est en service : on sait revenir en arrière.'),
  ('AIGMS-CF', 'AIGMS-OPS-009', 'role_host',           'Vous hébergez : la capacité se dimensionne et se surveille.'),
  ('AIGMS-CF', 'AIGMS-OPS-010', 'criticality_high',    'Usage critique : sa disponibilité et son mode dégradé se définissent.'),
  ('AIGMS-CF', 'AIGMS-OPS-010', 'in_service',          'Le système est en service : les métiers savent fonctionner sans lui.'),
  ('AIGMS-CF', 'AIGMS-MON-002', 'in_service',          'Le système est en service : la qualité de ses sorties se mesure.'),
  ('AIGMS-CF', 'AIGMS-MON-002', 'high_risk_potential', 'Haut risque potentiel : l''exactitude se mesure et se documente.'),
  ('AIGMS-CF', 'AIGMS-MON-003', 'gpai_dependency',     'Un modèle génératif : ses réponses erronées se mesurent.'),
  ('AIGMS-CF', 'AIGMS-MON-003', 'model_provider',      'Un modèle génératif tiers : ses réponses erronées se mesurent.'),
  ('AIGMS-CF', 'AIGMS-MON-004', 'asset_own_model',     'Un modèle propre : sa dérive se surveille.'),
  ('AIGMS-CF', 'AIGMS-MON-004', 'in_service',          'En service : la dérive par rapport à l''évaluation initiale se surveille.'),
  ('AIGMS-CF', 'AIGMS-MON-005', 'in_service',          'En service : latence, erreurs et disponibilité se mesurent.'),
  ('AIGMS-CF', 'AIGMS-MON-006', 'in_service',          'En service : le coût se mesure et se compare au bénéfice attendu.'),
  ('AIGMS-CF', 'AIGMS-MON-007', 'in_service',          'En service : l''usage réel se compare à l''usage prévu.'),
  ('AIGMS-CF', 'AIGMS-INC-008', 'in_service',          'En service : chaque incident significatif produit un retour d''expérience.');

-- -----------------------------------------------------------------------------
-- suggest_controls : portée cas d'usage, faits enrichis
-- -----------------------------------------------------------------------------
create or replace function app.suggest_controls(p_use_case_id uuid)
returns jsonb
language plpgsql
stable
security definer
set search_path = app, public, pg_catalog
as $$
declare
  v_uc     public.ai_use_case;
  v_org    public.organization;
  v_facts  app.suggestion_condition[] := '{}';
  v_flags  app.classification_flag[];
  v_kinds  app.asset_kind[];
begin
  select * into v_uc from public.ai_use_case where id = p_use_case_id;
  if v_uc.id is null then
    return jsonb_build_object('available', false, 'reason', 'Cas d’usage introuvable.');
  end if;
  select * into v_org from public.organization where id = v_uc.organization_id;
  if not app.has_tenant_access(v_org.tenant_id) then
    return jsonb_build_object('available', false, 'reason', 'Hors de votre périmètre.');
  end if;

  -- Les faits du cas d'usage.
  if v_uc.involves_personal_data then v_facts := v_facts || 'personal_data'::app.suggestion_condition; end if;
  if v_uc.involves_vulnerable_persons then v_facts := v_facts || 'vulnerable_persons'::app.suggestion_condition; end if;
  if v_uc.autonomy_level in ('L3', 'L4') then v_facts := v_facts || 'autonomy_gte_l3'::app.suggestion_condition; end if;
  if v_uc.criticality in ('high', 'critical') then v_facts := v_facts || 'criticality_high'::app.suggestion_condition; end if;
  if v_uc.status in ('PRODUCTION', 'MONITORING') then v_facts := v_facts || 'in_service'::app.suggestion_condition; end if;
  -- Des personnes exterieures : declarees comme concernees, sans etre des
  -- utilisateurs internes. On lit le champ tel quel : renseigne, il compte.
  if coalesce(btrim(v_uc.affected_persons), '') <> '' then v_facts := v_facts || 'external_persons'::app.suggestion_condition; end if;

  -- Les fournisseurs.
  if exists (select 1 from public.use_case_vendor_link l where l.use_case_id = v_uc.id) then
    v_facts := v_facts || 'external_vendor'::app.suggestion_condition;
  end if;
  if exists (select 1 from public.use_case_vendor_link l join public.vendor v on v.id = l.vendor_id
              where l.use_case_id = v_uc.id and v.is_model_provider) then
    v_facts := v_facts || 'model_provider'::app.suggestion_condition;
  end if;

  -- Les actifs : ce que le systeme EST.
  select coalesce(array_agg(distinct a.kind), '{}') into v_kinds
  from public.use_case_asset_link l join public.ai_asset a on a.id = l.asset_id
  where l.use_case_id = v_uc.id;
  if 'ai_agent' = any (v_kinds) then v_facts := v_facts || 'asset_agent'::app.suggestion_condition; end if;
  if 'ai_model' = any (v_kinds) then v_facts := v_facts || 'asset_own_model'::app.suggestion_condition; end if;
  if 'dataset' = any (v_kinds) then v_facts := v_facts || 'asset_dataset'::app.suggestion_condition; end if;

  -- La classification reglementaire, la plus recente.
  select rc.flags into v_flags
  from public.regulatory_classification rc
  where rc.use_case_id = v_uc.id
  order by rc.classified_at desc nulls last limit 1;
  if 'high_risk_potential' = any (coalesce(v_flags, '{}')) then v_facts := v_facts || 'high_risk_potential'::app.suggestion_condition; end if;
  if 'privacy_impact' = any (coalesce(v_flags, '{}')) then v_facts := v_facts || 'privacy_impact'::app.suggestion_condition; end if;
  if 'security_impact' = any (coalesce(v_flags, '{}')) then v_facts := v_facts || 'security_impact'::app.suggestion_condition; end if;
  if 'gpai_dependency' = any (coalesce(v_flags, '{}')) then v_facts := v_facts || 'gpai_dependency'::app.suggestion_condition; end if;
  if 'transparency_obligations' = any (coalesce(v_flags, '{}')) then v_facts := v_facts || 'transparency_obligations'::app.suggestion_condition; end if;

  -- Le role de l'organisation.
  case v_org.ai_activity_profile
    when 'infrastructure_host'   then v_facts := v_facts || 'role_host'::app.suggestion_condition;
    when 'model_developer'       then v_facts := v_facts || 'role_developer'::app.suggestion_condition;
    when 'integrator_consultant' then v_facts := v_facts || 'role_integrator'::app.suggestion_condition;
    when 'business_user'         then v_facts := v_facts || 'role_business_user'::app.suggestion_condition;
    else null;
  end case;

  return (
    with candidates as (
      select cc.id as catalog_control_id, f.code as framework_code, cc.control_code, cc.title,
             d.code as domain_code, d.name as domain_name, cc.phase::text as phase,
             coalesce(cc.applicability ->> 'default', 'conditional') = 'mandatory' as mandatory,
             coalesce(p.tier, 'relevant') as tier,
             (select c.id from public.control c
               where c.organization_id = v_org.id and c.catalog_control_id = cc.id limit 1) as control_id
      from public.catalog_control cc
      join public.catalog_version v on v.id = cc.version_id and v.status = 'published'
      join public.catalog_framework f on f.id = v.framework_id
        and (f.tenant_id is null or f.tenant_id = v_org.tenant_id)
      join public.catalog_domain d on d.id = cc.domain_id
      left join public.catalog_domain_priority p
        on p.profile = v_org.ai_activity_profile and p.domain_code = d.code
      -- Seule la portee cas d'usage se propose ici.
      where cc.scope = 'use_case'
    ),
    reasons as (
      select c.catalog_control_id,
             array_remove(array_agg(r.reason order by r.condition), null) as reasons
      from candidates c
      left join public.catalog_applicability_rule r
        on r.framework_code = c.framework_code and r.control_code = c.control_code
       and r.condition = any (v_facts)
       and (r.tenant_id is null or r.tenant_id = v_org.tenant_id)
      group by c.catalog_control_id
    ),
    scored as (
      select c.*, r.reasons,
             case
               when c.control_id is not null and exists (
                 select 1 from public.control_applicability ca
                  where ca.control_id = c.control_id and ca.use_case_id = v_uc.id and ca.status = 'applicable')
                 then 'already_affected'
               when c.control_id is not null then 'operational_not_affected'
               else 'to_add'
             end as state,
             (select coalesce(jsonb_agg(jsonb_build_object('code', t.code, 'acronym', t.acronym, 'automation', t.automation) order by t.code), '[]'::jsonb)
                from public.catalog_tool_control m join public.catalog_tool t on t.id = m.tool_id
               where m.framework_code = c.framework_code and m.control_code = c.control_code) as tools
      from candidates c join reasons r using (catalog_control_id)
    )
    select jsonb_build_object(
      'available', true,
      'facts', to_jsonb(v_facts),
      'profile', v_org.ai_activity_profile,
      'proposals', coalesce((
        select jsonb_agg(jsonb_build_object(
          'catalog_control_id', s.catalog_control_id,
          'framework_code', s.framework_code,
          'code', s.control_code,
          'title', s.title,
          'domain_code', s.domain_code,
          'domain_name', s.domain_name,
          'phase', s.phase,
          'tier', case when s.mandatory and array_length(s.reasons, 1) is null then 'baseline'
                       when array_length(s.reasons, 1) > 0 then 'triggered'
                       else s.tier end,
          'mandatory', s.mandatory,
          'reasons', case when s.mandatory
                            then to_jsonb(array['Attendu de tout cas d’usage.'] || s.reasons)
                            else to_jsonb(s.reasons) end,
          'state', s.state,
          'control_id', s.control_id,
          'tools', s.tools
        ) order by
          -- Ce que les faits declenchent d'abord — c'est le specifique — puis
          -- le socle commun.
          case when array_length(s.reasons, 1) > 0 then 0 else 1 end,
          case s.tier when 'core' then 0 when 'relevant' then 1 else 2 end,
          s.domain_code, s.control_code)
        from scored s
        where s.mandatory or array_length(s.reasons, 1) > 0
      ), '[]'::jsonb)
    )
  );
end;
$$;

-- -----------------------------------------------------------------------------
-- Les contrôles d'organisation : proposés une fois, sur la liste opérationnelle
-- -----------------------------------------------------------------------------
create or replace function app.suggest_organization_controls(p_organization_id uuid)
returns jsonb
language sql
stable
security definer
set search_path = app, public, pg_catalog
as $$
  with org as (
    select o.* from public.organization o
    where o.id = p_organization_id and app.has_tenant_access(o.tenant_id)
  ),
  candidates as (
    select cc.id as catalog_control_id, f.code as framework_code, cc.control_code, cc.title,
           d.code as domain_code, d.name as domain_name, cc.phase::text as phase,
           coalesce(p.tier, 'relevant') as tier,
           (select c.id from public.control c
             where c.organization_id = org.id and c.catalog_control_id = cc.id limit 1) as control_id,
           (select coalesce(jsonb_agg(jsonb_build_object('code', t.code, 'acronym', t.acronym, 'automation', t.automation) order by t.code), '[]'::jsonb)
              from public.catalog_tool_control m join public.catalog_tool t on t.id = m.tool_id
             where m.framework_code = f.code and m.control_code = cc.control_code) as tools
    from org
    join public.catalog_framework f on f.tenant_id is null or f.tenant_id = org.tenant_id
    join public.catalog_version v on v.framework_id = f.id and v.status = 'published'
    join public.catalog_control cc on cc.version_id = v.id and cc.scope = 'organization'
    join public.catalog_domain d on d.id = cc.domain_id
    left join public.catalog_domain_priority p on p.profile = org.ai_activity_profile and p.domain_code = d.code
  )
  select jsonb_build_object(
    'available', exists (select 1 from org),
    'proposals', coalesce((
      select jsonb_agg(jsonb_build_object(
        'catalog_control_id', c.catalog_control_id, 'framework_code', c.framework_code,
        'code', c.control_code, 'title', c.title, 'domain_code', c.domain_code, 'domain_name', c.domain_name,
        'phase', c.phase, 'tier', c.tier, 'mandatory', true,
        'reasons', jsonb_build_array('Contrôle du système de management : se tient une fois pour toute l’organisation.'),
        'state', case when c.control_id is not null then 'already_affected' else 'to_add' end,
        'control_id', c.control_id, 'tools', c.tools
      ) order by case c.tier when 'core' then 0 when 'relevant' then 1 else 2 end, c.domain_code, c.control_code)
      from candidates c
    ), '[]'::jsonb)
  );
$$;

create or replace function public.suggest_organization_controls(p_organization_id uuid)
returns jsonb language sql stable security invoker
set search_path = app, public, pg_catalog
as $$ select app.suggest_organization_controls(p_organization_id); $$;

grant execute on function public.suggest_organization_controls(uuid) to authenticated;

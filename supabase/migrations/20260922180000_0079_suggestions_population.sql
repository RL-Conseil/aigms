-- =============================================================================
-- AIGMS — 0079 — Les propositions disent leur population, et ce qu'elles taisent
-- =============================================================================
-- Le référentiel publié compte 120 contrôles-types : 51 de portée
-- organisation (système de management, proposés tous depuis le registre) et
-- 69 de portée cas d'usage (24 de socle, 45 conditionnels). Sur une fiche,
-- « 59 propositions » se lisait sans savoir sur combien, ni ce qui n'était pas
-- proposé. Les deux lectures portent désormais leur population, et celle du
-- cas d'usage liste les contrôles conditionnels qu'aucun fait ne déclenche —
-- avec les faits qui les déclencheraient.
--
-- Les deux fonctions ne changent que par ce complément : on réécrit leur
-- texte plutôt que de recopier leur corps.
-- =============================================================================

do $$
declare v text;
begin
  select pg_get_functiondef('app.suggest_controls(uuid)'::regprocedure) into v;
  v := replace(v,
    $x$      'profile', v_org.ai_activity_profile,
      'proposals', coalesce(($x$,
    $x$      'profile', v_org.ai_activity_profile,
      'population', jsonb_build_object(
        'use_case', (select count(*) from candidates),
        'baseline', (select count(*) from candidates c where c.mandatory),
        'organization', (select count(*) from public.catalog_control cc
                          join public.catalog_version v on v.id = cc.version_id and v.status = 'published'
                          join public.catalog_framework f on f.id = v.framework_id
                           and (f.tenant_id is null or f.tenant_id = v_org.tenant_id)
                          where cc.scope = 'organization')),
      -- Les conditionnels qu'aucun fait ne declenche, et ce qui les declencherait.
      'not_proposed', coalesce((
        select jsonb_agg(jsonb_build_object(
          'code', s.control_code, 'title', s.title, 'domain_name', s.domain_name,
          'triggers', (select coalesce(jsonb_agg(distinct r.condition::text), '[]'::jsonb)
                         from public.catalog_applicability_rule r
                        where r.framework_code = s.framework_code and r.control_code = s.control_code
                          and (r.tenant_id is null or r.tenant_id = v_org.tenant_id))
        ) order by s.domain_code, s.control_code)
        from scored s
        where not s.mandatory and array_length(s.reasons, 1) is null
      ), '[]'::jsonb),
      'proposals', coalesce(($x$);
  execute v;

  select pg_get_functiondef('app.suggest_organization_controls(uuid)'::regprocedure) into v;
  v := replace(v,
    $x$    'available', exists (select 1 from org),$x$,
    $x$    'available', exists (select 1 from org),
    'population', jsonb_build_object('organization', (select count(*) from candidates)),$x$);
  execute v;
end $$;

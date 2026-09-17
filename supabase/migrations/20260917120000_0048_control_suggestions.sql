-- =============================================================================
-- AIGMS — 0048 — Grille d'applicabilité et propositions de contrôles
-- =============================================================================
-- L'assistant propose, l'humain retient. Cette migration pose la partie
-- déterministe : QUELS contrôles-types proposer pour UN cas d'usage, et
-- POURQUOI — chaque proposition porte son motif, et chaque motif est une
-- règle qu'on peut lire et tester.
--
-- Trois entrées, toutes déjà en base :
--   * l'applicabilité par défaut du contrôle-type (obligatoire / conditionnel) ;
--   * les FAITS du cas d'usage : données personnelles, personnes vulnérables,
--     autonomie, criticité, fournisseur tiers, fournisseur de modèle ;
--   * le RÔLE de l'organisation vis-à-vis de l'IA, qui ordonne les domaines :
--     un hébergeur commence par la sécurité et l'exploitation, un utilisateur
--     métier par la gouvernance et la supervision.
--
-- Aucun modèle de langage n'intervient ici. S'il en vient un, il ordonnera et
-- rédigera sur cette liste — jamais à sa place.
-- =============================================================================

-- -----------------------------------------------------------------------------
-- Conditions : ce qu'un fait du cas d'usage déclenche
-- -----------------------------------------------------------------------------
create type app.suggestion_condition as enum (
  'personal_data', 'vulnerable_persons', 'autonomy_gte_l3', 'criticality_high',
  'external_vendor', 'model_provider',
  'role_host', 'role_developer', 'role_integrator', 'role_business_user'
);

create table public.catalog_applicability_rule (
  id             uuid primary key default gen_random_uuid(),
  tenant_id      uuid references public.tenant (id) on delete cascade,
  framework_code text not null,
  control_code   text not null,
  condition      app.suggestion_condition not null,
  reason         text not null check (btrim(reason) <> ''),
  unique (framework_code, control_code, condition)
);

comment on table public.catalog_applicability_rule is
  'Un contrôle-type conditionnel est proposé quand un fait du cas d''usage le déclenche. Le motif est lu tel quel par l''utilisateur.';

alter table public.catalog_applicability_rule enable row level security;
alter table public.catalog_applicability_rule force row level security;
create policy catalog_applicability_rule_select on public.catalog_applicability_rule
  for select to authenticated using (tenant_id is null or app.has_tenant_access(tenant_id));
create policy catalog_applicability_rule_write on public.catalog_applicability_rule
  for all to authenticated
  using (tenant_id is not null and app.has_tenant_role(tenant_id, app.roles_administer()))
  with check (tenant_id is not null and app.has_tenant_role(tenant_id, app.roles_administer()));
grant select, insert, update, delete on public.catalog_applicability_rule to authenticated;

-- Une regle d'un tenant est journalisee comme le reste ; celles de l'editeur,
-- sans tenant, n'arrivent que par migration.
create trigger catalog_applicability_rule_audit
  after insert or update or delete on public.catalog_applicability_rule
  for each row execute function app.audit_business();

insert into public.catalog_applicability_rule (framework_code, control_code, condition, reason) values
  ('AIGMS-CF', 'AIGMS-GOV-004', 'criticality_high',   'Un usage critique ou élevé passe devant le comité de gouvernance.'),
  ('AIGMS-CF', 'AIGMS-GOV-007', 'personal_data',      'Des données personnelles sont mobilisées : un responsable des données répond de leur usage.'),
  ('AIGMS-CF', 'AIGMS-INV-007', 'external_vendor',    'Un tiers concourt à l''usage : ses dépendances se cartographient.'),
  ('AIGMS-CF', 'AIGMS-USE-003', 'criticality_high',   'L''effort de gouvernance d''un usage critique se justifie par sa valeur.'),
  ('AIGMS-CF', 'AIGMS-RSK-011', 'criticality_high',   'Un usage critique appelle une veille sur les risques émergents.'),
  ('AIGMS-CF', 'AIGMS-DAT-004', 'personal_data',      'Des données personnelles sont mobilisées.'),
  ('AIGMS-CF', 'AIGMS-DAT-005', 'vulnerable_persons', 'Des personnes vulnérables sont concernées : vérifier les catégories particulières de données.'),
  ('AIGMS-CF', 'AIGMS-DAT-005', 'personal_data',      'Des données personnelles sont mobilisées : vérifier si des catégories particulières en font partie.'),
  ('AIGMS-CF', 'AIGMS-DAT-012', 'role_developer',     'Vous entraînez ou réglez des modèles : leurs données d''entraînement se documentent.'),
  ('AIGMS-CF', 'AIGMS-SEC-007', 'model_provider',     'Un modèle de langage tiers est en jeu : les injections de requêtes sont un risque propre.'),
  ('AIGMS-CF', 'AIGMS-SEC-007', 'role_developer',     'Vous fournissez un modèle : les injections de requêtes sont un risque propre.'),
  ('AIGMS-CF', 'AIGMS-SUP-006', 'external_vendor',    'Un fournisseur concourt à l''usage : ses engagements de service se contractualisent.'),
  ('AIGMS-CF', 'AIGMS-SUP-010', 'external_vendor',    'Un fournisseur concourt à l''usage : la sortie se prépare avant d''en avoir besoin.'),
  ('AIGMS-CF', 'AIGMS-HUM-002', 'autonomy_gte_l3',    'Au-delà de L2, une décision produite par le système exige une validation humaine effective.'),
  ('AIGMS-CF', 'AIGMS-HUM-002', 'vulnerable_persons', 'Des personnes vulnérables sont concernées : une validation humaine des décisions s''impose.'),
  ('AIGMS-CF', 'AIGMS-OPS-009', 'role_host',          'Vous hébergez : la capacité se dimensionne et se surveille.'),
  ('AIGMS-CF', 'AIGMS-MON-003', 'model_provider',     'Un modèle génératif tiers est en jeu : ses réponses erronées se mesurent.'),
  ('AIGMS-CF', 'AIGMS-MON-004', 'role_developer',     'Vous fournissez un modèle : sa dérive se surveille.'),
  ('AIGMS-CF', 'AIGMS-MON-004', 'model_provider',     'Un modèle tiers est en jeu : sa dérive se surveille.');

-- -----------------------------------------------------------------------------
-- Le rôle ordonne les domaines
-- -----------------------------------------------------------------------------
-- Tout se propose ; mais un hébergeur ne commence pas par la gestion des cas
-- d'usage, ni un utilisateur métier par la sécurité cloud. Trois rangs :
-- « core » se lit d'abord, « relevant » ensuite, « secondary » n'apparaît que
-- si une condition l'a déclenché.
create table public.catalog_domain_priority (
  profile     app.ai_activity_profile not null,
  domain_code text not null,
  tier        text not null check (tier in ('core', 'relevant', 'secondary')),
  primary key (profile, domain_code)
);

alter table public.catalog_domain_priority enable row level security;
alter table public.catalog_domain_priority force row level security;
create policy catalog_domain_priority_select on public.catalog_domain_priority
  for select to authenticated using (true);
grant select on public.catalog_domain_priority to authenticated;

insert into public.catalog_domain_priority (profile, domain_code, tier) values
  ('infrastructure_host', 'SEC', 'core'), ('infrastructure_host', 'OPS', 'core'), ('infrastructure_host', 'DAT', 'core'),
  ('infrastructure_host', 'INC', 'core'), ('infrastructure_host', 'MON', 'core'),
  ('infrastructure_host', 'GOV', 'relevant'), ('infrastructure_host', 'INV', 'relevant'), ('infrastructure_host', 'SUP', 'relevant'),
  ('infrastructure_host', 'CMP', 'relevant'), ('infrastructure_host', 'RSK', 'relevant'),
  ('infrastructure_host', 'USE', 'secondary'), ('infrastructure_host', 'HUM', 'secondary'),

  ('model_developer', 'DAT', 'core'), ('model_developer', 'SEC', 'core'), ('model_developer', 'MON', 'core'),
  ('model_developer', 'RSK', 'core'), ('model_developer', 'HUM', 'core'),
  ('model_developer', 'GOV', 'relevant'), ('model_developer', 'INV', 'relevant'), ('model_developer', 'USE', 'relevant'),
  ('model_developer', 'OPS', 'relevant'), ('model_developer', 'SUP', 'relevant'), ('model_developer', 'INC', 'relevant'),
  ('model_developer', 'CMP', 'relevant'),

  ('integrator_consultant', 'USE', 'core'), ('integrator_consultant', 'RSK', 'core'), ('integrator_consultant', 'SUP', 'core'),
  ('integrator_consultant', 'HUM', 'core'), ('integrator_consultant', 'GOV', 'core'),
  ('integrator_consultant', 'INV', 'relevant'), ('integrator_consultant', 'DAT', 'relevant'), ('integrator_consultant', 'SEC', 'relevant'),
  ('integrator_consultant', 'OPS', 'relevant'), ('integrator_consultant', 'MON', 'relevant'), ('integrator_consultant', 'INC', 'relevant'),
  ('integrator_consultant', 'CMP', 'relevant'),

  ('business_user', 'GOV', 'core'), ('business_user', 'INV', 'core'), ('business_user', 'USE', 'core'),
  ('business_user', 'RSK', 'core'), ('business_user', 'HUM', 'core'), ('business_user', 'SUP', 'core'),
  ('business_user', 'DAT', 'relevant'), ('business_user', 'INC', 'relevant'), ('business_user', 'CMP', 'relevant'),
  ('business_user', 'MON', 'relevant'),
  ('business_user', 'SEC', 'secondary'), ('business_user', 'OPS', 'secondary');

-- -----------------------------------------------------------------------------
-- Les propositions pour un cas d'usage
-- -----------------------------------------------------------------------------
create or replace function app.suggest_controls(p_use_case_id uuid)
returns jsonb
language plpgsql
stable
security definer
set search_path = app, public, pg_catalog
as $$
declare
  v_uc        public.ai_use_case;
  v_org       public.organization;
  v_facts     app.suggestion_condition[] := '{}';
  v_has_vendor boolean;
  v_has_model_provider boolean;
begin
  select * into v_uc from public.ai_use_case where id = p_use_case_id;
  if v_uc.id is null then
    return jsonb_build_object('available', false, 'reason', 'Cas d’usage introuvable.');
  end if;
  select * into v_org from public.organization where id = v_uc.organization_id;
  if not app.has_tenant_access(v_org.tenant_id) then
    return jsonb_build_object('available', false, 'reason', 'Hors de votre périmètre.');
  end if;

  -- Les faits, lus une fois.
  if v_uc.involves_personal_data then v_facts := v_facts || 'personal_data'::app.suggestion_condition; end if;
  if v_uc.involves_vulnerable_persons then v_facts := v_facts || 'vulnerable_persons'::app.suggestion_condition; end if;
  if v_uc.autonomy_level in ('L3', 'L4') then v_facts := v_facts || 'autonomy_gte_l3'::app.suggestion_condition; end if;
  if v_uc.criticality in ('high', 'critical') then v_facts := v_facts || 'criticality_high'::app.suggestion_condition; end if;
  select exists (select 1 from public.use_case_vendor_link l where l.use_case_id = v_uc.id),
         exists (select 1 from public.use_case_vendor_link l join public.vendor v on v.id = l.vendor_id
                  where l.use_case_id = v_uc.id and v.is_model_provider)
    into v_has_vendor, v_has_model_provider;
  if v_has_vendor then v_facts := v_facts || 'external_vendor'::app.suggestion_condition; end if;
  if v_has_model_provider then v_facts := v_facts || 'model_provider'::app.suggestion_condition; end if;
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
          'tier', s.tier,
          'mandatory', s.mandatory,
          'reasons', case when s.mandatory
                            then to_jsonb(array['Obligatoire par défaut dans le référentiel.'] || s.reasons)
                            else to_jsonb(s.reasons) end,
          'state', s.state,
          'control_id', s.control_id,
          'tools', s.tools
        ) order by
          case s.tier when 'core' then 0 when 'relevant' then 1 else 2 end,
          s.mandatory desc, s.domain_code, s.control_code)
        from scored s
        -- Un conditionnel sans motif ne se propose pas. Un domaine secondaire
        -- pour ce rôle ne se propose que sur motif, même obligatoire : un
        -- utilisateur métier n'a pas à lire douze contrôles de sécurité cloud.
        where array_length(s.reasons, 1) > 0 or (s.mandatory and s.tier <> 'secondary')
      ), '[]'::jsonb)
    )
  );
end;
$$;

comment on function app.suggest_controls is
  'Contrôles-types à proposer pour un cas d''usage, avec le motif de chacun. Déterministe : règles d''applicabilité, faits du cas d''usage, rôle de l''organisation.';

create or replace function public.suggest_controls(p_use_case_id uuid)
returns jsonb language sql stable security invoker
set search_path = app, public, pg_catalog
as $$ select app.suggest_controls(p_use_case_id); $$;

grant execute on function public.suggest_controls(uuid) to authenticated;

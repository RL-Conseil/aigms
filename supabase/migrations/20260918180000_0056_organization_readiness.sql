-- =============================================================================
-- AIGMS — 0056 — Une organisation n'est opérationnelle qu'avec ses six rôles
-- =============================================================================
-- Le RACI (0054, 0055) suppose six rôles tenus : Porteur de l'IA, AI
-- Governance Officer, Expert métier, Comité des risques, Comité de direction,
-- Auditeur. Une organisation où il en manque un ne peut pas dérouler le
-- parcours — une production critique sans Comité de direction ne s'approuve
-- pas, une preuve sans Expert ni Comité des risques ne se valide pas — et le
-- découvrir au milieu d'un dossier coûte plus cher que le savoir au départ.
--
-- Règle : tant que les six rôles ne sont pas chacun tenus par au moins une
-- personne active, l'organisation est « non opérationnelle » : on y lit, on
-- n'y écrit aucun objet de gouvernance. Les écritures d'administration —
-- organisation, comptes, attributions de rôles — restent ouvertes : c'est par
-- elles qu'on rend l'organisation opérationnelle.
--
-- La règle porte sur l'acte d'une personne authentifiée. Sans utilisateur —
-- amorçage, reprise, import — elle ne s'applique pas.
-- =============================================================================

create or replace function app.required_governance_roles()
returns app.app_role[]
language sql immutable set search_path = pg_catalog as $$
  select array['system_owner', 'governance_officer', 'reviewer', 'risk_owner', 'executive_viewer', 'auditor']::app.app_role[];
$$;

comment on function app.required_governance_roles is
  'Les six rôles qu''une organisation doit voir tenus pour être opérationnelle : Porteur de l''IA, AI Governance Officer, Expert métier, Comité des risques, Comité de direction, Auditeur.';

-- Les roles effectivement tenus sur une organisation, toutes personnes
-- confondues : les affectations explicites, et pour qui n'en a pas, le rôle
-- porté par l'appartenance au tenant — la même lecture que `organization_roles`.
create or replace function app.organization_held_roles(p_organization_id uuid)
returns app.app_role[]
language sql
stable
security definer
set search_path = app, public, pg_catalog
as $$
  with people as (
    select m.user_id, m.role as default_role
    from public.organization o
    join public.membership m on m.tenant_id = o.tenant_id and m.status = 'active'
    where o.id = p_organization_id
  ),
  effective as (
    select p.user_id,
           coalesce(
             (select array_agg(distinct r.role) from public.role_assignment r
               where r.organization_id = p_organization_id and r.user_id = p.user_id
                 and r.valid_from <= now() and (r.valid_until is null or r.valid_until > now())),
             array[p.default_role]
           ) as roles
    from people p
  )
  select coalesce(array_agg(distinct role), array[]::app.app_role[])
  from effective e, unnest(e.roles) as role;
$$;

create or replace function app.organization_missing_roles(p_organization_id uuid)
returns app.app_role[]
language sql
stable
security definer
set search_path = app, public, pg_catalog
as $$
  select coalesce(array_agg(r order by array_position(app.required_governance_roles(), r)), array[]::app.app_role[])
  from unnest(app.required_governance_roles()) as r
  where not (r = any (app.organization_held_roles(p_organization_id)));
$$;

create or replace function app.organization_ready(p_organization_id uuid)
returns boolean
language sql
stable
security definer
set search_path = app, public, pg_catalog
as $$
  select cardinality(app.organization_missing_roles(p_organization_id)) = 0;
$$;

comment on function app.organization_ready is
  'Vrai quand les six rôles de gouvernance sont chacun tenus par au moins une personne active. Tant que non, aucun objet de gouvernance ne s''écrit sur l''organisation.';

-- Le nom des rôles, pour un message qui se lit sans le code.
create or replace function app.role_label(p_role app.app_role)
returns text
language sql immutable set search_path = pg_catalog as $$
  select case p_role
    when 'system_owner'       then 'Porteur de l''IA'
    when 'governance_officer' then 'AI Governance Officer'
    when 'reviewer'           then 'Expert métier (DPO / RSSI)'
    when 'risk_owner'         then 'Comité des risques'
    when 'executive_viewer'   then 'Comité de direction'
    when 'auditor'            then 'Auditeur'
    when 'client_admin'       then 'Administrateur client'
    when 'platform_admin'     then 'Administration de la plateforme'
  end;
$$;

-- -----------------------------------------------------------------------------
-- Le garde : aucun objet de gouvernance ne s'écrit sur une organisation qui
-- n'est pas opérationnelle
-- -----------------------------------------------------------------------------
create or replace function app.assert_organization_ready()
returns trigger
language plpgsql
security definer
set search_path = app, public, pg_catalog
as $$
declare
  v_missing app.app_role[];
begin
  if app.current_user_id() is null then return new; end if;
  v_missing := app.organization_missing_roles(new.organization_id);
  if cardinality(v_missing) > 0 then
    raise exception 'Organisation non opérationnelle : % — personne ne tient ce(s) rôle(s). L''administration attribue les six rôles de gouvernance avant toute saisie.',
      (select string_agg(app.role_label(r), ', ') from unnest(v_missing) r)
      using errcode = 'insufficient_privilege';
  end if;
  return new;
end;
$$;

comment on function app.assert_organization_ready is
  'Refuse toute écriture de gouvernance sur une organisation dont l''un des six rôles n''est tenu par personne (0056).';

-- Sur chaque table de gouvernance qui porte une organisation. Les tables
-- d'administration (organization, membership, role_assignment, user_profile)
-- n'y sont pas : c'est par elles qu'on rend l'organisation opérationnelle.
do $$
declare
  v_table text;
begin
  foreach v_table in array array[
    'process', 'activity',
    'vendor', 'ai_asset', 'ai_use_case', 'assessment', 'regulatory_classification',
    'risk', 'risk_treatment', 'impact_assessment', 'impact_stakeholder', 'impact_finding',
    'control', 'control_applicability', 'evidence', 'human_oversight_plan',
    'governance_decision', 'action', 'change_request', 'reassessment', 'incident', 'capa'
  ] loop
    if exists (
      select 1 from information_schema.columns
      where table_schema = 'public' and table_name = v_table and column_name = 'organization_id'
    ) then
      execute format('drop trigger if exists %I_assert_ready on public.%I', v_table, v_table);
      execute format(
        'create trigger %I_assert_ready before insert or update on public.%I
           for each row execute function app.assert_organization_ready()',
        v_table, v_table);
    end if;
  end loop;
end;
$$;

-- -----------------------------------------------------------------------------
-- Lecture : ce qui manque, pour l'administration et pour l'écran
-- -----------------------------------------------------------------------------
create or replace function public.organization_readiness(p_organization_id uuid)
returns jsonb
language sql
stable
security invoker
set search_path = app, public, pg_catalog
as $$
  select jsonb_build_object(
    'ready', app.organization_ready(p_organization_id),
    'required', to_jsonb(app.required_governance_roles()),
    'held', to_jsonb(app.organization_held_roles(p_organization_id)),
    'missing', to_jsonb(app.organization_missing_roles(p_organization_id)),
    'people', (
      select count(distinct m.user_id)
      from public.organization o
      join public.membership m on m.tenant_id = o.tenant_id and m.status = 'active'
      where o.id = p_organization_id and m.role <> 'platform_admin'
    )
  )
  from public.organization o
  where o.id = p_organization_id and app.has_tenant_access(o.tenant_id);
$$;

comment on function public.organization_readiness is
  'Les six rôles requis, ceux tenus, ceux qui manquent. Une organisation où il en manque un ne s''écrit pas.';

revoke all on function public.organization_readiness(uuid) from public, anon;
grant execute on function public.organization_readiness(uuid) to authenticated;

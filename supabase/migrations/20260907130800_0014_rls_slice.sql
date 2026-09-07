-- =============================================================================
-- AIGMS — 0014 — RLS du vertical slice
-- =============================================================================
-- Les politiques sont générées par une boucle à partir d'un tableau déclaratif.
-- Motif : chaque table métier suit exactement le même contrat d'isolation, et
-- une boucle garantit qu'aucune table de la liste n'est oubliée ni ne dérive.
-- Les tables aux règles particulières (framework, requirement) sont traitées
-- explicitement à la fin.
-- =============================================================================

-- -----------------------------------------------------------------------------
-- Ensembles de rôles complémentaires
-- -----------------------------------------------------------------------------
create or replace function app.roles_contribute()
returns app.app_role[]
language sql immutable set search_path = pg_catalog as $$
  select array['platform_admin', 'governance_officer', 'client_admin', 'system_owner']::app.app_role[];
$$;

comment on function app.roles_contribute is
  'Rôles pouvant alimenter le dossier de gouvernance : le porteur du système déclare, répond et fournit les preuves (persona P3).';

create or replace function app.roles_risk()
returns app.app_role[]
language sql immutable set search_path = pg_catalog as $$
  select array['platform_admin', 'governance_officer', 'client_admin', 'risk_owner']::app.app_role[];
$$;

comment on function app.roles_risk is
  'Rôles pouvant traiter et accepter un risque (persona P4).';

create or replace function app.roles_review()
returns app.app_role[]
language sql immutable set search_path = pg_catalog as $$
  select array['platform_admin', 'governance_officer', 'client_admin', 'reviewer']::app.app_role[];
$$;

comment on function app.roles_review is
  'Rôles pouvant instruire une décision. L''approbation reste contrôlée par app.guard_decision_approval.';

grant execute on function app.roles_contribute(), app.roles_risk(), app.roles_review()
  to authenticated, service_role;

-- -----------------------------------------------------------------------------
-- Génération des politiques
-- -----------------------------------------------------------------------------
do $$
declare
  -- (table, fonction retournant l'ensemble de rôles habilités en écriture)
  v_specs text[][] := array[
    ['vendor',                    'roles_write_governance'],
    ['ai_asset',                  'roles_contribute'],
    ['ai_use_case',               'roles_contribute'],
    ['use_case_asset_link',       'roles_contribute'],
    ['use_case_vendor_link',      'roles_contribute'],
    ['assessment',                'roles_contribute'],
    ['assessment_answer',         'roles_contribute'],
    ['regulatory_classification', 'roles_write_governance'],
    ['risk',                      'roles_risk'],
    ['risk_treatment',            'roles_risk'],
    ['impact_assessment',         'roles_write_governance'],
    ['impact_stakeholder',        'roles_write_governance'],
    ['impact_finding',            'roles_write_governance'],
    ['control',                   'roles_write_governance'],
    ['control_requirement_map',   'roles_write_governance'],
    ['control_applicability',     'roles_write_governance'],
    ['evidence',                  'roles_contribute'],
    ['control_evidence',          'roles_contribute'],
    ['human_oversight_plan',      'roles_write_governance'],
    ['governance_decision',       'roles_review'],
    ['decision_link',             'roles_review'],
    ['action',                    'roles_contribute'],
    ['change_request',            'roles_contribute'],
    ['reassessment',              'roles_write_governance'],
    ['incident',                  'roles_contribute'],
    ['capa',                      'roles_write_governance']
  ];
  v_table text;
  v_roles text;
  i integer;
begin
  for i in 1 .. array_length(v_specs, 1) loop
    v_table := v_specs[i][1];
    v_roles := v_specs[i][2];

    execute format('alter table public.%I enable row level security', v_table);
    execute format('alter table public.%I force  row level security', v_table);

    -- Lecture : appartenance active au tenant. Les rôles auditor et
    -- executive_viewer lisent donc tout leur périmètre, sans jamais écrire.
    execute format($p$
      create policy %2$I on public.%1$I
        for select to authenticated
        using (app.has_tenant_access(tenant_id))
    $p$, v_table, v_table || '_select');

    execute format($p$
      create policy %2$I on public.%1$I
        for all to authenticated
        using (app.has_tenant_role(tenant_id, app.%3$I()))
        with check (app.has_tenant_role(tenant_id, app.%3$I()))
    $p$, v_table, v_table || '_write', v_roles);

    execute format('grant select, insert, update, delete on public.%I to authenticated', v_table);
    execute format('revoke all on public.%I from anon', v_table);
  end loop;
end;
$$;

-- -----------------------------------------------------------------------------
-- framework / requirement — catalogue plateforme
-- -----------------------------------------------------------------------------
-- Ces tables ne contiennent aucune donnée client : ce sont des références
-- normatives et des résumés internes. Lecture ouverte à tout utilisateur
-- authentifié, écriture réservée à l'administration plateforme.
-- -----------------------------------------------------------------------------
alter table public.framework   enable row level security;
alter table public.framework   force  row level security;
alter table public.requirement enable row level security;
alter table public.requirement force  row level security;

create policy framework_select on public.framework
  for select to authenticated using (true);

create policy framework_write on public.framework
  for all to authenticated
  using (app.is_platform_admin())
  with check (app.is_platform_admin());

create policy requirement_select on public.requirement
  for select to authenticated using (true);

create policy requirement_write on public.requirement
  for all to authenticated
  using (app.is_platform_admin())
  with check (app.is_platform_admin());

grant select, insert, update, delete on public.framework   to authenticated;
grant select, insert, update, delete on public.requirement to authenticated;
revoke all on public.framework   from anon;
revoke all on public.requirement from anon;

-- La vue hérite de la RLS de la table sous-jacente (security_invoker).
grant select on public.evidence_with_freshness to authenticated;
revoke all  on public.evidence_with_freshness from anon;

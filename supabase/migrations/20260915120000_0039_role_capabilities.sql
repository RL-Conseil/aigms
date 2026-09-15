-- =============================================================================
-- AIGMS — 0039 — La matrice des rôles se lit dans la base, pas dans l'écran
-- =============================================================================
-- L'écran d'attribution des rôles décrivait chaque rôle en une phrase. C'est
-- insuffisant pour répondre à la question qu'un administrateur se pose au
-- moment d'attribuer : « avec ce rôle, que pourra-t-elle faire, et que ne
-- pourra-t-elle pas ? »
--
-- La réponse est calculée ICI, à partir des ensembles de rôles que les
-- policies RLS utilisent réellement (`app.roles_administer()`,
-- `app.roles_write_governance()`, `app.roles_contribute()`, `app.roles_risk()`,
-- `app.roles_review()`). Une matrice écrite à la main dans l'application
-- finirait par diverger de ce que la base fait ; celle-ci ne le peut pas.
--
-- ELLE N'EST PAS RÉGLABLE, et c'est délibéré. Les ensembles de rôles sont des
-- fonctions immuables : rendre la matrice modifiable par tenant reviendrait à
-- laisser un administrateur donner au porteur du système le droit de se
-- prononcer sur sa propre mise en production. Ce que la matrice montre, ce sont
-- les règles ; changer une règle est une migration, relue et versionnée.
-- =============================================================================

create or replace function app.role_capabilities()
returns jsonb
language sql
stable
set search_path = app, public, pg_catalog
as $$
  with everyone as (
    select enum_range(null::app.app_role) as roles
  ),
  caps(display_order, "group", key, label, roles, note) as (
    values
      -- ---- Administration ------------------------------------------------
      (10, 'Administration', 'organizations',
       'Créer et administrer les organisations',
       app.roles_administer(),
       'Nom, rôle vis-à-vis de l''IA, identité des documents, logo. Aucune suppression : une organisation s''archive.'),
      (11, 'Administration', 'accounts',
       'Déclarer les comptes et attribuer les rôles',
       app.roles_administer(), null),
      (12, 'Administration', 'catalog',
       'Importer et publier un référentiel de contrôles',
       app.roles_administer(), null),
      (13, 'Administration', 'platform',
       'Régler la marque et les connecteurs',
       app.roles_administer(), null),

      -- ---- Registre ------------------------------------------------------
      (20, 'Registre', 'processes',
       'Cartographier les processus et leurs activités',
       app.roles_write_governance(), null),
      (21, 'Registre', 'use_cases',
       'Déclarer un usage d''IA, un actif',
       app.roles_contribute(), null),
      (22, 'Registre', 'vendors',
       'Déclarer un fournisseur et conduire sa revue',
       app.roles_write_governance(), null),
      (23, 'Registre', 'classification',
       'Qualifier et classifier au regard du règlement',
       app.roles_write_governance(), null),
      (24, 'Registre', 'transitions',
       'Faire franchir les étapes du cycle de vie (gates)',
       app.roles_write_governance(),
       'Le gate décide ; le rôle ne fait que demander.'),

      -- ---- Risques -------------------------------------------------------
      (30, 'Risques', 'risks',
       'Coter les risques, décider du traitement, porter une acceptation',
       app.roles_risk(), null),
      (31, 'Risques', 'impact',
       'Évaluer l''impact, planifier la supervision humaine',
       app.roles_write_governance(), null),

      -- ---- Contrôles et preuves -----------------------------------------
      (40, 'Contrôles et preuves', 'controls',
       'Définir les contrôles et statuer sur leur applicabilité',
       app.roles_write_governance(), null),
      (41, 'Contrôles et preuves', 'evidence',
       'Déposer une preuve et la rattacher',
       app.roles_contribute(), null),
      (42, 'Contrôles et preuves', 'soa',
       'Établir la Déclaration d''Applicabilité',
       app.roles_write_governance(), null),

      -- ---- Décisions et suivi -------------------------------------------
      (50, 'Décisions et suivi', 'decisions',
       'Soumettre une décision et se prononcer',
       app.roles_review(),
       'Séparation des rôles : l''auteur d''une mise en production, d''une acceptation de risque ou d''une exception ne peut pas l''approuver, quel que soit son rôle.'),
      (51, 'Décisions et suivi', 'operations',
       'Ouvrir une action, un incident, une demande de changement',
       app.roles_contribute(), null),
      (52, 'Décisions et suivi', 'capa',
       'Conduire une action corrective (CAPA), réévaluer',
       app.roles_write_governance(), null),

      -- ---- Lecture -------------------------------------------------------
      (60, 'Lecture', 'read',
       'Consulter le périmètre : registre, risques, contrôles, preuves, décisions',
       (select roles from everyone), null),
      (61, 'Lecture', 'audit_log',
       'Lire le journal d''audit',
       array['platform_admin', 'governance_officer', 'client_admin', 'auditor']::app.app_role[],
       null)
  )
  select jsonb_agg(
           jsonb_build_object(
             'key',   key,
             'group', "group",
             'label', label,
             'note',  note,
             'roles', to_jsonb(roles)
           )
           order by display_order
         )
  from caps;
$$;

comment on function app.role_capabilities is
  'Matrice rôles × capacités, calculée depuis les ensembles de rôles que les policies utilisent. Non réglable : changer une règle est une migration.';

create or replace function public.role_capabilities()
returns jsonb
language sql
stable
set search_path = app, public, pg_catalog
as $$
  select app.role_capabilities();
$$;

grant execute on function public.role_capabilities() to authenticated;

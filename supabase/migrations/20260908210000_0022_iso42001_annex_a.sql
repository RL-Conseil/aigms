-- =============================================================================
-- AIGMS — 0022 — ISO/IEC 42001:2023, Annexe A
-- =============================================================================
-- GÉNÉRÉ depuis knowledge/frameworks/iso-42001/2023/annexe-a.json.
-- Ne pas éditer à la main : modifier le fichier source et régénérer, faute de
-- quoi les deux divergent.
--
-- ---------------------------------------------------------------------------
-- CE QUE CE FICHIER CONTIENT, ET CE QU'IL NE CONTIENT PAS
-- ---------------------------------------------------------------------------
-- Il porte la NUMÉROTATION de l'Annexe A — 38 contrôles en
-- 9 objectifs, de A.2 à A.10 — qui est un fait, non
-- protégeable, accompagnée de titres et de résumés RÉDIGÉS EN PROPRE exprimant
-- ce qu'une organisation doit pouvoir démontrer.
--
-- Il ne reproduit pas le texte de la norme, conformément à
-- 04_References/REFERENCES_ET_TRACABILITE_V1.md et aux interdictions posées
-- dans CLAUDE.md. Le texte officiel s'obtient auprès de l'ISO.
--
-- Les résumés engagent une interprétation : ils portent un statut de revue et
-- doivent être validés avant tout usage devant un client ou un auditeur.
-- =============================================================================

-- -----------------------------------------------------------------------------
-- Une exigence appartient à un objectif de contrôle
-- -----------------------------------------------------------------------------
alter table public.requirement
  add column objective_code  text,
  add column objective_title text,
  add column display_order   integer,
  add column expected_evidence text,
  add column review_status   text not null default 'to_review'
    check (review_status in ('to_review', 'reviewed', 'contested'));

comment on column public.requirement.objective_code is
  'Objectif de contrôle dont relève l''exigence (A.2 à A.10 pour ISO/IEC 42001).';
comment on column public.requirement.review_status is
  'Statut de relecture du résumé interne. `to_review` tant qu''un humain ne l''a pas validé : un résumé est une interprétation, pas une citation.';
comment on column public.requirement.expected_evidence is
  'Nature des preuves habituellement attendues. Aide au cadrage, jamais une liste imposée.';

create index requirement_objective_idx on public.requirement (framework_id, objective_code, display_order);

-- -----------------------------------------------------------------------------
-- Le référentiel
-- -----------------------------------------------------------------------------
insert into public.framework (code, version, name, publisher, official_source, effective_from, is_active)
values ('ISO_IEC_42001', '2023', 'ISO/IEC 42001:2023 — Annexe A', 'ISO/IEC',
        'https://www.iso.org/standard/81230.html', '2023-12-01'::date, true)
on conflict (code, version) do update
  set name = excluded.name,
      publisher = excluded.publisher,
      official_source = excluded.official_source,
      effective_from = excluded.effective_from;

-- -----------------------------------------------------------------------------
-- Les 38 exigences de l'Annexe A
-- -----------------------------------------------------------------------------

insert into public.requirement (
  framework_id, requirement_reference, title, internal_summary, status,
  objective_code, objective_title, display_order, expected_evidence,
  official_source, review_status
)
select f.id, v.reference, v.title, v.internal_summary, 'requirement'::app.requirement_status,
       v.objective_code, v.objective_title, v.display_order, v.expected_evidence,
       'ISO/IEC 42001:2023, Annexe A', 'to_review'
from public.framework f
cross join (values
  ('A.2.2', 'Politique d''IA formalisée', 'L''organisation dispose d''une politique écrite encadrant ses usages d''IA, approuvée à un niveau de direction, diffusée aux personnes concernées et accessible. Elle énonce l''intention, le périmètre et les principes qui guident les décisions.', 'A.2', 'Politiques relatives à l''IA', 101, 'Document de politique approuvé, preuve de diffusion, date d''approbation.'),
  ('A.2.3', 'Articulation avec les autres politiques', 'La politique d''IA s''articule avec les politiques existantes — sécurité de l''information, protection des données, qualité, achats — sans les contredire. Les points de recouvrement sont identifiés et arbitrés.', 'A.2', 'Politiques relatives à l''IA', 102, 'Tableau d''articulation, mentions croisées dans les politiques concernées.'),
  ('A.2.4', 'Réexamen périodique de la politique', 'La politique est réexaminée à intervalles définis, et lorsqu''un changement significatif le justifie. Le réexamen produit une trace : ce qui a été revu, par qui, et ce qui en résulte.', 'A.2', 'Politiques relatives à l''IA', 103, 'Date de dernière revue, décision de reconduction ou de révision, prochaine échéance.'),
  ('A.3.2', 'Rôles et responsabilités en matière d''IA', 'Les rôles engagés dans la gouvernance de l''IA sont attribués nominativement et connus des intéressés : qui décide, qui porte le risque, qui exploite, qui contrôle. Les responsabilités sont documentées, non implicites.', 'A.3', 'Organisation interne', 204, 'Matrice de rôles, lettres de mission, attributions dans l''outil de gouvernance.'),
  ('A.3.3', 'Signalement des préoccupations', 'Toute personne peut signaler une préoccupation relative à un système d''IA par un canal identifié, sans crainte de conséquence défavorable. Les signalements sont enregistrés et traités.', 'A.3', 'Organisation interne', 205, 'Procédure de signalement, registre des signalements et de leur suite.'),
  ('A.4.2', 'Documentation des ressources', 'Les ressources mobilisées par chaque système d''IA — données, outils, calcul, compétences humaines — sont recensées et documentées, de façon à savoir de quoi le système dépend.', 'A.4', 'Ressources des systèmes d''IA', 306, 'Inventaire des ressources rattaché à chaque système.'),
  ('A.4.3', 'Ressources en données', 'Les jeux de données servant au développement et à l''exploitation sont identifiés, avec leur origine, leur nature et les restrictions qui les grèvent.', 'A.4', 'Ressources des systèmes d''IA', 307, 'Registre des jeux de données, mentions d''origine et de licence.'),
  ('A.4.4', 'Ressources d''outillage', 'Les outils, bibliothèques et environnements employés pour construire et exploiter les systèmes d''IA sont recensés, avec leur version et leur provenance.', 'A.4', 'Ressources des systèmes d''IA', 308, 'Inventaire d''outillage, versions, dépendances.'),
  ('A.4.5', 'Ressources système et de calcul', 'Les infrastructures d''hébergement, de calcul et de stockage supportant les systèmes d''IA sont documentées, y compris leur localisation et leurs conditions d''exploitation.', 'A.4', 'Ressources des systèmes d''IA', 309, 'Description d''architecture, localisation d''hébergement, capacités.'),
  ('A.4.6', 'Ressources humaines et compétences', 'Les compétences nécessaires à la conception, à l''exploitation et à la supervision des systèmes d''IA sont déterminées, et les personnes concernées les possèdent ou les acquièrent.', 'A.4', 'Ressources des systèmes d''IA', 310, 'Référentiel de compétences, attestations de formation, plan de montée en compétence.'),
  ('A.5.2', 'Processus d''évaluation d''impact', 'Un processus établi détermine quand une évaluation d''impact est requise, comment elle est conduite et par qui. Il ne dépend pas de l''initiative individuelle.', 'A.5', 'Évaluation des impacts des systèmes d''IA', 411, 'Procédure d''évaluation d''impact, critères de déclenchement.'),
  ('A.5.3', 'Documentation des évaluations', 'Chaque évaluation d''impact est consignée : périmètre, méthode, constats, mesures retenues, conclusion et date. Elle est conservée et réexaminable.', 'A.5', 'Évaluation des impacts des systèmes d''IA', 412, 'Rapports d''évaluation d''impact datés et versionnés.'),
  ('A.5.4', 'Impacts sur les personnes et les groupes', 'L''évaluation examine les effets du système sur les personnes concernées et sur les groupes, y compris ceux en situation de vulnérabilité, et pas seulement les effets sur l''organisation.', 'A.5', 'Évaluation des impacts des systèmes d''IA', 413, 'Identification des parties prenantes affectées, constats par catégorie d''impact.'),
  ('A.5.5', 'Impacts sociétaux', 'L''évaluation prend en compte les effets plus larges du système sur la société et sur l''environnement, au-delà des personnes directement exposées.', 'A.5', 'Évaluation des impacts des systèmes d''IA', 414, 'Section dédiée aux effets sociétaux dans l''évaluation d''impact.'),
  ('A.6.1.2', 'Objectifs de développement responsable', 'L''organisation fixe et documente les objectifs qui encadrent un développement responsable de ses systèmes d''IA, et les rend opposables aux équipes.', 'A.6', 'Cycle de vie des systèmes d''IA', 515, 'Objectifs formalisés, rattachement aux projets.'),
  ('A.6.1.3', 'Processus de conception responsable', 'Les processus de conception et de développement intègrent ces objectifs à chaque étape, plutôt que de les vérifier en fin de parcours.', 'A.6', 'Cycle de vie des systèmes d''IA', 516, 'Description du processus, points de contrôle intégrés.'),
  ('A.6.2.2', 'Exigences et spécification', 'Les exigences auxquelles le système doit répondre sont formulées et spécifiées avant sa construction, y compris les exigences non fonctionnelles de robustesse, d''équité et de sécurité.', 'A.6', 'Cycle de vie des systèmes d''IA', 517, 'Spécification d''exigences, critères d''acceptation.'),
  ('A.6.2.3', 'Documentation de conception', 'Les choix de conception sont documentés : architecture, modèles retenus, alternatives écartées et raisons de ces choix.', 'A.6', 'Cycle de vie des systèmes d''IA', 518, 'Dossier de conception, décisions d''architecture.'),
  ('A.6.2.4', 'Vérification et validation', 'Le système est vérifié et validé au regard de ses exigences avant mise en service, selon des critères définis à l''avance. Les résultats sont conservés.', 'A.6', 'Cycle de vie des systèmes d''IA', 519, 'Plans et rapports de test, jeux d''essai, critères de réussite.'),
  ('A.6.2.5', 'Déploiement', 'Le déploiement suit un processus défini, avec des critères de passage, une autorisation identifiée et une possibilité de retour arrière.', 'A.6', 'Cycle de vie des systèmes d''IA', 520, 'Procédure de déploiement, autorisation de mise en service, plan de retrait.'),
  ('A.6.2.6', 'Exploitation et surveillance', 'Le système en service est surveillé selon une cadence définie, avec des seuils d''alerte et des responsables identifiés. La dérive de performance est détectable.', 'A.6', 'Cycle de vie des systèmes d''IA', 521, 'Plan de surveillance, indicateurs suivis, journal des anomalies.'),
  ('A.6.2.7', 'Documentation technique', 'La documentation technique du système est constituée, tenue à jour et suffisante pour qu''un tiers compétent comprenne son fonctionnement et ses limites.', 'A.6', 'Cycle de vie des systèmes d''IA', 522, 'Dossier technique versionné, limites d''emploi documentées.'),
  ('A.6.2.8', 'Journalisation des événements', 'Les événements pertinents du système sont journalisés de façon à permettre l''analyse a posteriori d''un incident ou d''une décision contestée, avec une durée de conservation définie.', 'A.6', 'Cycle de vie des systèmes d''IA', 523, 'Politique de journalisation, extraits de journaux, durée de rétention.'),
  ('A.7.2', 'Données de développement et d''amélioration', 'Les données servant au développement, à l''entraînement et à l''amélioration continue sont identifiées et encadrées, avec les conditions de leur emploi.', 'A.7', 'Données des systèmes d''IA', 624, 'Registre des jeux de données par usage, conditions d''utilisation.'),
  ('A.7.3', 'Acquisition des données', 'Les modalités d''obtention des données sont documentées et licites : source, base légale ou contractuelle, consentements le cas échéant.', 'A.7', 'Données des systèmes d''IA', 625, 'Contrats et licences de données, base juridique du traitement.'),
  ('A.7.4', 'Qualité des données', 'Les critères de qualité attendus sont définis et vérifiés : exactitude, complétude, représentativité, actualité. Les écarts sont traités.', 'A.7', 'Données des systèmes d''IA', 626, 'Critères de qualité, résultats de contrôle, actions correctives.'),
  ('A.7.5', 'Provenance des données', 'L''origine des données et les transformations qu''elles ont subies sont traçables, de la collecte à l''usage dans le système.', 'A.7', 'Données des systèmes d''IA', 627, 'Traçabilité de bout en bout, journal des transformations.'),
  ('A.7.6', 'Préparation des données', 'Les opérations de préparation — nettoyage, étiquetage, échantillonnage, anonymisation — sont documentées, car elles influent sur le comportement du système.', 'A.7', 'Données des systèmes d''IA', 628, 'Description des traitements de préparation, choix d''échantillonnage.'),
  ('A.8.2', 'Documentation du système et information des utilisateurs', 'Les utilisateurs disposent d''une information suffisante sur ce que fait le système, ce qu''il ne fait pas, et comment l''employer correctement.', 'A.8', 'Information des parties intéressées', 729, 'Notice d''utilisation, conditions d''emploi, limites annoncées.'),
  ('A.8.3', 'Signalement externe', 'Un moyen permet aux personnes extérieures à l''organisation de signaler un problème lié à un système d''IA, et ces signalements reçoivent une suite.', 'A.8', 'Information des parties intéressées', 730, 'Canal de signalement externe, registre et traitement des signalements.'),
  ('A.8.4', 'Communication des incidents', 'Les incidents sont communiqués aux parties concernées selon des critères et des délais définis, en tenant compte des obligations de notification applicables.', 'A.8', 'Information des parties intéressées', 731, 'Procédure de communication d''incident, traces des notifications effectuées.'),
  ('A.8.5', 'Information des parties intéressées', 'Les parties intéressées reçoivent l''information qui les concerne sur les systèmes d''IA, selon une politique définie qui identifie qui reçoit quoi.', 'A.8', 'Information des parties intéressées', 732, 'Cartographie des parties intéressées, plan de communication.'),
  ('A.9.2', 'Processus d''utilisation responsable', 'Des processus encadrent l''emploi des systèmes d''IA au quotidien : qui peut les utiliser, dans quel cadre, avec quelle supervision.', 'A.9', 'Utilisation des systèmes d''IA', 833, 'Règles d''usage, habilitations, plan de supervision humaine.'),
  ('A.9.3', 'Objectifs d''utilisation responsable', 'L''organisation fixe les objectifs qui définissent ce qu''est un usage responsable dans son contexte, et les fait connaître aux utilisateurs.', 'A.9', 'Utilisation des systèmes d''IA', 834, 'Objectifs d''usage documentés, diffusion aux utilisateurs.'),
  ('A.9.4', 'Usage prévu du système', 'L''usage prévu de chaque système est défini, et l''écart entre usage prévu et usage réel est surveillé. Un emploi hors de ce cadre est identifié et traité.', 'A.9', 'Utilisation des systèmes d''IA', 835, 'Finalité déclarée, contrôle de l''usage effectif, traitement des écarts.'),
  ('A.10.2', 'Répartition des responsabilités', 'Lorsque plusieurs organisations interviennent sur un système d''IA, la répartition des responsabilités est définie et acceptée par chacune. Aucune zone n''est laissée sans titulaire.', 'A.10', 'Relations avec les tiers et les clients', 936, 'Matrice de responsabilités entre parties, clauses contractuelles.'),
  ('A.10.3', 'Fournisseurs', 'Les exigences applicables aux fournisseurs sont définies et portées au contrat, et leur respect est vérifié pendant la relation, non seulement à sa signature.', 'A.10', 'Relations avec les tiers et les clients', 937, 'Exigences contractuelles, revue fournisseur, suivi de conformité.'),
  ('A.10.4', 'Clients', 'Les besoins et attentes des clients à l''égard des systèmes d''IA fournis sont pris en compte, et l''information qui leur est due leur est transmise.', 'A.10', 'Relations avec les tiers et les clients', 938, 'Recueil des attentes clients, information contractuelle sur les systèmes fournis.')
) as v(reference, title, internal_summary, objective_code, objective_title, display_order, expected_evidence)
where f.code = 'ISO_IEC_42001' and f.version = '2023'
on conflict (framework_id, requirement_reference) do update
  set title = excluded.title,
      internal_summary = excluded.internal_summary,
      objective_code = excluded.objective_code,
      objective_title = excluded.objective_title,
      display_order = excluded.display_order,
      expected_evidence = excluded.expected_evidence;

-- -----------------------------------------------------------------------------
-- Contrôle de complétude
-- -----------------------------------------------------------------------------
-- Un référentiel partiellement chargé donnerait une Déclaration d'Applicabilité
-- fausse — le pire résultat possible pour ce document.
do $$
declare
  v_count integer;
begin
  -- On ne compte que l'Annexe A : le corps de la norme (6.1.2, 8.4, 9.3…) est
  -- chargé ailleurs et porte un objective_code nul.
  select count(*) into v_count
  from public.requirement r
  join public.framework f on f.id = r.framework_id
  where f.code = 'ISO_IEC_42001' and f.version = '2023'
    and r.objective_code is not null;

  if v_count <> 38 then
    raise exception 'Annexe A incomplète : % exigence(s) chargée(s) sur 38.', v_count;
  end if;
end;
$$;

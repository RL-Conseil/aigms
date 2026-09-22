# AIGMS — Audit technique et fonctionnel

*28 septembre 2026. Établi depuis le code, la base locale (rejouée par
`supabase db reset`) et la préprod. Chaque capacité déclarée présente est
citée par son emplacement. Ce document sert de socle à
`AIGMS_SERVICE_OFFER_VALIDATION_V1.md`.*

---

## 1. Ce que pèse la plateforme

| Élément | Mesure |
|---|---:|
| Migrations SQL versionnées | 91 (0001 → 0091) |
| Tables `public` | 64 |
| Fonctions `app` (règles) / `public` (API) | 206 / 71 |
| Politiques RLS | 130 |
| Déclencheurs métier | 223 |
| Écrans (`page.tsx`) | 48 |
| Routes serveur (`route.ts`) | 5 |
| Actions serveur | 16 fichiers |
| Composants de gouvernance | 48 |
| Tests RLS / E2E / unitaires | 50 fichiers (289 tests) / 10 / 6 (25 tests) |
| Lignes : application / SQL | 41 564 / 17 753 |

**Architecture.** Next.js 16 (App Router, React 19, TypeScript strict,
Tailwind v4) ; Supabase Postgres avec RLS forcée sur toutes les tables
métier ; les règles vivent en base (fonctions `app` en `security definer`,
enveloppes `public`), l'application ne les redouble pas. Déploiement Vercel
(Preview permanente par branche). Trois environnements : local, préprod
(`xahqdxwmlewyjpsiuzux`, à jour 0091), production (`xsagbzrgoljzgorwvsir`,
**arrêtée à 0016 — 75 migrations de retard**).

**Deux principes portent tout le reste.**

1. *Les règles ne sont pas contournables.* Un gate, une signature, une
   acceptation de risque passent par une fonction en base ; l'écran ne fait
   que présenter le refus. `ADR-0003`, `ADR-0004`.
2. *Tout laisse une trace.* `audit_log` est append-only (un déclencheur
   rejette `update` et `delete`, y compris pour `service_role`) et chaque
   entrée est située par organisation et cas d'usage depuis 0077.

---

## 2. Domaine couvert, par objet

### 2.1 Socle multi-clients

| Capacité | État | Emplacement |
|---|---|---|
| Tenant, organisations, entités | **Implémenté** | `tenant`, `organization`, `business_unit` ; `/admin/organizations` |
| Comptes, rôles, attributions par organisation | **Implémenté** | `membership`, `role_assignment` ; `/admin/comptes` ; `app.assignable_roles()` |
| Sept rôles attribuables | **Implémenté** | Porteur de l'IA, AI Governance Officer, **Administrateur client** (0091), Expert (DPO/RSSI), Comité des risques, Comité de direction, Auditeur |
| RACI appliqué en base | **Implémenté** | 0055 ; `app.roles_*` ; matrice des capacités `role_capabilities()` |
| Organisation « opérationnelle » si six rôles tenus | **Implémenté** | 0056, `app.assert_organization_ready` — déclencheur bloquant sur 14 tables |
| Marque blanche (logo, libellé, identité des documents) | **Implémenté** | `tenant_branding()`, `document_identity()` ; `ADR-0016` |
| Préférences de notification par personne | **Implémenté** | `notification_preference` (0086) |
| Demandes de contact (site) | **Implémenté** | `contact_request` ; `/admin/contacts` |

### 2.2 Registre et cycle de vie

| Capacité | État | Emplacement |
|---|---|---|
| Processus / activités, trois familles | **Implémenté** | `process`, `activity` ; `/processus` (arbre, couverture, risques, graphe) |
| Cas d'usage : intake, propriétaire, redevable, autonomie | **Implémenté** | `ai_use_case` ; `/admin/use-cases/[id]` |
| Cycle de vie à 12 statuts, 8 jalons | **Implémenté** | `app.transition_use_case`, `app.evaluate_gate` |
| Préconditions de production (8 checks) | **Implémenté** | `CLASSIFICATION_COMPLETE`, `RISKS_TREATED`, `IMPACT_ASSESSMENT`, `VENDOR_REVIEW`, `HUMAN_OVERSIGHT`, `MANDATORY_CONTROLS`, `PRODUCTION_DECISION`, `BLOCKING_ACTIONS` |
| Criticité : grille de triage, justification, signal des faits | **Implémenté** | 0075, 0082 ; `app.criticality_signal` |
| Qualification AI Act : rôle, drapeaux, revue juridique | **Implémenté** | `regulatory_classification` ; chaque drapeau agit (0082) |
| Actifs d'IA : registre, fiche, mesures techniques | **Implémenté** | `ai_asset`, `asset_control`, `use_case_asset_link` ; `/actifs` |
| Héritage des faits de l'actif vers le cas d'usage | **Implémenté** | 0080 (`use_case_personal_data`, `use_case_vendor_all`) |
| Fournisseurs : criticité, DPA, sécurité, réversibilité, revue | **Implémenté** | `vendor` ; revue datée, précondition de production |
| Import CSV actifs / fournisseurs (admin) | **Implémenté** | 0061/0062 ; `/admin/actifs-fournisseurs`, modèles dans `public/modeles/` |
| Import CSV des cas d'usage | **Implémenté** | 0092 ; `/administration`, `/admin/actifs-fournisseurs`, modèle `public/modeles/cas-d-usage.csv` |
| **Shadow AI (détection, registre d'outils grand public)** | **Absent** | — |

### 2.3 Risques, impact, supervision

| Capacité | État | Emplacement |
|---|---|---|
| Risques : cotation V×G calculée, brut/résiduel, statuts | **Implémenté** | `risk`, `app.rate_risk_level` |
| Qui répond du risque (seul à pouvoir l'accepter) | **Implémenté** | 0058, 0087 ; `app.guard_risk_acceptance` |
| Quatre stratégies de traitement à conséquences | **Implémenté** | 0059 : réduire → contrôle applicable ; éviter → action ; transférer → tiers revu ; accepter → décision si élevé |
| Acceptation d'un risque élevé → décision approuvée | **Implémenté** | `app.open_acceptance_decision` |
| Étude d'impact ISO/IEC 42005 complète | **Implémenté** | `impact_assessment`, `impact_stakeholder`, `impact_finding` ; `/etudes-impact` |
| Constat grave → action de remédiation ouverte | **Implémenté** | 0078 (`app.open_finding_action`), bloquante si gravité « grave » |
| **Double signature de l'AIIA** | **Implémenté** | 0091 : visa de méthode + acceptation des risques résiduels, refus motivé, relances J+7/J+14 |
| Export `.docx` au modèle ISO 42005 de l'organisation | **Implémenté** | `src/lib/impact/docx.ts` ; dépôt d'un clic comme preuve |
| Plan de supervision humaine adossé aux contrôles | **Implémenté** | `human_oversight_plan` (0071–0073) ; HUM-001 matérialisé |
| Réévaluation : moteur de verdict, réouverture | **Implémenté** | `change_request`, `reassessment`, `app.screen_change_request` |

### 2.4 Contrôles, preuves, conformité

| Capacité | État | Emplacement |
|---|---|---|
| Référentiel de contrôles-types importable et publiable | **Implémenté** | `catalog_*` ; 120 contrôles AIGMS-CF v0.2 (51 organisation, 69 cas d'usage) |
| Propositions de contrôles par les faits | **Implémenté** | `suggest_controls` : 24 de socle + conditionnels déclenchés ; population et non-proposés dits (0079) |
| Contrôles opérationnels : responsable, état, fréquence, test | **Implémenté** | `control` ; états `proposed → operating → ineffective/retired` |
| Applicabilité par cas d'usage | **Implémenté** | `control_applicability` |
| **Outillage : avec quoi un contrôle se tient** | **Implémenté** | 0088 : `organization_tooling`, `control_tooling` ; `/outillage` |
| Preuves : dépôt de fichier, empreinte SHA-256, fraîcheur, validation | **Implémenté** | `evidence` + Supabase Storage (`evidence`) — **le status doc le dit « non câblé », c'est faux depuis 0028** |
| Renouvellement, remplacement, clôture d'action au dépôt | **Implémenté** | `app.apply_evidence_replacement`, `close_renewal_actions` |
| Matrice des preuves attendues par profil | **Implémenté** | `evidence_typology*`, `typology_coverage`, `evidence_matrix_gaps` |
| Déclaration d'Applicabilité (SoA) | **Implémenté** | `soa_decision`, `statement_of_applicability()` ; imprimable |
| Exigences réglementaires et mapping N:N | **Partiel** | `framework`/`requirement` : ISO 42001 **41 exigences**, AI Act 2, RGPD 1, ISO 42005 1 ; 17 correspondances contrôle↔exigence seulement |
| **Campagnes de collecte de preuves** | **Absent** | Les actions individuelles existent, pas l'objet « campagne » |

### 2.5 Décisions, incidents, revues

| Capacité | État | Emplacement |
|---|---|---|
| Registre de décisions : 8 types, conditions, date d'effet | **Implémenté** | `governance_decision`, `decision_link` ; approbateur attendu, arbitrage Comité si critique |
| Décision ⇄ changement | **Implémenté** | 0063 |
| Incidents au format du kit : déclencheur, droits fondamentaux, arrêt d'urgence, double signature de clôture | **Implémenté** | 0068/0069 ; ticket imprimable + export JSON |
| CAPA avec vérification d'efficacité | **Implémenté** | `capa` |
| Revues de gouvernance (comité, direction) | **Implémenté** | 0067/0070 : ordre du jour généré, présents attendus, compte rendu, annulation motivée, preuve déposée d'elle-même |
| Cadence attendue par profil | **Implémenté** | `review_cadence()` : criticité × rôle × taille → registre/incidents/comité/direction |
| Calendrier de gouvernance | **Implémenté** | `review_calendar()` ; carte en Pilotage |
| **Rapport annuel de gouvernance (document unique)** | **Absent** | Huit impressions séparées existent |

### 2.6 Pilotage, alertes, journal

| Capacité | État | Emplacement |
|---|---|---|
| Poste de pilotage multi-organisations | **Implémenté** | `/admin/pilotage` + `attention_by_organization()` : risques élevés, preuves échues, actions en retard, incidents, revues dues, SoA sans décision, par client |
| Indice de santé de la gouvernance | **Implémenté** | `governance_health()` : 100 moins les pénalités, causes nommées |
| Couverture des contrôles, carte des risques, graphe | **Implémenté** | `control_coverage`, `risk_heatmap*`, `control_graph` (8 couches depuis 0089) |
| Chemin d'un risque (où la chaîne rompt) | **Implémenté** | `risk_path()` |
| 25 natures d'alerte nominatives | **Implémenté** | `notification` ; `docs/admin/ALERTES.md` |
| Rappels d'échéance sans tâche planifiée | **Implémenté** | 0084 : preuve à valider / bientôt échue / échue, revue de cas d'usage, de fournisseur, d'étude |
| Courriel : immédiat + synthèse quotidienne/hebdomadaire | **Implémenté** | 0086 + `/api/alertes/envoi` (Vercel Cron 7 h) — **exige `CRON_SECRET`, `RESEND_API_KEY`, `SYSTEM_EMAIL_FROM` sur le déploiement** |
| Journal d'audit par organisation, filtrable, imprimable | **Implémenté** | 0077 ; `/journal` |
| Connecteurs : contrat déclaratif | **Partiel** | `governance_connector` décrit source, capacités, habilitations, fraîcheur. **Aucune intégration réelle branchée.** |

---

## 3. Ce qui manque, classé par nature

### 3.1 Trous fonctionnels réels

1. **Aucune intégration branchée.** Le cadre des connecteurs existe, la
   collecte automatique n'existe pas. Toute preuve est déposée à la main.
2. **Pas de campagne de collecte.** On ouvre des actions une à une ; rien ne
   dit « demander ces douze preuves à ces cinq personnes, relancer, clore ».
3. **Pas de questionnaire de maturité.** `assessment_answer` existe (3 lignes
   de démonstration) sans aucun écran : ni grille, ni score, ni tendance.
4. **Pas de Shadow AI.** Ni registre des usages autorisés, ni détection.
6. **Pas de rapport annuel unique.** Huit documents imprimables séparés.
7. **Exigences réglementaires squelettiques** hors ISO 42001 : l'AI Act n'a
   que 2 exigences en base, le RGPD 1. La SoA ne vaut donc réellement que pour
   ISO 42001.
8. **Pas de multi-langue.** Interface française uniquement.
9. **Pas de portail client en lecture seule.** L'auditeur a un rôle, pas un
   espace distinct.

### 3.2 Dettes et incohérences relevées

| Point | Gravité | Détail |
|---|---|---|
| **Production à 75 migrations de retard** | **Haute** | Prod = 0016, préprod = 0091. Aucune des fonctions décrites ci-dessus n'existe en production. |
| Comptes de démonstration avec mot de passe partagé | **Haute** | `Demo!Passw0rd` — à retirer avant toute ouverture publique |
| Jetons transités en clair pendant le développement | **Haute** | Supabase (`sbp_…`), Vercel, Resend, Turnstile : **à faire tourner** |
| `SUPABASE_SERVICE_ROLE_KEY` absente sur Vercel | **Haute** | La déclaration de compte échoue tant qu'elle n'est pas posée |
| `IMPLEMENTATION_STATUS.md` obsolète | Moyenne | Annonce Storage « non câblé » (faux), sprint 14 « non commencé » (les revues existent), 12 tests unitaires (25) |
| Contrôles de démonstration non rattachés au référentiel | Faible | Les CTL-xx sont libres : « déjà affecté » ne peut pas les reconnaître (dit à l'écran depuis 0079) |
| E2E non exécutés localement | Moyenne | 10 fichiers Playwright maintenus mais jamais lancés (poste lent) : ils ne protègent rien aujourd'hui |
| Captcha non activé | Moyenne | Turnstile prévu, non branché |

### 3.3 Ce qui est plus solide qu'annoncé

- Le **stockage des preuves** fonctionne (bucket `evidence`, empreinte
  SHA-256, téléchargement contrôlé par `/admin/evidence/[id]/telecharger`).
- Les **revues de direction** (sprint 14 « non commencé ») sont livrées :
  ordre du jour généré, présents, compte rendu, preuve, cadence.
- La **couverture de tests RLS** (289 tests) protège les règles métier, pas
  seulement les accès : gates, signatures, héritages, alertes.

---

## 4. Lecture par parcours de service

*Ce que la plateforme sait faire, dans l'ordre où un consultant travaille.*

| Étape du service | Ce qu'AIGMS fait seul | Ce qui reste manuel |
|---|---|---|
| **Qualification** (30 min) | Rien : aucun objet « prospect » | Tout — hors plateforme |
| **Discovery Workshop** (2–3 h) | Saisir organisation, processus, cas d'usage, actifs, fournisseurs, risques, criticité, qualification ; proposer les contrôles par les faits ; imprimer registre et SoA | Animer, interroger, juger ; **importer en lot les usages (absent)** ; produire une synthèse d'atelier (absent) |
| **Onboarding / Baseline** | Six rôles exigés, référentiel publié, contrôles proposés et retenus, matrice des preuves, cadence de revue calculée, calendrier | Cartographie fine, choix des contrôles, désignation des responsables, première collecte |
| **Managed Governance** | Alertes nominatives (25 natures), rappels d'échéance, synthèse par courriel, poste de pilotage multi-clients, indice de santé, gates qui refusent | Analyse, arbitrage, animation des comités, qualité des preuves, relance humaine |
| **Revue annuelle** | Ordre du jour généré, compte rendu, preuve déposée, impressions séparées | **Rapport annuel consolidé (absent)**, recommandations, feuille de route |

---

## 5. Verdict technique

**Ce qui est vendable aujourd'hui, sans surpromesse :** un *système de
référence* de la gouvernance IA — registre, qualification, risques,
contrôles, preuves, décisions, incidents, revues — dont **les règles sont
appliquées côté serveur** et dont **tout acte est tracé**. C'est la
différence avec un tableur ou un GRC générique : le refus d'un jalon est
opposable, la signature est nominative, le journal ne se réécrit pas.

**Ce qui n'est pas vendable :** l'automatisation de la collecte (aucun
connecteur), la détection (aucun Shadow AI), la mesure de maturité (aucun
questionnaire), et tout ce qui suppose une production à jour — **la
production est à 0016**.

**Le chemin critique avant un premier client payant**, par ordre :
1. bascule de la production (75 migrations) et purge du jeu de démonstration ;
2. rotation des jetons, `SUPABASE_SERVICE_ROLE_KEY`, `CRON_SECRET`, captcha ;
3. import des cas d'usage en lot (Discovery) ;
4. rapport annuel consolidé (livrable de fin d'année) ;
5. campagnes de collecte (c'est là que se joue la rentabilité du service).

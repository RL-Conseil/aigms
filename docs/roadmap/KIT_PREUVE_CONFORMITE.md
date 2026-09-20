# Kit de preuve de l'AI Officer prestataire — conformité d'AIGMS et plan

*20 septembre 2026. Référence : `04_References/kit_preuve_ai_officer.md` et
`04_References/frequence_controles.png` (fréquence de revue attendue par
l'auditeur selon criticité, rôle et taille).*

## 1. RACI du kit ↔ six rôles d'AIGMS

| Kit | AIGMS | État |
|---|---|---|
| AI Officer (prestataire) | AI Governance Officer | ✅ |
| Direction générale (sponsor) | Comité de direction | ✅ — « A » sur l'arbitrage critique appliqué (0055) |
| Manager métier / System Owner | Porteur de l'IA | ✅ |
| DSI / Responsable IT | **absent** — l'Expert métier couvre DPO/RSSI, pas l'exécution technique | ⚠️ |

Ligne par ligne :

| Activité (kit) | Kit | AIGMS aujourd'hui | Écart |
|---|---|---|---|
| Politique de l'IA & objectifs (5.2) | R officer, A direction | contrôle GOV-001 (politique approuvée par la direction), preuve attendue | ✅ par la preuve ; pas d'objet « politique » |
| Triage & classification | R officer, I direction, C métier/IT | Criticité + qualification, journalisées, nominatives | ✅ (workflow A) |
| Évaluation d'impact (6.1.2) | R officer, C métier | AIIA requise par les faits, conduite par l'officer, action « déposer la preuve » | ⚠️ pas de **visa officer + acceptation des risques résiduels par le Porteur** (double signature) |
| Validation finale de mise en production | **A direction, A owner, R DSI, C officer** | décision `go_production` : Comité de direction si critique, sinon relecteurs ; l'officer peut approuver un cas modéré ; le Porteur ne se prononce jamais | ⚠️ le Porteur est « A » dans le kit ; l'officer devrait être « C » |
| Registre d'incidents | R officer | incidents + CAPA, journalisés | ✅ partiel (structure de ticket, §2) |
| Kill-switch | A direction/owner, R DSI, C officer | `containment_action` en texte libre ; « autorité d'arrêt » dans le plan de supervision | ⚠️ pas d'acte d'arrêt d'urgence structuré |
| Revue de direction (9.3) | R officer, A direction | **absent** — seules des dates de revue par objet | ❌ |

## 2. Ticket d'incident standardisé (kit §2) ↔ `incident` + `capa`

| Champ du kit | AIGMS | Écart |
|---|---|---|
| ID, date/heure de détection | `business_ref` INC-…, `detected_at` | ✅ |
| Déclencheur (monitoring, plainte, audit, fournisseur) | — | ❌ |
| Système IA impacté (inventaire) | `use_case_id` ; pas de lien vers l'**actif** | ⚠️ (le registre des actifs existe désormais) |
| Rôle de l'organisation | déduit de l'organisation | ✅ |
| Description, sévérité | `description`, `severity` S1–S4 | ✅ |
| Classification réglementaire, droits fondamentaux impactés | déductible de la qualification ; **pas de champ « droits fondamentaux »** | ⚠️ |
| Rapporteur, AI Officer en charge, System Owner | `reported_by`, `owner_user_id` | ⚠️ pas d'« officer en charge » distinct |
| Statut Nouveau → Analyse → Conservatoire → Résolu → Clos | OPEN → CONTAINED → INVESTIGATING → ACTION_PLAN → EFFECTIVENESS_REVIEW → CLOSED | ✅ (plus fin) |
| Cause profonde, action conservatoire, CAPA (échéance, responsable) | `root_cause`, `containment_action`, `capa` | ✅ |
| Qualification sous 24 h (workflow C) | — | ❌ |
| Validation AI Officer + approbation System Owner (double signature à la clôture) | clôture simple | ❌ |
| Export compatible Jira/ServiceNow | — | ❌ |

## 3. Workflows A–F

| Workflow | Fréquence (kit) | AIGMS | Écart |
|---|---|---|---|
| **A** Triage de l'inventaire | continu à trimestriel | déclaration, criticité, qualification, journal | ✅ |
| **B** AIIA & alignement des risques avant déploiement | avant déploiement | AIIA exigée par le gate, risques élevés soldés, acceptation par le responsable désigné, décision d'acceptation | ⚠️ double signature de l'AIIA (visa officer / acceptation des risques résiduels par le Porteur) |
| **C** Dérives & kill-switch | temps réel à mensuel | incidents, CAPA, plan de supervision (autorité d'arrêt) | ❌ SLA de qualification 24 h ; ❌ acte d'arrêt d'urgence ; ❌ alertes de monitoring (connecteurs) |
| **D** Gouvernance des fournisseurs | trimestriel à semestriel | revue tiers (approuvée / sous conditions / rejetée, DPA, sécurité, réversibilité), `next_review_at`, mesures contractuelles | ⚠️ questionnaire structuré ISO 42001 / AI Act ; fiche d'évaluation imprimable à annexer au contrat |
| **E** Revue périodique du registre de décision (comité) | trimestriel | — | ❌ objet « revue de gouvernance » : ordre du jour (décisions, CAPA, risques, changements), compte rendu, présents, prochaine date |
| **F** Autorisation d'usage d'outils grand public & littératie IA | au fil de l'eau | preuve « attestation de formation » (CTL-07) ; pas de registre nominatif | ❌ registre des usages autorisés (personne, outil, date, attestation) |

## 4. Fréquence selon la criticité, le rôle et la taille

Le tableau attend une **cadence de revue par profil** (criticité des systèmes ×
rôle de l'organisation × taille) : de *continue à mensuelle* (haut risque,
grande entreprise) à *annuelle au minimum* (usage simple, TPE). AIGMS
connaît les trois entrées — criticité des cas d'usage, rôle de l'organisation
vis-à-vis de l'IA, `headcount` — mais **ne calcule aucune cadence** : les
dates de revue (cas d'usage, risques, fournisseurs, qualification) sont
saisies à la main, sans référence.

## 5. Plan d'adaptation

Par ordre de valeur pour un audit, chaque point une branche et une Preview.

1. **Revue de gouvernance (workflow E, clause 9.3)** — objet `governance_review` :
   cadence, ordre du jour généré (décisions du trimestre, CAPA ouvertes,
   risques élevés, changements, revues échues), présents, compte rendu,
   décisions prises, prochaine date ; imprimable ; alerte au Comité de
   direction et à l'AI Governance Officer ; preuve déposée d'elle-même.
2. **Cadence attendue par profil (tableau)** — `app.review_cadence(organisation)` :
   registre, incidents, comité, direction, déduits de la criticité maximale,
   du rôle et de la taille ; lue en Pilotage (« calendrier attendu / tenu »),
   proposée comme date par défaut, signalée en retard ; la revue de gouvernance
   en hérite.
3. **Ticket d'incident au format du kit (§2, workflow C)** — déclencheur,
   actif impacté, droits fondamentaux, officer en charge ; **qualification sous
   24 h** (alerte à l'officer) ; **arrêt d'urgence** comme acte structuré
   (recommandé par l'officer, validé par le Porteur, exécuté par le
   responsable IT — d'où un rôle **Responsable IT** ou l'exécution confiée à
   l'Expert) ; **double signature** à la clôture (officer + Porteur) ; export
   JSON/CSV Jira-ServiceNow et impression du ticket.
4. **AIIA à double signature (workflow B)** — visa de l'officer à l'achèvement,
   **acceptation des risques résiduels par le Porteur** comme acte nominatif ;
   le gate Production l'exige.
5. **Validation de production (RACI)** — le Porteur devient partie prenante de
   l'approbation (co-approbation Porteur + relecteur ou Comité) ; l'officer
   passe « consulté » : il soumet, ne tranche pas. *À arbitrer : cela change
   0055.*
6. **Fournisseurs (workflow D)** — questionnaire structuré (politique de
   données, transparence, robustesse, entraînement sur données client), avis
   favorable / sous conditions / défavorable motivé, **fiche d'évaluation
   imprimable** à annexer au contrat, preuve déposée d'elle-même.
7. **Usages autorisés et littératie (workflow F)** — registre nominatif
   (personne, outil grand public, date, attestation de sensibilisation liée),
   importable ; croisé avec CTL-07.
8. **Rôle « Responsable IT »** — à décider : septième rôle (exécute l'arrêt
   d'urgence, « R » sur la mise en production technique), ou fonction de
   l'Expert métier.

Ce qui est déjà conforme et n'appelle rien : triage/qualification journalisés
(A), gate d'AIIA avant production (B), incidents avec cause profonde et CAPA,
revue tiers datée avec verdict (D), preuves nominatives et datées, journal
d'audit immuable, RACI des six rôles appliqué.

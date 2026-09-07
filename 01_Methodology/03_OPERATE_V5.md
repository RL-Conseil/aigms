# 03 — OPERATE
## AI Governance Office, assurance continue et amélioration — V5
Version 5.0 — 7 septembre 2026

## 1. Finalité
OPERATE correspond au **CHECK + ACT** du SMIA, avec maintien des activités opérationnelles du DO. L’objectif n’est pas de produire un rapport mensuel statique mais de démontrer qu’un système de management fonctionne réellement : les usages changent, les risques sont réévalués, les contrôles sont testés, les preuves restent fraîches, les incidents produisent des actions et la direction arbitre.

## 2. Operating Model
La direction client conserve :
- responsabilité ;
- acceptation des risques ;
- décisions stratégiques ;
- obligations légales propres à son rôle.

AI Governance Office externalisé peut assurer :
- coordination ;
- tenue des registres ;
- triage ;
- contrôles de second niveau convenus ;
- préparation des décisions ;
- monitoring ;
- audit readiness ;
- reporting ;
- amélioration.

## 3. Cadences
### Event-driven
- nouveau cas d’usage ;
- nouveau fournisseur/modèle ;
- changement significatif ;
- incident ;
- alerte contrôle ;
- nouvelle exigence réglementaire ;
- changement de donnée/permission/autonomie.

### Hebdomadaire
- intake ;
- décisions bloquantes ;
- incidents ouverts ;
- actions échues ;
- alertes critiques.

### Mensuel
- portefeuille ;
- risques ;
- preuves ;
- fournisseurs ;
- FinOps ;
- KPI/KRI ;
- comité opérationnel.

### Trimestriel
- tests contrôles ;
- revue agents/autonomie ;
- revue fournisseurs critiques ;
- objectifs ;
- roadmap ;
- échantillonnage de décisions.

### Semestriel / annuel
- audit interne selon programme ;
- revue de direction ;
- revue complète du scope ;
- exercice incident ;
- révision politiques ;
- readiness certification si objectif.

## 4. Processus détaillés

### O0 — Transition BUILD → RUN
- accepter backlog résiduel ;
- définir SLAs et responsabilités ;
- basculer owners ;
- vérifier accès AIGMS/connecteurs ;
- figer baseline KPI ;
- définir calendrier comités/audits ;
- enregistrer risques transitoires.

### O1 — Continuous Intake & Portfolio Governance
Pour chaque nouvel usage :
- enregistrer ;
- owner ;
- triage ;
- classification ;
- niveau d’assessment ;
- décision ;
- échéance de revue.

KPI : % nouveaux usages enregistrés avant production ; délai intake → décision.

### O2 — Continuous Risk Management
- surveiller risques existants ;
- nouvelles menaces/vulnérabilités ;
- changements de contexte ;
- incidents ;
- signaux fournisseur ;
- performance et usage réel ;
- risque résiduel ;
- plans de traitement.

Escalade immédiate si seuil critique dépassé ou contrôle clé défaillant.

### O3 — Impact Monitoring & AIIA Refresh
Réévaluer lorsqu’il existe :
- nouveau groupe affecté ;
- changement de finalité ;
- augmentation autonomie ;
- nouveau type de décision ;
- incident d’impact ;
- métrique indiquant résultat disproportionné ;
- changement majeur modèle/dataset.

Conserver comparaison avant/après.

### O4 — Control Monitoring & Evidence Freshness
Pour chaque contrôle :
- owner ;
- test method ;
- fréquence ;
- dernière exécution ;
- résultat ;
- preuves ;
- expiration ;
- exception ;
- action.

Statuts : effective / partially effective / ineffective / not tested / not applicable.

Les connecteurs peuvent alimenter les preuves mais ne décident jamais seuls de l’efficacité finale d’un contrôle critique.

### O5 — Decision Governance
Revoir :
- décisions conditionnelles ;
- exceptions ;
- risques acceptés ;
- échéances ;
- hypothèses devenues invalides.

AIGMS doit alerter avant la date de revue.

### O6 — Human Oversight Monitoring
- vérifier personnes nommées ;
- droits d’arrêt ;
- couverture horaires/processus ;
- événements d’intervention ;
- override ;
- erreurs évitées/non évitées ;
- permissions agentiques ;
- tests périodiques.

KRI : actions autonomes hors limite ; interventions tardives ; plans sans superviseur actif.

### O7 — Vendor & Model Monitoring
Surveiller :
- changement conditions ;
- sous-traitants ;
- localisation ;
- incidents ;
- sécurité ;
- nouvelles fonctionnalités ;
- version modèle ;
- retrait produit ;
- SLA ;
- coûts ;
- dépendance ;
- réversibilité.

Revue renforcée des fournisseurs critiques.

### O8 — Data Trust & Security Monitoring
Réutiliser les signaux SMSI/DLP/SIEM :
- accès anormal ;
- exposition ;
- données non autorisées ;
- secrets ;
- violations de politique ;
- vulnérabilités ;
- erreurs de configuration ;
- rétention/localisation.

AIGMS orchestre l’impact de ces signaux sur usages, risques et décisions.

### O9 — Incident Management
Processus : detect → triage → contain → investigate → notify/escalate → recover → CAPA → verify effectiveness → close.

Chaque incident peut déclencher :
- suspension usage ;
- réévaluation risque/impact ;
- revue fournisseur ;
- changement contrôle ;
- formation ;
- décision CODIR.

### O10 — Change & Configuration Governance
Maintenir un journal des changements liés à : modèles, datasets, prompts système structurants, permissions, agents, fournisseurs, intégrations, population, finalité, géographie, infrastructure.

Le change gate détermine : no reassessment / partial / full reassessment.

### O11 — AI Literacy & Competence Run
- onboarding ;
- refresh ;
- formation selon rôle ;
- campagnes ciblées après incident ;
- exercices ;
- mesure de compréhension ;
- mise à jour contenu lors de changements réglementaires/technologiques.

KPI : couverture, réussite, incidents liés à mauvais usage.

### O12 — FinOps & Value Governance
Suivre sans confondre conformité et valeur :
- coût licences ;
- tokens/API ;
- consommation ;
- doublons ;
- licences dormantes ;
- forecast ;
- valeur métier déclarée/mesurée ;
- coûts de contrôle ;
- coût de dépendance fournisseur.

Décision possible : scale / maintain / remediate / retire.

### O13 — Operational Governance Committee
Ordre du jour standard :
1. nouveaux usages ;
2. risques critiques ;
3. incidents ;
4. décisions ;
5. actions en retard ;
6. fournisseurs ;
7. contrôles/preuves ;
8. coûts/valeur ;
9. changements ;
10. arbitrages.

Livrable : CR + decisions + actions dans AIGMS.

### O14 — Performance Evaluation
Dashboard minimum :
- couverture portefeuille ;
- usages par tier ;
- risques élevés/critiques ;
- âge du risque ;
- décisions conditionnelles ;
- contrôles inefficaces ;
- preuves expirées ;
- incidents ;
- MTTR ;
- actions en retard ;
- fournisseurs critiques ;
- literacy ;
- coût ;
- valeur ;
- audit findings.

### O15 — Internal Audit
Programme fondé sur : risque, changements, incidents, résultats précédents et importance des processus.

Auditer :
- conformité aux dispositions internes ;
- application réelle ;
- efficacité ;
- traçabilité ;
- échantillons de systèmes/risques/décisions ;
- preuves ;
- clôture des écarts.

Indépendance suffisante de l’auditeur à organiser.

### O16 — Management Review
Préparer périodiquement une revue de direction incluant au minimum :
- évolutions de contexte ;
- attentes parties intéressées ;
- performance ;
- objectifs ;
- risques/opportunités ;
- incidents/non-conformités ;
- audits ;
- ressources ;
- efficacité des actions ;
- changements fournisseurs/technologies ;
- opportunités d’amélioration ;
- décisions et ressources nécessaires.

Sorties : décisions, priorités, ressources, changements du SMIA.

### O17 — Nonconformity, CAPA & Continual Improvement
Pour chaque écart :
- correction immédiate ;
- cause ;
- étendue ;
- action corrective ;
- owner ;
- échéance ;
- test d’efficacité ;
- mise à jour risque/processus/documentation si nécessaire.

Backlog d’amélioration priorisé par risque/valeur.

### O18 — Regulatory & Standards Watch
Veille structurée :
- AI Act et actes/lignes directrices ;
- normes ISO/IEC pertinentes ;
- CNIL/EDPB ;
- cybersécurité ;
- exigences sectorielles ;
- changements fournisseurs.

Toute évolution reçoit une analyse d’impact : no action / update control / update policy / reassess systems / training.

### O19 — Certification Readiness / External Audit Support
Si certification ISO 42001 visée :
- vérifier cycle de management réellement exécuté ;
- preuves de fonctionnement ;
- audit interne ;
- revue de direction ;
- nonconformités traitées ;
- scope cohérent ;
- préparation logistique de l’audit ;
- support factuel à l’auditeur.

Le certificateur tiers reste indépendant.

## 5. SLA / escalade type
| Niveau | Exemple | Action |
|---|---|---|
| P1 Critique | fuite, pratique potentiellement interdite, action agent dangereuse | immédiate, suspension/escalade direction |
| P2 Élevé | contrôle clé défaillant, risque > seuil, fournisseur critique | traitement prioritaire + décision |
| P3 Moyen | preuve expirée, action retardée | correction planifiée |
| P4 Faible | amélioration/documentation | backlog |

Les délais exacts sont contractualisés selon client et criticité.

## 6. Livrables récurrents
- dashboard mensuel ;
- note exécutive ;
- registres à jour ;
- Risk & Impact report ;
- Decision Register ;
- Control & Evidence health report ;
- Vendor review ;
- Incident/CAPA report ;
- FinOps & Value report ;
- CR comité ;
- audit interne ;
- revue de direction ;
- rapport annuel SMIA.

## 7. KPI/KRI recommandés
### Gouvernance
- % usages avec owner ;
- % usages production avec décision valide ;
- délai intake → décision ;
- nombre exceptions ouvertes.

### Risque/impact
- risques élevés/critiques ;
- âge moyen ;
- % avec traitement ;
- AIIA échues ;
- changements sans reassessment.

### Contrôles/preuves
- % contrôles testés ;
- efficacité ;
- preuves expirées ;
- temps de fermeture écarts.

### Human oversight
- systèmes sans superviseur ;
- interventions ;
- actions autonomes hors limites.

### Incident
- incidents par sévérité ;
- MTTR ;
- récurrence ;
- CAPA échues.

### Supplier
- fournisseurs critiques non revus ;
- changements non évalués ;
- dépendance concentration.

### Literacy
- couverture ;
- résultat évaluations ;
- incidents liés à l’usage.

### Valeur/FinOps
- budget vs actual ;
- licences inutilisées ;
- coût par usage ;
- usages retirés/rationalisés ;
- valeur métier documentée.

## 8. Critères d’un SMIA « vivant »
Un SMIA n’est pas considéré opérationnel uniquement parce que les documents existent. Il doit démontrer :
- décisions réelles ;
- risques réellement traités ;
- contrôles testés ;
- incidents/changements absorbés ;
- preuves fraîches ;
- objectifs mesurés ;
- audit effectué ;
- revue de direction tenue ;
- actions d’amélioration clôturées.

## Références normatives et état de l’art
Cette méthode est une interprétation opérationnelle et ne reproduit pas le texte des normes. Elle doit être adaptée au contexte, aux rôles réglementaires et au niveau de risque du client.

Références principales :
- ISO/IEC 42001:2023 — système de management de l’IA (SMIA), logique PDCA et amélioration continue.
- ISO/IEC 23894:2023 — recommandations de management des risques liés à l’IA.
- ISO/IEC 42005:2025 — évaluation de l’impact des systèmes d’IA sur les individus, groupes et société tout au long du cycle de vie.
- ISO/IEC 27001:2022 — système de management de la sécurité de l’information et gestion des risques de sécurité.
- Règlement (UE) 2024/1689 (AI Act), version consolidée applicable : obligations selon rôle, usage et niveau de risque.
- NIST AI RMF 1.0 — fonctions GOVERN, MAP, MEASURE, MANAGE comme cadre complémentaire de bonnes pratiques.

Sources officielles :
- https://www.iso.org/fr/standard/42001
- https://www.iso.org/fr/standard/77304.html
- https://www.iso.org/fr/standard/42005
- https://www.iso.org/fr/standard/27001
- https://eur-lex.europa.eu/eli/reg/2024/1689
- https://www.nist.gov/itl/ai-risk-management-framework


## Références de méthode et règle d'interprétation
La phase s'appuie sur ISO/IEC 42001:2023 comme référentiel de système de management, complété par ISO/IEC 23894:2023 pour le risque, ISO/IEC 42005:2025 pour les impacts, ISO/IEC 27001:2022 pour la sécurité de l'information, et l'AI Act selon le rôle et le niveau de risque.

**Règle AIGMS :** une exigence externe n'est jamais implémentée comme une simple case à cocher. Elle doit pouvoir être reliée à un owner, un contrôle, une preuve, une décision, un statut, une échéance et un historique.

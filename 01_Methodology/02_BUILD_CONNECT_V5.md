# 02 — BUILD & CONNECT
## Construction du SMIA, contrôles, preuves et intégrations — V5
Version 5.0 — 7 septembre 2026

## 1. Finalité
BUILD est la phase **DO** du SMIA. Elle transforme les constats DISCOVERY en système de gouvernance exécutable : politique, responsabilités, critères de risque, workflows, contrôles, preuves, compétences, gouvernance fournisseurs, supervision humaine, incidents et mécanismes de mesure.

CONNECT fait partie de BUILD : toute capacité déjà mieux assurée par un outil spécialisé doit être intégrée lorsque cela réduit le risque, le coût ou la dette produit.

## 2. Règle BUILD / CONNECT / DON'T BUILD
Pour chaque besoin :
1. Est-ce une capacité cœur de gouvernance IA et de décision ? → **BUILD**.
2. Existe-t-elle dans un outil déjà déployé avec données fiables et API adaptées ? → **CONNECT**.
3. Est-ce une plateforme spécialisée lourde (SIEM, DLP, CMDB, IAM, runtime guardrails, observabilité modèle) ? → **DON'T BUILD** ; intégrer ou référencer.

Toute décision est consignée dans un **Architecture Decision Record** avec owner, justification, risques et réversibilité.

## 3. Déroulé détaillé

### B0 — Mobilisation programme et architecture intégrée
- confirmer sponsor, governance officer, workstreams ;
- figer périmètre SMIA V1 ;
- cartographier interfaces SMSI/RGPD/QMS/ERM/achats/RH ;
- définir environnements AIGMS ;
- planifier pilotes ;
- créer backlog et critères DoD.

Livrables : Program Charter, RACI, roadmap, architecture cible, backlog.

### B1 — Contexte, périmètre et parties intéressées
Mettre sous contrôle :
- contexte ;
- parties intéressées ;
- exigences pertinentes ;
- périmètre du SMIA ;
- exclusions ;
- interfaces avec systèmes de management existants.

Preuves attendues : scope approuvé, register des exigences, ownership.

### B2 — Leadership, politique et accountability
Construire :
- AI Policy ;
- principes d’usage responsable ;
- responsabilités et délégations ;
- AI Governance Committee ;
- règles d’escalade ;
- risque acceptable et pouvoirs d’acceptation ;
- gestion des conflits d’intérêt ;
- Decision Register.

**Critère d’efficacité :** une décision sensible possède décideur, justification, conditions, échéance de revue et preuve.

### B3 — Objectifs, planification et indicateurs
Définir des objectifs mesurables, par exemple :
- 100 % des usages P1 enregistrés ;
- 100 % des risques élevés avec traitement ;
- aucun usage production sans gate approuvé ;
- preuves critiques à jour ;
- réduction des usages inconnus ;
- AI literacy adaptée aux rôles ;
- réduction incidents récurrents.

Relier chaque objectif à owner, mesure, cible, échéance et revue.

### B4 — Registres et configuration management
Mettre en place les registres :
- AI use cases ;
- systems ;
- models ;
- agents ;
- datasets ;
- vendors ;
- deployments ;
- risks ;
- impacts ;
- controls ;
- evidence ;
- decisions ;
- incidents ;
- changes ;
- actions.

Exigence : version, propriétaire, état, date de revue et liens entre objets.

### B5 — Lifecycle & Governance Gates
Implémenter :
`DRAFT → TRIAGE → ASSESSMENT → REVIEW → APPROVED / CONDITIONAL / REJECTED → PILOT → PRODUCTION → MONITORING → RETIRED`

Gates :
1. intake complet ;
2. rôle/classification ;
3. risque/impact ;
4. data/security/privacy ;
5. vendor/model ;
6. human oversight ;
7. contrôles/preuves ;
8. décision ;
9. production ;
10. change/reassessment ;
11. retirement.

Les transitions interdites sont contrôlées dans AIGMS.

### B6 — Processus de Risk Management IA
Construire une méthode reproductible :
- taxonomie ;
- critères vraisemblance/impact ;
- seuils ;
- risques positifs/opportunités si retenus ;
- identification ;
- analyse ;
- évaluation ;
- traitement ;
- acceptation ;
- monitoring ;
- déclencheurs de réévaluation.

Le traitement peut être : éviter, réduire, transférer/partager, accepter selon règles internes.

Preuves : risk register, plans, décisions, tests de contrôle, historique.

### B7 — Processus AI Impact Assessment
Définir quand déclencher AIIA Lite ou complète :
- personnes affectées ;
- décisions à enjeu ;
- populations vulnérables ;
- autonomie élevée ;
- usage externe massif ;
- nouvelles données ;
- changements substantiels.

Processus : scope → parties affectées → impacts/bénéfices → gravité/probabilité/incertitude → mesures → consultation si pertinente → décision → suivi → révision.

Relier AIIA aux risques, décisions et actions.

### B8 — Data Governance & Data Trust
Contrôles proportionnés sur :
- provenance ;
- légitimité d’usage ;
- qualité ;
- représentativité si pertinente ;
- minimisation ;
- séparation environnements ;
- classification ;
- rétention ;
- localisation ;
- traçabilité ;
- données synthétiques ;
- données de test ;
- dataset changes.

CONNECT privilégié avec Purview ou catalogues existants lorsque disponibles.

### B9 — Security-by-design et interface ISO 27001
Ne pas créer un second SMSI. Mapper les risques/contrôles IA avec le SMSI :
- identité et privilèges ;
- secrets API ;
- sécurité cloud ;
- développement sécurisé ;
- vulnérabilités ;
- logging ;
- supply chain ;
- sauvegarde ;
- continuité ;
- incidents ;
- accès admin ;
- séparation dev/test/prod.

Les preuves techniques doivent être réutilisables entre SMSI et SMIA.

### B10 — Human Oversight & Autonomie des agents
Créer une matrice d’autonomie :
- advisory ;
- propose ;
- execute with approval ;
- execute within limits ;
- highly autonomous.

Pour chaque système concerné :
- accountable human ;
- compétence ;
- pouvoirs d’arrêt ;
- seuils d’intervention ;
- contrôle des permissions ;
- limites d’action ;
- supervision ;
- journal des interventions ;
- test périodique.

### B11 — Vendor / Model / Third-party Governance
Processus :
1. onboarding ;
2. due diligence ;
3. classification critique ;
4. clauses minimales ;
5. approbation ;
6. monitoring ;
7. changement ;
8. incident ;
9. renouvellement ;
10. exit.

Clauses/capacités à examiner : données, sous-traitants, sécurité, notification incident, audit, SLA, limitations, évolution modèle, réversibilité, localisation, IP, responsabilité.

### B12 — AI Literacy, compétence et communication
Construire une matrice rôle → compétence :
- utilisateur ;
- owner ;
- développeur/intégrateur ;
- risk owner ;
- DPO/RSSI ;
- acheteur ;
- dirigeant ;
- auditeur.

Preuves : formation, sensibilisation, exercices, attestations, évaluations, communication des règles.

### B13 — Controls Library & Multi-framework Mapping
AIGMS doit gérer :
- requirement ;
- control ;
- applicability ;
- implementation status ;
- owner ;
- test method ;
- evidence expectation ;
- frequency ;
- mappings multiples.

Mappings initiaux : ISO 42001, ISO 27001, AI Act, RGPD, NIS2, CRA, ISO 23894, ISO 42005, NIST AI RMF.

Règle : **un contrôle interne stable, plusieurs exigences externes**.

### B14 — Evidence Management
Catégories :
- document ;
- configuration ;
- log ;
- ticket ;
- rapport de test ;
- décision ;
- formation ;
- contrat ;
- capture/attestation ;
- preuve importée par connecteur.

Métadonnées obligatoires : owner, source, période, date, validité, niveau de confiance, contrôle lié, tenant, intégrité/version.

### B15 — Incident, Nonconformity & CAPA
Mettre en place :
- canal de déclaration ;
- sévérité ;
- triage ;
- containment ;
- investigation ;
- notification ;
- cause racine ;
- corrective action ;
- preventive action ;
- efficacité ;
- clôture ;
- retour d’expérience.

Déclencheurs possibles : hallucination grave, fuite données, comportement discriminatoire, action agent non autorisée, défaut fournisseur, contournement de règle, dérive coûts, performance inattendue.

### B16 — Change Management & Reassessment
Tout changement significatif peut réouvrir : classification, risque, impact, sécurité, human oversight, contrôle et décision.

Déclencheurs : modèle, fournisseur, dataset, finalité, population, autonomie, permissions, intégration, territoire, volumétrie, performance ou incident.

### B17 — Monitoring, Auditability & Management Review Design
Avant le go-live, définir :
- KPI/KRI ;
- contrôles à tester ;
- fréquence ;
- audit trail ;
- programme audit interne ;
- format revue de direction ;
- seuils d’escalade ;
- processus d’amélioration.

### B18 — CONNECT : conception des intégrations
Pour chaque connecteur :
- use case ;
- système source ;
- data owner ;
- champs importés ;
- sensibilité ;
- authentification ;
- scopes ;
- fréquence ;
- source of truth ;
- idempotence ;
- gestion des erreurs ;
- fraîcheur ;
- journalisation ;
- réversibilité ;
- conservation ;
- tests ;
- SLA.

Connecteurs prioritaires : Entra/M365/Purview, Azure/Azure AI, GitHub, Google, Claude/OpenAI admin, Vanta, Jira/ServiceNow, SIEM.

**Principe zéro trust connector :** permissions minimales, secrets serveur, rotation, aucune écriture distante par défaut.

### B19 — Implémentation AIGMS
Configurer :
- tenants ;
- RBAC ;
- registres ;
- taxonomies ;
- workflows ;
- notifications ;
- dashboards ;
- templates ;
- mappings ;
- exports ;
- rétention ;
- audit logs.

Tester :
- isolation cross-tenant ;
- transitions ;
- permissions ;
- exports ;
- audit ;
- restauration ;
- connecteurs.

### B20 — Pilote opérationnel
Sélectionner 2–5 usages représentatifs, dont au moins un usage significatif.

Exécuter de bout en bout :
intake → assessment → risk → impact → controls → evidence → human oversight → decision → pilot → monitoring → change test.

Collecter retours utilisateurs et temps de traitement.

### B21 — Internal Readiness Review / Gate BUILD
Vérifier :
- périmètre et politique validés ;
- rôles actifs ;
- registres opérationnels ;
- risques/impacts traités ;
- contrôles implémentés/testables ;
- preuves disponibles ;
- formation réalisée ;
- incidents/changements testés ;
- KPI définis ;
- audit/revue de direction planifiés ;
- écarts P1 fermés ou acceptés.

**Gate :** GO OPERATE / GO sous conditions / prolongation BUILD.

## 4. Matrice de livrables BUILD
| Domaine | Livrable minimum | Preuve d’efficacité |
|---|---|---|
| Gouvernance | AI Policy + RACI + comité | décisions réelles |
| Scope | périmètre SMIA | usages liés au scope |
| Risk | méthode + registre | traitements/acceptations |
| Impact | méthode AIIA | évaluation sur usages P1 |
| Lifecycle | workflow + gates | cas pilote traversé |
| Human oversight | plans | tests/interventions |
| Vendor | due diligence | fournisseur évalué |
| Data | Data Trust controls | preuves de provenance/accès |
| Security | mapping SMSI | contrôles/test |
| Literacy | matrice + programme | présence/évaluation |
| Evidence | index | fraîcheur/owner |
| Incident | procédure + CAPA | exercice ou incident |
| Change | procédure | reassessment test |
| Monitoring | KPI/KRI | dashboard |
| Audit | programme | audit pilote |

## 5. BUILD vs CONNECT recommandé pour AIGMS
**BUILD :** registre IA, intake, classification, risk/AIIA, décisions, human oversight, mappings, evidence index, vendor governance, changes, incidents, actions, dashboards multi-clients.

**CONNECT :** evidence automation, data classification/DLP, IAM, SIEM, CMDB/ITSM, cloud telemetry, model/agent telemetry, ticketing.

**DON'T BUILD :** DLP engine, SIEM, IAM provider, CMDB généraliste, runtime guardrails, model observability platform, SOC tooling.

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

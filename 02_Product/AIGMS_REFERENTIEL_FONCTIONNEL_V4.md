# AIGMS — Référentiel fonctionnel V4
Version 4.0 — 7 septembre 2026

## 1. Vision produit

**AIGMS — AI Governance Management System** est un système de pilotage opérationnel de la gouvernance de l’IA destiné prioritairement aux PME/ETI, DSI externalisées, cabinets de conseil, hébergeurs, MSP et intégrateurs.

AIGMS n’a pas vocation à devenir un clone de Vanta, OneTrust ou ServiceNow GRC. Sa proposition de valeur cible est :

> **AI Governance System of Record + Operating System de l’AI Governance Officer externalisé.**

AIGMS centralise les systèmes IA, cas d’usage, décisions, risques, impacts, fournisseurs, contrôles, preuves, incidents, changements, actions, comités et indicateurs.

## 2. Principes directeurs

1. **Use-case first** : chaque gouvernance part d’un cas d’usage réel.
2. **Decision centric** : toute décision significative est traçable et révisable.
3. **Risk based** : niveau de gouvernance proportionné au risque.
4. **Evidence driven** : aucun contrôle important sans preuve attendue.
5. **Multi-framework** : un même contrôle peut répondre à plusieurs référentiels.
6. **Human accountability** : AIGMS assiste, mais ne remplace pas l’acceptation humaine du risque.
7. **Multi-tenant native** : un AI Governance Officer doit pouvoir piloter plusieurs clients depuis un même portefeuille.
8. **Connect rather than rebuild** : les fonctions techniques déjà excellentes ailleurs sont intégrées, non recodées inutilement.
9. **Auditability by design** : historique, versionning, owner, date, justification, preuve.
10. **PME/ETI pragmatique** : simplicité, onboarding rapide, workflows courts, vocabulaire compréhensible.

---



## 2A. Modèle de management exécutable — nouveauté V4
AIGMS doit implémenter le cycle de management, pas seulement ses registres :

`DISCOVERY / ASSESS (PLAN) -> BUILD / CONNECT (DO) -> OPERATE (CHECK + ACT) -> RE-ASSESS en cas de changement significatif.`

Chaque processus critique doit avoir :
- une entrée et un déclencheur ;
- un owner et un accountable ;
- un statut et des transitions autorisées ;
- des critères de sortie ;
- des contrôles et preuves attendues ;
- une décision si un gate l'exige ;
- une échéance ou prochaine revue ;
- une trace d'audit.

### Trois familles de données
**Master data** : organization, vendor, framework, requirement, control, model, dataset.  
**Governance records** : use_case, assessment, risk, impact_assessment, oversight_plan, decision, evidence, incident, change.  
**Management records** : objective, KPI, audit, management_review, action, CAPA, improvement.

### Reassessment Engine
Tout changement doit être qualifié : MODEL, DATASET, PURPOSE, VENDOR, AUTONOMY, POPULATION, TERRITORY, SECURITY, DEPLOYMENT. Le moteur retourne `NO_REASSESSMENT`, `PARTIAL_REASSESSMENT` ou `FULL_REASSESSMENT`, avec justification et approbation humaine pour les cas sensibles.


## 3. Positionnement concurrentiel

| Capacité | AIGMS cible | Vanta | OneTrust | ServiceNow AI Control Tower | Microsoft Purview | Décision AIGMS |
|---|---|---|---|---|---|---|
| Inventaire systèmes/cas d’usage IA | Fort | Fort | Très fort | Très fort | Partiel | BUILD |
| Inventaire agents/modèles/datasets | Fort | Fort | Très fort | Très fort | Partiel | BUILD + CONNECT |
| Intake nouveau cas d’usage | Très fort | Moyen | Très fort | Très fort | Faible | BUILD |
| Classification AI Act | Très fort | Fort | Très fort | Fort | Faible | BUILD |
| ISO 42001 readiness | Très fort | Très fort | Fort | Fort | Faible | BUILD |
| Risk register IA | Très fort | Fort | Très fort | Très fort | Moyen | BUILD |
| AIIA / impact assessment | Très fort | Fort | Très fort | Très fort | Faible | BUILD |
| Registre de décisions | **Différenciant** | Moyen | Moyen | Moyen | Faible | BUILD |
| Human oversight | **Différenciant** | Moyen | Fort | Fort | Faible | BUILD |
| Gouvernance fournisseurs IA | Très fort | Fort | Très fort | Très fort | Moyen | BUILD |
| Contrôles & preuves | Fort | **Excellent** | Très fort | Très fort | Fort | BUILD socle + CONNECT |
| Evidence collection automatique | Moyen | **Excellent** | Très fort | Très fort | Fort Microsoft | CONNECT |
| Runtime AI guardrails | Faible | En progression | **Excellent** | Très fort | Fort données | DON'T BUILD |
| Détection shadow AI automatisée | Moyen | Fort | Très fort | Très fort | Fort écosystème MS | CONNECT |
| Monitoring modèles / agents | Moyen | En progression | Très fort | **Excellent** | Partiel | CONNECT |
| CMDB / ITSM | Faible | Faible | Faible | **Excellent** | Faible | DON'T BUILD |
| DLP / classification données | Faible | Moyen | Fort | Moyen | **Excellent** | CONNECT |
| Gestion audits certification | Fort | **Excellent** | Très fort | Très fort | Moyen | BUILD léger + CONNECT |
| Multi-framework control mapping | Très fort | Très fort | Très fort | Très fort | Moyen | BUILD |
| AI Governance Officer externalisé | **Très fort** | Faible | Moyen | Moyen | Faible | BUILD |
| Portefeuille multi-clients MSP/cabinet | **Très fort** | Moyen | Moyen | Faible à moyen | Faible | BUILD |
| Dashboard CODIR PME/ETI | **Très fort** | Fort | Fort | Très fort | Moyen | BUILD |
| Benchmark maturité clients | **Très fort** | Moyen | Moyen | Moyen | Faible | BUILD |
| Rapport mensuel gouvernance auto | **Très fort** | Moyen | Fort | Fort | Faible | BUILD |

### Conclusion concurrentielle
AIGMS doit éviter trois guerres perdues d’avance :
- collecte massive de preuves techniques face à Vanta ;
- runtime guardrails face à OneTrust ;
- CMDB/ITSM/AI asset discovery enterprise face à ServiceNow ;
- data security/DLP face à Microsoft Purview.

Son terrain prioritaire : **orchestration humaine + réglementaire + multi-client + gouvernance continue PME/ETI**.

---

## 4. Personas

### P1 — AI Governance Officer / Consultant
Pilote 5 à 30 organisations clientes.

### P2 — DSI / RSSI / DPO client
Suit risques, décisions, actions et preuves.

### P3 — AI System Owner / Product Owner
Déclare un usage, répond aux assessments, fournit les preuves.

### P4 — Risk Owner / Direction métier
Accepte, refuse ou conditionne un risque.

### P5 — Auditeur interne
Consulte contrôles, preuves, historique et non-conformités.

### P6 — Direction / CODIR
Consulte score, risques majeurs, décisions attendues, KPI et roadmap.

---

## 5. Modules fonctionnels

### M01 — Organizations & Tenancy — P0
- organisations
- entités / business units
- portefeuille consultant
- séparation stricte des données par tenant
- branding / co-branding futur
- statut prospect / pilote / actif / archivé

### M02 — Identity, RBAC & Accountability — P0
Rôles :
- platform_admin
- governance_officer
- client_admin
- system_owner
- risk_owner
- reviewer
- auditor
- executive_viewer

Exigences :
- RBAC tenant-aware
- journal d’accès
- séparation audit / opération lorsque requise
- délégation temporaire

### M03 — AI Asset & Use Case Register — P0
Objets :
- AI Use Case
- AI System
- Model
- Agent
- Dataset
- Vendor
- Business Process
- Deployment

Champs minimum use case :
- finalité
- owner
- métier
- utilisateurs
- personnes affectées
- données
- fournisseur
- modèles
- autonomie
- niveau de décision
- criticité
- statut lifecycle
- date prochaine revue

### M04 — Intake & Governance Workflow — P0
Workflow :
`DRAFT → TRIAGE → ASSESSMENT → REVIEW → CONDITIONAL_APPROVAL/APPROVED/REJECTED → PILOT → PRODUCTION → MONITORING → RETIRED`

Gates obligatoires :
1. complétude
2. classification
3. risques & impacts
4. fournisseur
5. sécurité / données
6. human oversight
7. décision
8. go production
9. changement significatif
10. retrait

### M05 — AI Act Classifier — P0
Sorties :
- hors périmètre / à confirmer
- pratique interdite suspectée
- high-risk potentiel
- obligations de transparence
- GPAI/provider dependency
- rôle organisation : provider / deployer / importer / distributor / other
- niveau de validation juridique requis

Principe : le moteur donne une **pré-qualification**, jamais une conclusion juridique définitive.

### M06 — Risk & Impact Management — P0
- risk register
- bibliothèque de scénarios
- probabilité / impact / exposition
- risque brut / résiduel
- owner
- plan de traitement
- acceptation
- date de revue
- AIIA
- liaison DPIA/RGPD
- droits fondamentaux
- impacts opérationnels, cyber, réputation, finance, humain

### M07 — AI Governance Decision Register — P0 différenciant
Objet `governance_decision` :
- id lisible : DEC-IA-YYYY-####
- objet de décision
- contexte
- options examinées
- décision
- conditions
- justification
- décideur
- contributeurs
- risques liés
- contrôles liés
- preuves
- référentiels
- date d’effet
- date de revue
- statut
- historique/version

Types :
- autorisation usage
- autorisation pilote
- go production
- acceptation risque
- exception politique
- changement significatif
- suspension
- retrait

### M08 — Human Oversight — P0
- supervisor
- capacité d’interruption
- niveau d’autonomie
- événements nécessitant intervention humaine
- instructions
- compétence requise
- journal des interventions
- tests de supervision

### M09 — Controls, Requirements & Mapping — P0
Objets :
- framework
- requirement
- control
- control_test
- evidence_requirement
- applicability
- mapping

Référentiels initiaux :
- ISO/IEC 42001
- EU AI Act
- ISO/IEC 27001
- RGPD
- NIS2
- CRA
- NIST AI RMF
- ISO/IEC 23894
- ISO/IEC 42005

Un contrôle peut satisfaire N exigences.

### M10 — Evidence Management — P0/P1
P0 :
- dépôt manuel
- URL externe
- preuve déclarative
- owner
- validité
- date d’expiration
- hash/version
- validation

P1 :
- connecteurs Vanta, Microsoft, GitHub, Azure, Google Workspace, SIEM, etc.
- synchronisation metadata uniquement si possible
- statut fraîcheur de preuve

### M11 — Third Party / Vendor AI Governance — P0
- vendor register
- criticité
- DPA / sécurité / localisation
- model provider
- sous-traitants
- réversibilité
- SLA
- incidents
- score fournisseur
- date de revue
- documents

### M12 — Change Management — P0
Déclencheurs :
- nouveau modèle
- version majeure
- nouveau dataset
- changement finalité
- nouvelle population
- augmentation autonomie
- changement fournisseur
- changement territoire
- modification sécurité

Tout changement significatif crée une réévaluation.

### M13 — Incidents, Issues & CAPA — P0
Sévérité S1-S4.
- incident
- non-conformité
- observation
- cause
- containment
- corrective action
- preventive action
- owner
- SLA
- preuves de clôture
- décision de remise en service

### M14 — Governance Meetings & Reviews — P1
- comité IA
- ordre du jour
- participants
- décisions
- actions
- risques escaladés
- revue direction
- export CR

### M15 — AI Governance Index — P1
8 piliers :
1. leadership
2. stratégie
3. usages IA
4. données
5. cybersécurité
6. conformité
7. compétences
8. pilotage

Score 0-100 :
- maturité, non certification
- historique par période
- comparaison intra-portefeuille anonymisée
- radar / heatmap / tendance

### M16 — Dashboards & Reporting — P1
Vue client :
- systèmes IA
- usages non évalués
- high risk
- contrôles efficaces
- preuves expirantes
- incidents
- actions échues
- décisions à prendre

Vue consultant :
- portefeuille clients
- score maturité
- risque agrégé
- clients sans revue
- charge du mois
- alertes critiques
- prochaine échéance

### M17 — Audit & Readiness — P1
- programme audit
- audit
- échantillons
- constats
- preuves
- NC
- CAPA
- readiness ISO 42001
- export dossier auditeur

### M18 — Policy & Document Register — P1
Ne pas construire un Google Docs interne.
Construire :
- registre documentaire
- version
- owner
- statut approbation
- date prochaine revue
- liens fichiers externes
- génération assistée de modèles futurs

### M19 — Integrations Hub — P1/P2
Connecteurs prioritaires :
1. Microsoft Entra / M365 / Purview
2. Azure / Azure AI
3. GitHub
4. Claude Enterprise
5. OpenAI
6. Google Workspace / GCP
7. Vanta
8. Jira / ServiceNow
9. SIEM/SOC
10. webhooks génériques

### M20 — AI Copilot interne — P2
Fonctions autorisées :
- résumer un assessment
- proposer risques
- identifier preuves manquantes
- préparer un CR
- suggérer mappings
- préparer questions

Interdictions :
- accepter un risque
- approuver un système
- déclarer une conformité
- qualifier juridiquement de manière définitive

---

## 6. Modèle de données MVP

Entités P0 :
`tenant`
`organization`
`business_unit`
`user_profile`
`membership`
`ai_use_case`
`ai_system`
`ai_model`
`ai_agent`
`dataset`
`vendor`
`use_case_asset_link`
`assessment`
`assessment_answer`
`risk`
`risk_treatment`
`impact_assessment`
`framework`
`requirement`
`control`
`control_requirement_map`
`control_applicability`
`evidence`
`control_evidence`
`governance_decision`
`decision_link`
`human_oversight_plan`
`change_request`
`incident`
`action`
`audit_log`

Règle : UUID interne + identifiant métier lisible.

---

## 7. Architecture technique recommandée pour démarrage

### Front
- Next.js App Router
- TypeScript
- Tailwind
- composants UI accessibles
- server actions/API routes selon besoin

### Back / Data
- Supabase PostgreSQL
- Supabase Auth
- Row Level Security obligatoire
- Storage pour pièces jointes
- Edge Functions si besoin
- pgvector uniquement si cas d’usage concret

### Qualité
- migrations versionnées
- seed data
- tests unitaires métier
- tests RLS
- tests E2E workflows critiques
- audit_log immutable autant que possible

### Sécurité
- tenant isolation
- least privilege
- MFA via provider disponible
- secret management
- aucune clé API client côté navigateur
- export / suppression tenant encadrés

---

## 8. BUILD / CONNECT / DON'T BUILD

### BUILD maintenant
- multi-tenant
- registre IA
- intake
- AI Act pre-classification
- risk & impact
- decisions
- human oversight
- controls & mappings
- evidence manual
- vendors
- changes
- incidents
- actions
- dashboards de base

### CONNECT ensuite
- Vanta
- Purview
- Entra ID
- GitHub
- Azure
- Claude/OpenAI admin data
- Jira/ServiceNow
- SIEM
- Google Workspace

### DON'T BUILD
- SIEM
- DLP
- CMDB généraliste
- IAM
- full ITSM
- model observability engine
- prompt firewall
- runtime guardrails
- endpoint security
- certification marketplace
- stockage documentaire bureautique complet

---

## 9. MVP — définition stricte

Le MVP est réussi si un consultant peut :

1. créer un client ;
2. inviter un owner ;
3. déclarer un cas d’usage ;
4. le classifier ;
5. produire un assessment ;
6. créer risques + AIIA ;
7. affecter des contrôles ;
8. demander des preuves ;
9. documenter human oversight ;
10. soumettre une décision ;
11. approuver sous conditions ;
12. suivre actions et échéances ;
13. produire un dashboard ;
14. exporter un dossier de gouvernance.

Le MVP n’a pas besoin de connecteurs automatiques pour être commercialement testable.

---

## 10. Backlog MVP proposé

### Sprint 0 — foundation
- repository
- architecture
- Supabase project
- environments
- auth
- tenancy
- RLS
- migrations
- CI

### Sprint 1 — organizations / users
### Sprint 2 — AI registry / intake
### Sprint 3 — classifier / assessments
### Sprint 4 — risks / impacts
### Sprint 5 — controls / mappings / evidence
### Sprint 6 — decisions / human oversight
### Sprint 7 — vendors / changes / incidents
### Sprint 8 — dashboards / exports / hardening

---

## 11. Critères d’acceptation non négociables

- aucune fuite cross-tenant ;
- chaque décision critique possède owner + justification + date ;
- chaque risque élevé possède owner + traitement ou acceptation ;
- tout changement significatif réouvre l’évaluation ;
- aucune conclusion de conformité générée automatiquement ;
- historique des changements important ;
- export exploitable par un consultant ;
- UI utilisable sans connaissance ISO approfondie ;
- champs réglementaires configurables et versionnables ;
- données démo disponibles.

---

## 12. Roadmap post-MVP

### V1
MVP commercial pilote.

### V1.5
Portefeuille consultant, rapports mensuels, AI Governance Index.

### V2
Connecteurs prioritaires + automation preuves.

### V2.5
Co-branding / MSP / templates sectoriels.

### V3
AI copilot gouvernance, benchmarks, marketplace de packs réglementaires.

---

## 13. Positionnement commercial

> **AIGMS donne à une PME/ETI et à son AI Governance Officer un registre unique pour savoir quelles IA sont utilisées, pourquoi, avec quels risques, quelles décisions, quels contrôles et quelles preuves — et pour démontrer que cette gouvernance vit réellement dans le temps.**

Tagline :
**« Gouverner l’IA. Décider. Prouver. Améliorer. »**


## 14. Règles de conception issues de la méthode V5
1. Une transition vers PRODUCTION est bloquée si les gates obligatoires ne sont pas satisfaits.
2. Les règles de gate sont exécutées côté serveur et couvertes par des tests.
3. Les dates et exigences réglementaires sont versionnées et configurables.
4. L'AIIA est réévaluable durant le cycle de vie et liée aux changements significatifs.
5. Les CAPA comportent correction, cause, action corrective, owner, échéance et test d'efficacité.
6. Les preuves possèdent source, owner, fraîcheur, validité, statut et historique.
7. CONNECT utilise des interfaces communes ; lecture seule et moindre privilège par défaut.
8. L'IA interne peut suggérer, jamais accepter un risque ou approuver une mise en production.

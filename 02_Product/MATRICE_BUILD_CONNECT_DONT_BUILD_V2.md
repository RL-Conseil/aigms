# AIGMS — Matrice BUILD / CONNECT / DON'T BUILD — V2

## BUILD — cœur différenciant
- multi-tenant consultant/MSP
- AI use case & asset registry
- intake & approval lifecycle
- AI Act pre-classification
- risks & AIIA
- governance decision register
- human oversight plans
- control library & cross-framework mapping
- manual evidence management
- vendor AI governance
- change gates
- incidents / CAPA / actions
- AI Governance Officer dashboards
- monthly governance reporting
- AI Governance Index

## CONNECT — utiliser les meilleurs outils
- Vanta : evidence/compliance automation
- Microsoft Purview : data classification, DLP, AI data risk
- ServiceNow : ITSM/CMDB/enterprise workflows
- OneTrust : enterprise runtime AI governance when present
- Azure / GitHub / GCP : technical metadata
- Claude / OpenAI administration : usage metadata when APIs allow
- SIEM/SOC : incident and security telemetry
- Jira : task/action synchronization

## DON'T BUILD — hors stratégie
- DLP engine
- endpoint security
- SIEM
- CMDB généraliste
- ITSM généraliste
- identity provider
- model observability platform
- prompt firewall
- runtime guardrails engine
- SOC tooling
- certification marketplace
- office document editor

## Règle produit
Si une fonctionnalité :
1. n’améliore pas directement la gouvernance d’un cas d’usage IA ;
2. existe déjà avec une profondeur enterprise chez un acteur spécialisé ;
3. nécessite une infrastructure de sécurité/observabilité lourde ;
alors privilégier CONNECT.


## Critères de décision BUILD vs CONNECT
Noter chaque capacité sur 1 à 5 : différenciation AIGMS, criticité gouvernance, maturité du marché, coût de construction, dette sécurité, besoin d'accès runtime, valeur multi-client.

### BUILD si
- la capacité matérialise une décision, responsabilité ou preuve de gouvernance ;
- elle est centrale pour DISCOVERY/BUILD/OPERATE ;
- elle différencie l'AI Governance Officer multi-client.

### CONNECT si
- la donnée existe déjà dans un outil spécialisé ;
- la profondeur technique serait coûteuse ou risquée à reproduire ;
- AIGMS n'a besoin que de métadonnées, statut ou preuve.

### DON'T BUILD si
- la fonction relève du SIEM, DLP, IAM, CMDB, ITSM, observabilité modèle ou guardrails runtime généralistes ;
- la valeur produit est faible par rapport à la dette sécurité/exploitation.

## Contrat d'intégration AIGMS
Tout connecteur doit déclarer : source, capabilities, auth, scopes, source of truth, objets importés, fréquence, fraîcheur, erreurs, audit, réversibilité, ownership et règles de rétention.

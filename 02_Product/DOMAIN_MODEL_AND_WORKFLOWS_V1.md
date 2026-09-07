# AIGMS — Domain Model & Workflows V1
Version 1.0 — 7 septembre 2026

## 1. But
Traduire la méthode V5 en objets métier, états et règles serveur. Ce document est prescriptif pour le MVP.

## 2. Agrégats
### Tenant & Accountability
`tenant`, `organization`, `business_unit`, `user_profile`, `membership`, `role_assignment`.

### AI Portfolio
`ai_use_case`, `ai_system`, `ai_model`, `ai_agent`, `dataset`, `vendor`, `deployment`, `asset_link`.

### Assessment
`assessment`, `assessment_answer`, `regulatory_classification`, `risk`, `risk_treatment`, `impact_assessment`, `impact_stakeholder`, `impact_finding`.

### Governance
`human_oversight_plan`, `governance_decision`, `decision_link`, `change_request`, `reassessment`, `incident`, `capa`, `action`.

### Assurance
`framework`, `requirement`, `control`, `control_requirement_map`, `control_applicability`, `evidence`, `control_evidence`, `audit`, `audit_finding`, `management_review`, `objective`, `kpi`, `improvement`.

## 3. Workflow AI Use Case
`DRAFT -> TRIAGE -> ASSESSMENT -> REVIEW -> APPROVED | CONDITIONAL_APPROVAL | REJECTED -> PILOT -> PRODUCTION -> MONITORING -> RETIRED`

### Gate PRODUCTION minimum
- classification complète ;
- risque : aucun risque critique sans traitement/acceptation ;
- impact assessment requis terminé ;
- vendor review si tiers ;
- human oversight approuvé ou N/A justifié ;
- contrôles obligatoires affectés ;
- décision GO Production approuvée ;
- actions bloquantes closes.

## 4. Workflow Change
`DRAFT -> IMPACT_SCREENING -> NO_REASSESSMENT | PARTIAL_REASSESSMENT | FULL_REASSESSMENT -> REVIEW -> APPROVED -> IMPLEMENTED -> VERIFIED`

Types : MODEL, DATASET, PURPOSE, VENDOR, AUTONOMY, POPULATION, TERRITORY, SECURITY, DEPLOYMENT.

## 5. Workflow Incident / CAPA
`OPEN -> CONTAINED -> INVESTIGATING -> ACTION_PLAN -> EFFECTIVENESS_REVIEW -> CLOSED`

CAPA obligatoire pour incident significatif, non-conformité majeure ou récurrence.

## 6. Decision Register
Types : pilot approval, go production, risk acceptance, policy exception, significant change, suspension, retirement.
Toute décision a : scope, options, rationale, conditions, approver, contributors, linked risks/controls/evidence, effective date, review date, version.

## 7. Human Oversight
Niveaux : L0 advisory ; L1 propose ; L2 execute after approval ; L3 execute within limits ; L4 highly autonomous.
Le plan contient : accountable human, competence, monitoring cadence, intervention triggers, override, stop authority, expected evidence.

## 8. Business Rules non négociables
- aucune transition critique uniquement côté client ;
- aucune approbation par IA ;
- aucune fuite cross-tenant ;
- toute modification sensible journalisée ;
- toute preuve a un owner et un freshness status ;
- toute acceptation de risque a un responsable humain et une date de revue ;
- changement significatif => réévaluation documentée ;
- suppression logique ou politique d'archivage pour les traces d'audit.

## 9. Event model conseillé
Evénements : `UseCaseSubmitted`, `AssessmentCompleted`, `RiskAccepted`, `DecisionApproved`, `EvidenceExpired`, `SignificantChangeDetected`, `IncidentOpened`, `CAPAClosed`, `ReviewDue`.
Le MVP peut les implémenter comme événements applicatifs persistés sans infrastructure event-bus complexe.

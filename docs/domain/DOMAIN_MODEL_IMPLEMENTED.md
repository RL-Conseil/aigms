# AIGMS — Modèle de domaine implémenté

Version 1.0 — 7 septembre 2026

Ce document décrit ce qui **existe en base**, par opposition au modèle cible de
`02_Product/DOMAIN_MODEL_AND_WORKFLOWS_V1.md`.

## 1. Agrégats livrés

### Tenancy & Accountability
`tenant`, `organization`, `business_unit`, `user_profile`, `membership`,
`role_assignment`.

### AI Portfolio
`vendor`, `ai_asset` (discriminée par `kind` : `ai_system`, `ai_model`,
`ai_agent`, `dataset` — voir ADR-0005), `ai_use_case`, `use_case_asset_link`,
`use_case_vendor_link`.

### Assessment
`assessment`, `assessment_answer`, `regulatory_classification`, `risk`,
`risk_treatment`, `impact_assessment`, `impact_stakeholder`, `impact_finding`.

### Governance
`human_oversight_plan`, `governance_decision`, `decision_link`,
`change_request`, `reassessment`, `incident`, `capa`, `action`.

### Assurance
`framework`, `requirement`, `control`, `control_requirement_map`,
`control_applicability`, `evidence`, `control_evidence`.

### CONNECT
`governance_connector`, `connector_sync_run`.

Le contrat d'intégration exigé par la matrice BUILD/CONNECT : source, capacités,
authentification, portées, objets importés, fréquence, fraîcheur, erreurs,
propriétaire et rétention. **Aucun secret n'y figure** : la table porte le nom de
la variable d'environnement qui le détient, et un trigger refuse toute valeur
ayant l'apparence d'un jeton ([ADR-0009](../adr/ADR-0009-connector-secrets.md)).

### Catalogue de contrôles
`catalog_framework`, `catalog_version`, `catalog_domain`, `catalog_control`,
`catalog_profile`, `catalog_reference_use_case`, `catalog_import_job`,
`catalog_import_error`.

Bibliothèque de contrôles-types importée depuis un paquet versionné, à ne pas
confondre avec `framework` / `requirement`, qui portent les référentiels
**normatifs** externes. Un `control` instancié chez un client peut référencer
son contrôle-type par `catalog_control_id`.

Flux d'import : `UPLOADED → VALIDATED → REVIEWED → IMPORTED → PUBLISHED`, ou
`UPLOADED → REJECTED`. La validation consigne chaque constat plutôt que
d'échouer au premier ; l'import est transactionnel ; une baseline publiée est
gelée par trigger, et se réimporter lui est refusé.

### Traçabilité
`audit_log`, `governance_event`.

**Non livré à ce stade** : `audit`, `audit_finding`, `management_review`,
`objective`, `kpi`, `improvement` (Sprint 14), `deployment`.

## 2. Identifiants

Chaque objet porte un UUID interne et une référence métier lisible, produite par
`app.next_business_ref(tenant, prefixe)` : compteur par tenant, préfixe et année.

| Objet | Préfixe | Exemple |
|---|---|---|
| organisation | `ORG` | `ORG-2026-0001` |
| cas d'usage | `UC` | `UC-2026-0001` |
| décision | `DEC-IA` | `DEC-IA-2026-0001` |
| risque | `RSK` | `RSK-2026-0003` |
| AIIA | `AIIA` | `AIIA-2026-0001` |
| contrôle | `CTL` | `CTL-2026-0004` |
| preuve | `EVD` | `EVD-2026-0002` |
| changement | `CHG` | `CHG-2026-0001` |
| incident | `INC` | `INC-2026-0001` |

## 3. Cycle de vie du cas d'usage

```
DRAFT ─► TRIAGE ─► ASSESSMENT ─► REVIEW ─┬─► APPROVED ─────┬─► PILOT ─► PRODUCTION ─► MONITORING
                                          ├─► CONDITIONAL_APPROVAL ─► PILOT
                                          └─► REJECTED ─► DRAFT
                                                              tout statut ─► RETIRED
```

`app.allowed_use_case_transitions` fait autorité. `app.transition_use_case` est
**l'unique point d'écriture du statut** : un trigger refuse tout `UPDATE` direct.
La table `UI_TRANSITIONS` du front est un simple miroir d'affichage, verrouillé
par un test de parité.

### Gates amont

| Vers | Précondition |
|---|---|
| `TRIAGE` | finalité renseignée, owner et responsable redevable désignés |
| `ASSESSMENT` | criticité déterminée |
| `REVIEW` | classification courante présente **et** au moins un risque identifié |
| `APPROVED` / `CONDITIONAL_APPROVAL` | décision d'autorisation approuvée |
| `PILOT` | décision d'autorisation de pilote approuvée |
| `RETIRED` | décision de retrait ou de suspension approuvée |

### Gate PRODUCTION — huit préconditions

| Code | Contrôle |
|---|---|
| `CLASSIFICATION_COMPLETE` | classification exploitable : rôle déterminé, ni « à confirmer » ni « pratique interdite suspectée », revue juridique close si requise |
| `RISKS_TREATED` | aucun risque élevé ou critique sans traitement effectif ni acceptation |
| `IMPACT_ASSESSMENT` | AIIA terminé lorsqu'il est requis |
| `VENDOR_REVIEW` | revue close pour chaque tiers rattaché |
| `HUMAN_OVERSIGHT` | plan approuvé, ou non applicable et justifié |
| `MANDATORY_CONTROLS` | applicabilité statuée pour tous les contrôles obligatoires |
| `PRODUCTION_DECISION` | décision GO production approuvée et en vigueur |
| `BLOCKING_ACTIONS` | aucune action bloquante ouverte |

Un gate refusé retourne le détail de **chacune** des huit préconditions, y
compris celles qui passent : une autorisation doit être justifiable, pas
seulement un refus.

### Quand l'AIIA est-il requis ?

`app.impact_assessment_required` répond oui si l'une de ces conditions tient :
données personnelles, personnes vulnérables, autonomie L3 ou L4, criticité haute
ou critique, drapeau `high_risk_potential` ou `privacy_impact`.

## 4. Moteur de réévaluation

`app.evaluate_governance_impact(change)` retourne un verdict, son périmètre et
ses motifs.

| Déclencheur | Verdict | Périmètre rouvert |
|---|---|---|
| changement de finalité | `FULL` | classification, risques, AIIA, supervision, contrôles |
| nouvelle population affectée | `FULL` | classification, AIIA, risques |
| autonomie accrue | `FULL` | supervision, risques, AIIA |
| périmètre de données personnelles modifié | `FULL` | AIIA, classification, risques |
| changement de modèle | `PARTIAL` | risques, contrôles |
| changement de jeu de données | `PARTIAL` | risques, AIIA |
| changement de fournisseur | `PARTIAL` | fournisseur, risques, contrôles |
| nouveau territoire | `PARTIAL` | classification, contrôles |
| changement touchant la sécurité | `PARTIAL` | risques, contrôles |

**Facteur aggravant** : sur un cas d'usage marqué `high_risk_potential`, tout
déclencheur partiel est relevé en réévaluation complète.

`app.screen_change_request` enregistre le verdict et **rouvre effectivement** les
évaluations concernées (`status = 'reopened'`). Le verdict du moteur est une
recommandation : `reassessment.final_verdict` porte la décision humaine, et
s'en écarter exige une justification (contrainte
`reassessment_override_is_justified`).

## 5. Règles métier gravées dans le schéma

| Contrainte | Effet |
|---|---|
| `risk_acceptance_requires_human` | acceptation impossible sans approbateur, justification et date de revue |
| `decision_approval_requires_human` | approbation impossible sans approbateur, justification, énoncé et date d'effet |
| `decision_conditional_requires_conditions` | une approbation sous conditions énonce ses conditions |
| `decision_review_date_required` | GO production, acceptation de risque et exception portent une date de revue |
| `app.guard_decision_approval` | l'auteur d'une décision engageante ne peut pas l'approuver (INSERT et UPDATE) |
| `oversight_approved_is_complete` | un plan approuvé nomme un responsable, des déclencheurs, une autorité d'arrêt |
| `oversight_high_autonomy_needs_stop_authority` | au-delà de L2, autorité d'arrêt nominative obligatoire |
| `impact_finding_severe_requires_mitigation` | un constat défavorable significatif ou grave porte une mesure de réduction |
| `control_na_requires_justification` | pas d'exclusion de contrôle silencieuse |
| `capa_closure_requires_effectiveness` | pas de clôture de CAPA sans test d'efficacité vérifié |
| `app.guard_incident_closure` | incident S1/S2, non-conformité ou récurrence : CAPA close obligatoire |
| `app.guard_use_case_status` | le statut ne se modifie que par la fonction de transition |
| `app.guard_platform_admin_flag` | le privilège plateforme ne s'auto-attribue pas |
| `app.reject_audit_mutation` | journal d'audit append-only |

## 6. Événements persistés

`UseCaseSubmitted`, `ProductionGatePassed`, `ProductionGateBlocked`,
`SignificantChangeDetected`, `ReassessmentTriggered`, `IncidentOpened`,
`CAPAClosed`. Émis par `app.emit_event`, qui refuse toute émission hors du
périmètre tenant de l'appelant.

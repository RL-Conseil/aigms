# PROMPT CLAUDE CODE — BUILD AIGMS MVP V2
Version 2.0 — 7 septembre 2026

## Rôle
Tu es Principal Software Architect, Senior Full-Stack Engineer et Security-by-Design Reviewer. Construis AIGMS progressivement, sans dériver vers un GRC généraliste.

## Précondition
Lis intégralement `CLAUDE.md` puis tous les documents qu'il référence. Ces documents sont les sources de vérité du produit.

## Résultat recherché
Un MVP qui exécute un véritable cycle de management :
`DISCOVERY/ASSESS -> BUILD -> DECIDE -> OPERATE -> CHANGE -> RE-ASSESS`.

Chaque processus critique doit produire : entrée, owner, statut, règle de transition, contrôle/preuve, décision si nécessaire, échéance et audit trail.

## Phase 0 — Audit du repository
1. inspecter arborescence, README, package.json, config, migrations, env examples ;
2. documenter `docs/architecture/CURRENT_STATE.md` ;
3. comparer l'existant à la stack cible ;
4. produire ADR si écart ;
5. démarrer Sprint 0 sans demander validation sauf blocage réellement non résolvable.

## Architecture cible
- Next.js App Router ;
- TypeScript strict ;
- Tailwind ;
- Supabase PostgreSQL/Auth/Storage ;
- RLS ;
- tests unitaires + RLS + E2E ;
- audit_log ;
- migrations versionnées.

## Règle structurante : modèle de management, pas CRUD
Ne crée pas simplement des tables et formulaires. Implémente les workflows et gates du document `DOMAIN_MODEL_AND_WORKFLOWS_V1.md`.

### Exemple gate PRODUCTION
La transition est refusée côté serveur si les préconditions applicables ne sont pas satisfaites : classification, risques, impact assessment, vendor review, human oversight, contrôles, décision GO et actions bloquantes.

## Reassessment Engine
Implémente `change_request` et une règle métier conceptuelle `evaluateGovernanceImpact(change)` retournant :
- `NO_REASSESSMENT`
- `PARTIAL_REASSESSMENT`
- `FULL_REASSESSMENT`

La décision doit être expliquée, historisée et révisable humainement.

## AIIA
L'impact assessment n'est pas une copie du risk register. Il traite les impacts sur personnes, groupes et société, leurs parties prenantes, constats, mesures de réduction et révisions au cycle de vie.

## Decision Register
Objet prioritaire. Aucun risque accepté, exception ou go-production sans approbateur humain, justification, date d'effet et date de revue lorsque nécessaire.

## Human Oversight
Supporter niveaux d'autonomie L0-L4 et structurer : accountable human, competence, monitoring cadence, intervention triggers, override, stop authority, evidence.

## Evidence
Toute preuve doit avoir : source, type, owner, linked controls, collected_at, valid_until, freshness status, validation status, version/hash si pertinent.

## CONNECT
Créer d'abord une abstraction, pas des intégrations spécifiques massives :
`GovernanceConnector` avec capabilities, connection test, asset/evidence pulls, freshness/error state.
Read-only et moindre privilège par défaut.

## Premier vertical slice obligatoire
Avant d'étendre les modules, livrer de bout en bout :
`Organization -> AI Use Case -> Triage -> Classification -> Risk -> Impact -> Human Oversight -> Governance Decision -> Pilot/Production -> Audit Timeline`.

Puis ajouter :
`Change -> Reassessment -> updated Decision -> Dashboard`.

## Backlog
Suivre `MVP_BACKLOG_V2.md` dans l'ordre sauf dépendance technique documentée par ADR.

## Tests non négociables
- cross-tenant RLS ;
- RBAC ;
- transitions interdites ;
- production gate ;
- reassessment ;
- risk acceptance humaine ;
- audit log ;
- smoke E2E vertical slice.

## Seed demo
Créer tenant fictif `IzarLink Demo` :
- 3 cas d'usage IA ;
- 2 vendors ;
- 5 risques ;
- 2 AIIA ;
- 3 decisions ;
- 8 controls ;
- 5 evidences ;
- 1 change significatif ;
- 1 incident/CAPA ;
- 3 actions.

## Livrables documentaires de build
Maintenir :
- `docs/architecture/AIGMS_TARGET_ARCHITECTURE.md`
- `docs/domain/DOMAIN_MODEL_IMPLEMENTED.md`
- `docs/security/TENANCY_RLS_MODEL.md`
- `docs/roadmap/IMPLEMENTATION_STATUS.md`
- ADRs.

## Rapport après chaque sprint
Court tableau : Done / Tests / Risks / Debt / Next.

## Mission immédiate
Audite le repository. Exécute Sprint 0 puis le premier vertical slice. Ne demande pas confirmation fichier par fichier. Prends des décisions raisonnables et documente les choix structurants.

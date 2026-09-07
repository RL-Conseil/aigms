# CLAUDE.md — AIGMS Master Instructions
Version 1.0 — 7 septembre 2026

## Mission
Construire AIGMS comme **AI Governance System of Record + Operating System de l'AI Governance Officer**, pour PME/ETI et partenaires multi-clients.

## Ordre de lecture obligatoire
1. `04_References/REFERENCES_ET_TRACABILITE_V1.md`
2. `01_Methodology/01_DISCOVERY_ASSESS_V5.md`
3. `01_Methodology/02_BUILD_CONNECT_V5.md`
4. `01_Methodology/03_OPERATE_V5.md`
5. `02_Product/AIGMS_REFERENTIEL_FONCTIONNEL_V4.md`
6. `02_Product/MATRICE_BUILD_CONNECT_DONT_BUILD_V2.md`
7. `02_Product/DOMAIN_MODEL_AND_WORKFLOWS_V1.md`
8. `02_Product/MVP_BACKLOG_V2.md`
9. `02_Product/PROMPT_CLAUDE_CODE_BUILD_AIGMS_MVP_V2.md`

## Hiérarchie en cas de conflit
1. sécurité et isolation tenant ;
2. règles de gouvernance de la méthodologie ;
3. règles métier/domain model ;
4. périmètre fonctionnel ;
5. backlog ;
6. convenance d'implémentation.

## Principes produit
- Use-case first.
- Decision centric.
- Risk & impact based.
- Evidence driven.
- Human accountable.
- Multi-framework.
- Multi-tenant native.
- Connect rather than rebuild.
- Auditability by design.
- PME/ETI pragmatique.

## Principes d'implémentation
- Next.js App Router + TypeScript strict + Tailwind.
- Supabase PostgreSQL/Auth/Storage.
- RLS obligatoire et testée.
- migrations versionnées.
- règles de gate côté serveur.
- validation server-side.
- audit log des opérations sensibles.
- aucun secret client dans le navigateur.
- référentiels réglementaires configurables/versionnés.

## Interdictions
Ne pas :
- construire SIEM, DLP, IAM, CMDB, ITSM, runtime guardrails, model observability généralistes ;
- copier intégralement du contenu normatif protégé ;
- coder des dates AI Act en dur dans les composants ;
- faire approuver automatiquement un risque ou une mise en production par IA ;
- affirmer certification ou conformité garantie.

## Méthode de travail
Pour chaque sprint : inspecter -> décomposer -> coder verticalement -> tester -> documenter -> ADR si décision structurante -> bilan.
Ne pas créer dix écrans CRUD avant qu'un workflow critique fonctionne de bout en bout.

## Definition of Done
Migration + RLS + types + validation serveur + UI + tests + audit log si sensible + documentation.

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

## Flux de travail Git et déploiement

Règle posée par le propriétaire du dépôt le 7 septembre 2026. Elle prévaut sur
toute habitude de travail contraire.

### Branches

| Branche | Rôle | Qui pousse |
|---|---|---|
| `main` | production — déployée sur `www.aigms.eu` (l'apex `aigms.eu` y redirige) | **le propriétaire seul** |
| `dev` | intégration, copie de `main`, Preview permanente | Claude Code |
| `feat/<sujet>` | une branche par demande, créée depuis `dev` | Claude Code |

**Ne jamais pousser sur `main`.** La mise en production relève du seul
propriétaire, après validation sur une Preview. Cela vaut aussi pour un
correctif d'apparence anodine.

### Cycle pour chaque nouvelle demande

1. Partir de `dev` à jour : `git switch dev && git pull`.
2. Créer `feat/<sujet>` — un sujet, une branche.
3. Développer, puis **corriger en local** : `npm run typecheck`, `npm run lint`,
   `npm run test`. Ces vérifications sont rapides et n'ouvrent aucun navigateur.
4. Committer et **toujours pousser la branche de feature** :
   `git push -u origin feat/<sujet>`.
5. **Proposer systématiquement le déploiement en Preview** :
   `npm run deploy:preview`, puis transmettre l'URL.
6. Attendre la validation. Le propriétaire décide seul de la promotion vers
   `main`.

### Ne pas faire tourner l'application en local

Le poste de développement est lent : `npm run dev`, `npm run start` et les
tests Playwright ne doivent pas être lancés pour donner à voir un résultat. La
visualisation se fait **sur la Preview Vercel**, jamais sur `localhost`.

Restent en local, parce qu'ils sont rapides et sans interface : la vérification
des types, le lint, les tests unitaires, les tests RLS et les migrations sur la
stack Supabase locale.

### Déploiement

`npm run deploy:preview` depuis la branche courante. Le script pose un alias
stable par branche (`aigms-<branche>.vercel.app`), attend la fin du build et
n'annonce l'URL qu'une fois le déploiement prêt.

`npm run deploy:prod` refuse de s'exécuter depuis une branche autre que `main`.

## Definition of Done
Migration + RLS + types + validation serveur + UI + tests + audit log si sensible + documentation.

# AIGMS — État d'avancement

Version 1.0 — 7 septembre 2026

## Sprints du backlog

| Sprint | Périmètre | État |
|---|---|---|
| 0 — Foundation | dépôt, environnements, CI, Supabase, migrations, Auth, tenancy, RLS, audit_log, ADR | **Terminé** |
| 1 — Organization / Context / Roles | organisations, entités, rôles, parties prenantes | **Terminé** (côté données et lecture) |
| 2 — AI Registry + Intake | cas d'usage, systèmes, modèles, agents, datasets, fournisseurs, cycle de vie | **Terminé** (données et lecture ; formulaire d'intake à venir) |
| 3 — Triage + pré-classification | criticité, rôle réglementaire, drapeaux, revue juridique | **Terminé** (données et gates) |
| 4 — Risk Management | scénarios, cotation, traitement, acceptation, revue | **Terminé** |
| 5 — AI Impact Assessment | parties prenantes, constats, mesures, revue | **Terminé** |
| 6 — Human Oversight | autonomie, responsable, déclencheurs, autorité d'arrêt | **Terminé** |
| 7 — Controls / Requirements / Mapping | référentiels, exigences, contrôles, mapping N:N, applicabilité | **Terminé** |
| 8 — Evidence | dépôt, propriétaire, fraîcheur, validation, rattachement | **Partiel** — le stockage de fichiers Supabase Storage n'est pas câblé |
| 9 — Decision Register + gates | décisions, conditions, liens, contrôles serveur de transition | **Terminé** |
| 10 — Vendor Governance | criticité, contrats, sécurité, réversibilité, revue | **Terminé** (côté données) |
| 11 — Change + Reassessment Engine | demande, screening, verdict, réouverture | **Terminé** |
| 12 — Incident / CAPA | incident, confinement, cause, CAPA, efficacité | **Terminé** (côté données) |
| 13 — OPERATE Dashboard | revues dues, risques, décisions, preuves, actions, incidents | **Terminé** |
| 14 — Audit / Management Review | constats, revue de direction, export | **Non commencé** |
| 15 — Connector Framework | contrat abstrait, lecture seule, fraîcheur | **Non commencé** |

## Vertical slice — critère du prompt de build

`Organization → AI Use Case → Triage → Classification → Risk → Impact →
Human Oversight → Governance Decision → Pilot/Production → Audit Timeline`
puis `Change → Reassessment → updated Decision → Dashboard`.

**Livré et vérifié de bout en bout.** Le jeu de démonstration rejoue ce parcours
par les fonctions de transition réelles : si un gate régresse, le seed échoue.

## Tests

| Suite | Nombre | Couvre |
|---|---|---|
| `tests/unit` | 5 | libellés et présentation du domaine |
| `tests/rls` | 40 | isolation cross-tenant, RBAC, transitions interdites, gate production, acceptation de risque, registre de décisions, moteur de réévaluation, journal d'audit, parité interface/base |
| `tests/e2e` | 4 | connexion, parcours complet, refus de gate motivé, tableau de bord |

Tous verts au 7 septembre 2026.

## Provisionnement

| Ressource | État |
|---|---|
| Dépôt GitHub `RL-Conseil/aigms` | privé, existant |
| Supabase local (Docker) | opérationnel, 15 migrations appliquées |
| Supabase distant `xsagbzrgoljzgorwvsir` | **non provisionné** — voir `docs/architecture/CURRENT_STATE.md` §5 |
| Vercel | **non provisionné** |
| CI GitHub Actions | écrite ; nécessite le scope `workflow` sur le jeton `gh` |

## Suite immédiate

1. Habiliter le jeton GitHub (`gh auth refresh -s workflow`) et pousser la CI.
2. Lier le projet Supabase distant et appliquer les 15 migrations.
3. Créer le projet Vercel et y reporter les variables d'environnement.
4. Sprint 8 complet : dépôt de fichiers via Supabase Storage.
5. Formulaires d'écriture : intake, risque, décision, changement.
6. Sprint 14 puis 15.

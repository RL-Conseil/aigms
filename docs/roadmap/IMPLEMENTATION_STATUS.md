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
| `tests/rls` | 49 | isolation cross-tenant, RBAC, transitions interdites, gate production, acceptation de risque, registre de décisions, moteur de réévaluation, journal d'audit, parité interface/base, surface publique |
| `tests/e2e` | 8 | site public et formulaire de contact ; connexion, parcours complet, refus de gate motivé, tableau de bord |

Tous verts au 7 septembre 2026.

## Provisionnement

| Ressource | État |
|---|---|
| Dépôt GitHub `RL-Conseil/aigms` | privé, existant |
| Supabase local (Docker) | opérationnel, 15 migrations appliquées |
| Supabase distant `aigms-supabase` (`xsagbzrgoljzgorwvsir`, eu-west-1) | **provisionné** : 15 migrations appliquées, jeu de démonstration chargé, étanchéité vérifiée par l'API |
| Vercel | **provisionné** : projet `aigms` (équipe `rlabradors-projects`), variables d'environnement posées, production en ligne sur `aigms.vercel.app` derrière la protection SSO d'équipe |
| Notification des demandes de contact | **fonctionnelle, en mode test** : clé Resend chiffrée dans les variables Vercel. Le domaine d'envoi n'étant pas vérifié, l'expéditeur est imposé à `onboarding@resend.dev` et le seul destinataire accepté est l'adresse propriétaire du compte Resend. Voir ci-dessous |
| CI GitHub Actions | écrite ; le push nécessite le scope `workflow` sur le jeton `gh` |

## Vérification du projet distant

Effectuée par appels API le 7 septembre 2026 :

| Contrôle | Résultat |
|---|---|
| Lecture anonyme de `tenant` et `ai_use_case` | refusée (42501) |
| Écriture anonyme de `tenant` | refusée (42501) |
| `app.log_audit` atteignable depuis l'API publique | non — le schéma `app` n'est pas exposé |
| Connexion `officer@rl-conseil.demo` puis lecture | 3 cas d'usage de son tenant |
| `evaluate_gate` sur `UC-2026-0001` | 8/8 préconditions satisfaites |
| Lecture par l'officer du second tenant | tableau vide |

## Structure des routes

| Route | Accès |
|---|---|
| `/` | publique — page de présentation |
| `/contact` | publique — formulaire de rappel |
| `/login` | publique — identifiant et mot de passe, sans récupération |
| `/admin` | session requise — portefeuille |
| `/admin/pilotage` | session requise — tableau de bord OPERATE |
| `/admin/organizations/[id]`, `/admin/use-cases/[id]` | session requise |
| `/admin/contacts` | session requise, lecture réservée à l'administration plateforme |

`src/proxy.ts` ne protège que le préfixe `/admin` ; l'autorisation réelle reste
portée par la RLS.

## Notification des demandes de contact

La chaîne fonctionne de bout en bout — formulaire, enregistrement en base,
appel Resend — mais le compte Resend est en **mode test** : tant qu'aucun
domaine n'y est vérifié, il refuse tout expéditeur autre que
`onboarding@resend.dev` et tout destinataire autre que l'adresse propriétaire
du compte.

Pour notifier `contact@iparenea.fr` :

1. Ajouter `iparenea.fr` sur https://resend.com/domains et poser les
   enregistrements DNS demandés (SPF, DKIM).
2. Une fois le domaine vérifié, changer deux variables Vercel :
   `CONTACT_NOTIFICATION_FROM` vers une adresse de ce domaine (par exemple
   `AIGMS <aigms@iparenea.fr>`) et `CONTACT_NOTIFICATION_EMAIL` vers
   `contact@iparenea.fr`.
3. Redéployer.

Aucune modification de code n'est nécessaire : ces deux valeurs sont des
variables d'environnement. Et dans tous les cas, l'enregistrement en base ne
dépend pas de la notification — une demande reste consultable dans
`/admin/contacts` même si l'envoi échoue.

## Deux liens à rétablir

1. **CI** — le jeton GitHub `rlabrador` n'a pas le scope `workflow` : le commit
   contenant `.github/workflows/ci.yml` attend en local.
   `gh auth refresh -h github.com -u rlabrador -s workflow` puis `git push`.
2. **Vercel ↔ GitHub** — le projet Vercel est lié à `rlabrador/aigms`, un dépôt
   vide, alors que le code vit dans `RL-Conseil/aigms`. L'App GitHub de Vercel
   n'ayant pas accès à cette organisation, le lien ne peut pas être posé par
   API. Installer l'App (https://github.com/apps/vercel) sur `RL-Conseil`, puis
   relier le projet : les déploiements redeviendront automatiques à chaque push.
   D'ici là, ils se font par appel API depuis le poste de développement.

## Suite immédiate

1. Sprint 8 complet : dépôt de fichiers via Supabase Storage.
2. Formulaires d'écriture : intake, risque, décision, changement.
3. Sprint 14 puis 15.

## Point de vigilance

Le jeu de démonstration est chargé sur le projet distant avec des comptes dont
le mot de passe est connu de tous (`Demo!Passw0rd`). Ces comptes ne portent que des
données fictives, mais le projet ne doit pas être promu en production sans les
supprimer ou en changer les mots de passe.

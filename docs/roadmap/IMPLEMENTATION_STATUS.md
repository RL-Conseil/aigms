# AIGMS — État d'avancement

Version 1.0 — 7 septembre 2026

## Sprints du backlog

| Sprint | Périmètre | État |
|---|---|---|
| 0 — Foundation | dépôt, environnements, CI, Supabase, migrations, Auth, tenancy, RLS, audit_log, ADR | **Terminé** |
| 1 — Organization / Context / Roles | organisations, entités, rôles, parties prenantes | **Terminé** : création d'organisation, déclaration de comptes et attribution de rôles depuis l'application, réservées à l'administration ([ADR-0008](../adr/ADR-0008-account-provisioning.md)) |
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
| 15 — Connector Framework | contrat abstrait, lecture seule, fraîcheur | **Partiel** : `governance_connector` porte le contrat d'intégration — source, capacités, habilitations, fréquence, fraîcheur, erreurs — et l'écran d'administration le configure. Aucune intégration réelle n'est encore branchée ([ADR-0009](../adr/ADR-0009-connector-secrets.md)) |
| — Référentiels de contrôles | import, validation, publication d'une bibliothèque de contrôles-types | **Terminé** : flux complet de `IMPORT_SPEC.md`, éprouvé sur le paquet AIGMS Control Framework v0.1 — 12 domaines, 120 contrôles |

## Vertical slice — critère du prompt de build

`Organization → AI Use Case → Triage → Classification → Risk → Impact →
Human Oversight → Governance Decision → Pilot/Production → Audit Timeline`
puis `Change → Reassessment → updated Decision → Dashboard`.

**Livré et vérifié de bout en bout.** Le jeu de démonstration rejoue ce parcours
par les fonctions de transition réelles : si un gate régresse, le seed échoue.

## Tests

| Suite | Nombre | Couvre |
|---|---|---|
| `tests/unit` | 12 | libellés et présentation du domaine |
| `tests/rls` | 75 | isolation cross-tenant, RBAC, transitions interdites, gate production, acceptation de risque, registre de décisions, moteur de réévaluation, journal d'audit, parité interface/base, surface publique |
| `tests/e2e` | 23 | site public et formulaire de contact ; connexion, parcours complet, refus de gate motivé, tableau de bord |

Tous verts au 7 septembre 2026.

## Provisionnement

| Ressource | État |
|---|---|
| Dépôt GitHub `RL-Conseil/aigms` | privé, existant |
| Supabase local (Docker) | opérationnel, 15 migrations appliquées |
| Supabase `aigms-supabase` (`xsagbzrgoljzgorwvsir`, eu-west-1) | **production** : 16 migrations appliquées. Porte encore le jeu de démonstration, à purger une fois un compte réel créé |
| Supabase `aigms-supabase-preprod` (`xahqdxwmlewyjpsiuzux`, eu-west-1) | **preprod** : 16 migrations et jeu de démonstration, étanchéité et gates vérifiés par appels API. Sert les déploiements Preview |
| Vercel | **provisionné** : projet `aigms` (équipe `rlabradors-projects`), variables d'environnement posées, production en ligne sur `aigms.vercel.app` derrière la protection SSO d'équipe |
| Notification des demandes de contact | **fonctionnelle** : clé Resend chiffrée dans les variables Vercel, envoi depuis `contact@iparenea.fr` sur domaine vérifié, notification vers la même adresse |
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

## Environnements

| Environnement | Base | Variables Vercel |
|---|---|---|
| Production (`aigms.vercel.app`, branche `main`) | `aigms-supabase` | cible `production` |
| Preview (une par branche) | `aigms-supabase-preprod` | cibles `preview` et `development` |
| Poste de développement | stack Supabase locale (Docker) | `.env.local` |

Le poste de développement reste sur la stack Docker : les tests d'isolation
exigent une connexion Postgres directe et rejouent `db reset` à volonté, ce
qu'on ne fait pas sur une base partagée. Les migrations remontent donc dans
l'ordre local → preprod → production, chacune par `supabase db push`.

Deux jetons Supabase cohabitent, un par projet : celui qui couvre
`aigms-supabase` ne voit pas preprod, et inversement.

## Structure des routes

| Route | Accès |
|---|---|
| `/` | publique — page de présentation |
| `/contact` | publique — formulaire de rappel |
| `/login` | publique — identifiant et mot de passe, sans récupération |
| `/admin` | session requise — organisations |
| `/admin/pilotage` | session requise — tableau de bord OPERATE |
| `/admin/organizations/[id]`, `/admin/use-cases/[id]` | session requise |
| `/admin/contacts` | session requise, réservée à l'administration plateforme |
| `/admin/connecteurs` | session requise, réservée à l'administration plateforme |
| `/admin/referentiels` | session requise, réservée à l'administration plateforme |
| `/admin/comptes` | session requise, réservée à l'administration plateforme — comptes et rôles |
| `/admin/organisations/nouvelle` | session requise, réservée à l'administration plateforme |
| `/admin/parametres` | session requise — profil, rôle, organisation |
| `/admin/organizations/[id]/declaration-applicabilite` | session requise — couverture ISO/IEC 42001 exigence par exigence |

`src/proxy.ts` ne protège que le préfixe `/admin` ; l'autorisation réelle reste
portée par la RLS.

## Notification des demandes de contact

Chaîne vérifiée de bout en bout : formulaire, enregistrement en base, envoi via
Resend depuis `contact@iparenea.fr` — domaine authentifié DKIM et SPF — vers la
même adresse. Le champ réponse porte l'adresse du demandeur : répondre au
message suffit à le recontacter.

Trois variables la pilotent, sans code à modifier pour en changer :
`RESEND_API_KEY` (chiffrée côté Vercel), `CONTACT_NOTIFICATION_EMAIL` et
`CONTACT_NOTIFICATION_FROM`.

**Un piège rencontré, qui vaut d'être noté** : Resend demande par défaut ses
enregistrements sur le sous-domaine `send.`, déjà occupé sur ce domaine par un
CNAME vers un autre service d'emailing. Un CNAME excluant tout autre
enregistrement sur le même nom, le SPF et le MX attendus ne pouvaient pas y
être posés et la vérification échouait, DKIM valide compris. Le contournement
est de déclarer le domaine dans Resend avec un autre sous-domaine
d'authentification.

L'envoi reste une commodité, jamais un point de passage obligé : une demande
est enregistrée en base et consultable dans `/admin/contacts` même si Resend
refuse ou tombe.

## Référentiels normatifs chargés

| Référentiel | Ce qui est chargé |
|---|---|
| ISO/IEC 42001:2023 | **Annexe A complète** — 38 contrôles de référence en 9 objectifs (A.2 à A.10) — plus trois exigences du corps (6.1.2, 8.4, 9.3) |
| Règlement (UE) 2024/1689 | Articles 14 et 50 |
| RGPD | Article 35 |
| ISO/IEC 42005:2025 | Clause 6.4 |

**Ce que ces données sont, et ne sont pas.** Elles portent la numérotation des
référentiels — un fait, non protégeable — accompagnée de titres et de résumés
rédigés en propre, exprimant ce qu'une organisation doit pouvoir démontrer.
Elles ne reproduisent pas le texte des normes.

Chaque résumé de l'Annexe A porte `review_status = 'to_review'` : un résumé est
une interprétation, et il engage vis-à-vis d'un client ou d'un auditeur. La
relecture humaine est un préalable à tout usage commercial, et un test vérifie
qu'aucun résumé n'a été marqué relu sans l'avoir été.

Le fichier source est `knowledge/frameworks/iso-42001/2023/annexe-a.json`, et la
migration `0022` en est **générée**. Un test compare les deux à chaque exécution :
ils ne peuvent pas diverger silencieusement.

ISO/IEC 27001 n'est pas chargée. Le besoin d'AIGMS y est plus étroit — montrer
qu'un contrôle IA sert aussi la sécurité de l'information, pour éviter la
double collecte de preuves. Un sous-ensemble ciblé suffirait ; importer les 93
contrôles d'un référentiel qu'AIGMS ne pilote pas serait disproportionné.

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

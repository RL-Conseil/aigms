# AIGMS — AI Governance Management System

**AI Governance System of Record + Operating System de l'AI Governance Officer**,
pour PME/ETI, cabinets de conseil, MSP et intégrateurs.

> Gouverner l'IA. Décider. Prouver. Améliorer.

## Ce que fait AIGMS

AIGMS exécute un cycle de management, pas seulement des registres :

```
DISCOVERY / ASSESS ─► BUILD / CONNECT ─► DECIDE ─► OPERATE ─► CHANGE ─► RE-ASSESS
```

Chaque processus critique porte une entrée, un responsable, un statut, des
règles de transition, des contrôles et preuves, une décision lorsqu'un gate
l'exige, une échéance et une trace d'audit.

**Le passage en production est refusé côté serveur** tant que les huit
préconditions ne sont pas satisfaites : classification, risques, évaluation
d'impact, revue fournisseur, supervision humaine, contrôles obligatoires,
décision GO et actions bloquantes.

## Stack

Next.js 16 (App Router) · TypeScript strict · Tailwind v4 · Supabase
(PostgreSQL, Auth) · RLS activée et forcée sur toutes les tables · migrations
versionnées · Vitest · Playwright.

Les règles de gouvernance vivent dans la base — voir
[ADR-0003](docs/adr/ADR-0003-server-side-gates.md).

## Démarrage

Prérequis : Node.js 22, Docker.

```bash
npm install
cp .env.example .env.local

npx supabase start          # stack locale ; reporter les cles affichees dans .env.local
npm run db:reset            # migrations + jeu de demonstration « IzarLink Demo »
npm run dev
```

Comptes de démonstration — mot de passe `Demo!Passw0rd` :

| Compte | Rôle |
|---|---|
| `admin@rl-conseil.demo` | administration de la plateforme — organisations, comptes et rôles |
| `officer@rl-conseil.demo` | AI Governance Officer |
| `owner@izarlink.demo` | porteur du système |
| `risk@izarlink.demo` | responsable du risque |
| `reviewer@izarlink.demo` | relecteur des décisions |
| `auditor@rl-conseil.demo` | auditeur, lecture seule |
| `officer@autre-cabinet.demo` | second tenant, pour vérifier l'étanchéité |

## Scripts

| Commande | Effet |
|---|---|
| `npm run dev` | serveur de développement |
| `npm run build` | build de production |
| `npm run typecheck` | vérification des types |
| `npm run lint` | ESLint |
| `npm run test` | tests unitaires et tests de base |
| `npm run test:rls` | isolation, RBAC, gates, journal d'audit |
| `npm run test:e2e` | parcours de bout en bout (Playwright) |
| `npm run db:reset` | rejoue migrations et jeu de démonstration |
| `npm run db:types:local` | régénère les types TypeScript |

## Environnements

| Environnement | Base Supabase |
|---|---|
| Production — `aigms.vercel.app`, branche `main` | `aigms-supabase` |
| Preview — une par branche | `aigms-supabase-preprod` |
| Poste de développement | stack locale Docker |

Les migrations remontent dans cet ordre, chacune par `supabase db push`. Le
flux de branches et de déploiement est décrit dans `CLAUDE.md`.

## Documentation

| Document | Objet |
|---|---|
| [`docs/architecture/AIGMS_TARGET_ARCHITECTURE.md`](docs/architecture/AIGMS_TARGET_ARCHITECTURE.md) | architecture cible et couches |
| [`docs/architecture/CURRENT_STATE.md`](docs/architecture/CURRENT_STATE.md) | audit initial du dépôt et des accès |
| [`docs/domain/DOMAIN_MODEL_IMPLEMENTED.md`](docs/domain/DOMAIN_MODEL_IMPLEMENTED.md) | ce qui existe en base : agrégats, gates, moteur de réévaluation |
| [`docs/security/TENANCY_RLS_MODEL.md`](docs/security/TENANCY_RLS_MODEL.md) | modèle de tenancy et politiques RLS |
| [`docs/roadmap/IMPLEMENTATION_STATUS.md`](docs/roadmap/IMPLEMENTATION_STATUS.md) | avancement par sprint |
| [`docs/adr/`](docs/adr/) | décisions d'architecture |

Les sources de vérité produit sont dans `00_Governance` à `04_References` ;
`CLAUDE.md` en fixe l'ordre de lecture.

## Périmètre

AIGMS ne construit ni SIEM, ni DLP, ni CMDB, ni ITSM, ni IAM, ni plateforme
d'observabilité de modèles, ni garde-fous d'exécution. Ces capacités relèvent de
connecteurs en lecture seule — voir
`02_Product/MATRICE_BUILD_CONNECT_DONT_BUILD_V2.md`.

AIGMS aide au cadrage, à la pré-classification, à la documentation et à la
preuve. Il ne remplace ni un avis juridique, ni une décision de responsable de
risque, ni un audit de certification.

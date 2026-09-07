# AIGMS — État courant du repository (Phase 0 — Audit)

Version 1.0 — 7 septembre 2026
Auteur : Claude Code (Principal Software Architect)

## 1. Objet

Ce document restitue l'audit du repository réalisé avant l'exécution du Sprint 0,
conformément à la Phase 0 de `02_Product/PROMPT_CLAUDE_CODE_BUILD_AIGMS_MVP_V2.md`.

## 2. État constaté avant Sprint 0

### 2.1 Nature du repository

Le répertoire `/mnt/d/CCOWORK/AIGMS` n'était **pas** un repository Git. Il contenait
exclusivement le pack documentaire *AI Governance Office Supports V5* : méthode,
référentiel fonctionnel, modèle de domaine, backlog et prompts.

| Élément attendu | Présent avant Sprint 0 | Commentaire |
|---|---|---|
| Repository Git | Non | `git init` réalisé en Sprint 0 |
| `package.json` | Non | Aucune application |
| Next.js / App Router | Non | À créer |
| TypeScript | Non | À créer |
| Tailwind | Non | À créer |
| Migrations Supabase | Non | À créer |
| `.env.example` | Non | À créer |
| CI | Non | À créer |
| Tests | Non | À créer |
| ADR | Non | Convention à établir |
| `project-access.json` (règle CCOWORK) | Non | À créer |

### 2.2 Arborescence documentaire constatée

```
00_Governance/      Offre générale V5
01_Methodology/     DISCOVERY_ASSESS V5, BUILD_CONNECT V5, OPERATE V5
02_Product/         Référentiel fonctionnel V4, Matrice BUILD/CONNECT, Domain Model V1,
                    MVP Backlog V2, Prompt Claude Code MVP V2
03_Commercial/      Prompt Gamma V2
04_References/      Références et traçabilité V1
Sprint Préparation Déploiement IA/   Kit sprint DISCOVERY
docs/               Documents de travail hétérogènes (.url, .docx, .xlsx, .excalidraw)
OLD/                Versions antérieures V2/V3/V4
```

**Conséquence :** l'écart avec la stack cible est total. Il ne s'agit pas d'une
migration mais d'une construction *greenfield*. Aucun ADR d'écart technique n'est
requis pour l'existant ; les ADR portent sur les choix structurants du Sprint 0.

### 2.3 Fichiers binaires et bruit

Le répertoire contenait des `.zip`, `.docx`, `.xlsx`, `.url`, `.pdf` et un dossier
`OLD/`. Ces artefacts sont exclus du versionnement (`.gitignore`) : les sources de
vérité produit sont les fichiers `.md`. Voir `docs/adr/ADR-0001-repository-layout.md`.

## 3. Connecteurs et accès audités

| Service | État constaté | Décision |
|---|---|---|
| GitHub | `gh` v2.45 ; deux comptes locaux : `richard-affinity`, `rlabrador` | Repo cible `RL-Conseil/aigms` (privé, existant, non vide) accessible **uniquement** via `rlabrador` |
| GitHub — scope `workflow` | Absent sur le token `rlabrador` | Bloquant pour pousser `.github/workflows/` — voir §5 |
| Vercel | CLI v54.18.1, connecté en tant que `affinity-2575`, team `richard-2575s-projects` | Aucun projet AIGMS existant |
| Supabase (MCP) | Connecté à l'organisation `affinityhousefactory64@gmail.com's Org` | **N'a pas accès** au projet cible `xsagbzrgoljzgorwvsir` (permission refusée) |
| Supabase CLI | Non installé globalement | Ajouté en devDependency du projet |
| Node.js | v22.22.3 / npm 10.9.8 | Conforme |
| Docker | v29.5.3 | Disponible pour `supabase start` local |

## 4. Écart vis-à-vis de la stack cible

La stack cible (`PROMPT_CLAUDE_CODE_BUILD_AIGMS_MVP_V2.md` §Architecture cible) est
intégralement à construire :

- Next.js App Router — **construit en Sprint 0**
- TypeScript strict — **construit en Sprint 0**
- Tailwind — **construit en Sprint 0**
- Supabase PostgreSQL / Auth / Storage — **schéma et RLS construits en Sprint 0**
- RLS + tests cross-tenant — **construits en Sprint 0**
- `audit_log` — **construit en Sprint 0**
- Migrations versionnées — **construites en Sprint 0**
- CI — **construite en Sprint 0**

## 5. Points bloquants identifiés et traitement

| # | Point | Impact | Traitement |
|---|---|---|---|
| B1 | Le token GitHub `rlabrador` n'a pas le scope `workflow` | Le push des fichiers `.github/workflows/*` sera rejeté par GitHub | Les fichiers CI sont écrits dans le repo local ; l'utilisateur doit exécuter `gh auth refresh -h github.com -u rlabrador -s workflow` avant le premier push |
| B2 | Le serveur MCP Supabase n'a pas accès au projet `xsagbzrgoljzgorwvsir` | Impossible d'appliquer les migrations via MCP | Approche **migrations-first** via Supabase CLI : les migrations sont versionnées dans `supabase/migrations/` et appliquées avec `supabase link` + `supabase db push`, ce qui nécessite un `SUPABASE_ACCESS_TOKEN` et le mot de passe base fournis par l'utilisateur en `.env.local` |
| B3 | Aucun `project-access.json` pour AIGMS | Règle CCOWORK n°3 non satisfaite | Créé en Sprint 0 à la racine du projet |

Aucun de ces points n'empêche la construction du Sprint 0 : le code, les migrations,
les tests et la documentation sont produits ; seules l'application distante des
migrations et la publication de la CI requièrent une action d'habilitation.

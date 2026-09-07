# ADR-0001 — Un seul dépôt pour le produit et sa méthode

Date : 7 septembre 2026 · Statut : accepté

## Contexte

Le répertoire de départ contenait le pack documentaire *AI Governance Office
Supports V5* et aucun code. Ces documents ne sont pas de la documentation
d'accompagnement : ils sont la **source de vérité fonctionnelle**, et le
`CLAUDE.md` du projet impose un ordre de lecture qui les référence par chemin.

Il contenait aussi des `.zip`, `.docx`, `.xlsx`, `.url`, `.pdf` et un dossier
`OLD/` de versions antérieures.

## Décision

Un dépôt unique. Le code applicatif est à la racine (`src/`, `supabase/`,
`docs/`, `tests/`) aux côtés des dossiers `00_Governance` à `04_References`,
conservés tels quels.

Les binaires de travail (`*.zip`, `*.docx`, `*.xlsx`, `*.url`, `*.pdf`,
`*.excalidraw`) et `OLD/` sont exclus du versionnement : les sources de vérité
sont les fichiers `.md`, qui, eux, sont versionnés.

## Conséquences

- Une exigence produit et le code qui l'implémente évoluent dans le même commit.
- Les chemins du `CLAUDE.md` restent valides sans réécriture.
- Le dépôt reste léger ; les documents bureautiques vivent hors Git.
- Un binaire réellement nécessaire devra faire l'objet d'une exception explicite
  dans `.gitignore`.

## Alternatives écartées

- **Deux dépôts (méthode / produit)** : synchroniser deux dépôts pour une équipe
  d'une personne coûte plus qu'il ne rapporte, et casse l'ordre de lecture.
- **Versionner les binaires** : le pack pèse plusieurs mégaoctets et se
  régénère ; l'historique Git n'y gagne rien.

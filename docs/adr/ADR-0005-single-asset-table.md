# ADR-0005 — Une table `ai_asset` discriminée plutôt que quatre tables

Date : 7 septembre 2026 · Statut : accepté

## Contexte

Le modèle cible liste `ai_system`, `ai_model`, `ai_agent` et `dataset`. Ces
quatre objets partagent identité, organisation, propriétaire, fournisseur,
version, hébergement, et le même rattachement N:N au cas d'usage.

Leurs différences se limitent à quelques attributs, dont un seul est structurant
au stade du MVP : `contains_personal_data`, propre aux jeux de données.

## Décision

Une table `ai_asset` avec une colonne `kind` de type `app.asset_kind`. La
référence métier reflète le type : `SYS-`, `MOD-`, `AGT-`, `DTS-`.

## Conséquences

- Un seul jeu de politiques RLS au lieu de quatre à maintenir cohérents entre
  eux — c'est le gain déterminant, la RLS étant l'exigence numéro un.
- Le rattachement `use_case_asset_link` reste unique, ce qui simplifie l'analyse
  d'impact d'un changement de modèle ou de jeu de données.
- Les attributs spécifiques à un type sont nullables. Si l'un d'eux devient
  structurant, il faudra soit une table d'extension, soit une contrainte
  conditionnelle sur `kind`.
- L'interface doit filtrer sur `kind` pour présenter des listes homogènes.

## Alternatives écartées

- **Quatre tables** : quadruple les politiques, les triggers et les tests pour un
  gain de typage marginal.
- **Héritage de table PostgreSQL** : mal servi par la RLS et par PostgREST.

# ADR-0003 — Les règles de gate vivent dans la base

Date : 7 septembre 2026 · Statut : accepté

## Contexte

Le modèle de domaine impose : « aucune transition critique uniquement côté
client », « aucune approbation par IA », « toute modification sensible
journalisée ». Le passage en production dépend de huit préconditions portant sur
sept agrégats différents.

Trois emplacements étaient possibles : le client React, la couche Server Action,
ou la base.

## Décision

Les règles sont des fonctions PostgreSQL dans le schéma `app` :
`evaluate_gate`, `evaluate_production_gate`, `transition_use_case`,
`evaluate_governance_impact`, `screen_change_request`.

Le statut d'un cas d'usage n'est modifiable que par `app.transition_use_case` ;
un trigger refuse tout `UPDATE` direct. Les Server Actions valident la forme de
l'entrée avec Zod, puis délèguent.

## Conséquences

- La règle s'applique quel que soit le chemin d'accès : interface, API PostgREST,
  script, psql. Il n'existe pas de porte dérobée.
- Elle se teste sans navigateur ni serveur d'application : 40 tests SQL couvrent
  isolation, RBAC, gates et journalisation.
- Le jeu de démonstration rejoue le parcours réel par ces fonctions ; une
  régression de gate fait échouer le seed.
- Les fonctions sont `SECURITY DEFINER` — nécessaire pour lire les appartenances
  sans récursion RLS — donc **chacune revérifie explicitement l'habilitation**.
  C'est le point de vigilance permanent de ce choix.
- Une règle évolue par migration versionnée, pas par déploiement applicatif.
- La logique métier est en PL/pgSQL : moins confortable à outiller que du
  TypeScript, et c'est le prix accepté.

## Alternatives écartées

- **Règles en TypeScript côté Server Actions** : contournables par un appel
  PostgREST direct, puisque le client détient un JWT valide.
- **Règles dupliquées base + application** : deux vérités qui divergent. Le front
  ne conserve qu'un miroir d'affichage des transitions, verrouillé par un test de
  parité.

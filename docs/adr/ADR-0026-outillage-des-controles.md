# ADR-0026 — Avec quoi un contrôle se tient : une carte d'outillage, pas une CMDB

*26 septembre 2026. Migration 0088.*

## Contexte

Le référentiel porte, à côté des 120 contrôles-types, une **typologie de 60
familles d'outillage** (`catalog_tool`) : IaaS, PaaS, CSPM, IaC, MLOps,
passerelle d'appels IA, observabilité, gestion des incidents… Chacune dit ce
qu'elle contrôle, la question à poser, les preuves qu'elle produit, des
exemples de produits. Les propositions de contrôles l'affichaient déjà :
« Se tient avec : CSPM, Observabilité ».

C'est une typologie — elle dit *où chercher*. Elle ne dit pas ce que
l'organisation emploie. Un contrôle qui « se tient avec l'observabilité » est
moins probant qu'un contrôle qui se tient « avec Datadog, chez nous », et on
ne sait pas où prendre sa preuve.

## Décision

1. **`organization_tooling`** : une ligne par famille, le **produit employé**,
   avec en option le fournisseur du registre et le connecteur qui en lit les
   preuves. C'est tout.
2. **Ce n'est pas un inventaire du SI.** Pas d'instances, pas de dépendances,
   pas de cycle de vie : le CLAUDE.md interdit de reconstruire une CMDB, et
   *Connect rather than rebuild* est un principe produit. L'inventaire vit
   dans l'ITSM ; chaque produit déclaré ici est un **connecteur candidat** —
   c'est le chemin vers la collecte automatique des preuves.
3. **`control_tooling`** : ce que l'AI Governance Officer retient **pour ce
   contrôle-là**. Le référentiel propose, l'humain retient — comme pour
   l'applicabilité. Le **contrôle-type n'est jamais modifié** : sa
   correspondance d'outillage est une donnée d'éditeur, versionnée, qu'une
   réimportation du référentiel doit pouvoir remplacer sans écraser ce que le
   client a déclaré. Un cabinet peut ajouter ses propres familles et
   correspondances (les tables le prévoient), sans toucher à celles de
   l'éditeur.
4. **Deux lignes de RACI** : *Outillage des contrôles* (R officer, C Expert —
   DSI/RSSI, qui le connaît), *Référentiel* (donnée d'éditeur, I pour tous).
5. **Le connecteur ne se choisit pas ici.** Déclarer l'outillage relève des
   rôles de gouvernance ; **configurer un connecteur** chez un fournisseur,
   pour en tirer les preuves par son API, est une tâche d'administration de la
   plateforme — et la manière dont cela s'articulera avec le mode hébergé
   reste à poser. La colonne `connector_id` existe en base ; l'écran ne la
   propose pas.

## Conséquences

- Le registre des contrôles dit, par contrôle, « Se tient avec : Datadog » ou
  « Se tient à la main », et l'on y retient les outils d'un clic.
- La page Outillage signale les familles **attendues par les contrôles de
  l'organisation** et encore sans produit — c'est la liste à remplir.
- Un produit rattaché à un fournisseur sans revue approuvée le dit : la revue
  tiers reste une précondition de production.
- La couche « outillage » du graphe de gouvernance reste à faire.

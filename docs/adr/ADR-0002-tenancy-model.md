# ADR-0002 — `tenant_id` porté par chaque table métier

Date : 7 septembre 2026 · Statut : accepté

## Contexte

AIGMS est multi-tenant natif : un AI Governance Officer pilote 5 à 30
organisations clientes. Le critère d'acceptation non négociable est l'absence de
fuite entre tenants.

La hiérarchie naturelle est `tenant → organization → objets`. Une politique RLS
pourrait donc remonter la chaîne de clés étrangères à chaque vérification.

## Décision

Chaque table métier porte une colonne `tenant_id` non nulle, référençant
`tenant`. Toute politique de lecture s'écrit `app.has_tenant_access(tenant_id)`.

Un trigger `app.assert_tenant_consistency` interdit qu'une ligne portant un
`tenant_id` référence une organisation appartenant à un autre tenant.

## Conséquences

- Une politique tient en une ligne et se relit sans suivre trois jointures.
  Sur 36 tables, c'est ce qui rend l'ensemble auditable.
- Pas de jointure à l'exécution de chaque politique.
- La dénormalisation crée un risque d'incohérence, neutralisé par le trigger et
  couvert par un test.
- Toute nouvelle table doit être ajoutée au tableau déclaratif de la migration
  `0014`, sans quoi elle n'a ni politique ni droits — donc aucun accès.

## Alternatives écartées

- **Remonter la chaîne de clés étrangères** : politiques illisibles et coûteuses,
  pour un gain de normalisation qui ne se voit nulle part.
- **Un schéma PostgreSQL par tenant** : ingérable en migrations pour un
  portefeuille de trente clients, et incompatible avec les vues de portefeuille.

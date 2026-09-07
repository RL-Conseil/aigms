# ADR-0006 — Catalogue de référentiels partagé au niveau plateforme

Date : 7 septembre 2026 · Statut : accepté

## Contexte

`framework` et `requirement` portent les référentiels — ISO/IEC 42001, AI Act,
RGPD — sous forme de références, de résumés internes et d'exigences dérivées.
Aucune reproduction de texte normatif protégé, conformément à
`REFERENCES_ET_TRACABILITE_V1.md`.

Ces données ne contiennent rien qui appartienne à un client. Les dupliquer par
tenant reviendrait à maintenir trente copies du même mapping ISO.

## Décision

`framework` et `requirement` sont **globaux** : lecture ouverte à tout
utilisateur authentifié, écriture réservée à `platform_admin`. Ils ne portent pas
de `tenant_id`.

Les `control`, eux, appartiennent à un tenant et à une organisation :
c'est là que se loge la spécificité client, et `control_requirement_map`
rattache un contrôle à N exigences.

## Conséquences

- Un référentiel se met à jour une fois pour tout le portefeuille.
- Les dates d'effet et de retrait sont des **données versionnées**, jamais du
  code : l'interdiction de coder une date AI Act en dur est structurellement
  tenue.
- Un tenant ne peut pas amender un résumé d'exigence pour son seul usage. Si le
  besoin apparaît, il faudra une table d'annotations par tenant plutôt que de
  rendre le catalogue inscriptible.
- La lecture ouverte révèle quels référentiels existent sur la plateforme. Ce
  sont des références publiques : l'exposition est sans conséquence.

## Alternatives écartées

- **Catalogue par tenant** : duplication massive, mappings divergents,
  mise à jour réglementaire à répéter par client.
- **Catalogue en fichiers de code** : contredit l'exigence de référentiels
  configurables et versionnés en base.

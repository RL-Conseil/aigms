# ADR-0015 — Les documents remis portent une identité, et elle est unique

*Statut : accepté — 14 septembre 2026*

> Cet ADR porte le numéro 0015 : le 0014 est pris par la branche
> `feat/lecture-et-edition`, fusionnée séparément.

## Contexte

Un registre des usages d'IA et une déclaration d'applicabilité ne servent à
rien tant qu'ils restent dans l'outil : ce sont des pièces qu'on remet. Or
l'organisation ne connaissait d'elle-même qu'un nom d'usage, un secteur et un
pays — pas de raison sociale complète, pas d'adresse, pas d'immatriculation,
pas de logo, et aucune mention de confidentialité.

Imprimer l'écran de travail ne convenait pas : il porte des filtres, des
formulaires de décision et des infobulles qui n'ont rien à faire dans une pièce
remise à un auditeur.

## Décision

**Une identité documentaire sur l'organisation.** Adresse, code postal, ville,
immatriculation, TVA, site, contact, logo, mention de confidentialité et mention
libre de pied de page (migration 0035). Elle se saisit à la création de
l'organisation et se complète ensuite sur un écran dédié, réservé à
l'administration de la plateforme — comme le rôle vis-à-vis de l'IA.

**Une seule lecture pour tous les documents.** `app.document_identity(uuid)`
rend l'en-tête et le pied sous forme de `jsonb`. Deux en-têtes écrits séparément
finiraient par diverger, et un auditeur qui reçoit deux pièces du même système
avec deux identités différentes a raison de s'en inquiéter.

**Des vues d'impression dédiées**, et non une feuille de style appliquée aux
écrans de travail : `/impression/registre` et
`/impression/declaration-applicabilite`, bâties sur la même chrome
(`PrintDocument`). L'en-tête et le pied se répètent sur chaque feuille par
`position: fixed`, les marges de `@page` leur réservant la place.

**Le logo vit dans un bucket privé.** `branding`, non public, chemin imposé
`<tenant>/<organisation>/`, vérifié deux fois : dans l'action serveur qui le
dérive, et par `app.guard_organization_logo` qui le refuse s'il ne correspond
pas. Chaque affichage passe par une URL signée d'une heure. Le logo d'un client
n'a pas à être servi publiquement à qui devine son adresse.

## Ce que cela ne fait pas

- **Aucun gate ne lit ces champs.** Ils ne gouvernent rien : ce sont des
  informations d'en-tête. Ils restent néanmoins journalisés (migration 0033) —
  le nom légal qui figure sur une pièce remise n'est pas un détail d'affichage.
- **Pas de numérotation de page.** Les boîtes de marge de `@page` ne sont pas
  implémentées dans les navigateurs où cette application s'utilise ; le
  navigateur pose lui-même son propre pied de page paginé.
- **Pas de génération de PDF côté serveur.** L'impression du navigateur suffit
  et n'ajoute aucune dépendance. Si un PDF signé devenait nécessaire, ce serait
  une décision distincte.

## Conséquences

- Le registre s'imprime depuis la vue d'ensemble de l'organisation, la
  déclaration depuis son propre écran.
- Une troisième vue imprimable — registre des décisions, registre des preuves —
  ne coûtera que sa table : la chrome et l'identité sont déjà là.
- Les organisations créées avant la migration 0035 n'ont pas d'adresse. Le même
  écran sert à compléter comme à corriger.

## Voir aussi

- ADR-0011 — garde des fichiers de preuve (même règle de préfixe dérivé)
- ADR-0013 — surface applicative seule

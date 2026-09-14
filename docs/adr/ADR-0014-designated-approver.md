# ADR-0014 — La personne appelée à se prononcer est désignée, jamais substituée

*Statut : accepté — 14 septembre 2026*

## Contexte

Le registre de décisions séparait déjà deux actes : soumettre énonce ce qui est
décidé, se prononcer engage nominativement. Sur une mise en production, une
acceptation de risque ou une exception de politique, `app.guard_decision_approval`
refuse que l'auteur approuve sa propre décision.

Il manquait une chose : une décision soumise n'était adressée à personne. Elle
attendait qu'un rôle habilité la trouve. Sur une organisation qui compte trois
personnes habilitées, cela revient à ne la confier à aucune — et le
tableau de bord ne pouvait pas dire à qui la relance s'adresse.

La demande était formulée ainsi : « les décisions sont censées être prises par
une personne déclarée dans l'organisation, préciser la personne dans une liste
de choix ».

## Décision

`governance_decision.expected_approver_user_id` désigne **qui est appelé à
trancher**. Il se choisit à la soumission, dans la liste des personnes déclarées
sur l'organisation dont l'affectation est en cours de validité et dont le rôle
figure dans `app.roles_review()` (AI Governance Officer, administrateur client,
relecteur).

`app.guard_expected_approver` refuse que l'auteur se désigne lui-même sur les
trois types soumis à séparation des rôles : s'adresser la décision à soi-même
serait annoncer un refus.

## Ce que cette colonne n'est pas

**Elle ne permet pas de consigner une approbation au nom d'un tiers.** C'était
la lecture littérale de la demande, et elle est écartée.

`approver_user_id` reste renseigné par la personne qui se prononce, à partir de
sa propre session. Si l'écran laissait choisir « qui a approuvé » dans une liste,
n'importe quel porteur d'un rôle habilité pourrait enregistrer l'accord d'un
autre. La séparation des rôles deviendrait une formalité de saisie, et le
registre perdrait exactement ce qui lui donne sa valeur : le fait qu'un nom
inscrit dans la colonne « approbateur » correspond à quelqu'un qui s'est
réellement connecté et a réellement cliqué.

Le champ désigné est donc une **adresse**, pas un droit : il n'autorise rien,
ne remplace pas la RLS, ne dispense pas de la séparation des rôles, et
n'empêche pas une autre personne habilitée de se prononcer si le destinataire
pressenti est absent.

## Conséquences

- Le registre affiche, sur toute décision encore à instruire, la personne
  appelée à se prononcer — ou signale qu'elle est *adressée à personne*, avec un
  compteur dédié en tête de page.
- Une organisation qui ne déclare qu'une seule personne habilitée voit la liste
  vide sur les décisions à séparation : c'est le rappel, au bon moment, qu'il en
  faut au moins deux.
- Migration `20260914180000_0034_expected_approver.sql`. La colonne est nullable :
  les décisions antérieures restent lisibles, simplement non adressées.

## Voir aussi

- ADR-0003 — les gates s'exécutent côté serveur
- ADR-0004 — le refus est un résultat, pas une exception

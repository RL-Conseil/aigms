# Démontrer l'échéance des preuves

*5 octobre 2026. Migrations 0104 à 0106.*

Le scénario tient en quatre gestes, tous dans l'interface, et il produit des
alertes réelles — rien n'est simulé.

## Ce qui se joue

Depuis la migration 0097, un contrôle applicable qu'aucune preuve validée ne
démontre **avertit** au jalon PRODUCTION sans le retenir. C'était la seule façon
d'introduire l'exigence sans rendre non conformes, du jour au lendemain, les cas
d'usage déjà en service.

Une voie douce sans terme est un renoncement. L'échéance lui en donne un, **par
organisation**, parce que c'est un engagement pris envers un client : il se
négocie, se reporte, et doit se lire.

## 1. Avant — l'écart s'assume

Ouvrir un cas d'usage en pilote, onglet **Contrôles affectés**, case **Sans
preuve** : les contrôles applicables que rien ne démontre. Puis *Avancer* vers
PRODUCTION : la précondition « Chaque contrôle applicable est démontré par une
preuve validée » figure au détail, **en ambre**, avec la mention « avertissement
— ne retient pas le jalon ».

Soumettre la décision de mise en production : l'écart est **figé** sur elle,
l'AI Governance Officer doit dire ce qu'il en est, et l'**Administrateur
client** reçoit alerte et courriel avec les contrôles nommés. Son approbation
exige de déclarer en avoir pris connaissance.

## 2. Poser l'échéance

**Organisations > une organisation > Administration**, carte *Preuves exigées à
la mise en production*. Choisir une date, enregistrer.

Trois choses partent immédiatement :

| Destinataire | Ce qu'il reçoit |
|---|---|
| AI Governance Officer | l'annonce de la règle et de sa date |
| Administrateur client | « vous ne pourrez plus approuver sans que ce soit démontré » |
| Porteur de chaque cas d'usage en pilote, revue ou autorisé **qui porte un écart** | « *UC-xxxx* ne passera plus en production sans ses preuves », avec les contrôles nommés et un lien vers l'onglet filtré sur *Sans preuve* |

Et deux rappels sont **posés d'avance**, à J-30 et J-7, sans tâche planifiée :
`my_notifications` ne rend que ce qui est dû. Ils ne partent pas si la date est
déjà passée.

> **Pour la démonstration**, poser une date à **moins de trente jours** : le
> rappel J-30 est alors déjà dû et se lit tout de suite dans *Mes alertes*.

## 3. Après l'échéance — l'écart retient

Poser une date passée. Rouvrir le même cas d'usage et *Avancer* : la même
précondition est maintenant **rouge et bloquante**, et le détail dit « Depuis le
JJ/MM/AAAA, cet écart retient la mise en production ». La transition est refusée
par la base, pas seulement par l'écran.

## 4. Reporter — tout se rejoue

Changer la date. Les alertes non lues qui annonçaient l'ancienne échéance sont
**effacées**, les nouvelles partent, et les rappels se reposent sur la nouvelle
date. Reporter ne laisse rien traîner.

La retirer efface tout et rend l'écart à son statut d'avertissement.

## Ce qu'il faut avoir sous la main

- Une organisation dont un cas d'usage **en pilote** porte au moins un contrôle
  applicable sans preuve validée — le jeu de démonstration en a un.
- Un compte **Administrateur client** déclaré sur cette organisation, sans quoi
  la deuxième alerte n'a pas de destinataire et ne part pas.
- Le courriel n'est envoyé que si `RESEND_API_KEY` est configurée. Sans elle,
  les alertes restent lisibles dans *Mes alertes* — l'envoi est une commodité,
  jamais la trace.

## Voir aussi

- `docs/adr/ADR-0032-l-ecart-de-preuve-s-assume.md` — pourquoi la voie douce, et
  ce que l'avertissement engage

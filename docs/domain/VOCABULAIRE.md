# AIGMS — Conventions de vocabulaire

Version 1.0 — 8 septembre 2026

Les mots de l'interface ne sont pas décoratifs : ils décident de ce que le
lecteur croit avoir sous les yeux. Ce document fixe ceux qui ont été tranchés,
et pourquoi.

## « Portefeuille » désigne les usages d'IA, jamais les organisations

Le mot portait deux sens dans le produit :

| Sens | Où |
|---|---|
| Portefeuille **d'usages IA** | « gouverner un portefeuille d'usages IA qui évolue chaque semaine » (accroche produit), « portefeuille priorisé en vagues P1/P2/P3 » (DISCOVERY), « couverture portefeuille » (OPERATE) |
| Portefeuille **de clients** | l'ancien titre de l'écran listant les organisations, « portefeuille consultant » (Référentiel V4) |

Le premier est le sens fort : celui du discours métier, celui qui accroche un
dirigeant. Le second est secondaire et se dit déjà autrement — « multi-clients »,
« organisations clientes ».

**Décision** : « portefeuille » est réservé aux usages d'IA. L'écran qui liste
les clients s'appelle **Organisations**.

Trois raisons :

1. Le mot cesse d'être surchargé dans l'endroit le plus visible de l'interface.
2. « Organisations » est vrai dans les deux configurations : une PME qui
   gouverne ses propres usages n'a pas de portefeuille, elle *est* une
   organisation.
3. L'écran affiche exactement des `organization` : nommer l'écran d'après
   l'objet qu'il contient évite au lecteur une traduction mentale.

## Le sous-titre suit le rôle

Administrer des organisations et en gouverner les usages sont deux métiers.
L'écran ne raconte donc pas la même chose à l'un et à l'autre :

| Rôle | Sous-titre |
|---|---|
| Administration de la plateforme | Les organisations déclarées sur la plateforme. |
| Rôles de gouvernance | Les organisations dont vous pilotez la gouvernance de l'IA. |

## Deux niveaux, deux mots

| Objet | Mot d'interface | Ce que c'est |
|---|---|---|
| `tenant` | « la plateforme » | Le cabinet, MSP ou DSI externalisée qui exploite AIGMS. Frontière d'isolation |
| `organization` | « organisation » | Le client dont on gouverne les usages d'IA |

D'où : un compte est « rattaché à la plateforme » avec un rôle, puis
éventuellement « affecté à une organisation » avec un rôle plus précis. Un rôle
sans affectation ciblée « porte sur toutes les organisations ».

## À vérifier avant d'ajouter un écran

- Le titre nomme-t-il l'objet affiché, ou une métaphore de métier ?
- Le mot vaut-il aussi bien pour une PME seule que pour un cabinet
  multi-clients ?
- Le mot est-il déjà employé ailleurs dans le produit avec un autre sens ?

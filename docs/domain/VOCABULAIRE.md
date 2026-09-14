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

## « Activité » désigne une activité de processus, et rien d'autre

Version 1.1 — 14 septembre 2026

Le mot portait trois sens dans l'interface :

| Sens | Où |
|---|---|
| **Activité d'un processus** | la carte des processus : `Servir le client › Traitement des demandes clients` |
| **Branche d'activité** | sens courant du français des affaires, d'autant plus tentant que la fiche de l'organisation porte un « Secteur » |
| **Profil d'activité** | le rôle ISO/IEC 42001 de l'organisation — hébergeur, développeur, intégrateur, utilisateur métier |

Le champ d'intake s'appelait « Activité servie » et proposait la première, sans
dire d'où venait la liste. Il se lisait comme la deuxième.

**Décision** : « activité » ne désigne qu'une activité de processus.

- Le champ d'intake devient **« Activité du processus servie »**, avec son
  origine en aide et un renvoi vers la carte.
- Le troisième sens disparaît de l'interface : le rôle ISO/IEC 42001 s'appelle
  partout **« rôle vis-à-vis de l'IA »**. Le nom technique
  (`ai_activity_profile`) reste, il n'est pas lu par un utilisateur.

### Pourquoi pas « tâche »

La question s'est posée. Les référentiels répondent dans l'autre sens :

| Référentiel | Ce qu'il pose |
|---|---|
| BPMN 2.0 | `Activity` est le sur-type ; `Task` est l'activité **atomique**. Une tâche est une activité, pas l'inverse. |
| APQC PCF | Category → Process Group → Process → **Activity** → Task |
| ISO 9001, approche processus | processus → activités ; la tâche relève du mode opératoire |
| `SPEC_PROCESS` | pose Processus → Activité |

Et le niveau décrit le confirme : « Présélection des candidatures » n'est pas
une tâche, c'est un ensemble de tâches porté par un responsable et produisant un
résultat identifiable. C'est la définition d'une activité.

Le renommage aurait par ailleurs touché la table, six fonctions SQL
(`process_map`, `governance_health`, `control_coverage`, `control_graph`,
`risk_path`, `attention_by_organization`) et les références métier `ACT-P-`,
pour un terme moins juste.


## « Pré-classification » plutôt que « qualification du risque »

Version 1.2 — 14 septembre 2026

Le volet de saisie s'appelait « Qualifier au regard du règlement », la carte de
lecture « Pré-classification réglementaire » : deux noms pour une même chose.
« Qualification générale du risque au regard du règlement » a été envisagé, puis
écarté.

**Décision** : le volet s'appelle **« Pré-classifier au regard du règlement »**.

Deux raisons :

1. **Le terme est déjà établi** — page commerciale, méthodologie, action
   serveur, carte de lecture. En introduire un second aurait recréé le défaut
   que ce document existe pour corriger.
2. **Le mot « risque » y aurait été faux, et coûteux.** Cette rubrique ne cote
   aucun risque : elle situe le système au regard du règlement. « Haut risque »
   y désigne une **catégorie de système**, qui déclenche des obligations ; la
   cotation d'un risque se fait ailleurs, par vraisemblance et gravité, dans une
   rubrique qui s'appelle précisément « Risques » et se trouve juste en dessous.
   Nommer les deux « risque » aurait mis deux sens du mot à trois centimètres
   l'un de l'autre.

La note de la rubrique énonce explicitement cette distinction : c'est la
confusion la plus coûteuse de l'écran, et un test E2E la verrouille.

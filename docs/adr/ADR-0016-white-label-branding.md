# ADR-0016 — La marque est un réglage du tenant, pas un fork

*Statut : accepté — 14 septembre 2026*

## Contexte

AIGMS s'adresse à des cabinets, MSP et DSI externalisées qui pilotent un
portefeuille de clients. Certains veulent revendre la plateforme sous leur
propre marque : leurs clients doivent voir la leur, pas celle de l'éditeur.

Jusqu'ici la marque était écrite en dur dans le composant `Wordmark` : la
changer demandait de modifier le code, donc un déploiement par revendeur.

## Décision

**La marque vit sur le tenant** (migration 0036) : `brand_label`,
`brand_tagline`, `logo_path`. C'est le cabinet qui revend, pas son client —
poser le réglage sur l'organisation aurait laissé chaque client final changer
la marque de son prestataire.

**Trois degrés, du plus léger au plus complet :**

| Réglage | Effet |
|---|---|
| `brand_tagline` vidée | « Designed by Caritis » disparaît |
| `brand_label` changée | le nom porté par l'en-tête change |
| `logo_path` déposé | l'image remplace le glyphe **et** le nom |

Un logo porte déjà son propre nom : l'afficher à côté du nom textuel serait
redondant. C'est pourquoi le logo remplace les deux plutôt que de s'y ajouter.

**Le logo réutilise le bucket privé `branding`** introduit par la migration 0035,
sous un préfixe distinct `<tenant>/plateforme/`, vérifié par
`app.guard_tenant_logo`. Deux logos coexistent donc dans le même espace et ne
répondent pas à la même question : celui du tenant dit quel outil on utilise,
celui de l'organisation (0035) dit de qui est la pièce qu'on remet.

**Une seule lecture** : `app.tenant_branding()`, appelée par l'en-tête. La
marque ne se calcule pas différemment selon l'écran.

## Ce que cela ne fait pas

**La mire de connexion n'est pas personnalisée.** Avant authentification, on ne
sait pas quel tenant se présente : l'application n'a ni domaine par revendeur ni
sous-domaine de tenant. Elle garde donc la marque de l'éditeur. Personnaliser la
mire supposerait de résoudre le tenant depuis le domaine — c'est une décision
distincte, à prendre le jour où un revendeur apporte son propre domaine.

**Les documents imprimés ne portent pas cette marque** mais celle de
l'organisation (ADR-0015). Une déclaration d'applicabilité est la pièce d'un
client, pas la vitrine d'un outil.

## Conséquences

- Le réglage se trouve dans *Paramètres*, réservé à l'administration de la
  plateforme : la policy d'écriture sur `tenant` existait déjà et suffit.
- Aucun déploiement n'est nécessaire pour changer de marque.
- Le tenant de démonstration conserve `AIGMS` / `Designed by Caritis`, ce qui
  vaut test de non-régression.

## Voir aussi

- ADR-0015 — identité documentaire de l'organisation

# ADR-0013 — La vitrine quitte l'application

Date : 10 septembre 2026 · Statut : accepté

## Contexte

AIGMS servait deux publics dans le même déploiement : une page de présentation
publique avec formulaire de contact, et l'espace de gouvernance derrière
identification. Le site commercial https://caritis.fr reprend la présentation et
la collecte de demandes.

Maintenir la vitrine dans l'application aurait signifié : deux discours
commerciaux à tenir à jour, une surface publique à défendre, et une exception
d'écriture anonyme en base — le tout sans usage une fois la collecte déplacée.

## Décision

**L'accueil est la mire de connexion.** `/` sert la connexion et un abstract de
trois lignes ; une session ouverte y est renvoyée vers `/admin`. `/login`
redirige vers `/` en conservant le paramètre `next` : l'adresse a circulé —
signets, courriels, documentation — et la supprimer casserait des accès
existants pour un gain nul.

**Pas d'inscription libre, et l'écran le dit.** Les comptes sont déclarés par
l'administration de la plateforme, qui attribue les rôles (ADR-0008). Un
formulaire d'inscription contredirait le modèle d'habilitation dont dépend tout
le reste : sans rôles attribués par un tiers, la séparation auteur/approbateur
du registre de décisions n'a plus de sens.

**La surface anonyme est refermée.** `contact_request` était la seule exception
à la règle « anon ne dispose d'aucun droit » posée en 0005. L'exception n'a plus
d'objet : une écriture anonyme sans formulaire pour l'émettre est une surface
d'attaque sans usage. La migration 0030 révoque le droit et un test vérifie
qu'`anon` ne détient plus aucun droit sur aucune table du schéma `public`.

**La table et ses données restent.** Les demandes déjà reçues sont des pistes
commerciales réelles ; `/admin/contacts` continue de les présenter comme
archive. Ce qui ferme est l'entrée, pas l'historique.

**Le contenu est exporté, pas perdu.**
[`03_Commercial/PAGE_ACCUEIL_CARITIS.md`](../../03_Commercial/PAGE_ACCUEIL_CARITIS.md)
porte l'intégralité des textes, les données des trois graphiques, la frise
réglementaire et les précautions à conserver — notamment celle qui interdit
d'affirmer que l'outil certifie ou garantit la conformité.

## Conséquences

- Un seul discours commercial à tenir à jour, et il vit là où il est lu.
- La seule page servie sans session est la mire. C'est une propriété de
  sécurité, vérifiée par un parcours end-to-end plutôt que déclarée.
- `RESEND_API_KEY`, `CONTACT_NOTIFICATION_EMAIL` et `CONTACT_NOTIFICATION_FROM`
  ne sont plus lues. Elles peuvent être retirées de Vercel — la chaîne de
  notification et le contournement du sous-domaine `send.` sont documentés dans
  l'historique de ce dépôt si elle devait resservir.
- `/admin/contacts` devient une archive à durée de vie limitée : une fois les
  demandes traitées, l'écran et la table pourront disparaître. À décider plus
  tard, pas dans le même geste.

## Alternatives écartées

- **Garder la vitrine et la laisser diverger.** Deux pages disant la même chose
  finissent toujours par ne plus la dire pareil ; celle qui n'est pas lue est
  celle qu'on oublie de corriger.
- **Rediriger `/` vers caritis.fr.** L'application aurait perdu son point
  d'entrée propre, et un utilisateur revenant sur son signet aurait été sorti de
  l'outil qu'il cherchait à ouvrir.
- **Supprimer la table `contact_request`.** Destructif et sans bénéfice :
  révoquer les droits ferme la surface, effacer les lignes ferait perdre des
  pistes commerciales.
- **Ouvrir une inscription libre.** Contredit ADR-0008 et viderait de son sens
  la séparation des rôles.

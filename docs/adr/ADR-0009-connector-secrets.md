# ADR-0009 — Un connecteur ne détient jamais son secret

Date : 8 septembre 2026 · Statut : accepté

## Contexte

Les connecteurs relient AIGMS à Vanta, OneTrust, ServiceNow ou Microsoft
Purview. Chacun demande un jeton ou une clé.

Le réflexe est de ranger ce secret à côté de la configuration qu'il sert : une
colonne `api_token` dans la table du connecteur. Ce réflexe crée une base de
données qui devient, à elle seule, la clé de tout l'écosystème d'un client. Elle
part dans les sauvegardes, transite dans les exports, apparaît dans les journaux
de requêtes lentes, et une politique RLS trop large la donne à lire.

## Décision

`governance_connector` ne porte pas de secret et n'en portera pas. Elle porte
`credential_env_var` : le **nom** de la variable d'environnement qui le détient.
Le secret vit dans le coffre de la plateforme d'hébergement.

Trois garde-fous rendent la règle effective plutôt que déclarative :

1. **Le format.** Une contrainte impose `^[A-Z][A-Z0-9_]{2,63}$` — un nom de
   variable, en majuscules.
2. **L'apparence.** Un trigger refuse toute valeur ayant la forme d'un jeton :
   plus de 64 caractères, minuscules, ou préfixe connu (`sk_`, `ghp_`, `sbp_`,
   `xox`…). Un copier-coller malheureux est rejeté par la base, pas seulement
   par le formulaire.
3. **Le formulaire le dit.** Un encadré indique explicitement de ne pas coller
   le secret, et le champ est pré-rempli avec le nom suggéré.

## Conséquences

- Une fuite de la base ne livre aucun accès aux systèmes tiers. Elle révèle
  quels connecteurs existent et quelles variables les portent — une information
  de configuration, pas un moyen d'accès.
- La configuration se fait **à deux mains** : l'administrateur déclare le
  connecteur dans l'application, et pose la valeur dans les variables
  d'environnement de la plateforme. C'est une friction assumée : elle est le
  prix de la séparation.
- Le test de configuration est honnête sur ce qu'il vérifie : la variable est-elle
  définie sur cet environnement, l'hôte répond-il. Un appel authentifié réel
  dépendra de l'API de chaque éditeur et viendra avec chaque intégration.
- Un connecteur ne peut pas passer `active` sans URL ni variable déclarée : la
  contrainte `connector_active_is_configured` s'en assure.
- **La lecture seule est le défaut**, et l'écriture vers un système tiers exige
  une justification écrite. AIGMS lit des métadonnées, des statuts et des
  preuves ; il ne prend pas la main sur les systèmes d'en face — c'est ce que
  promet la page publique, et la contrainte le tient.

## Alternatives écartées

- **Chiffrer le secret en base** (pgsodium, Vault Supabase) : déplace le
  problème vers la clé de chiffrement, qui vit alors quelque part. La solution
  ne devient intéressante qu'avec une rotation automatisée et un cloisonnement
  par tenant — hors périmètre du MVP, et inutile tant que le coffre de la
  plateforme fait le travail.
- **Un coffre externe** (AWS Secrets Manager, HashiCorp Vault) : la bonne
  réponse à l'échelle, une dépendance de trop aujourd'hui. `credential_env_var`
  ne l'interdit pas : il suffira de faire pointer la variable vers une référence
  de coffre.

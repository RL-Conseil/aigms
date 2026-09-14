# Mire de connexion — ce qui la protège

*Version 1.0 — 14 septembre 2026*

La mire est la seule surface de l'application accessible sans compte. Ce
document dit ce qui la protège aujourd'hui, et ce qui reste à activer.

## Ce qui est déjà en place

**Aucune inscription libre.** Les comptes sont déclarés par l'administration de
la plateforme, qui attribue les rôles (ADR-0008). Il n'y a pas de formulaire
d'inscription à attaquer.

**Pas d'énumération des comptes.** Le message d'échec ne distingue pas un compte
inconnu d'un mot de passe erroné. La réponse est la même dans les deux cas :
« Identifiants invalides. »

**Pas d'indexation.** La page porte `robots: { index: false, follow: false }`.

**Limitation de débit côté Supabase.** L'API d'authentification applique ses
propres seuils par adresse IP et par compte.

## Le captcha — deux réglages, et le second est celui qui protège

Cloudflare Turnstile est câblé dans la mire. Il demande **deux** réglages
indépendants :

1. **`NEXT_PUBLIC_TURNSTILE_SITE_KEY`** dans l'environnement de l'application
   (Vercel, `.env.local`). Elle fait **apparaître** le défi et fait partir le
   jeton avec l'authentification.

2. **Supabase : Authentication > Attack protection > Enable Captcha**,
   fournisseur *Turnstile*, avec la **clé secrète** du même widget. C'est ce
   réglage qui fait **refuser** une authentification dont le jeton est absent ou
   invalide.

> **Le second sans le premier** bloque toute connexion : Supabase exigera un
> jeton que la mire n'envoie pas.
>
> **Le premier sans le second** est pire que rien : le défi s'affiche, le jeton
> part, personne ne le vérifie. Un captcha décoratif fait croire à une
> protection qui n'existe pas.

Tant que la clé publique est absente, la mire fonctionne sans captcha — c'est
délibéré : le développement, les Previews et les tests de bout en bout n'ont pas
à résoudre un défi.

### Poser le widget

1. Sur `dash.cloudflare.com` > Turnstile, créer un widget pour le domaine
   `aigms.eu` (et ajouter le domaine des Previews Vercel si le captcha doit y
   être actif).
2. Reporter la **clé de site** dans `NEXT_PUBLIC_TURNSTILE_SITE_KEY`.
3. Reporter la **clé secrète** dans Supabase, écran cité plus haut.
4. Vérifier qu'une connexion réussit, puis qu'une connexion depuis un client qui
   n'envoie pas de jeton échoue.

## Ce qui reste ouvert

- **Second facteur.** Supabase gère le TOTP. Il n'est pas activé : à décider
  pour les comptes portant le rôle `platform_admin` en premier lieu.
- **Politique de mot de passe.** Longueur minimale et refus des mots de passe
  compromis se règlent côté Supabase (Authentication > Policies).
- **Comptes de démonstration.** Ils portent un mot de passe connu et doivent
  être retirés ou réinitialisés avant toute ouverture publique.

## Voir aussi

- `docs/adr/ADR-0008-account-provisioning.md` — pourquoi il n'y a pas
  d'inscription libre
- `docs/security/TENANCY_RLS_MODEL.md` — ce qui protège les données une fois la
  session ouverte

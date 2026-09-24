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

### Où va la clé secrète — et pourquoi pas sur Vercel

**AIGMS n'appelle jamais `siteverify` lui-même.** La mire envoie le jeton à
`signInWithPassword`, et c'est **Supabase Auth** qui le vérifie auprès de
Cloudflare, avec la clé secrète configurée sur le projet. Poser un
`TURNSTILE_SECRET_KEY` dans l'environnement de l'application ne protégerait
donc rien : aucune ligne de code ne le lirait.

C'est la conséquence de l'architecture, pas un choix : la mire n'a pas de
gestionnaire serveur à protéger, elle parle directement à Supabase.

### Poser le widget

1. Sur `dash.cloudflare.com` > Turnstile, créer un widget. **Les noms d'hôte
   comptent** : Turnstile refuse un défi servi depuis un domaine qu'il ne
   connaît pas. Déclarer `aigms.eu` (qui couvre `www.aigms.eu` et
   `demo.aigms.eu`), `localhost`, et **chaque alias de Preview Vercel** que le
   captcha doit laisser passer — `aigms-dev.vercel.app` en premier lieu.
2. Reporter la **clé de site** dans `NEXT_PUBLIC_TURNSTILE_SITE_KEY`
   (Vercel, `.env.local`). Elle est publique : elle peut circuler.
3. Poser la **clé secrète** dans `.env.local` sous `TURNSTILE_SECRET_KEY`, puis :

   ```
   npm run captcha:activer                 # sur la préprod
   npm run captcha:activer -- --production # sur la production
   npm run captcha:activer -- --etat       # ne change rien, dit où l'on en est
   ```

   Le script pose le fournisseur, le secret et l'activation sur Supabase **dans
   cet ordre** — un captcha activé sans secret ferait refuser toute
   authentification. Il ne rend que des booléens : le secret n'est jamais
   affiché, jamais passé en argument, jamais journalisé.

4. **Redéployer** — `NEXT_PUBLIC_*` n'entre en vigueur qu'au déploiement suivant.
5. Vérifier qu'une connexion réussit, puis qu'une connexion depuis un client qui
   n'envoie pas de jeton échoue.

> **L'ordre entre les deux environnements compte aussi.** Activer le captcha sur
> la préprod ferme la connexion à toute Preview dont le nom d'hôte n'est pas
> déclaré dans le widget, `demo.aigms.eu` compris. Vérifier la liste des
> domaines avant d'activer, pas après.

### Le jeton ne sert qu'une fois

Après un échec d'authentification, la page reste ouverte et le jeton est déjà
consommé : réessayer avec le même se ferait refuser par Cloudflare, et la
personne verrait un second échec sans rapport avec son mot de passe. La mire
réarme donc le widget à chaque échec — mot de passe comme annuaire — et repart
d'un jeton neuf.

### En local

`supabase/config.toml` laisse `[auth.captcha]` en commentaire, et cela reste
ainsi : l'activer casserait les tests et le développement, qui n'ont pas à
résoudre un défi.

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

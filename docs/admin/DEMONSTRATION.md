# L'environnement de démonstration

*29 septembre 2026.*

## Ce qu'il est

La branche `dev` est déployée en permanence sur Vercel, contre la base de
**préprod** (`xahqdxwmlewyjpsiuzux`). Elle porte le **jeu de démonstration
complet** — organisations, cas d'usage, risques, contrôles, preuves,
décisions, incidents, revues — **et ses comptes**, pour qu'une démonstration
se conduise sans rien préparer.

| Adresse | Qui y accède |
|---|---|
| `aigms-dev.vercel.app` | membres de l'équipe Vercel uniquement (protection SSO) |
| `demo.aigms.eu` | **tout le monde** — un domaine personnalisé échappe à la protection SSO |

C'est précisément la raison d'être du domaine personnalisé : montrer la
plateforme à un partenaire sans l'inviter dans l'équipe Vercel.

## Ce que cela implique, et qui est assumé

Ouvrir `demo.aigms.eu`, c'est **exposer la mire de connexion à l'internet**,
avec les comptes de démonstration actifs et leur mot de passe partagé. C'est
un choix : la démonstration doit être immédiatement utilisable.

Trois conséquences à garder en tête :

1. **Rien de réel ne doit entrer sur la préprod.** Aucune donnée client,
   aucun document confidentiel, aucune adresse personnelle. Ce qui y est
   déposé est lisible par quiconque connaît un compte de démonstration.
2. **Le captcha n'est pas actif** (`TURNSTILE_SECRET_KEY` absente) : la mire
   n'est pas protégée contre les tentatives automatisées. À poser quand la
   clé Turnstile sera disponible.
3. **La production, elle, ne porte pas le jeu de démonstration.** Sa purge est
   décrite dans `docs/roadmap/MISE_EN_PRODUCTION.md` §5, et elle reste due
   avant toute ouverture publique de `www.aigms.eu`.

## Mise en place

### 1. Ajouter le domaine (une fois, dans Vercel)

Vercel → projet `aigms` → *Settings* → *Domains* → ajouter `demo.aigms.eu`.
Vercel indique l'enregistrement DNS à créer chez le registraire — un `CNAME`
vers `cname.vercel-dns.com`.

Ne pas l'attacher à une branche Git : le projet n'est pas relié par branche
au dépôt (son lien pointe vers `rlabrador/aigms`, alors que les poussées vont
sur `RL-Conseil/aigms`). C'est le script de déploiement qui l'attache.

### 2. Déployer

```
npm run deploy:preview
```

Depuis `dev`, le script pose **deux** alias sur le déploiement : l'alias de
branche `aigms-dev.vercel.app` et le domaine `demo.aigms.eu`. Tant que le
domaine n'est pas ajouté au projet, il le dit sans faire échouer le
déploiement.

Le domaine se change par `VERCEL_DEMO_DOMAIN` ; la branche suivie est `dev`.

## Comptes de démonstration

Ils vivent dans `supabase/seed.sql` et se rejouent à chaque
`supabase db reset`. Le mot de passe est partagé et documenté là. Ils ne
doivent **jamais** exister en production.

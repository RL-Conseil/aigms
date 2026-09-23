# ADR-0030 — Le jeton se vérifie ici, les compteurs arrivent après

*24 septembre 2026. Migration 0093.*

Fin de l'audit de latence du 23 septembre 2026, après ADR-0028 (la région) et
ADR-0029 (la mise en page et l'écran d'attente).

## 1. `getClaims()` remplace `getUser()` sur le chemin de lecture

`getUser()` interroge le serveur d'authentification **à chaque appel**. Le
proxy en voyait un par requête — et il en voit beaucoup : chaque navigation,
mais aussi chaque **préchargement de lien**, que Next déclenche au survol.
Survoler la barre en tirait une poignée. Le contexte de la personne en faisait
un second, à chaque rendu de page.

Les deux projets Supabase signent en **ES256** (vérifié par l'API de gestion :
la clé HS256 est `previously_used`, l'ES256 est `in_use`). `getClaims()`
récupère alors la clé publique une fois, la garde, et vérifie la signature
localement. Ce n'est pas une vérification au rabais : c'est exactement celle
que fait PostgREST avant d'appliquer la RLS.

**Ce que cela change.** Une session révoquée côté serveur reste acceptée
jusqu'à l'expiration du jeton — **une heure au plus** (`jwt_exp = 3600`).

**Pourquoi c'est acceptable.** L'accès aux **données** se comportait déjà
ainsi : PostgREST sert sur la seule foi de la signature. Le proxy était donc
plus strict que la couche qui décide vraiment. Ce changement aligne la porte
sur la RLS, qui est l'autorité (CLAUDE.md : « l'autorisation réelle est portée
par la RLS »). Et couper quelqu'un immédiatement se fait là où cela compte —
en retirant son affectation (`valid_until = now()`), lue en base à chaque
requête, donc appliquée au clic suivant.

**Ce qui ne change pas.** Les **actions serveur** — toute écriture — gardent
`getUser()`. Une mutation est rare, un aller-retour y est sans conséquence, et
c'est le moment où la vérification la plus stricte se justifie.

## 2. Les compteurs n'empêchent plus la barre de s'afficher

La mise en page attendait ses quatre lectures avant de rendre quoi que ce soit.
Deux d'entre elles ne servent qu'à des **pastilles**.

Désormais elle n'attend que ce sans quoi la barre n'existe pas — qui vous êtes,
sous quelle marque — et les deux partent ensemble : **une vague**. Les
compteurs sont passés en **promesses**, que la barre consomme derrière une
frontière `Suspense`, pastille par pastille. Les intitulés, les liens et les
menus s'affichent sans attendre la base.

Une pastille absente une fraction de seconde ne trompe personne ; une barre
absente une seconde, si.

Chaque promesse porte un `catch` : un compteur indisponible ne doit pas
emporter la navigation. La barre s'affiche alors sans pastille — le pire cas
acceptable.

## 3. Deux N+1 disparaissent

- **Comptes et rôles** appelait `organization_readiness` une fois par
  organisation : sept allers-retours pour sept clients, cinquante pour
  cinquante. La migration 0093 ajoute `public.organizations_readiness()`, même
  calcul appliqué au périmètre entier, `security invoker` donc mêmes refus.
  C'est ce que fait déjà `attention_by_organization` pour les compteurs.
- **Actifs et fournisseurs** lisait les personnes organisation par
  organisation. `peopleByOrganization` fait la même lecture avec un `in` —
  aucune migration, le regroupement était déjà côté application.

## Ce qui reste, et pourquoi je ne l'ai pas fait

`apply_due_decisions` s'exécute toujours pendant le rendu de la fiche d'un cas
d'usage : une **écriture** sur le chemin le plus chaud. La sortir de là n'est
pas un travail de performance mais une **décision de gouvernance** — elle
déplacerait le moment où un jalon franchit sa date d'effet, du premier
affichage de la fiche à un balayage quotidien. Cela demanderait une fonction de
service balayant tous les tenants (la fonction actuelle est bornée par
`app.has_tenant_access`, qui ne répond rien sous la clé de service), et cela
changerait un comportement observable du registre de décisions.

Le gain est d'une vague sur une page. Le sujet mérite d'être posé pour
lui-même, pas glissé dans un lot de performance.

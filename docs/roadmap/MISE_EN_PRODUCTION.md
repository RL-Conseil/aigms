# AIGMS — Mise en production

Version 1.0 — 8 septembre 2026

## 1. Écart entre la production et `dev`

**Vérifié le 11 septembre 2026.**

| | |
|---|---|
| Domaine de production | `www.aigms.eu` — l'apex `aigms.eu` y redirige en 308. `aigms.vercel.app` reste servi. |
| `main` | `c7bba41` — le socle et le vertical slice |
| `dev` | `fe1c02b` |
| Écart | **25 commits, 14 migrations** (`0017` à `0030`) |

**Le déploiement en ligne ne correspond à aucune branche.** Il a été construit
le 7 septembre depuis `1a76da2e` (« Ajoute la CI GitHub Actions »), commit resté
isolé sur `feat/ci-github-actions` faute du scope `workflow` sur le jeton GitHub,
et jamais fusionné. Fonctionnellement il équivaut à `main`, mais la provenance
n'est pas reconstituable depuis l'historique : la prochaine bascule doit repartir
de `main`.

Ce que la production ne fait pas encore :

| Apport | Ce qui manque en ligne |
|---|---|
| Surface de l'application | `/` redirige vers `/login` ; la mire d'accueil, l'abstract et la fermeture de la surface anonyme sont absents |
| Espace `/admin` | Les écrans vivent à la racine (`/portfolio`, `/dashboard`) |
| Périmètre d'administration | `is_platform_admin()` court-circuite tous les contrôles de rôle : l'administrateur peut gouverner |
| Comptes et rôles | Aucun écran de gestion des comptes, aucun courriel d'ouverture d'accès |
| Connecteurs et référentiels | Tables, écrans et moteur d'import absents |
| ISO/IEC 42001 Annexe A | Référentiel non chargé, Déclaration d'Applicabilité absente |
| Cartographie orientée processus | Processus, activités, graphe, santé de la gouvernance : rien |
| Dépôt de preuves | Ni compartiment de stockage, ni registre, ni validation nominative |
| Matrice des preuves | Profil d'activité et régime de preuve absents |
| Vocabulaire | L'écran s'appelle encore « Portefeuille » |

## 2. Le point à trancher avant tout

**La production ne porte aucun compte réel.** Elle contient le jeu de
démonstration, dont les mots de passe sont publics.

La migration `0017` retire à l'administration les droits de gouvernance. Après
bascule, gouverner un cas d'usage en production exigera un compte portant un
rôle de gouvernance — attribué par un administrateur.

Il faut donc **au moins un compte réel avant la bascule** :

1. Console Supabase de `aigms-supabase` → Authentication → Add user. Renseigner
   une adresse et un mot de passe solide, cocher « Auto Confirm User ».
2. Le promouvoir, dans l'éditeur SQL :

```sql
-- 1. Privilège plateforme
update public.user_profile
   set is_platform_admin = true,
       full_name = 'Votre nom',
       job_title = 'Administration de la plateforme'
 where email = 'votre.adresse@exemple.fr';

-- 2. Rattachement au tenant, avec le rôle d'administration
insert into public.membership (tenant_id, user_id, role)
select t.id, p.id, 'platform_admin'
  from public.tenant t, public.user_profile p
 where t.slug = 'rl-conseil'
   and p.email = 'votre.adresse@exemple.fr'
on conflict (tenant_id, user_id) do update set role = 'platform_admin';
```

Ces deux requêtes s'exécutent depuis la console, avec les droits de service :
`app.assignable_roles()` interdit d'attribuer `platform_admin` depuis
l'application, et c'est voulu.

Depuis ce compte, vous déclarerez ensuite les comptes de gouvernance par
l'écran **Comptes et rôles**.

## 3. Séquence

L'ordre importe : **les migrations d'abord, le code ensuite**. Elles sont
additives — nouvelles tables, nouvelles colonnes, politiques resserrées — et
l'ancien code continue de fonctionner entre les deux. L'inverse ne tient pas :
le nouveau code interrogerait des tables absentes.

| # | Qui | Action |
|---|---|---|
| 1 | vous | Créer le compte réel et le promouvoir (§2) |
| 2 | vous | `git switch main && git merge --ff-only dev && git push` |
| 3 | Claude | Appliquer les migrations `0017` à `0021` sur `aigms-supabase` |
| 4 | Claude | `npm run deploy:prod` |
| 5 | Claude | Vérifier (§4) |
| 6 | vous | Décider de la purge du jeu de démonstration (§5) |

L'étape 2 vous revient : vous seul poussez sur `main`.

## 4. Vérifications après bascule

| Contrôle | Attendu |
|---|---|
| `GET /` | Page de présentation, sans session |
| `GET /contact` | Formulaire accessible |
| `GET /admin` sans session | Redirection vers `/login` |
| Connexion avec le compte réel | Bandeau « Administration de la plateforme » |
| Lecture anonyme de `tenant` et `ai_use_case` | Refusée (401) |
| Insertion anonyme dans `contact_request` | Acceptée (201), lecture refusée |
| `evaluate_gate` sur `UC-2026-0001` | 8/8 tant que le jeu de démonstration est en place |
| `/admin/connecteurs` et `/admin/referentiels` | Accessibles à l'administration, refusés aux rôles de gouvernance |

## 5. Purge du jeu de démonstration

À faire **après** avoir vérifié qu'un compte réel fonctionne, faute de quoi la
production devient inaccessible.

```sql
-- Les suppressions en cascade emportent l'ensemble des données rattachées.
-- Le journal d'audit du tenant est conservé : il porte l'historique.
delete from auth.users where email like '%.demo';
delete from public.contact_request where email like '%@exemple-test.fr';
```

Le tenant `RL Conseil` et son organisation `IzarLink Demo` disparaissent avec
leurs comptes. Recréez alors votre tenant et vos organisations depuis l'écran
**Organisations**.

Une variante conserve la structure et n'efface que les cas d'usage fictifs :
supprimer les lignes de `ai_use_case`, `risk`, `governance_decision`,
`impact_assessment`, `control`, `evidence`, `change_request` et `incident` du
tenant concerné, en laissant `tenant`, `organization` et `membership`.

## 6. Retour arrière

- **Le code** : Vercel garde chaque déploiement. Le tableau de bord permet de
  promouvoir la version précédente en une action, sans rebuild.
- **Le schéma** : les migrations `0017` à `0021` sont additives, sauf `0017`
  qui resserre des politiques. Y revenir demande une migration correctrice, pas
  une restauration. Prendre une sauvegarde avant l'étape 3 reste la précaution
  la moins chère.

## 7. Ce qui reste hors du périmètre de cette bascule

- **La CI** n'est pas dans `dev` : le commit `.github/workflows/ci.yml` attend
  sur `feat/ci-github-actions`, faute du scope `workflow` sur le jeton GitHub.
  `gh auth refresh -h github.com -u rlabrador -s workflow` puis un merge le
  débloquent.
- **Les déploiements automatiques** : l'App GitHub de Vercel n'a pas accès à
  l'organisation `RL-Conseil`, d'où le déploiement par script. L'installer
  rendrait Preview et Production automatiques au push.
- **Le changement de mot de passe depuis l'application** n'existe pas : il se
  fait depuis la console Supabase.

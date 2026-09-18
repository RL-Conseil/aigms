# Comptes : déclaration manuelle, et branchement d'un annuaire d'entreprise

*18 septembre 2026.*

## 1. Déclarer un compte à la main (Comptes et rôles)

L'administration de la plateforme déclare un compte en cinq champs : nom,
adresse, fonction, rôle, organisation, et un mot de passe provisoire (douze
caractères au moins) qui se transmet **par un autre canal** que le courriel
d'ouverture d'accès. Le compte est créé, rattaché au tenant avec son rôle,
affecté à l'organisation ; la personne se connecte et change son mot de passe.

### Pré-requis par environnement : la clé de service

La création du compte d'authentification est le **seul** point de l'application
qui emploie la clé `service_role` de Supabase (ADR-0008). Elle ne sert qu'à
`auth.admin.createUser` ; tout le reste — profil, appartenance, affectation —
passe par la session de l'administrateur, sous RLS.

Cette clé vit dans les variables d'environnement du déploiement, jamais dans
le code ni dans Git :

| Environnement | Variable | Valeur |
|---|---|---|
| poste de développement | `.env.local` → `SUPABASE_SERVICE_ROLE_KEY` | clé du projet local ou de préprod |
| Vercel *Preview* / *Development* | `SUPABASE_SERVICE_ROLE_KEY` (type *sensitive*) | clé `service_role` du projet **préprod** `xahqdxwmlewyjpsiuzux` |
| Vercel *Production* | `SUPABASE_SERVICE_ROLE_KEY` (type *sensitive*) | clé `service_role` du projet **production** `xsagbzrgoljzgorwvsir` |

La clé se lit dans Supabase → *Project Settings* → *API keys* (« service_role »,
à ne jamais exposer côté navigateur). Elle se pose sur Vercel → *Project* →
*Settings* → *Environment Variables*, ou par la CLI :

```
vercel env add SUPABASE_SERVICE_ROLE_KEY preview      # colle la clé préprod
vercel env add SUPABASE_SERVICE_ROLE_KEY development  # idem
vercel env add SUPABASE_SERVICE_ROLE_KEY production   # colle la clé production
```

Puis redéployer (`npm run deploy:preview`). **Sans la clé**, « Déclarer le
compte » répond : *Déclaration impossible : la clé de service n'est pas
configurée sur cet environnement.* C'est l'erreur rencontrée sur la Preview le
18 septembre 2026 : aucune des trois cibles Vercel ne portait la variable.

### Ce que « six rôles » impose

Une organisation n'est opérationnelle qu'avec ses six rôles tenus (migration
0056) : la page Comptes le lit organisation par organisation, et dit lesquels
manquent. Déclarer les comptes dans cet ordre évite le blocage : AI Governance
Officer, Porteur de l'IA, Expert métier, Comité des risques, Comité de
direction, Auditeur.

## 2. Brancher un annuaire d'entreprise (Microsoft Entra ID, ex-Azure AD)

Trois niveaux, cumulables. AIGMS s'appuie sur Supabase Auth ; rien n'est à
coder pour les deux premiers, tout se configure.

### Niveau A — Connexion par l'annuaire (SSO), sans rien changer aux comptes

**Option A1 — OpenID Connect « Microsoft » (tous plans Supabase).**
1. Entra ID → *App registrations* → *New registration* : nom « AIGMS »,
   comptes « single tenant », URI de redirection
   `https://<ref>.supabase.co/auth/v1/callback` (préprod puis production).
2. *Certificates & secrets* → nouveau secret client (noter l'expiration : 12 ou
   24 mois, à renouveler dans le calendrier de l'AI Governance Officer).
3. Supabase → *Authentication* → *Providers* → *Azure* : Client ID, secret,
   **Azure Tenant URL** = `https://login.microsoftonline.com/<tenant-id>` (pour
   refuser les comptes personnels Microsoft).
4. Dans AIGMS, la mire propose « Se connecter avec Microsoft » —
   `supabase.auth.signInWithOAuth({ provider: 'azure', options: { scopes: 'email openid profile' } })`.
   (Bouton à ajouter sur la mire : petite évolution, sans migration.)

**Option A2 — SAML 2.0 (plan Supabase Pro ou supérieur).** Pour les DSI qui
imposent SAML ou un IdP autre qu'Entra (Okta, ADFS, Keycloak) :
1. Entra ID → *Enterprise applications* → *New application* → *Create your own*
   → « Integrate any other application » ; *Single sign-on* → SAML.
   Identifier (Entity ID) : `https://<ref>.supabase.co/auth/v1/sso/saml/metadata` ;
   Reply URL (ACS) : `https://<ref>.supabase.co/auth/v1/sso/saml/acs`.
   Claims : `email`, `name` ; ajouter un claim de groupes si l'on veut les rôles
   (voir niveau C).
2. Côté Supabase : `supabase sso add --project-ref <ref> --type saml
   --metadata-url '<URL App Federation Metadata>' --domains client.fr
   --attribute-mapping-file mapping.json`.
3. Dans AIGMS, la mire propose « Se connecter avec l'annuaire de mon
   organisation » : saisie de l'adresse, `signInWithSSO({ domain })` redirige
   vers l'IdP du domaine.

**Dans les deux cas**, à la première connexion, le déclencheur
`on_auth_user_created` crée le profil ; la personne n'a **aucun rôle** tant que
l'administration ne l'a pas rattachée (Comptes et rôles) — ou tant que le
niveau C ne l'a pas fait. C'est voulu : l'annuaire dit *qui* est là, AIGMS dit
*ce qu'elle a le droit de faire*.

Réglages complémentaires : sur un domaine géré par SSO, désactiver
l'inscription par mot de passe (Supabase → *Authentication* → *Sign In /
Providers* → *Email* → « Enable sign up » off) et laisser le captcha.

### Niveau B — Restreindre aux personnes de l'annuaire

Entra ID → *Enterprise application* → *Properties* → « Assignment required »
= Yes, puis *Users and groups* : seules les personnes ou groupes affectés
peuvent se connecter. AIGMS n'a rien à faire ; c'est le bon endroit pour
appliquer une règle de départ (compte désactivé dans l'annuaire = plus de
connexion, immédiatement).

### Niveau C — Provisionner rôles et organisations depuis les groupes (proposition)

Supabase ne parle pas SCIM. Pour que l'annuaire **attribue les rôles**, AIGMS
porterait un *connecteur annuaire* — `microsoft_entra` existe déjà dans le
catalogue des connecteurs (page Connecteurs), en lecture seule, jamais source
de vérité pour la gouvernance :

1. **Une convention de groupes** dans Entra : `AIGMS-<code organisation>-<rôle>`,
   par exemple `AIGMS-IZL-officer`, `AIGMS-IZL-owner`, `AIGMS-IZL-expert`,
   `AIGMS-IZL-risques`, `AIGMS-IZL-direction`, `AIGMS-IZL-auditeur`. Six groupes
   par organisation, un par rôle — la règle « six rôles tenus » se lit alors
   directement dans l'annuaire.
2. **Une table de correspondance** en base (`directory_group_mapping` : groupe →
   organisation, rôle), administrée depuis Connecteurs, journalisée.
3. **Une synchronisation** : l'application lit les membres des groupes par
   Microsoft Graph (`GroupMember.Read.All`, application permission, secret ou
   certificat dans les variables d'environnement), et pour chaque personne :
   crée le compte s'il n'existe pas (invitation SSO, sans mot de passe), pose
   l'appartenance au tenant, pose ou révoque les affectations
   (`valid_until = now()` pour un retrait — jamais de suppression, le journal
   garde qui a eu quel rôle). Déclenchée à la demande (« Synchroniser » sur le
   connecteur) et par une tâche planifiée (Vercel Cron, quotidienne).
4. **Garde-fous** : la synchronisation ne touche jamais `platform_admin` ; elle
   refuse de laisser une organisation sans AI Governance Officer ; elle rend
   compte (comptes créés, affectations posées, retirées, refusées) dans le
   journal des connecteurs, et la page Comptes affiche « géré par l'annuaire »
   sur les comptes concernés, dont le rôle ne se change plus à la main.

Ordre de grandeur : une migration (table de correspondance, journal de
synchronisation), une action serveur de synchronisation, un écran dans
Connecteurs, le bouton SSO sur la mire — un sujet de branche `feat/annuaire`.
À décider avant : plan Supabase (SAML exige Pro), et si les groupes portent
aussi les organisations (multi-clients d'un cabinet) ou seulement les rôles.

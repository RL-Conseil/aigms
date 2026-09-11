# AIGMS — État d'avancement

Version 1.0 — 7 septembre 2026

## Sprints du backlog

| Sprint | Périmètre | État |
|---|---|---|
| 0 — Foundation | dépôt, environnements, CI, Supabase, migrations, Auth, tenancy, RLS, audit_log, ADR | **Terminé** |
| 1 — Organization / Context / Roles | organisations, entités, rôles, parties prenantes | **Terminé** : création d'organisation, déclaration de comptes et attribution de rôles depuis l'application, réservées à l'administration ([ADR-0008](../adr/ADR-0008-account-provisioning.md)) |
| 2 — AI Registry + Intake | cas d'usage, systèmes, modèles, agents, datasets, fournisseurs, cycle de vie | **Terminé** : cartographie des processus, formulaire d'intake, rattachement à une activité |
| 3 — Triage + pré-classification | criticité, rôle réglementaire, drapeaux, revue juridique | **Terminé** : saisis depuis le dossier du cas d'usage |
| 4 — Risk Management | scénarios, cotation, traitement, acceptation, revue | **Terminé** : création et acceptation depuis le dossier ; le niveau reste calculé par la base |
| 5 — AI Impact Assessment | parties prenantes, constats, mesures, revue | **Terminé** |
| 6 — Human Oversight | autonomie, responsable, déclencheurs, autorité d'arrêt | **Terminé** |
| 7 — Controls / Requirements / Mapping | référentiels, exigences, contrôles, mapping N:N, applicabilité | **Terminé** |
| 8 — Evidence | dépôt, propriétaire, fraîcheur, validation, rattachement | **Partiel** — le stockage de fichiers Supabase Storage n'est pas câblé |
| 9 — Decision Register + gates | décisions, conditions, liens, contrôles serveur de transition | **Terminé** |
| 10 — Vendor Governance | criticité, contrats, sécurité, réversibilité, revue | **Terminé** (côté données) |
| 11 — Change + Reassessment Engine | demande, screening, verdict, réouverture | **Terminé** |
| 12 — Incident / CAPA | incident, confinement, cause, CAPA, efficacité | **Terminé** (côté données) |
| 13 — OPERATE Dashboard | revues dues, risques, décisions, preuves, actions, incidents | **Terminé** |
| 14 — Audit / Management Review | constats, revue de direction, export | **Non commencé** |
| 15 — Connector Framework | contrat abstrait, lecture seule, fraîcheur | **Partiel** : `governance_connector` porte le contrat d'intégration — source, capacités, habilitations, fréquence, fraîcheur, erreurs — et l'écran d'administration le configure. Aucune intégration réelle n'est encore branchée ([ADR-0009](../adr/ADR-0009-connector-secrets.md)) |
| — Référentiels de contrôles | import, validation, publication d'une bibliothèque de contrôles-types | **Terminé** : flux complet de `IMPORT_SPEC.md`, éprouvé sur le paquet AIGMS Control Framework v0.1 — 12 domaines, 120 contrôles |

## Vertical slice — critère du prompt de build

`Organization → AI Use Case → Triage → Classification → Risk → Impact →
Human Oversight → Governance Decision → Pilot/Production → Audit Timeline`
puis `Change → Reassessment → updated Decision → Dashboard`.

**Livré et vérifié de bout en bout.** Le jeu de démonstration rejoue ce parcours
par les fonctions de transition réelles : si un gate régresse, le seed échoue.

## Tests

| Suite | Nombre | Couvre |
|---|---|---|
| `tests/unit` | 12 | libellés et présentation du domaine |
| `tests/rls` | 90 | isolation cross-tenant, RBAC, transitions interdites, gate production, acceptation de risque, registre de décisions, moteur de réévaluation, journal d'audit, parité interface/base, surface publique |
| `tests/e2e` | 30 | site public et formulaire de contact ; connexion, parcours complet, refus de gate motivé, tableau de bord |

Tous verts au 7 septembre 2026.

## Provisionnement

| Ressource | État |
|---|---|
| Dépôt GitHub `RL-Conseil/aigms` | privé, existant |
| Supabase local (Docker) | opérationnel, 15 migrations appliquées |
| Supabase `aigms-supabase` (`xsagbzrgoljzgorwvsir`, eu-west-1) | **production** : 16 migrations appliquées. Porte encore le jeu de démonstration, à purger une fois un compte réel créé |
| Supabase `aigms-supabase-preprod` (`xahqdxwmlewyjpsiuzux`, eu-west-1) | **preprod** : 16 migrations et jeu de démonstration, étanchéité et gates vérifiés par appels API. Sert les déploiements Preview |
| Vercel | **provisionné** : projet `aigms` (équipe `rlabradors-projects`), variables d'environnement posées. Production sur `www.aigms.eu` — l'apex `aigms.eu` y redirige en 308, et `aigms.vercel.app` reste servi |
| Notification des demandes de contact | **fonctionnelle** : clé Resend chiffrée dans les variables Vercel, envoi depuis `contact@iparenea.fr` sur domaine vérifié, notification vers la même adresse |
| CI GitHub Actions | écrite ; le push nécessite le scope `workflow` sur le jeton `gh` |

## Vérification du projet distant

Effectuée par appels API le 7 septembre 2026 :

| Contrôle | Résultat |
|---|---|
| Lecture anonyme de `tenant` et `ai_use_case` | refusée (42501) |
| Écriture anonyme de `tenant` | refusée (42501) |
| `app.log_audit` atteignable depuis l'API publique | non — le schéma `app` n'est pas exposé |
| Connexion `officer@rl-conseil.demo` puis lecture | 3 cas d'usage de son tenant |
| `evaluate_gate` sur `UC-2026-0001` | 8/8 préconditions satisfaites |
| Lecture par l'officer du second tenant | tableau vide |

## Environnements

| Environnement | Base | Variables Vercel |
|---|---|---|
| Production (`aigms.vercel.app`, branche `main`) | `aigms-supabase` | cible `production` |
| Preview (une par branche) | `aigms-supabase-preprod` | cibles `preview` et `development` |
| Poste de développement | stack Supabase locale (Docker) | `.env.local` |

Le poste de développement reste sur la stack Docker : les tests d'isolation
exigent une connexion Postgres directe et rejouent `db reset` à volonté, ce
qu'on ne fait pas sur une base partagée. Les migrations remontent donc dans
l'ordre local → preprod → production, chacune par `supabase db push`.

Deux jetons Supabase cohabitent, un par projet : celui qui couvre
`aigms-supabase` ne voit pas preprod, et inversement.

## Structure des routes

| Route | Accès |
|---|---|
| `/` | **seule page ouverte** — mire de connexion et abstract du produit |
| `/login` | redirection vers `/`, en conservant `next` |
| `/admin` | session requise — organisations |
| `/admin/pilotage` | session requise — tableau de bord OPERATE |
| `/admin/organizations/[id]`, `/admin/use-cases/[id]` | session requise |
| `/admin/contacts` | session requise, réservée à l'administration plateforme — archive des demandes reçues avant la fermeture de l'entrée |
| `/admin/connecteurs` | session requise, réservée à l'administration plateforme |
| `/admin/referentiels` | session requise, réservée à l'administration plateforme |
| `/admin/comptes` | session requise, réservée à l'administration plateforme — comptes et rôles |
| `/admin/organisations/nouvelle` | session requise, réservée à l'administration plateforme |
| `/admin/parametres` | session requise — profil, rôle, organisation |
| `/admin/organizations/[id]/declaration-applicabilite` | session requise — couverture ISO/IEC 42001 exigence par exigence |
| `/admin/organizations/[id]/processus` | session requise — trois lectures du même modèle (`?vue=arbre\|couverture\|risques`) ; sélection et lecture passent par l'URL et se partagent |
| `/admin/organizations/[id]/cas-d-usage/nouveau` | session requise — fiche d'intake |

`src/proxy.ts` ne protège que le préfixe `/admin` ; l'autorisation réelle reste
portée par la RLS.

## Courrier système

La plateforme dispose d'un unique point d'envoi, `src/lib/email/mailer.ts`,
expédiant depuis le compte système `contact@caritis.fr` via Resend — domaine
vérifié, région `eu-west-1`. Deux variables le pilotent, sans code à modifier :
`RESEND_API_KEY` et `SYSTEM_EMAIL_FROM`.

Deux principes le façonnent, et ils expliquent sa forme :

1. **L'envoi est une commodité, jamais un point de passage.** Un compte déclaré
   l'est même si le courriel ne part pas. `sendSystemEmail` ne lève jamais : elle
   rend un résultat (`not_configured`, `refused`, `unreachable`) que l'appelant
   présente. Faire échouer une déclaration de compte parce qu'un fournisseur de
   courriel est indisponible serait une régression de gouvernance.
2. **Aucun secret ne transite par courriel.** Ni mot de passe, ni jeton. Ce que
   la plateforme envoie est une information, pas un moyen d'accès. Un test le
   vérifie sur le contenu du message.

Sans variables — poste de développement, intégration continue — le module se
tait proprement. Le premier usage câblé est l'**ouverture d'accès** : à la
déclaration d'un compte, la personne reçoit l'adresse de connexion, son rôle et
son périmètre. Son mot de passe provisoire continue de se transmettre par un
autre canal.

## La vitrine a quitté l'application

AIGMS est une application SaaS : la page de présentation et le formulaire de
contact sont repris par le site commercial (https://caritis.fr). Le contenu de
l'ancienne page d'accueil est exporté dans
[`03_Commercial/PAGE_ACCUEIL_CARITIS.md`](../../03_Commercial/PAGE_ACCUEIL_CARITIS.md),
prêt à être remonté ailleurs — textes, tableaux de données des trois graphiques,
frise réglementaire, précautions à conserver.

Ce que cela change dans le produit
([ADR-0013](../adr/ADR-0013-application-only-surface.md)) :

- **L'accueil est la mire de connexion.** Une session ouverte y est renvoyée
  vers `/admin` ; `/login` redirige vers `/` en conservant `next`, parce que
  l'adresse a circulé.
- **Aucune inscription libre**, et l'écran le dit. Les comptes sont déclarés par
  l'administration de la plateforme, qui attribue les rôles (ADR-0008) : un
  formulaire d'inscription contredirait le modèle d'habilitation dont dépend le
  registre de décisions.
- **La surface anonyme est refermée.** `contact_request` était la seule
  exception à la règle « anon ne dispose d'aucun droit » ; l'exception n'a plus
  d'objet, et la laisser ouverte maintiendrait une écriture anonyme sans
  formulaire pour l'émettre. Un test vérifie désormais qu'`anon` ne détient
  **aucun** droit sur **aucune** table du schéma `public`.
- **La table et ses données sont conservées.** Les demandes déjà reçues sont des
  pistes commerciales réelles ; `/admin/contacts` continue de les présenter,
  comme archive. Ce qui ferme, c'est l'entrée.
- `RESEND_API_KEY`, `CONTACT_NOTIFICATION_EMAIL` et `CONTACT_NOTIFICATION_FROM`
  ne sont plus lues par le code. Elles peuvent être retirées de Vercel.

## Cartographie orientée processus — incrément 1 sur 4

Le modèle cible de `SPEC_PROCESS` devient :
`Organisation → Processus → Activité → Cas d'usage IA → Risque → Contrôle →
Preuve → Décision → Action`.

`process` et `activity` étaient le chaînon manquant : `business_process` n'était
qu'un champ de texte libre, qu'on pouvait écrire mais pas interroger — donc pas
agréger, pas cartographier. Il est conservé comme note de contexte, le
rattachement structuré passant par `ai_use_case.activity_id`.

| Incrément | Contenu | État |
|---|---|---|
| 1 | Modèle processus/activité, cartographie, saisie intake, triage, classification, risques | **Terminé** |
| 2 | Process & Risk Map avec indicateurs par nœud et panneau latéral | **Terminé** |
| 3 | Control Coverage Map et Risk Heatmap | **Terminé** |
| 4 | AI Control Graph, couches activables, chemin du risque | **Terminé** |

**Principe retenu pour la fluidité** : la carte n'est pas un rapport qu'on
consulte, c'est l'établi sur lequel on travaille. Un nœud vide est une
invitation à saisir — une activité sans usage d'IA propose d'en déclarer un.
Les formulaires vivent dans des volets, sur la fiche même : on saisit là où l'on
regarde.

### Quatre lectures du même modèle

Un seul écran, quatre questions, une seule adresse — `?vue=` :

| Lecture | Ce qu'elle répond |
|---|---|
| **Processus** | Que fait l'organisation, et où l'IA intervient |
| **Couverture** | Ce qui tient réellement : contrôles opérants, prouvés, testés récemment |
| **Risques** | Où se concentre l'exposition, par processus et par niveau |
| **Graphe** | Ce que la hiérarchie ne montre pas : un contrôle partagé, une preuve mutualisée, un risque dont rien ne redescend vers une preuve |

Deux partis pris méritent d'être connus. Le **taux de couverture est exigeant** :
un contrôle ne compte que s'il est opérant *et* prouvé par une preuve validée
non échue. Un contrôle déclaré sans preuve ne protège personne, et c'est ce
qu'un auditeur vient vérifier. La **carte thermique compte les risques
ouverts**, pas le total : un risque accepté est une décision assumée, avec un
responsable et une date de revue — le laisser clignoter en rouge reviendrait à
confondre une décision avec une alerte.

### L'AI Control Graph et le chemin du risque

L'arbre montre une hiérarchie. Il ne sait pas montrer ce qui la traverse. Le
graphe existe pour cela, et pour rien d'autre : six couches de gauche à droite —
`processus → activité → cas d'usage → risque → contrôle → preuve` — trois
couches activables (risques, contrôles, preuves) et un placement par barycentre
qui range chaque couche sous ses parents. Les croisements qui subsistent sont
ceux qui portent l'information : un contrôle partagé entre deux cas d'usage
*doit* se voir croiser.

**Le graphe a imposé une correction du modèle.** Rien ne reliait un risque au
contrôle censé le réduire ; le rapprochement n'aurait pu être qu'inféré — « ces
contrôles s'appliquent au même cas d'usage » — ce qui ne démontre rien. Le lien
est désormais déclaré et porté par le plan de traitement
(`risk_treatment.control_id`). Le graphe distingue donc deux arêtes qu'il ne
faut jamais confondre : **applicable à** (une décision d'applicabilité) et
**désigné pour traiter** (une chaîne de maîtrise opposable). Voir
[ADR-0010](../adr/ADR-0010-declared-risk-control-link.md).

**Le chemin du risque** (`app.risk_path`) rend un verdict plutôt qu'un dessin.
Il ne dit pas « incomplet » : il nomme le maillon exact où la chaîne rompt,
parce que les quatre ruptures n'appellent pas la même action.

| Verdict | Ce qui manque | Ce qu'il faut faire |
|---|---|---|
| `no_treatment` | aucun plan de traitement | ouvrir un traitement, ou accepter le risque nominativement |
| `no_control` | un traitement écrit que rien n'exécute | désigner le contrôle qui le met en œuvre |
| `control_not_operating` | le contrôle désigné n'est pas opérant | le faire passer en état opérant |
| `no_evidence` | le contrôle opère sans rien démontrer | y rattacher une preuve validée et non échue |

Un **risque accepté n'est pas une chaîne rompue**. L'acceptation est une
décision humaine nominative, justifiée et datée ; exiger en plus une chaîne
complète reviendrait à la dénier.

Le jeu de démonstration illustre les cinq issues, une par risque — c'est ce qui
rend la règle vérifiable plutôt que déclarative.

### La santé de la gouvernance

`app.governance_health(organisation, activité)` produit un indice sur 100,
accompagné de ses causes. Ce qu'il mesure : **l'entretien du dispositif** —
risques élevés laissés sans suite, preuves échues, revues en retard, actions
échues, incidents non clos, contrôles applicables jamais rendus opérants.

Ce qu'il ne mesure pas, et le dit dans sa propre réponse
(`not_a_measure_of: "conformité réglementaire"`) : la conformité. Un nombre sur
cent dans un outil de gouvernance se lit spontanément comme un taux de
conformité, ce que les interdictions produit excluent. L'affichage nomme donc
l'indice « santé de la gouvernance », montre ses causes à côté de lui, et écrit
en toutes lettres qu'il n'est pas un taux de conformité.

Trois garde-fous rendent l'indice défendable :

1. **Chaque pénalité est nommée, fixe et plafonnée.** L'indice se recalcule de
   tête à partir des causes affichées — un test le vérifie arithmétiquement.
2. **Sans usage d'IA déclaré, aucun indice n'est produit.** Un score sur un
   périmètre vide serait un chiffre sans objet.
3. **Il reste soumis à l'habilitation.** Un tenant étranger n'obtient rien.

## Référentiels normatifs chargés

| Référentiel | Ce qui est chargé |
|---|---|
| ISO/IEC 42001:2023 | **Annexe A complète** — 38 contrôles de référence en 9 objectifs (A.2 à A.10) — plus trois exigences du corps (6.1.2, 8.4, 9.3) |
| Règlement (UE) 2024/1689 | Articles 14 et 50 |
| Matrice des preuves AIGMS v1 | 8 typologies techniques × 4 profils d'activité, avec criticité et livrables attendus |
| RGPD | Article 35 |
| ISO/IEC 42005:2025 | Clause 6.4 |

**Ce que ces données sont, et ne sont pas.** Elles portent la numérotation des
référentiels — un fait, non protégeable — accompagnée de titres et de résumés
rédigés en propre, exprimant ce qu'une organisation doit pouvoir démontrer.
Elles ne reproduisent pas le texte des normes.

Chaque résumé de l'Annexe A porte `review_status = 'to_review'` : un résumé est
une interprétation, et il engage vis-à-vis d'un client ou d'un auditeur. La
relecture humaine est un préalable à tout usage commercial, et un test vérifie
qu'aucun résumé n'a été marqué relu sans l'avoir été.

Le fichier source est `knowledge/frameworks/iso-42001/2023/annexe-a.json`, et la
migration `0022` en est **générée**. Un test compare les deux à chaque exécution :
ils ne peuvent pas diverger silencieusement.

ISO/IEC 27001 n'est pas chargée. Le besoin d'AIGMS y est plus étroit — montrer
qu'un contrôle IA sert aussi la sécurité de l'information, pour éviter la
double collecte de preuves. Un sous-ensemble ciblé suffirait ; importer les 93
contrôles d'un référentiel qu'AIGMS ne pilote pas serait disproportionné.

## Le dépôt de preuves

La rupture que le chemin du risque nomme le plus souvent est `no_evidence` :
un contrôle opère, rien ne le démontre. Elle est désormais réparable depuis la
plateforme — registre des preuves par organisation, dépôt de fichier,
validation nominative, rattachement aux contrôles, téléchargement par lien
signé.

Les règles tiennent en cinq lignes, et elles sont en base
([ADR-0011](../adr/ADR-0011-evidence-file-custody.md)) :

| Règle | Pourquoi |
|---|---|
| Chemin `tenant/organisation/preuve/fichier`, dérivé et jamais saisi | une preuve ne doit pas pouvoir pointer vers l'objet d'un autre client |
| Empreinte SHA-256 obligatoire dès qu'il y a un fichier | sans elle, on ne démontre pas que la pièce téléchargée est celle qui a été validée |
| Fichier figé après validation, aucune politique `UPDATE` | modifier après coup ce qu'un validateur a examiné détruit la valeur probante |
| Validation en son propre nom | c'est un acte, pas un champ |
| L'administrateur de plateforme ne télécharge pas | extension d'ADR-0008 au seul endroit qui porte des données et non des métadonnées |

Un **dépôt n'est pas une validation** : la pièce arrive « à valider », et
l'écran le dit.

### La preuve attendue dépend du rôle exercé vis-à-vis de l'IA

Le registre proposait les mêmes typologies à tout le monde. C'est faux dans les
deux sens : un hébergeur démontre l'isolation de ses calculs et n'a rien à dire
sur l'équité d'un modèle qu'il n'entraîne pas ; un utilisateur métier répond de
la dérive du système qu'il exploite, pas de son alignement.

Une organisation porte donc un **profil d'activité** au sens d'ISO/IEC 42001,
posé à sa création : hébergeur / infrastructure, développeur / éditeur,
intégrateur / conseil, utilisateur métier. La **matrice des preuves** — huit
typologies techniques × quatre profils — en tire une criticité, et de cette
criticité découle ce que la Déclaration d'Applicabilité exige
([ADR-0012](../adr/ADR-0012-evidence-matrix-and-soa-regime.md)) :

| Criticité pour le profil | Statut attendu | Ce que la Déclaration exige |
|---|---|---|
| critique, élevé | sélectionné | preuve **technique** : décrire la mesure, pointer un livrable |
| modéré, faible | sélectionné | preuve **organisationnelle** : politique, clause, procédure |
| négligeable | exclu | **justification formelle d'exclusion**, motivée par le profil |

La **règle d'or** est portée par une contrainte, pas par un écran : aucune
exigence de l'Annexe A ne reste sans réponse, et les deux branches — sélection
comme exclusion — exigent une justification écrite d'au moins trente
caractères. « Non applicable » n'est pas une justification.

Trois écarts sont nommés plutôt que lissés :

- `undecided` — une exigence sans décision portée ;
- `exclusion_contested` — une exclusion là où la matrice attend une preuve ;
- `technical_evidence_missing` — un régime technique sans contrôle prouvé.

La matrice ne décide de rien. Elle dit ce qui est attendu ; un humain
sélectionne ou exclut, et peut la contredire — l'écart est alors **affiché, pas
effacé**.

Le rôle se **modifie depuis la fiche de l'organisation**, à côté de ce qu'il
rend exigeant : le lien entre le choix et ses conséquences se perd si l'un et
l'autre vivent sur deux écrans. Le jeu de démonstration place IzarLink Demo en
« Hébergeur / Infrastructure » — isolation et empreinte environnementale
critiques, cybersécurité IA élevée, explicabilité et alignement négligeables.

**Onze références citées par la matrice ne se résolvent pas** : l'Annexe A
chargée s'arrête à A.10.4, et seuls les articles 14 et 50 du règlement sont
présents. `app.evidence_matrix_gaps()` les liste, l'écran les affiche, et un
test vérifie que cette liste correspond exactement à ce que le fichier source
déclare. Les taire produirait une Déclaration qui paraît complète en omettant
ce qu'elle ne sait pas rapprocher.

Un point demande un arbitrage : `A.8.4` se résout, mais porte dans l'Annexe A
chargée la **communication des incidents**, là où la matrice l'invoque pour
l'empreinte environnementale.

### Faut-il un écran d'administration du stockage ?

**Non, et probablement jamais sous cette forme.** Compartiment, quota, durée de
rétention, région : c'est de l'infrastructure. L'exposer en écran donnerait
l'illusion d'un réglage produit, ouvrirait une surface de configuration qu'il
faudrait défendre, et n'apporterait aucune garantie de gouvernance
supplémentaire — la garantie vient des politiques, pas d'un formulaire.

Ce qui manquerait vraiment à un exploitant, c'est de **savoir** où vivent les
fichiers. C'est rendu, en lecture seule, dans le volet « Où vivent les
fichiers » du registre : compartiment privé, chemin confiné au client, lien
signé d'une minute, aucune URL en base.

**Ce que l'hébergement IaaS demandera vraiment**, le jour du sprint dédié :

1. **Copier l'arborescence.** `tenant/organisation/preuve/fichier` se transpose
   telle quelle sur tout stockage compatible S3. Aucune ligne de la base ne
   référence Supabase — seulement un couple (compartiment, chemin).
2. **Reposer l'équivalent des politiques.** C'est le seul point non portable :
   les politiques de `storage.objects` sont propres à Supabase Storage. Sur un
   stockage tiers, le contrôle d'accès devra vivre dans le service qui signe les
   URL, et `app.storage_tenant` reste la règle à réimplémenter.
3. **Reprendre l'authentification.** GoTrue est l'autre dépendance de plateforme ;
   elle sort du périmètre du stockage mais pas de celui de la procédure.

C'est cette procédure — et non un écran — qui rendra un hébergement chez un
tiers réalisable.

## Deux liens à rétablir

1. **CI** — le jeton GitHub `rlabrador` n'a pas le scope `workflow` : le commit
   contenant `.github/workflows/ci.yml` attend en local.
   `gh auth refresh -h github.com -u rlabrador -s workflow` puis `git push`.
2. **Vercel ↔ GitHub** — le projet Vercel est lié à `rlabrador/aigms`, un dépôt
   vide, alors que le code vit dans `RL-Conseil/aigms`. L'App GitHub de Vercel
   n'ayant pas accès à cette organisation, le lien ne peut pas être posé par
   API. Installer l'App (https://github.com/apps/vercel) sur `RL-Conseil`, puis
   relier le projet : les déploiements redeviendront automatiques à chaque push.
   D'ici là, ils se font par appel API depuis le poste de développement.

## Suite immédiate

1. Reprise de la disposition des écrans. Elle précède le registre de décisions,
   dont le placement dépend d'elle.
2. Formulaires d'écriture restants : contrôle, action, incident, fournisseur.
3. Export du dossier de gouvernance et rapport mensuel.
4. Sprint 14 puis 15.
5. Sprint d'hébergement : procédure de portage sur IaaS (voir « Le dépôt de
   preuves »).

## Point de vigilance

Le jeu de démonstration est chargé sur le projet distant avec des comptes dont
le mot de passe est connu de tous (`Demo!Passw0rd`). Ces comptes ne portent que des
données fictives, mais le projet ne doit pas être promu en production sans les
supprimer ou en changer les mots de passe.

## Fonctionnalités différées

Les fonctionnalités décidées mais non implémentées — dont le **registre de
décisions**, dont le socle serveur est en place et l'interface absente — sont
consignées dans [`BACKLOG.md`](./BACKLOG.md), avec ce qu'il faut pour les ouvrir
sans tout re-instruire.

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
| Supabase `aigms-supabase` (`xsagbzrgoljzgorwvsir`, eu-west-1, org **caritis**) | **production** : schéma à la migration 0015, 24 migrations de retard sur `dev` (0016 → 0039). Porte encore le jeu de démonstration, à purger une fois un compte réel créé. Réactivée le 15 septembre 2026 après mise en pause ; `site_url`, `password_min_length` (12) et `uri_allow_list` réglés |
| Supabase `aigms-supabase-preprod` (`xahqdxwmlewyjpsiuzux`, eu-west-1, org **caritis**) | **preprod** : sert les déploiements Preview. Les deux projets partagent l'organisation caritis depuis le 15 septembre 2026 : un seul jeton Owner les couvre |
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

## Une navigation qui donne à lire l'avancement

Reprise de la disposition, premier volet. Le reproche de départ : un menu qui ne
porte que des noms de pages oblige à ouvrir chaque écran pour savoir s'il s'y
passe quelque chose, et tout ce qui relevait d'un client était enfoui sous sa
fiche.

**La navigation se lit désormais sur deux niveaux.** Le premier est stable — où
travailler : Organisations, Pilotage. Le second n'apparaît qu'à l'intérieur
d'une organisation et porte ses sections : vue d'ensemble, processus et risques,
preuves, Déclaration d'Applicabilité.

**Chaque niveau porte ce qui y appelle une action.** `app.attention_by_organization()`
rend sept compteurs, et pas un de plus :

| Compteur | L'acte qu'il appelle |
|---|---|
| actions échues | quelqu'un devait faire quelque chose |
| incidents ouverts | un fait est survenu et n'est pas clos |
| risques élevés ouverts | ni traités, ni acceptés |
| revues en retard | un cas d'usage devait être réexaminé |
| preuves à renouveler | une preuve validée n'est plus fraîche |
| preuves à valider | une pièce déposée attend un verdict |
| exigences sans décision | la règle d'or de la Déclaration |

Trois partis pris, qui expliquent ce qui n'y figure pas :

- **Aucun indicateur de volume.** « 12 cas d'usage » n'appelle aucune action et
  encombrerait ce qui en appelle une.
- **Un compteur à zéro ne s'affiche pas.** Un « 0 action échue » occupe la même
  place qu'un vrai retard et apprend à ne plus regarder.
- **Un retard n'est pas une attente.** Ce qui aurait déjà dû être fait est en
  rouge, ce qui attend une main en ambre. La distinction commande la couleur,
  pas l'inverse.

Chaque compteur est un lien : lire un retard sans pouvoir l'atteindre
obligerait à le retrouver soi-même. La liste des organisations est ordonnée par
ce qui appelle le plus d'action, et chaque ligne porte son résumé.

L'administration de la plateforme n'en voit aucun : lui compter des retards
qu'elle ne peut pas solder serait une invitation à outrepasser son rôle
(ADR-0008).

### Un gabarit partagé, et des fiches qui ouvrent sur l'essentiel

Second et troisième volets de la reprise.

**Le gabarit.** Trois écrans avaient chacun leur copie du chiffre saillant, avec
trois seuils de couleur différents : le même zéro apparaissait gris ici, rouge
là. `Stat`, `StatStrip` et `ScrollTable` vivent désormais dans
`src/components/ui.tsx`. Règle retenue : **un chiffre ne prend sa couleur que
s'il appelle une action**, et un zéro n'en appelle jamais. Le défilement
horizontal appartient au tableau, jamais à la page — un écran de gouvernance se
lit souvent sur un portable, et une page qui glisse latéralement fait perdre la
colonne qui nomme la ligne.

**La densité.** La fiche d'un cas d'usage empilait treize cartes de même poids :
le dossier de référence et ce qui appelle une action s'y lisaient pareil. Elle
s'ouvre maintenant sur quatre chiffres — risques élevés ouverts, contrôles
obligatoires non statués, actions échues, décisions à instruire — puis sur les
volets de travail. Cinq cartes de référence se replient : fiche, détail de la
pré-classification, supervision humaine, changements et réévaluations, journal
d'audit. Rien n'est retiré, tout est à un clic.

Un défaut d'accessibilité est apparu en repliant : le titre d'un volet n'était
pas un titre de document, et replier une section la retirait du plan de la page.
`Disclosure` porte désormais un `<h2>` — le bouton vit dans le titre, l'inverse
serait invalide.

### Le pilotage dit de quel client il parle

Quatrième volet. L'écran listait des retards sans jamais nommer l'organisation
dont ils relevaient — pour un cabinet suivant plusieurs clients, la cible même
du produit, un risque anonyme oblige à ouvrir la fiche pour savoir de qui il
s'agit.

- **Chaque ligne porte son client**, dès que plusieurs sont en vue. Sous une vue
  restreinte, la mention disparaît : elle n'apprendrait rien.
- **Un filtre par organisation** (`?organisation=`), comme les vues de la carte :
  rendu serveur, et un lien vers « le pilotage de ce client » se partage. Il
  n'apparaît qu'à partir de deux organisations suivies.
- **Les chiffres suivent le filtre.** Un compteur resté global sous une vue
  restreinte ferait douter de tout l'écran.
- **Les statuts se lisent en français.** `treatment_in_progress` et
  `EFFECTIVENESS_REVIEW` s'affichaient bruts.
- **Une hiérarchie sans déplacer les blocs** : `Card` accepte un accent latéral,
  rouge pour l'échu, ambre pour ce qui approche, et seulement lorsque la carte
  porte effectivement quelque chose. Un accent partout ne distingue plus rien.

### Des écrans longs deviennent parcourables

Cinquième volet. Deux écrans grossissaient sans moyen d'y chercher.

**Déclaration d'Applicabilité.** 38 exigences, dont 33 sans décision — et le
volet de saisie s'ouvrait de lui-même sur chacune : **trente-trois zones de
texte dépliées d'un coup**. Juste sur une exigence, ingérable sur trente-trois.
Le volet se replie ; le signalement passe par le badge d'écart et par deux
filtres — par écart (à décider, exclusion à réexaminer, preuve technique
manquante, sans contrôle, sans écart) et par objectif de contrôle. Une exigence
s'ouvre à la demande, ou par `?exigence=A.3.2` pour partager un lien vers celle
qu'on veut faire trancher.

**Registre des preuves.** Il affichait tout, sans filtre ni limite : six pièces
en démonstration, illisible en un an sur une organisation qui dépose une preuve
par contrôle et par trimestre. Filtres par état et par typologie — cette
dernière ordonnée par criticité pour le profil, ce qui relie enfin le registre à
la matrice affichée à côté — et **plafond explicite à 50 pièces** plutôt qu'une
troncature silencieuse : une preuve qu'on ne voit pas sans savoir qu'elle existe
est pire qu'une page longue.

Trois règles communes, portées par un composant unique (`SegmentedFilter`, dont
le filtre par organisation du pilotage est devenu un cas particulier) :

- **Les compteurs portent sur l'ensemble, jamais sur le filtre en cours.** Un
  filtre dont les compteurs dépendent d'un autre filtre ne dit plus ce qu'il
  compte.
- **Un filtre conserve ses voisins.** Un filtre qui réinitialise les autres est
  un filtre qu'on n'ose plus combiner.
- **Une combinaison vide le dit, et propose d'en sortir** — plutôt qu'une carte
  muette dont on ne sait pas si elle est vide ou cassée.

Un compteur à zéro reste affiché dans un filtre, contrairement aux pastilles du
menu : savoir qu'une catégorie est vide **est** l'information, c'est ce qui évite
de cliquer pour le découvrir.

### La saisie quitte les écrans de consultation

Sixième volet. Trois formulaires occupaient en permanence une colonne d'écrans
qu'on vient consulter : le dépôt d'une preuve, l'ajout d'un processus, l'ajout
d'une activité. On consulte un registre cent fois pour y déposer une fois, et
on décrit un référentiel de processus une fois puis on l'amende rarement.

Chacun a désormais sa page :

| Page | Depuis |
|---|---|
| `/preuves/deposer` | bouton « Déposer une preuve », ou un contrôle démuni |
| `/processus/nouveau` | carte, encart « Compléter la carte » |
| `/processus/activite` | idem, ou un processus sans activité |

**Une page plutôt qu'une fenêtre modale.** C'est déjà le motif de la déclaration
d'un cas d'usage et de la création d'une organisation : un seul motif de saisie
vaut mieux que deux. Une modale se prête mal à une saisie longue qu'on relit —
or un processus se nomme une fois et se lit des années.

### Trois écrans s'expliquent eux-mêmes

Les notes `InfoTip` — même icône, même comportement — répondent aux questions
qu'un nouvel utilisateur pose devant chaque écran :

- **Déclaration d'Applicabilité** : ce que l'Annexe A est, et n'est pas.
- **Registre des preuves** : le seuil qui compte une preuve comme couvrante, d'où
  vient le classement des typologies (la matrice croisée avec le profil
  d'activité déclaré), d'où viennent les contrôles proposés au rattachement, et
  pourquoi la liste n'offre jamais deux fois le même.
- **Processus et risques** : ce que chacun des quatre onglets demande au même
  modèle, et pourquoi les cases vides sont des informations et non des trous.

### Un écran de bureau ou une tablette

Cartes, matrices et déclarations demandent de la largeur. L'accueil l'annonce
avant la connexion, et l'espace de travail le rappelle **uniquement sur un écran
étroit** — une mention permanente serait du bruit pour ceux qui sont déjà au bon
endroit. L'application n'est pas bloquée pour autant : consulter depuis un
téléphone reste légitime, c'est la saisie qui y est inconfortable.

### Organisation courante et organisations gérées

Septième volet. Deux notions se confondaient sous le même mot : ce qu'une
personne a le **droit de lire** — tout son tenant — et ce qu'elle **gouverne**,
c'est-à-dire les organisations sur lesquelles l'administration lui a attribué un
rôle. La liste montrait les premières, proposant un travail qu'on ne peut pas
faire.

- **`app.managed_organizations()`** ne retient que les organisations portant une
  attribution de rôle. L'administration de plateforme voit celles de son tenant :
  elle les crée, et ne peut pas attribuer un rôle sur ce qu'elle ne verrait pas.
- **`user_profile.current_organization_id`** porte l'organisation sur laquelle on
  travaille. Un choix de la personne, qui la suit d'un poste à l'autre — un
  témoin de navigation l'aurait fait varier selon l'endroit d'où l'on se
  connecte, et « Mon organisation » n'aurait plus eu de contenu stable. Sans
  choix explicite et avec une seule organisation gérée, il n'y a rien à
  choisir : elle est rendue d'office.
- **Le choix est contraint mais n'ouvre aucun droit.** `app.guard_current_organization`
  refuse une organisation hors du périmètre géré — non par sécurité, la RLS
  reste souveraine, mais parce qu'un point de vue hors périmètre produirait des
  écrans vides et inexplicables. Un test vérifie qu'il n'accorde rien.

**La navigation s'ensuit.** Le premier niveau ne porte plus que deux
destinations — *Vue d'ensemble* et *Pilotage*. La racine ne montre rien
d'elle-même : elle conduit à la fiche de l'organisation courante. La liste des
organisations gérées a rejoint le menu de l'utilisateur, sous « Mon
organisation » : on en change rarement, et la laisser au menu principal donnait
deux entrées concurrentes pour « organisation ».

**« Mon organisation »** (`/admin/parametres#organisation`) récapitule ce qui
vaut ici : nom de l'organisation, rôle qu'on y détient, nom, fonction et adresse
enregistrés, rôle vis-à-vis de l'IA — **en lecture seule, il relève de
l'administration** — et ce que ce rôle rend exigeant. Le sélecteur d'organisation
courante n'y apparaît qu'à partir de deux organisations gérées.

**La fiche d'une organisation** porte son contexte sous le titre — secteur, pays,
effectif, entités identifient l'organisation, ils ne sont pas une rubrique à
consulter — et ses deux inventaires en onglets : cas d'usage d'IA et
fournisseurs, l'un qu'on gouverne, l'autre dont on dépend.

### La fiche d'un cas d'usage se lit comme un parcours

Huitième volet.

**La frise porte un libellé et ses jalons.** Elle disait où l'on en est ; elle ne
disait pas où l'on sera arrêté. Chaque transition est évaluée par
`app.evaluate_gate`, mais deux seulement portent un point de passage
substantiel — **Revue** (pré-classification et au moins un risque identifié) et
**Production** (huit préconditions, dont une décision d'autorisation en vigueur).
Ces deux-là sont marquées, et la légende dit ce que la marque signifie :
découvrir le refus au moment de le subir était le défaut.

**L'action qui fait avancer se lit à côté de la frise.** « Faire évoluer le cas
d'usage » vivait en bas de la colonne de droite : lire où l'on en est puis
chercher ailleurs comment avancer séparait la question de sa réponse.

**Gate production et contrôles affectés se replient.** L'un est un constat qu'on
relit, l'autre un inventaire ; aucun n'appelle une action par lui-même. Le gate
s'ouvre néanmoins d'office lorsqu'il n'est pas satisfait, et son résumé compte
les préconditions manquantes.

**« Déclarer un cas d'usage » figure aussi sur la vue d'ensemble** — c'est là
qu'on lit l'inventaire, donc là qu'on constate qu'il en manque un.

### Avertir avant la mise en service, saisir sans quitter la fiche

Neuvième volet.

**Les risques non soldés avertissent avant une mise en service.** Deux trous se
cachaient derrière la même évidence :

- le gate PRODUCTION ne refuse que sur les risques **élevés ou critiques**
  (`RISKS_TREATED`) : un risque modéré jamais traité passe sans être vu ;
- **SURVEILLANCE n'a aucune précondition** — elle tombe dans la branche
  « transition de reprise ou de suivi » d'`evaluate_gate`.

Le panneau de transition avertit donc lorsque la cible est PRODUCTION ou
SURVEILLANCE et que des risques ne sont ni traités, ni acceptés, ni clos — en
distinguant ceux qui n'ont jamais été recotés, où le risque reste brut. **Il
avertit, il n'empêche pas** : le bouton devient « Demander la transition malgré
tout ». Bloquer côté écran ce que le serveur autorise déplacerait la règle au
mauvais endroit ; la taire laisserait mettre en service sous des risques que
personne n'a soldés.

**Un risque se saisit dans une fenêtre, ouverte depuis la carte qu'il alimente.**
Le volet dépliant occupait la colonne au-dessus de la liste : on lisait le
formulaire avant ce qu'il complète.

La règle n'est pas « modale ou page » mais : **la saisie reste dans la page quand
son objet n'a de sens que dans cette page.** Un risque appartient à son cas
d'usage, et quitter l'écran ferait perdre de vue les autres risques qu'on vient
de lire. Un processus, lui, se décrit une fois et se lit des années hors du
contexte où il a été créé : il garde sa page.

**L'identité du cas d'usage se lit en clair**, sous la ligne de statut, dans la
zone qui était vide. Replier ce qui dit de quoi l'on parle obligeait à ouvrir un
volet pour le savoir.

## Le dispositif de maîtrise devient saisissable

Groupe 1 des écrans d'édition. Quatre écritures manquaient, et elles se
tiennent : un contrôle existe dans le référentiel de l'organisation, il est
déclaré applicable ou non à un cas d'usage, il répond à des exigences
normatives, et il peut être désigné comme la mesure qui traite un risque.

**Aucune des quatre n'existait.** Tout ce qui se lisait — taux de couverture,
AI Control Graph, chemin du risque, Déclaration d'Applicabilité, registre des
preuves — reposait sur des contrôles qu'on ne pouvait pas créer. Sur un client
réel, la moitié des écrans restait vide sans remède. Les règles, elles, étaient
déjà en base : ces écrans valident la forme et laissent la base répondre.

| Écriture | Où | Forme |
|---|---|---|
| Créer un contrôle | `/controles/nouveau` | page — il vit dans le référentiel et se relit hors contexte |
| Changer son état | référentiel | fenêtre |
| Rattacher une exigence | référentiel | fenêtre |
| Statuer l'applicabilité | fiche du cas d'usage | fenêtre |
| Traiter un risque | fiche du cas d'usage | fenêtre |

**Une section « Contrôles »** rejoint la navigation d'une organisation, entre
« Processus et risques » et « Preuves » — l'ordre dans lequel on les remplit.

Trois choses que ces écrans disent, et qu'il fallait dire :

- **Créer, déclarer opérant et prouver sont trois gestes distincts.** Le
  référentiel l'énonce en tête : aucun ne remplace les autres, et c'est la
  preuve validée non échue qui fait compter un contrôle comme couvrant.
- **« Obligatoire » n'est pas une étiquette.** Le gate PRODUCTION exige qu'un
  contrôle obligatoire applicable soit affecté et opérant : cocher engage le
  passage en service, et le formulaire le dit avant la case.
- **Un traitement sans contrôle désigné s'arrête à l'intention.** Le champ le
  rappelle, et le message de retour distingue les deux cas — c'est la règle
  d'ADR-0010, jusqu'ici verrouillée en base mais inatteignable.

Un contrôle sans exigence rattachée est signalé sur sa ligne : il ne compte dans
aucune Déclaration, et rien ne le disait.

## Le registre devient saisissable

Groupe 2 des écrans d'édition. Quatre objets complètent le dossier d'un cas
d'usage, et aucun ne pouvait être saisi.

| Objet | Où | Forme |
|---|---|---|
| Fournisseur | `/registre/nouveau` | page — il vit dans le référentiel de l'organisation |
| Actif d'IA (système, modèle, agent, jeu de données) | `/registre/nouveau?nature=actif` | page |
| Revue tiers d'un fournisseur | onglet Fournisseurs | fenêtre — c'est un acte, pas une propriété |
| Rattachement actif / fournisseur ↔ cas d'usage | fiche du cas d'usage | fenêtre |
| Plan de supervision humaine | fiche du cas d'usage | fenêtre |
| Évaluation d'impact | fiche du cas d'usage | fenêtre |

Fournisseur et actif partagent une page : on déclare un fournisseur puis le
modèle qu'il fournit, et l'inverse obligerait à revenir.

Ce que ces écrans portent, et qui ne se devine pas :

- **La revue tiers est un acte séparé.** Le gate PRODUCTION exige une revue
  close pour chaque tiers impliqué ; la déclarer n'est donc pas la conduire, et
  le message de création le dit.
- **Les quatre points qu'une revue examine sont posés à la création** — fournit
  un modèle, contrat de traitement signé, sécurité évaluée, réversibilité
  documentée — pour éviter d'y revenir en urgence à la mise en service.
- **Le champ de justification d'une supervision non applicable n'apparaît que
  lorsqu'il devient exigible.** La base l'impose
  (`oversight_na_is_justified`) ; l'écran le demande au bon moment.
- **Les refus des contraintes de supervision sont traduits** : « un plan
  approuvé doit être complet », « au-delà de L2, l'autonomie impose une autorité
  d'arrêt nommée » — plutôt que « violates check constraint ».

## Le registre de décisions

Groupe 3, premier volet — et la feature que la page commerciale présente comme
**le différenciateur** du produit. Le socle serveur existait depuis la migration
0010 ; il manquait le chemin pour y écrire, et une décision transverse — une
exception de politique portant sur l'organisation entière — n'était visible
nulle part.

**Deux actes, deux personnes.** Soumettre énonce ce qui est décidé et pourquoi ;
se prononcer engage nominativement. Sur une mise en production, une acceptation
de risque ou une exception, `app.guard_decision_approval` refuse que ce soit la
même personne. L'écran **ne l'anticipe pas** : il annonce la règle avant la
saisie, puis présente le refus du serveur tel quel. C'est ce qui donne sa valeur
au registre — et un test E2E le vérifie en changeant de compte.

Quatre règles vivent en base, et aucune n'est réimplémentée dans l'application :
approbateur nommé avec justification, énoncé et date d'effet ; séparation des
rôles ; date de revue sur les décisions à effet durable ; conditions énoncées
sur une approbation sous conditions. Les refus sont traduits, pas affichés bruts.

**Une section « Décisions »** rejoint la navigation d'une organisation, après
Preuves. Quatre chiffres en tête — dont **« sans élément probant »**, qui compte
les décisions ne disant que *qui* a décidé, pas *sur quoi*. Un filtre par état
mène aux décisions à instruire et aux revues échues.

Deux points relevés au passage :

- **Se prononcer relève de `app.roles_review()`** — officer, client admin,
  reviewer. Un responsable du risque cote et accepte des risques ; il ne tranche
  pas les décisions de gouvernance. Il faut donc **au moins deux personnes**
  parmi ces trois rôles pour que la séparation soit praticable.
- **La confirmation d'un verdict disparaissait avec le bouton qui l'avait
  produit.** La revalidation retire le déclencheur une fois la décision tranchée ;
  `Modal` accepte désormais de masquer son bouton sans se démonter. Sous un
  filtre « à instruire », la ligne quitte malgré tout la liste — le registre
  complet est l'endroit où l'on tranche.

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

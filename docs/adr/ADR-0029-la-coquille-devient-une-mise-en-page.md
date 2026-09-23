# ADR-0029 — La barre de navigation devient une mise en page

*23 septembre 2026. Groupe de routes `(espace)`.*

## Contexte

Suite de l'audit de latence du 23 septembre 2026, dont ADR-0028 a traité la
première cause. Une fois les fonctions rapprochées de la base, restait la
seconde : **il n'existait aucun `layout.tsx` sous `/admin`**. Le dépôt comptait
46 pages d'administration, dont 36 rendaient elles-mêmes `<Shell>`, et un seul
layout dans tout le projet — celui de la racine.

C'est précisément ce que l'App Router sait éviter. Une mise en page est
**conservée d'une navigation à l'autre** : elle n'est ni re-rendue, ni
re-interrogée. Ici, la barre, ses pastilles, le menu utilisateur et le compteur
d'alertes étaient reconstruits à chaque clic, en six allers-retours enchaînés —
et ces six-là s'exécutaient **après** ceux de la page, puisque `Shell` était le
composant parent recevant des enfants déjà résolus.

## Décision

**Un groupe de routes `(espace)` porte la coquille dans son `layout.tsx`.**

### Pourquoi un groupe, et non `/admin/layout.tsx`

Huit pages d'impression vivent sous `/admin/organizations/[id]/impression/`.
Ce sont des pièces remises à un auditeur : elles ont leur propre chrome
(`PrintDocument`, `@page`, en-tête répété à chaque feuille) et ne doivent porter
ni barre de navigation, ni menu. Une mise en page posée sur `/admin` les aurait
coiffées, et un enfant ne peut pas retirer ce qu'un parent a mis.

Le groupe les laisse dehors. **Aucune adresse ne change** — un groupe est
transparent pour le routage : `/admin/organizations/<id>/impression/preuves`
reste ce qu'il était, et le build le confirme route par route.

### Qui sait où l'on se trouve

La barre vit maintenant dans le navigateur, et doit donc se situer seule. Deux
sources, dans cet ordre :

1. **le chemin**, quand il porte l'organisation — `/admin/organizations/<id>/…`.
   C'est le cas de 33 pages sur 36, et cela vaut dès le rendu serveur : aucun
   clignotement ;
2. **ce que la page annonce** (`<AnnounceSection>`), pour les adresses qui ne
   portent pas l'organisation — la fiche d'un cas d'usage. L'annonce arrive
   après l'hydratation ; d'ici là la barre affiche l'organisation courante du
   profil.

### Les compteurs ne sont plus demandés deux fois

`attentionTotal()` et `attentionFor()` dérivaient toutes deux de
`attentionByOrganization()`, qui couvre le portefeuille entier en un appel. La
mise en page fait cet appel une fois et passe le tableau à la barre, qui y lit
la ligne qui la concerne. Le total du Pilotage et les pastilles de section
sortent de la même lecture.

### Ce qui reste dans `Shell`

Le nom et la signature sont conservés — 36 pages s'en servent, les renommer
n'aurait rien appris à personne. Il ne porte plus que ce qui change avec la
page : fil d'Ariane, titre, gestes, et la disponibilité de l'organisation,
qu'une mise en page ne peut pas connaître pour la fiche d'un cas d'usage. Ses
deux lectures restantes partent ensemble.

## Deux modules ont dû se scinder

- **`lib/governance/attention.ts`** portait `import 'server-only'` et
  contenait à la fois les intitulés, l'ordre, les destinations — purs — et les
  trois lectures de la base. La barre étant devenue un composant client, les
  lectures partent dans `attention-data.ts` et le reste devient utilisable des
  deux côtés.
- **`RegisterAsset`** était exporté par la page du registre des actifs et
  importé par trois autres. Une page n'est pas un module : le type vit
  désormais dans `lib/domain/assets.ts`. Le groupe de routes l'a révélé en
  cassant le chemin relatif.

## La faute que cette bascule a produite, et son garde-fou

La première version laissait `ORGANIZATION_SECTIONS`, `PRIMARY_SECTIONS` et
`REGISTER_SECTIONS` dans `chrome.tsx`, module marqué `'use client'`, et
`shell.tsx` — composant **serveur** — les en importait. Depuis le serveur, on
ne reçoit alors pas la valeur mais une **référence** : `REGISTER_SECTIONS.includes(…)`
lève, et la page répond « A server error occurred ». Le symptôme était précis —
seules les pages portant une organisation échouaient, puisque la lecture est
conditionnée par elle.

Ni TypeScript ni le build ne voient cette faute : c'est une erreur d'exécution.
Elle a donc atteint l'utilisateur.

Les données partent dans `lib/domain/sections.ts`, module pur que les deux
côtés lisent. Et `tests/unit/frontiere-client.test.ts` refuse désormais qu'un
module serveur importe autre chose qu'un **composant** depuis un module client.

Ce test, une fois écrit, en a trouvé une seconde, antérieure :
`INCIDENT_TRIGGER_LABELS` vivait dans `operations-forms.tsx` — client — et la
page d'impression d'un incident, servie par le serveur, le lisait. Le libellé
rejoint ses pareils dans `lib/domain/governance.ts`.

## Ce que cela donne

Vagues d'allers-retours enchaînées, par navigation :

| | Avant | Après |
|---|---|---|
| Coquille (barre, marque, alertes, pastilles) | 6, à chaque page | **0** — conservée |
| `Shell` (disponibilité de l'organisation) | comprise ci-dessus | 2, en parallèle |
| Mise en page `(espace)` | — | 2, **au premier chargement seulement** |

Les données de la barre se rafraîchissent quand même : `revalidatePath`, appelé
après chaque mutation, provoque un rafraîchissement qui réexécute la mise en
page. Les pastilles restent justes.

## Suite : l'écran d'attente

*24 septembre 2026.* Un `loading.tsx` pose une frontière `Suspense` autour de
`{children}` : la barre reste affichée et cliquable, seule la zone de contenu
attend, et **le routeur montre cet écran dès le clic**, sans attendre le
serveur. C'est ce qui manquait — l'application ne bougeait pas jusqu'à la
dernière requête, et paraissait lente même quand le serveur répondait vite.

Un seul suffit pour le groupe `(espace)` : le gabarit — fil d'Ariane, titre,
cartes — est celui de presque toutes les pages. Les pages d'impression, hors du
groupe, ont le leur, qui se place lui-même faute de `<main>`.

La forme imite ce qui va s'afficher plutôt qu'un rond qui tourne : l'œil se
place avant le contenu, et le saut final est moins brutal. `animate-pulse`
s'arrête de lui-même quand le système demande moins d'animations.

## Ce que cela ne fait pas

- La **mise en page elle-même** bloque encore le premier affichage d'un
  chargement complet : ses deux vagues précèdent la frontière `Suspense`, qui
  est en dessous d'elle. Envelopper les pastilles dans leur propre `Suspense`
  laisserait la barre paraître d'abord — c'est le lot P1-5.
- `getUser()` part toujours deux fois par requête — proxy et contexte.
- `apply_due_decisions` s'exécute encore pendant le rendu de la fiche d'un cas
  d'usage.
- Il reste deux N+1, sur les comptes et sur les actifs et fournisseurs.

Ramener `Shell` à zéro aller-retour demanderait de déplacer le bandeau de
disponibilité dans une mise en page d'organisation — ce qui le ferait passer
au-dessus du fil d'Ariane. Un changement visible, à décider pour lui-même.

## Effet de bord assumé

La barre d'administration souligne désormais l'entrée courante — elle ne le
faisait pour aucune, faute de savoir où l'on était. La déduction par le chemin
le donne gratuitement.

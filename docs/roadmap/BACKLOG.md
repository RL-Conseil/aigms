# Backlog — fonctionnalités spécifiées, non implémentées

Ce fichier consigne les fonctionnalités **décidées mais différées**, avec ce
qu'il faut savoir pour les ouvrir sans avoir à tout re-instruire : ce qui existe
déjà, ce qui manque, les questions de conception encore ouvertes, et les
critères d'acceptation.

L'avancement de ce qui est fait vit dans
[`IMPLEMENTATION_STATUS.md`](./IMPLEMENTATION_STATUS.md).

---

## Registre de décisions

**Consigné le 10 septembre 2026 · Statut : différé, socle existant**

Différé volontairement : d'autres incréments et une reprise de la disposition
des écrans passent avant. Le socle serveur, lui, est en place — c'est
l'interface qui manque.

### Pourquoi cette fonctionnalité compte

La page d'accueil en fait **le différenciateur** du produit : « une gouvernance
crédible ne documente pas seulement les risques, elle documente qui a décidé
quoi, pourquoi et sous quelles conditions ». La matrice BUILD/CONNECT le classe
également en *différenciant*. C'est donc la promesse la plus exposée du
discours commercial, et l'écart entre ce qui est promis et ce qui se montre
doit être connu avant toute démonstration.

### Ce qui existe déjà — migration `0010`

`public.governance_decision` : référence métier `DEC-IA-…`, huit types
(autorisation d'usage, approbation pilote, mise en production, acceptation de
risque, exception de politique, changement significatif, suspension, retrait),
sept statuts, chaînage des versions par `supersedes_id`.

Les quatre promesses de la page d'accueil sont chacune adossées à un mécanisme
serveur :

| Promesse | Mécanisme |
|---|---|
| Aucune approbation automatique | Contrainte `decision_approval_requires_human` : approbateur nommé, date d'approbation, énoncé, justification et date d'effet. `app.guard_decision_approval` couvre l'`INSERT` autant que l'`UPDATE` — sans quoi une décision pourrait naître déjà approuvée. |
| Séparation des rôles | Même trigger : sur `go_production`, `risk_acceptance` et `policy_exception`, `approver_user_id = submitted_by` lève une `insufficient_privilege`. |
| Rien ne dort | Contrainte `decision_review_date_required` sur ces trois types ; `/admin/pilotage` remonte les décisions à instruire et celles dont la revue est échue. |
| Reconstituable | `decision_link` — N–N vers risque, contrôle, preuve, AIIA, demande de changement, incident, cas d'usage, processus, activité, fournisseur, actif d'IA. |

Le registre alimente le gate : `app.evaluate_production_gate` exige une décision
`go_production` approuvée en vigueur ; autorisation d'usage et approbation
pilote conditionnent les transitions correspondantes ; suspension et retrait
ouvrent les transitions inverses. Couvert par 14 assertions dans
`tests/rls/governance-workflow.test.ts`, six décisions dans le jeu de
démonstration.

### Ce qui manque

1. **Aucun écran de registre.** Pas de vue listant les décisions d'une
   organisation, filtrable par type et par statut. `use_case_id` étant
   nullable, une décision **transverse** — une exception de politique portant
   sur l'organisation entière — n'est visible nulle part, sauf à passer par le
   pilotage si elle est en brouillon ou échue. C'est le trou le plus net.

2. **Aucun formulaire de soumission ni d'approbation.** Les décisions du jeu de
   démonstration viennent du seed ; il n'existe aucune server action. Le
   workflow est *verrouillé* côté serveur, il n'est pas *opérable* depuis
   l'application — même situation que les preuves avant l'incrément « dépôt de
   preuves ».

3. **`decision_link` n'est ni écrit ni lu par l'application.** La promesse
   « reconstituable » est modélisée et seedée (trois liens), aucun écran ne
   l'affiche.

### Questions de conception, ouvertes

Ce sont elles qui justifient le report : les trancher avant de coder évitera de
reprendre l'écran deux fois.

- **Où vit le registre ?** Une entrée de navigation propre à côté de
  « Pilotage » ? Un onglet de la fiche d'organisation, comme « Preuves » et
  « Processus » ? Le second est cohérent avec la disposition actuelle — tout ce
  qui relève d'un client vit sous son organisation — mais un registre de
  décisions est aussi un objet transverse que l'on consulte pour lui-même.
- **Articulation avec le pilotage.** Le pilotage montre déjà les décisions à
  instruire et les revues échues. Le registre ne doit pas les redoubler : il en
  est la vue exhaustive, le pilotage en reste la vue « ce qui appelle une
  action ». À vérifier à l'écran, pas seulement en principe.
- **L'approbation se fait-elle depuis le registre ?** La séparation des rôles
  n'a de sens visible que si l'écran empêche l'auteur d'approuver — ou explique
  le refus que le serveur oppose. C'est le point à soigner : c'est la
  démonstration la plus parlante du produit.
- **Rattachement des éléments probants.** Même geste que le rattachement
  preuve ↔ contrôle : ne proposer que ce qui n'est pas déjà lié, et le replier.

### Critères d'acceptation

- Une décision se soumet, se rattache à ses éléments probants, et s'approuve
  depuis l'application.
- L'auteur d'une décision de mise en production, d'acceptation de risque ou
  d'exception **ne peut pas** l'approuver : le refus du serveur est présenté
  tel quel, pas masqué.
- Une décision approuvée sans date de revue est refusée par la base ; l'écran
  le dit avant l'envoi.
- Les décisions transverses (sans cas d'usage) sont visibles.
- Les éléments probants d'une décision s'affichent et se parcourent.
- Tests RLS sur la séparation des rôles depuis le chemin applicatif, parcours
  E2E de bout en bout, journal d'audit vérifié.

### Prérequis

Aucun sur le plan technique. À planifier après la reprise de la disposition des
écrans, pour ne pas poser le registre à un endroit qu'il faudrait déplacer.

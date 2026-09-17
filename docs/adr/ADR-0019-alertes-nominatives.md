# ADR-0019 — Des alertes nominatives, émises en base, visibles à date

*Statut : accepté — 18 septembre 2026*

## Contexte

La fiche d'un cas d'usage est devenue un poste de travail : on y désigne un
responsable de risque, on y fixe une revue de surveillance, on y soumet une
décision avec une date d'effet, on y prévoit un changement à une date. Chacun
de ces actes engage **quelqu'un** à **une date** — et personne n'en était
averti. Le suivi reposait sur la mémoire de la personne qui avait saisi.

## Décision

**Une table `notification`, nominative** (migration 0053). Chacun ne lit que
les siennes (`recipient_user_id = app.current_user_id()`), et ne peut que les
marquer lues : un déclencheur refuse toute autre réécriture. Elle porte une
**date de visibilité** (`due_at`) : un rappel daté attend son jour — il n'y a
pas de planificateur, la lecture (`my_notifications`) filtre sur `due_at <=
now()`. Les alertes ne sont **pas journalisées** : le journal trace l'acte qui
les produit, pas l'avis qu'on en donne. La table est donc exclue de
`audit_coverage_gaps`.

**Émises par des déclencheurs, en base**, pour que le chemin d'écriture
n'importe pas (formulaire, import, RPC) :

| Acte | Qui est averti | Rappel |
|---|---|---|
| risque avec responsable | le responsable | — |
| action avec responsable | le responsable | à l'échéance |
| plan de supervision avec date de revue | le responsable du plan, sinon du cas d'usage | le jour de la revue |
| décision soumise | qui a soumis ; qui est appelé à statuer | à la date d'effet (vérifier que la décision est actée, déposer la preuve) |
| changement enregistré | qui l'a demandé | à la date prévue (l'action qui le met en œuvre est-elle ouverte ?) |

Une alerte non lue de même nature sur la même pièce est **remplacée**, pas
empilée : re-enregistrer un plan ne crée pas trois rappels. La clôture d'une
action, le rejet d'une décision retirent les rappels non lus qui n'ont plus
lieu d'être.

**Une évaluation d'impact achevée ouvre une action** « Déposer la preuve de
l'évaluation d'impact » (et l'AIPD si elle est requise), confiée à la personne
qui l'a conduite, à 30 jours. C'est la seule alerte qui crée une pièce de
gouvernance — et elle en crée une parce qu'une évaluation sans pièce qui
l'atteste ne vaut rien devant un auditeur. Le dépôt de la preuve, depuis la
fiche, clôt l'action (paramètre `action` de la page de dépôt).

## Conséquences

- Une cloche dans le bandeau compte les alertes dues non lues ; « Mes alertes »
  (`/admin/alertes`) les liste, chacune conduisant à la rubrique de la fiche
  concernée.
- Aucun courriel n'est envoyé pour l'instant : le module `mailer` existe et
  pourra relayer les rappels dus, une fois la cadence et le désabonnement
  décidés.
- Les alertes existantes ne sont pas rejouées sur les données antérieures à la
  migration : seuls les actes posés après l'émettent.

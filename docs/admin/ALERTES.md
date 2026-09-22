# Les alertes : qui est prévenu, de quoi, et quand

*24 septembre 2026 — migrations 0053, 0058, 0064, 0068, 0074, 0083, 0084.*

Une alerte est **nominative** : elle va à la personne qui en répond, et elle
se lit dans « Mes alertes ». Elle n'est pas un fait de gouvernance — le
journal d'audit, lui, trace les actes. Chaque alerte conduit à l'endroit où
l'on agit.

## Comment elles fonctionnent

`app.notify` pose l'alerte avec une **date d'échéance** (`due_at`) :
`my_notifications` ne rend que ce qui est dû. Un rappel daté se pose donc à
l'avance et apparaît le jour venu — **aucune tâche planifiée n'est
nécessaire**. Changer la date repose le rappel ; solder l'objet le retire
(`app.drop_pending_notifications`). Une alerte non lue de même nature sur le
même objet remplace la précédente : pas d'empilement.

## Ce qui alerte aujourd'hui

| Événement | Nature | Destinataire |
|---|---|---|
| Risque confié | `risk_owner` | responsable désigné du risque |
| Action confiée, échéance atteinte | `action_owner`, `action_due` | responsable de l'action |
| Traitement de risque confié, échéance | `treatment_owner`, `treatment_due` | responsable du traitement |
| Décision soumise, à statuer, date d'effet, bloquée | `decision_submitted`, `decision_to_approve`, `decision_effective`, `decision_blocked` | soumetteur, approbateur attendu |
| Changement enregistré, date prévue | `change_planned`, `change_due` | demandeur du changement |
| Plan de supervision : revue fixée, due | `oversight_review`, `oversight_review_due` | responsable du plan |
| Incident : à qualifier sous 24 h, 24 h écoulées, arrêt recommandé, clôture à signer | `incident_new`, `incident_qualify`, `incident_stop`, `incident_closure` | AI Governance Officer, Porteur de l'IA |
| Criticité dépassée par les faits | `criticality_review` | AI Governance Officer |
| Revue de gouvernance planifiée, le jour même | `oversight_review`, `oversight_review_due` | présents attendus |
| **Preuve déposée en attente** | `evidence_to_validate` | AI Governance Officer, sinon Expert métier |
| **Preuve à trente jours de l'échéance** | `evidence_expiring` | propriétaire de la pièce |
| **Preuve échue** | `evidence_expired` | propriétaire **et** AI Governance Officer |
| **Revue d'un cas d'usage due** | `use_case_review_due` | Porteur, sinon responsable redevable |
| **Revue d'un fournisseur due** | `vendor_review_due` | AI Governance Officer |
| **Revue d'une étude d'impact due** | `impact_review_due` | personne qui l'a conduite |

Les six dernières sont posées par 0084 : ce qui expire prévient avant
d'expirer. Une preuve échue fait cesser son contrôle de compter dans la
couverture — c'est la raison pour laquelle l'officer en est averti, et pas
seulement le propriétaire de la pièce.

## Ce qui n'alerte pas, et pourquoi

- **Jalon refusé** (`gate_blocked`) : journalisé, lisible sur le jalon
  lui-même. Une alerte ferait doublon avec le refus qu'on vient de lire.
- **Contrôle devenu inefficace**, **cadence de revue dépassée**,
  **organisation non opérationnelle** : lisibles en Pilotage et par bandeau.
  À arbitrer — trop d'alertes tue l'alerte.
- **Imports et corrections de registre** : le journal d'audit les porte, avec
  l'avant et l'après.

## À venir

Notification par courriel (préférence par personne, réglable aussi par
l'administration) et courriel de synthèse des actions et incidents à faire
avancer.

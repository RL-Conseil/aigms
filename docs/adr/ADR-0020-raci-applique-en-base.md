# ADR-0020 — Les « A » du RACI sont des règles de la base

*Statut : accepté — 18 septembre 2026*

## Contexte

Le RACI des six rôles ([ROLES_ET_RACI.md](../admin/ROLES_ET_RACI.md)) donnait
deux responsabilités finales que les droits ne portaient pas : la validation
des contrôles par l'Expert métier et le Comité des risques, l'arbitrage IA
critique par le Comité de direction. Un RACI que l'outil n'applique pas est
un document ; le propriétaire a demandé que ces « A » soient appliqués.

## Décision

Migration 0055. Deux ensembles de rôles immuables, comme les autres :
`app.roles_validate_evidence()` (AI Governance Officer, Administrateur client,
Expert métier, Comité des risques) et `app.roles_arbitrate()` (Comité de
direction). Deux politiques de mise à jour ciblées — `evidence_validate`,
`governance_decision_arbitrate` — ouvrent la ligne à qui ne l'écrivait pas,
et deux gardes restreignent l'acte : qui ne fait que valider ne touche qu'à
la validation ; qui ne fait qu'arbitrer ne se prononce que sur une décision
soumise. Le Porteur de l'IA, qui déposait et validait, ne valide plus.

L'arbitrage critique est défini en base (`app.decision_is_critical_arbitration`) :
`policy_exception`, et `go_production` sur un cas d'usage de criticité élevée
ou critique. L'approbateur nommé doit tenir le rôle de Comité de direction sur
l'organisation (`app.user_organization_roles`), que ce soit lui ou un
relecteur qui enregistre l'approbation.

Les règles portent sur l'acte d'une personne authentifiée ; sans utilisateur
(reprise, import), la ligne passe et le journal dit qui l'a versée — même
principe que la validation nominative (0028).

## Conséquences

- La matrice des capacités gagne deux lignes, calculées comme les autres :
  « Prononcer la validité d'une preuve », « Arbitrer ».
- Une organisation sans Comité de direction ne peut plus approuver une mise
  en production critique ni une exception : c'est voulu, et c'est ce que
  l'administration doit attribuer avant.
- Le formulaire de décision le dit avant la soumission ; la liste des
  personnes appelées à se prononcer inclut le Comité de direction.
- Non retenu : exiger que le validateur d'une preuve diffère de son déposant.
  Le retrait du Porteur couvre le cas courant ; imposer quatre yeux à l'AI
  Governance Officer d'une petite organisation bloquerait le registre.

# Les six rôles de gouvernance et leur RACI

*18 septembre 2026 — migration 0054.*

## Dénominations

| Valeur en base | Dénomination | Ce que c'est |
|---|---|---|
| `system_owner` | **Porteur de l'IA** (Owner) | Le métier ou chef de projet qui déploie l'outil. |
| `governance_officer` | **AI Governance Officer** | Le pilote global de la conformité IA. |
| `reviewer` | **Expert métier (DPO / RSSI)** | Les relecteurs spécialisés — vie privée, sécurité. |
| `risk_owner` | **Comité des risques** (Risk Manager) | Le valideur indépendant des risques. |
| `executive_viewer` | **Comité de direction** | L'instance suprême d'arbitrage stratégique. |
| `auditor` | **Auditeur** | Le contrôleur indépendant, a posteriori. |

Les valeurs de l'énuméré `app.app_role` ne changent pas : elles sont dans les
politiques de sécurité, les tests et les attributions déjà faites. Seul le nom
change, partout où l'interface le montre — comptes existants et futurs.

Hors des six : `client_admin` (Administrateur client, mêmes prérogatives que
l'AI Governance Officer côté client) et `platform_admin` (Administration de la
plateforme, qui ouvre les accès et ne gouverne pas).

## RACI synthétique

R réalise · A valide et assume la responsabilité finale · C donne son
expertise obligatoire · I reçoit l'information sans bloquer le flux.

| Étape du parcours | Porteur de l'IA | AI Governance Officer | Expert (DPO/RSSI) | Comité des risques | Comité de direction | Auditeur |
|---|---|---|---|---|---|---|
| 1. Déclaration et inventaire | A | R | C | — | — | I |
| 2. Évaluation des risques | R | A | C | C | — | I |
| 3. Validation des contrôles | I | R | A | A | — | I |
| 4. Arbitrage IA critique | I | C | C | C | A | I |
| 5. Audit de conformité | I | I | I | I | I | A |

Où cela se joue dans l'application : 1 → fiche du cas d'usage, fil
conducteur ; 2 → rubriques Risques et Évaluation d'impact ; 3 → Contrôles
affectés et registre des preuves ; 4 → Décisions et passage en production ;
5 → journal d'audit, registres, impressions.

## Ce que le RACI n'est pas

Le RACI dit ce que l'organisation **attend** de chaque rôle. La matrice des
capacités (Comptes › Matrice) dit ce que la base **laisse faire** — calculée
depuis les politiques, elle ne se règle pas à l'écran. Les deux se recoupent
sans se confondre :

- le « A » du Comité de direction sur l'arbitrage n'est pas un droit d'écriture :
  ce rôle reste en lecture seule, et son arbitrage se porte par la décision qui
  le nomme comme personne appelée à se prononcer ;
- le « A » de l'Expert métier et du Comité des risques sur la validation des
  contrôles se matérialise par la validation nominative des preuves et par
  l'approbation des décisions, pas par un droit d'écriture sur les contrôles.

Faire porter ces « A » par des droits en base — par exemple ouvrir
l'approbation des décisions `go_production` au Comité de direction — est une
évolution possible, à décider ; elle passerait par une migration relue.

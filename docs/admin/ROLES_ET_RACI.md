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

## Ce que la base applique (migration 0055)

Le RACI dit ce que l'organisation **attend** de chaque rôle ; la matrice des
capacités (Comptes › Matrice) dit ce que la base **laisse faire**. Depuis la
migration 0055, les deux « A » qui n'étaient pas portés le sont :

- **Validation des contrôles (étape 3)** — la validité d'une preuve se
  prononce par l'Expert métier, le Comité des risques ou l'AI Governance
  Officer (`app.roles_validate_evidence`). Le **Porteur de l'IA dépose, il ne
  valide plus** : il attestait de sa propre pièce. L'Expert et le Comité, qui
  n'écrivent pas de preuve, n'obtiennent que l'acte de validation — rien
  d'autre ne bouge sur la ligne. La validation reste nominative.
- **Arbitrage IA critique (étape 4)** — le **Comité de direction** se prononce
  sur une décision soumise (approuver, sous conditions, rejeter) sans pouvoir
  en soumettre ni en réécrire une (`app.roles_arbitrate`). Et l'arbitrage
  critique lui revient : une mise en production (`go_production`) d'un cas
  d'usage de criticité **élevée ou critique**, et toute **exception à une
  politique** (`policy_exception`), ne s'approuvent que par une personne qui
  tient ce rôle sur l'organisation. Une mise en production d'un cas d'usage
  modéré reste du ressort des relecteurs.

Les deux règles portent sur l'**acte** fait par une personne authentifiée :
une reprise de données ou un import CONNECT, sans utilisateur, verse des
décisions et des validations faites ailleurs, et le journal dit qui les a
versées.

Ce qui reste une responsabilité sans droit spécifique : le « A » du Porteur
sur la déclaration (il déclare déjà), le « A » de l'AI Governance Officer sur
l'évaluation des risques (il la conduit déjà), le « A » de l'Auditeur sur
l'audit (lecture seule, journal compris).

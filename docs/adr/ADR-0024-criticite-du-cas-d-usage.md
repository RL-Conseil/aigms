# ADR-0024 — La criticité du cas d'usage : un jugement a priori, confronté aux faits

*22 septembre 2026. Migrations 0074–0075.*

## Contexte

La criticité (faible, modérée, élevée, critique) se pose au triage et commande
côté serveur : l'évaluation d'impact (0011), l'arbitrage du GO production par
le Comité de direction (0055), la cadence de revue de l'organisation (0067),
des contrôles supplémentaires (0048). Elle est donc structurante.

Trois défauts : (1) elle se saisissait dans un volet en bas du fil conducteur,
après les actifs, alors que tout en dépend ; (2) ses libellés parlaient
d'« effet grave sur les personnes », vocabulaire de l'évaluation d'impact, ce
qui entretenait la confusion avec l'AIIA et les risques ; (3) sa justification,
exigée au formulaire, n'était pas conservée, et rien ne confrontait la
criticité retenue aux faits postérieurs — un risque résiduel critique ouvert
sous une criticité « modérée » ne disait rien.

## Décision

1. **La criticité est un acte de triage, humain et tracé.** Elle mesure
   l'effort de gouvernance à engager, pas l'impact — qui relève de l'AIIA — ni
   la situation réglementaire — qui relève de la qualification. Les libellés
   disent ce que chaque niveau engage.
2. **Elle se pose en fenêtre, dans la colonne de droite du fil**, au rang de
   la qualification et avant elle, dans l'ordre du cycle. Une grille de quatre
   questions (affectés, réversibilité, portée de la décision, données)
   propose un niveau, pré-remplie par ce que la fiche sait déjà ; l'officer
   retient le sien et justifie l'écart. Justification, grille, date et auteur
   sont conservés sur le cas d'usage.
3. **Les faits la rattrapent, sans la changer.** `app.criticality_signal`
   compare la criticité retenue à ce que les faits imposent : risque ouvert
   d'un niveau supérieur (résiduel, sinon inhérent), personnes vulnérables,
   autonomie L3+, potentiel haut risque ou pratique interdite soupçonnée à la
   qualification, AIPD requise par une AIIA achevée. Quand les faits dépassent,
   la carte dit « à réviser » et pourquoi, l'onglet le signale, et
   l'AI Governance Officer est alerté (`criticality_review`). Relever la
   criticité lève l'alerte. Aucune baisse ni hausse automatique : la
   criticité reste sous une main.

## Conséquences

- Réviser à la hausse relance ce que la criticité commande : l'AIIA devient
  exigée si elle manquait, le GO production passe au Comité de direction.
- Les règles de gate, de RACI et de cadence ne changent pas.
- Les cas existants n'ont pas de justification conservée : la carte le dit et
  invite à réviser.

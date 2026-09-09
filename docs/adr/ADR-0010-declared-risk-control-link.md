# ADR-0010 — Le lien risque → contrôle est déclaré, jamais inféré

Date : 9 septembre 2026 · Statut : accepté

## Contexte

Le modèle reliait un contrôle à un **cas d'usage** (`control_applicability`) et
un risque à un **cas d'usage** (`risk.use_case_id`). Aucun lien ne reliait un
risque au contrôle censé le réduire.

En construisant l'AI Control Graph, la tentation était forte de refermer la
boucle par déduction : « ces contrôles s'appliquent au même cas d'usage que ce
risque, donc ils le traitent ». La déduction est bon marché, elle remplit
l'écran, et elle est fausse. Un contrôle d'information des utilisateurs
(Art. 50) s'applique au même cas d'usage qu'un risque de fuite de données ; il
n'en réduit rien. Un graphe qui présenterait ce lien ferait croire à une chaîne
de maîtrise qui n'a jamais été établie — devant un auditeur, c'est pire que de
ne rien montrer.

## Décision

Le plan de traitement porte le lien : `risk_treatment.control_id`, nullable,
avec un garde-fou d'organisation (`app.assert_treatment_control`).

Le graphe expose donc **deux types d'arêtes distincts**, jamais confondus :

| Arête | Signification | Ce qu'elle démontre |
|---|---|---|
| `applicability` (cas d'usage → contrôle) | un contrôle a été jugé pertinent pour ce cas d'usage | une décision d'applicabilité |
| `mitigation` (risque → contrôle) | un humain a désigné ce contrôle pour réduire ce risque | une chaîne de maîtrise opposable |

`app.risk_path` ne remonte que la seconde. Un risque dont aucun traitement ne
désigne de contrôle rend le verdict `no_control` — pas une liste de contrôles
voisins.

## Conséquences

- La colonne est **nullable**, et le reste : un risque tout juste identifié n'a
  pas encore de mesure, et forcer un lien produirait une fausse maîtrise.
- Le verdict nomme le maillon exact où la chaîne rompt — `no_treatment`,
  `no_control`, `control_not_operating`, `no_evidence` — parce que les quatre
  n'appellent pas la même action.
- Un risque **accepté** n'est pas une chaîne rompue. L'acceptation est une
  décision humaine nominative, justifiée et datée (contrainte
  `risk_acceptance_requires_human`) ; exiger en plus une chaîne complète
  reviendrait à la dénier.
- Un contrôle désigné par un traitement entre dans le graphe même si personne
  n'a statué son applicabilité. Masquer la seule mesure engagée sur un risque
  parce qu'une case n'est pas cochée serait un contresens.
- Le jeu de démonstration illustre les cinq issues, une par risque : c'est ce
  qui rend la règle vérifiable plutôt que déclarative.

## Alternatives écartées

- **Inférer le lien par le cas d'usage partagé.** Rejeté : voir ci-dessus. Une
  proximité n'est pas une mesure.
- **Une table d'association `risk_control`.** Elle aurait doublé le plan de
  traitement sans rien porter de plus : c'est le traitement qui décide d'une
  mesure, et qui en porte le responsable, l'échéance et le statut.
- **Rendre `control_id` obligatoire sur un traitement.** Aurait empêché de
  décrire une intention avant de l'outiller — exactement l'étape que la
  gouvernance doit pouvoir tracer.

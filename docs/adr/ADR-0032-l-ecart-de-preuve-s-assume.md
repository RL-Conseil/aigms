# ADR-0032 — L'écart de preuve s'assume, il ne bloque pas

*3 octobre 2026. Migrations 0096 à 0101.*

## Contexte

Depuis 0072, la plateforme sait ce qu'est un contrôle tenu : **opérant ET
prouvé** par une preuve validée non échue (`app.control_is_held`). Le graphe
des contrôles s'en sert pour sa couleur, la carte de couverture aussi.

Le gate PRODUCTION, lui, n'exigeait **aucune preuve**. Ses huit vérifications
portaient sur la classification, les risques, l'étude d'impact, la revue
fournisseur, la supervision humaine, l'applicabilité statuée des contrôles
obligatoires, la décision GO et les actions bloquantes. Jamais qu'un contrôle
applicable soit démontré.

Un contrôle déclaré opérant sans aucune preuve passait entre toutes les
mailles. C'est le constat d'audit le plus banal qui soit.

`app.suggest_actions` couvrait la preuve **échue ou proche de l'échéance**
(0051, cas 3) — jamais la preuve **absente**.

## Décision : la voie douce

Rendre le gate bloquant du jour au lendemain aurait rendu non conformes tous
les cas d'usage déjà en production. Ce n'est pas une décision de migration.

**Le manque devient une vérification d'avertissement.** `CONTROLS_EVIDENCED`
figure au détail du gate ; elle ne le fait jamais échouer.

Pour cela, `GateCheck` gagne une `severity` — `blocking` ou `warning` — et la
synthèse ne compte que les bloquantes :

```sql
select bool_and((c ->> 'satisfied')::boolean) into v_satisfied
from jsonb_array_elements(v_checks) c
where coalesce(c ->> 'severity', 'blocking') = 'blocking';
```

Le `coalesce` laisse les huit vérifications d'avant bloquantes sans les
réécrire. Le champ resservira.

## Ce que l'avertissement engage

Un avertissement décoratif ne vaut rien. Quatre règles le rendent ferme.

**1. L'écart est figé à la soumission.** `governance_decision.evidence_gap`
porte l'instantané — les contrôles **nommés**, pas un compteur. Une preuve
déposée le lendemain ne réécrit pas ce que l'approbateur a lu.

**2. L'officer doit dire ce qu'il en est.** `evidence_gap_statement` est
**obligatoire** dès que l'écart n'est pas vide, refusé par la base. C'est là
que CARITIS explique la remédiation en cours ou la pièce que l'organisation
n'a pas encore présentée. Un écart sans explication ne part pas.

**3. L'avertissement arrive nommé.** L'alerte et le courriel portent les codes
des contrôles et la parole de l'officer — jamais « 3 contrôles ». Un compteur
se survole ; une liste de codes se vérifie.

**4. La prise de connaissance est un acte.** L'approbation exige
`evidence_gap_acknowledged_at`, refusée en base. Une case cochée seulement à
l'écran ne prouve rien.

## Qui se prononce, et quand il l'apprend

**Par défaut, l'Administrateur client** (`client_admin`) — la DSI côté client,
celle qui met en service —, à défaut le Comité de direction
(`app.default_decision_approver`). La désignation reste modifiable : le défaut
évite qu'une décision parte sans destinataire, il ne décide pas à la place.

**L'AI Governance Officer est en copie** (`decision_gap_notice`) : la
remédiation lui revient, la décision non.

**Le courriel part à la soumission, pas le lendemain.** `decision_to_approve`
ne rejoignait déjà pas la synthèse (0086), mais l'envoi passe par la tâche
planifiée, qui tourne une fois par jour à 7 h : une mise en production soumise
à 8 h aurait attendu vingt-trois heures. Plutôt que d'accélérer la cadence
générale — ce qui multiplierait les réveils pour tout le reste —,
`public.claim_decision_notices` (0100) rend les messages **et les marque comme
partis**, et l'action serveur les envoie. Un seul des deux envoie, jamais les
deux.

L'envoi reste une commodité : s'il échoue, l'alerte demeure lisible dans
« Mes alertes », et une mise en production ne se refuse pas parce qu'un
courriel n'est pas parti.

## Le risque assumé, et ce qui le contient

**L'avertissement peut devenir routine.** Si chaque mise en production en
porte un, la case se coche sans lire. Trois contre-mesures, toutes dans la
conception :

- les contrôles sont **nommés**, pas comptés ;
- l'écart est **figé** et reste au dossier, avec la parole de l'officer et la
  date de prise de connaissance — visible dans le registre des décisions et
  sur le fil du cas d'usage. Ce qu'un auditeur verra ne reste pas routinier ;
- la justification est **obligatoire**. Sans elle, ce ne serait qu'une case.

## Ce que le second signal vaut commercialement

Savoir où la preuve se collecte encore à la main sert d'abord la gouvernance.
En atelier de qualification, il produit du chiffré et du nominatif là où le
catalogue de connecteurs ne dit qu'une capacité abstraite. **Cet usage est
celui de la lecture faite en atelier, pas un message dans le produit** :
l'officer client lit son propre écran, et une incitation à l'achat y serait
mal reçue.

## Une lacune trouvée par les tests

Le garde RACI (0055) borne ce que le Comité de direction peut toucher quand il
arbitre : « il se prononce, il ne réécrit pas ». Les deux colonnes de prise de
connaissance n'y figuraient pas — l'approbation devenait donc **impossible**
pour celui-là même à qui on la demandait, avec un message parlant d'une
réécriture qui n'avait pas eu lieu. Corrigé en 0101. Le test RACI l'a trouvé
avant la Preview.

## Les deux propositions d'action

*4 octobre 2026. Migration 0102.*

`app.suggest_actions` dérivait six familles d'écarts. Les deux qui manquaient
étaient celles que l'officer découvre le plus tard.

**L'applicabilité indéterminée.** `control_applicability.status` vaut
`to_determine` par défaut (0009) : retenir vingt contrôles proposés sans
statuer les laisse tous indéterminés, et le gate ne bloque que sur les
obligatoires. Une proposition **par contrôle** noierait la liste — vingt lignes
qui disent la même chose. D'où **une seule action groupée** par cas d'usage,
qui se ferme d'elle-même quand il ne reste rien, et qui n'est bloquante que si
des obligatoires sont concernés : exactement ce que le gate exige déjà.

**Le contrôle applicable sans aucune preuve.** Le cas 3 couvrait la preuve
échue ou proche de l'échéance, jamais la preuve **absente**. Une par contrôle,
non bloquante — 0097 avertit, il ne bloque pas — et **plafonnée à cinq**, les
obligatoires d'abord. Au-delà de cinq ce n'est plus une action mais un
chantier, et trente propositions feraient abandonner la liste.

## Ce qui n'est pas fait

- **`CONTROLS_EVIDENCED` reste un avertissement.** Le rendre bloquant à une
  date fixée est la suite naturelle, et c'est une décision qui vous revient.

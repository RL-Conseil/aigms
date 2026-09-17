# ADR-0018 — L'assistant propose, l'humain retient

*Statut : accepté — 17 septembre 2026*

## Contexte

Affecter des contrôles à un cas d'usage demandait de connaître le référentiel
par cœur : 120 contrôles-types, dont l'applicabilité dépend du rôle de
l'organisation et des faits du cas d'usage. Le classeur « Outils IT,
supervision et contrôles IA » — 61 outils, avec ce que chacun contrôle et
comment — n'était pas dans la plateforme.

## Décision

**Une couche outillage** (migrations 0046–0047) : `catalog_tool` (61 outils de
l'éditeur, même règle de propriété que les référentiels) rattachés aux
contrôles-types par *code* via `catalog_tool_control` — le lien survit aux
versions. La **phase** (DISCOVERY, GOVERN, BUILD, CONNECT, OPERATE) entre comme
métadonnée sur les outils et les contrôles-types : elle ordonne, ne conditionne
rien, n'apparaît nulle part comme jalon.

**Une grille d'applicabilité** (migration 0048) : `catalog_applicability_rule`
dit quel fait du cas d'usage déclenche quel contrôle-type conditionnel, avec
un motif rédigé pour l'utilisateur ; `catalog_domain_priority` dit, pour chaque
rôle, quels domaines se lisent d'abord, ensuite, ou seulement sur motif.

**`app.suggest_controls(use_case)`** calcule les propositions : obligatoires
par défaut (hors domaines secondaires du rôle), conditionnels déclenchés, avec
motifs, rang, état (déjà affecté, dans la liste opérationnelle, à ajouter) et
outils. **Déterministe** : règles lisibles, testées ; aucun modèle de langage.

**Le panneau « Propositions »** sur la fiche du cas d'usage : on coche, on
retient. Retenir ajoute le contrôle à la liste opérationnelle s'il n'y est pas
(lien au contrôle-type, exigences ISO 42001 rattachées) puis le déclare
applicable, avec le motif de la proposition dans la justification, précédé de
sa provenance et du nom de qui a retenu. Rien ne s'écrit avant ce clic.

## Ce qui est décidé pour la suite

- Le même panneau servira aux **actions** (dérivées des écarts : contrôle non
  opérant, risque non traité, preuve à échéance, gate refusé) et à l'**avis sur
  une preuve** (le document démontre-t-il ce que le contrôle attend). Dans les
  deux cas, la proposition est un état à retenir, jamais une écriture.
- Un **modèle de langage** pourra, plus tard, ordonner et rédiger sur la liste
  courte que les règles produisent — jamais à sa place. Il n'entre qu'après le
  choix d'un fournisseur selon nos propres contrôles (SUP-005, DAT-011) et d'un
  mode d'hébergement (API, serveur d'inférence local, ou aucun). Le mode sans
  modèle est un mode de plein droit.
- **Pas de RAG** : le corpus tient dans un contexte et il est structuré ; la
  sélection est une requête, pas une similarité. `pgvector` reste disponible si
  un jour des documents client doivent être indexés.
- L'assistant sera lui-même **inscrit au registre** comme cas d'usage d'IA.

## Voir aussi

- ADR-0017 — référentiels de l'éditeur et des tenants, instanciation
- ADR-0004 — le refus est un résultat, pas une exception

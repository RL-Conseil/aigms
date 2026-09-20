# ADR-0022 — Décisions et changements se répondent

*Statut : accepté — 20 septembre 2026*

## Contexte

Une **décision** est un acte de gouvernance (autorisation, pilote, production,
acceptation de risque, exception, changement significatif, suspension,
retrait). Un **changement** est un fait sur le système (modèle, données,
finalité, fournisseur, autonomie, population, territoire, sécurité,
déploiement) que le moteur de réévaluation lit. Ils vivaient côte à côte : un
changement pouvait être mis en œuvre sans décision, une décision de
suspension ne déclarait rien de ce qui change, et la fiche les montrait dans
deux onglets sans lien.

## Décision

Deux objets restent — ils ne mesurent pas la même chose — mais ils se
répondent (migration 0063) :

- **Changement ⇒ décision, automatiquement.** Quand la réévaluation d'un
  changement conclut *partielle* ou *complète*, une décision « changement
  significatif » s'ouvre d'elle-même, soumise par le demandeur du changement
  et liée à lui. Le changement ne peut être approuvé, mis en œuvre ni vérifié
  tant que cette décision n'est pas approuvée ; l'approbation le fait passer
  *approuvé*, le rejet le rejette. Un changement sans réévaluation reste un
  fait tracé. (Option retenue par le propriétaire contre le bouton manuel :
  la règle « pas de mise en œuvre sans décision » ne tient que s'il existe
  toujours une décision à approuver.)
- **Décision ⇒ changement.** Une décision de type changement significatif,
  suspension ou retrait porte « ce qui change » dans son formulaire ; à la
  soumission, le changement est créé, lié, puis qualifié par le moteur. Le
  lien existant, aucune seconde décision ne s'ouvre. On déclare une fois.
- **Une seule lecture.** `decisions_and_changes(organisation, cas d'usage)`
  mêle les deux dans l'ordre, chacun disant à quoi il est lié. La fiche du
  cas d'usage a un onglet « Décisions et changements » ; le registre des
  décisions gagne une vue « Changements ».

## Conséquences

- Les alertes existantes (changement enregistré / date prévue, décision
  soumise / à statuer / date d'effet) s'appliquent aux décisions ouvertes
  automatiquement comme aux autres.
- La confirmation humaine du verdict (`final_verdict`) reste possible : elle
  rejoue le déclencheur ; un verdict ramené à « aucune réévaluation » ne
  retire pas une décision déjà ouverte — elle se rejette.

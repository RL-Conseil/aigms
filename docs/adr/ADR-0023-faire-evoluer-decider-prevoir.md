# ADR-0023 — Franchir, décider, prévoir : une porte, trois intentions

*Statut : accepté — 20 septembre 2026*

## Contexte

Trois portes se recouvraient sur la fiche d'un cas d'usage : « Faire
évoluer » franchissait Approuvé, Pilote et Retiré sans décision ; « Soumettre
une décision » envoyait dans le registre puis obligeait à refaire évoluer ;
« Déclarer un changement » ne disait pas qu'il ne touchait pas au statut. La
suspension n'était pas un statut. La supervision humaine n'était jamais
rouverte par une réévaluation.

## Décision

**Un jalon engageant est une décision ; une décision approuvée franchit le
jalon à sa date d'effet ; un changement est une évolution prévue du système,
pas du statut — et ce qu'il rouvre, il le rouvre vraiment.**

- **Décision ⇒ jalon** (0064–0065) : autorisation → Approuvé (sous conditions,
  ou Refusé), pilote → Pilote, production → Production, suspension →
  Suspendu, retrait → Retiré. Immédiat si la date d'effet est passée, sinon à
  la date d'effet, appliqué à l'ouverture de la fiche (`apply_due_decisions`).
  Le gate reste le juge : un refus laisse la décision approuvée, le jalon en
  attente, et avertit qui a soumis. Un jalon fermé ne se soumet pas : le gate
  est vérifié à la soumission.
- **La décision se prend depuis la fiche**, en fenêtre : types selon le jalon
  courant, **contexte et justification exigés**, preuves validées rattachées
  dès la soumission — **au moins une pour la production**, exigée par la base
  à l'approbation. Le registre garde « Nouvelle décision » pour les décisions
  transverses.
- **« Faire évoluer » est la porte unique** : *Franchir un jalon* (triage,
  évaluation, revue, surveillance, retours — immédiat, avec motif), *Décider*
  (les jalons engageants), *Prévoir un changement du système* (à une date,
  lu par le moteur de réévaluation).
- **Suspendu** est un statut : depuis Pilote, Production, Surveillance ; vers
  Production, Revue, Retiré.
- **Réévaluation ⇒ supervision** (0066) : quand le périmètre rouvert contient
  la supervision, le plan repasse en brouillon, motivé, et son responsable est
  averti ; le gate Production tient jusqu'à révision.

## Non retenu

Un planificateur pour appliquer les décisions à date : l'application à
l'ouverture de la fiche, doublée de l'alerte « date d'effet », suffit et
n'introduit aucune infrastructure.

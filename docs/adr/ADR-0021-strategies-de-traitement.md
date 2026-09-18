# ADR-0021 — La stratégie de traitement d'un risque a des conséquences

*Statut : accepté — 19 septembre 2026*

## Contexte

La stratégie d'un traitement (réduire, éviter, transférer, accepter) était
stockée et affichée ; aucune règle ne la lisait. Le gate PRODUCTION ne
regardait que le statut du traitement, la SoA ne connaissait que les
applicabilités, l'acceptation d'un risque n'ouvrait aucune décision. Le
propriétaire a demandé que le choix engage.

## Décision

Migration 0059.

- **Accepter** n'est plus une stratégie : accepter est un acte à part,
  nominatif, réservé au responsable désigné (0058). Un traitement « accept »
  est refusé.
- **Réduire** exige un contrôle désigné ; le contrôle devient applicable au
  cas d'usage (il rejoint la Déclaration d'Applicabilité, avec le risque pour
  motif). Le traitement compte quand il est effectif (`implemented`,
  `verified`).
- **Éviter** ouvre une action pour le responsable : traduire l'évitement en
  demande de changement de périmètre ou en suspension. Aucun contrôle.
- **Transférer** ne compte comme effectif que si un fournisseur rattaché au
  cas d'usage a passé sa revue (approuvée, même sous conditions).
- **Risque élevé ou critique** : tout traitement ouvre une action bloquante
  pour son responsable, à l'échéance du traitement (l'alerte du traitement est
  alors portée par l'action, pas doublée) ; une acceptation ouvre une décision
  `risk_acceptance`, soumise par l'acceptant et liée au risque, que quelqu'un
  d'autre doit approuver — la séparation existante s'applique.
- Le gate lit `app.risk_is_settled` : atténué ou clos ; accepté (décision
  approuvée s'il est élevé/critique) ; ou traité effectivement (transfert :
  tiers revu).

**Chercher le contrôle qui traite.** `search_controls` cherche, à partir de
ce que l'utilisateur a écrit (intitulé, scénario, description), dans les
contrôles de l'organisation puis dans les référentiels publiés — plein texte
français et similarité de trigrammes. Retenir un contrôle-type l'ajoute au
registre (lien conservé, exigences rattachées), porté par le responsable
indiqué. L'assistant propose ; l'humain retient (ADR-0018).

**Registre des contrôles.** Un contrôle a toujours un responsable — à défaut,
celui qui le crée. Il porte ses preuves attendues et ses questions
d'évaluation : reprises du contrôle-type à l'instanciation (et rétro-remplies
pour les contrôles déjà instanciés), saisies pour un contrôle libre. Le
registre le dit quand un contrôle n'a ni l'une ni l'autre.

## Ce qui ne change pas

L'évaluation d'impact reste déclenchée par les faits du cas d'usage (données
personnelles, personnes vulnérables, autonomie L3/L4, criticité, qualification),
jamais par un risque ni sa stratégie.

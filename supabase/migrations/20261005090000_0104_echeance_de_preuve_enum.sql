-- 0104 — Une nature d'alerte pour l'échéance de preuve.
--
-- Séparée de la migration qui l'emploie : une valeur ajoutée à un type énuméré
-- n'est pas utilisable dans la même transaction.
--
-- Elle ne se confond avec aucune des existantes. `evidence_expired` dit qu'une
-- pièce est périmée ; celle-ci dit qu'à partir d'une date, l'absence de preuve
-- retiendra la mise en production. L'une parle d'une pièce, l'autre d'une
-- règle qui change.

alter type app.notification_kind add value if not exists 'evidence_deadline';

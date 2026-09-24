-- 0096 — Une nature d'alerte de plus : l'écart de preuve signalé à l'officer.
--
-- Séparée de la migration qui l'emploie : une valeur ajoutée à un type énuméré
-- n'est pas utilisable dans la même transaction.
--
-- Pourquoi une nature propre plutôt que `decision_to_approve` : celle-ci dit
-- « vous êtes appelé à statuer », ce qui est faux pour l'AI Governance Officer.
-- Lui est mis en copie parce qu'il répond de la remédiation, pas parce qu'il
-- décide.

alter type app.notification_kind add value if not exists 'decision_gap_notice';

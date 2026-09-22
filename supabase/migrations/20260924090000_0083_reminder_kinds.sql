-- =============================================================================
-- AIGMS — 0083 — Les rappels qui manquaient (valeurs d'énumération)
-- =============================================================================
-- Une valeur d'énumération ne s'emploie pas dans la transaction qui la crée :
-- elles vivent dans leur propre fichier, avant 0084 qui s'en sert.
alter type app.notification_kind add value if not exists 'evidence_expiring';
alter type app.notification_kind add value if not exists 'evidence_expired';
alter type app.notification_kind add value if not exists 'evidence_to_validate';
alter type app.notification_kind add value if not exists 'use_case_review_due';
alter type app.notification_kind add value if not exists 'vendor_review_due';
alter type app.notification_kind add value if not exists 'impact_review_due';

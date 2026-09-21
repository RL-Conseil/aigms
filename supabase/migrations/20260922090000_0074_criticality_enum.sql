-- =============================================================================
-- AIGMS — 0074 — Alerte « criticité à réviser » (valeur d'énumération)
-- =============================================================================
-- Une valeur d'énumération ne s'emploie pas dans la transaction qui la crée :
-- elle vit dans son propre fichier, avant 0075 qui s'en sert.
alter type app.notification_kind add value if not exists 'criticality_review';

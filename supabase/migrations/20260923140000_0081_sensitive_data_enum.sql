-- =============================================================================
-- AIGMS — 0081 — Donnée sensible (valeur d'énumération)
-- =============================================================================
-- Une valeur d'énumération ne s'emploie pas dans la transaction qui la crée :
-- elle vit dans son propre fichier, avant 0082 qui s'en sert.
alter type app.suggestion_condition add value if not exists 'sensitive_data';

-- =============================================================================
-- AIGMS — 0064 — Le statut « Suspendu », et l'alerte « jalon non franchi »
-- =============================================================================
-- Une valeur d'énuméré ne s'emploie pas dans la transaction qui la crée :
-- elle est posée ici, seule ; 0065 s'en sert.
-- =============================================================================
alter type app.use_case_status add value if not exists 'SUSPENDED' after 'MONITORING';
alter type app.notification_kind add value if not exists 'decision_blocked';

-- =============================================================================
-- AIGMS — 0068 — Énumérés du ticket d'incident (0069 s'en sert)
-- =============================================================================
create type app.incident_trigger as enum ('monitoring_alert', 'user_complaint', 'internal_audit', 'vendor_alert', 'other');
alter type app.notification_kind add value if not exists 'incident_new';
alter type app.notification_kind add value if not exists 'incident_qualify';
alter type app.notification_kind add value if not exists 'incident_stop';
alter type app.notification_kind add value if not exists 'incident_closure';

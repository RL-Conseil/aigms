-- =============================================================================
-- AIGMS — 0090 — Signature de l'étude d'impact : valeurs d'énumération
-- =============================================================================
-- Ni un statut ni une nature d'alerte ne s'emploient dans la transaction qui
-- les crée : ils vivent dans leur propre fichier, avant 0091.

-- L'étude visée par l'officer attend l'acceptation du Porteur : ce n'est ni
-- un brouillon, ni une étude achevée.
alter type app.impact_assessment_status add value if not exists 'awaiting_signature' before 'completed';

alter type app.notification_kind add value if not exists 'impact_signature';
alter type app.notification_kind add value if not exists 'impact_signature_late';
alter type app.notification_kind add value if not exists 'impact_returned';

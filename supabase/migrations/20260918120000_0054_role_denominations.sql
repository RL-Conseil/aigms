-- =============================================================================
-- AIGMS — 0054 — Les six dénominations des rôles de gouvernance
-- =============================================================================
-- Les rôles s'appellent désormais, pour les comptes existants comme pour les
-- futurs : Porteur de l'IA (system_owner), AI Governance Officer
-- (governance_officer), Expert métier — DPO / RSSI (reviewer), Comité des
-- risques (risk_owner), Comité de direction (executive_viewer), Auditeur
-- (auditor). Les valeurs de l'énuméré ne bougent pas : elles vivent dans les
-- politiques, les tests et les attributions déjà faites. Un nom change ; un
-- droit, non.
--
-- Ce que la migration fait :
--   * documente la correspondance sur le type, là où on la cherchera ;
--   * apprend à `app.person_for_role` les nouveaux noms — c'est par eux que
--     les contrôles-types désignent un responsable pressenti (« Expert
--     métier », « Comité des risques », « DPO », « RSSI »…).
-- =============================================================================

comment on type app.app_role is
  'Rôles applicatifs. Dénominations (18/09/2026) : system_owner = Porteur de l''IA ; governance_officer = AI Governance Officer ; reviewer = Expert métier (DPO / RSSI) ; risk_owner = Comité des risques ; executive_viewer = Comité de direction ; auditor = Auditeur ; client_admin = Administrateur client ; platform_admin = Administration de la plateforme.';

create or replace function app.person_for_role(p_organization_id uuid, p_role_label text)
returns uuid
language plpgsql stable
set search_path = app, public, pg_catalog
as $$
declare v_role app.app_role; v_id uuid;
begin
  v_role := case
    when p_role_label ilike '%governance officer%' or p_role_label ilike 'AIGO%' then 'governance_officer'
    when p_role_label ilike '%comité de direction%' or p_role_label ilike '%direction%' then 'executive_viewer'
    when p_role_label ilike '%risque%' or p_role_label ilike '%risk%' then 'risk_owner'
    -- « Expert métier » avant « métier » : l'expert n'est pas le porteur.
    when p_role_label ilike '%expert%' or p_role_label ilike '%dpo%' or p_role_label ilike '%rssi%'
      or p_role_label ilike '%relecteur%' or p_role_label ilike '%juridique%' or p_role_label ilike '%sécurité%'
      or p_role_label ilike '%protection des données%' then 'reviewer'
    when p_role_label ilike '%porteur%' or p_role_label ilike '%owner%' or p_role_label ilike '%métier%' then 'system_owner'
    when p_role_label ilike '%auditeur%' or p_role_label ilike '%audit%' then 'auditor'
    else null end;
  if v_role is null then return null; end if;
  select ra.user_id into v_id from public.role_assignment ra
   where ra.organization_id = p_organization_id and ra.role = v_role
     and (ra.valid_until is null or ra.valid_until > now())
   order by ra.valid_from limit 1;
  return v_id;
end;
$$;

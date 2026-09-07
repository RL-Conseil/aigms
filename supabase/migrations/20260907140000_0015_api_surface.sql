-- =============================================================================
-- AIGMS — 0015 — Surface d'API
-- =============================================================================
-- PostgREST n'expose que `public`. La logique reste dans `app` ; `public`
-- n'offre que des points d'entrée minces, en SECURITY INVOKER, qui délèguent.
-- Les paramètres sont typés `text` puis castés : un enum défini hors du schéma
-- exposé n'est pas exploitable côté client.
-- =============================================================================

create or replace function public.transition_use_case(
  p_use_case_id uuid,
  p_target      text,
  p_rationale   text default null
)
returns jsonb
language sql
volatile
security invoker
set search_path = app, public, pg_catalog
as $$
  select app.transition_use_case(p_use_case_id, p_target::app.use_case_status, p_rationale);
$$;

comment on function public.transition_use_case is
  'Point d''entrée API du changement de statut d''un cas d''usage. Délègue à app.transition_use_case.';

create or replace function public.evaluate_gate(
  p_use_case_id uuid,
  p_target      text
)
returns jsonb
language sql
stable
security invoker
set search_path = app, public, pg_catalog
as $$
  select app.evaluate_gate(p_use_case_id, p_target::app.use_case_status);
$$;

comment on function public.evaluate_gate is
  'Évalue les préconditions d''une transition sans la déclencher. Permet d''afficher ce qui manque avant d''agir.';

create or replace function public.screen_change_request(p_change_request_id uuid)
returns jsonb
language sql
volatile
security invoker
set search_path = app, public, pg_catalog
as $$
  select app.screen_change_request(p_change_request_id);
$$;

comment on function public.screen_change_request is
  'Qualifie un changement et enregistre la réévaluation correspondante.';

create or replace function public.evaluate_governance_impact(p_change_request_id uuid)
returns jsonb
language sql
stable
security invoker
set search_path = app, public, pg_catalog
as $$
  select app.evaluate_governance_impact(p_change_request_id);
$$;

comment on function public.evaluate_governance_impact is
  'Recommandation du moteur de réévaluation, sans effet de bord.';

-- Les fonctions déléguées sont SECURITY DEFINER et revérifient l'habilitation.
revoke all on function public.transition_use_case(uuid, text, text)      from public, anon;
revoke all on function public.evaluate_gate(uuid, text)                  from public, anon;
revoke all on function public.screen_change_request(uuid)                from public, anon;
revoke all on function public.evaluate_governance_impact(uuid)           from public, anon;

grant execute on function public.transition_use_case(uuid, text, text)   to authenticated;
grant execute on function public.evaluate_gate(uuid, text)               to authenticated;
grant execute on function public.screen_change_request(uuid)             to authenticated;
grant execute on function public.evaluate_governance_impact(uuid)        to authenticated;

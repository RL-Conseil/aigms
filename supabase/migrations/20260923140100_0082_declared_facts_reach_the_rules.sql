-- =============================================================================
-- AIGMS — 0082 — Les faits déclarés atteignent les règles
-- =============================================================================
-- Trois endroits déclarent les mêmes faits, et deux les jetaient :
--
--   * la GRILLE DE TRIAGE (« quelles données traite-t-il ? », « qui subit une
--     erreur ? ») était enregistrée et relue nulle part ;
--   * la QUALIFICATION agissait inégalement — « impact vie privée » exigeait
--     l'AIIA, « obligations de transparence » ne faisait rien, « hors
--     périmètre » non plus ;
--   * la FICHE (cases « données personnelles », « personnes vulnérables »)
--     était la seule source lue.
--
-- Ici : la donnée sensible existe enfin (art. 9 RGPD), elle exige l'AIPD et
-- porte la criticité observée ; « impact vie privée » implique des données
-- personnelles ; la transparence propose son contrôle. La grille et la
-- qualification écrivent dans la fiche côté application — un seul endroit
-- décide, plusieurs chemins pour y arriver (voir 0080 pour les actifs).
-- =============================================================================

alter table public.ai_use_case
  add column if not exists involves_sensitive_data boolean not null default false;

comment on column public.ai_use_case.involves_sensitive_data is
  'Catégories particulières au sens de l''article 9 du RGPD : santé, biométrie, opinions, orientation. Implique des données personnelles.';

-- Sensible implique personnel : une seule source, comme pour les actifs (0080).
create or replace function app.use_case_personal_data(p_use_case_id uuid)
returns boolean
language sql stable
set search_path = app, public, pg_catalog
as $$
  select exists (select 1 from public.ai_use_case u
                  where u.id = p_use_case_id and (u.involves_personal_data or u.involves_sensitive_data))
      or exists (select 1 from public.use_case_asset_link l join public.ai_asset a on a.id = l.asset_id
                  where l.use_case_id = p_use_case_id and a.contains_personal_data)
      or exists (select 1 from public.regulatory_classification c
                  where c.use_case_id = p_use_case_id and c.is_current and 'privacy_impact' = any (c.flags));
$$;

comment on function app.use_case_personal_data is
  'Des données personnelles sont en jeu : la fiche, un actif rattaché, ou la qualification qui retient un impact vie privée.';

create or replace function app.use_case_sensitive_data(p_use_case_id uuid)
returns boolean
language sql stable
set search_path = app, public, pg_catalog
as $$
  select coalesce((select u.involves_sensitive_data from public.ai_use_case u where u.id = p_use_case_id), false);
$$;

create or replace function public.use_case_sensitive_data(p_use_case_id uuid)
returns boolean language sql stable security invoker
set search_path = app, public, pg_catalog
as $$ select app.use_case_sensitive_data(p_use_case_id); $$;

grant execute on function public.use_case_sensitive_data(uuid) to authenticated;

-- -----------------------------------------------------------------------------
-- 1. Pourquoi l'AIIA est exigée — le gate le dit
-- -----------------------------------------------------------------------------
create or replace function app.impact_assessment_reason(p_use_case_id uuid)
returns text
language sql
stable
security definer
set search_path = app, public, pg_catalog
as $$
  select nullif(array_to_string(array_remove(array[
    case when app.use_case_sensitive_data(u.id) then 'données sensibles' end,
    case when app.use_case_personal_data(u.id) and not app.use_case_sensitive_data(u.id) then 'données personnelles' end,
    case when u.involves_vulnerable_persons then 'personnes vulnérables' end,
    case when u.autonomy_level in ('L3', 'L4') then 'autonomie ' || u.autonomy_level end,
    case when u.criticality in ('high', 'critical') then 'criticité ' || (case u.criticality when 'critical' then 'critique' else 'élevée' end) end,
    case when exists (select 1 from public.regulatory_classification c where c.use_case_id = u.id and c.is_current
                       and 'high_risk_potential' = any (c.flags)) then 'haut risque potentiel' end
  ], null), ', '), '')
  from public.ai_use_case u where u.id = p_use_case_id;
$$;

create or replace function public.impact_assessment_reason(p_use_case_id uuid)
returns text language sql stable security invoker
set search_path = app, public, pg_catalog
as $$ select app.impact_assessment_reason(p_use_case_id); $$;

grant execute on function public.impact_assessment_reason(uuid) to authenticated;

do $$
declare v text;
begin
  select pg_get_functiondef('app.evaluate_production_gate(uuid)'::regprocedure) into v;
  v := replace(v,
    $x$                when not v_aiia_required then 'AIIA non requis pour ce cas d''usage.'
                when v_aiia_ok then 'AIIA terminé.'$x$,
    $x$                when not v_aiia_required then 'AIIA non requis pour ce cas d''usage.'
                when v_aiia_ok then format('AIIA terminé (exigé : %s).', coalesce(app.impact_assessment_reason(p_use_case_id), 'faits du cas d''usage'))$x$);
  v := replace(v, $x$else 'AIIA requis mais non terminé.' end$x$,
                  $x$else format('AIIA requis (%s) mais non terminé.', coalesce(app.impact_assessment_reason(p_use_case_id), 'faits du cas d''usage')) end$x$);
  execute v;
end $$;

-- -----------------------------------------------------------------------------
-- 2. Données sensibles : l'AIPD n'est pas une option
-- -----------------------------------------------------------------------------
create or replace function app.guard_impact_dpia()
returns trigger
language plpgsql
security definer
set search_path = app, public, pg_catalog
as $$
begin
  if new.status <> 'completed' then return new; end if;
  if current_setting('aigms.seed', true) = 'on' then return new; end if;
  if app.use_case_sensitive_data(new.use_case_id)
     and btrim(coalesce(new.dpia_reference, '')) = '' then
    raise exception 'Le cas d''usage traite des données sensibles (article 9 du RGPD) : l''étude d''impact ne s''achève pas sans la référence de l''AIPD.'
      using errcode = 'check_violation';
  end if;
  return new;
end;
$$;

create trigger impact_assessment_guard_dpia before insert or update of status on public.impact_assessment
  for each row execute function app.guard_impact_dpia();

-- -----------------------------------------------------------------------------
-- 3. Le signal de criticité lit la donnée sensible
-- -----------------------------------------------------------------------------
do $$
declare v text;
begin
  select pg_get_functiondef('app.criticality_signal(uuid)'::regprocedure) into v;
  v := replace(v,
    $x$  if v_uc.involves_vulnerable_persons then$x$,
    $x$  if app.use_case_sensitive_data(v_uc.id) then
    v_observed := greatest(v_observed, 3);
    v_reasons := array_append(v_reasons, 'Des données sensibles sont traitées (article 9 du RGPD).');
  end if;

  if v_uc.involves_vulnerable_persons then$x$);
  execute v;
end $$;

-- -----------------------------------------------------------------------------
-- 4. Les propositions lisent la donnée sensible et la transparence
-- -----------------------------------------------------------------------------
do $$
declare v text;
begin
  select pg_get_functiondef('app.suggest_controls(uuid)'::regprocedure) into v;
  v := replace(v,
    $x$  if app.use_case_personal_data(v_uc.id) then v_facts := v_facts || 'personal_data'::app.suggestion_condition; end if;$x$,
    $x$  if app.use_case_personal_data(v_uc.id) then v_facts := v_facts || 'personal_data'::app.suggestion_condition; end if;
  if app.use_case_sensitive_data(v_uc.id) then v_facts := v_facts || 'sensitive_data'::app.suggestion_condition; end if;$x$);
  execute v;
end $$;

insert into public.catalog_applicability_rule (framework_code, control_code, condition, reason) values
  ('AIGMS-CF', 'AIGMS-DAT-005', 'sensitive_data',           'Des données sensibles sont traitées : les catégories particulières de l''article 9 se traitent à part.'),
  ('AIGMS-CF', 'AIGMS-DAT-006', 'sensitive_data',           'Des données sensibles sont traitées : si la santé est en jeu, ce contrôle s''applique.'),
  ('AIGMS-CF', 'AIGMS-DAT-009', 'sensitive_data',           'Des données sensibles sont traitées : ne transmettre que le strict nécessaire.'),
  -- L'article 50 de l'AI Act : informer la personne qu'elle interagit avec
  -- une IA, et marquer ce que le système produit. La case ne faisait rien.
  ('AIGMS-CF', 'AIGMS-HUM-006', 'transparency_obligations', 'La qualification retient des obligations de transparence (article 50) : les personnes en sont informées de façon compréhensible.'),
  ('AIGMS-CF', 'AIGMS-USE-004', 'transparency_obligations', 'Obligations de transparence : les personnes informées sont des parties prenantes à recenser.')
on conflict do nothing;

-- Le socle reste le socle. Un contrôle attendu de tout cas d'usage que les
-- faits déclenchent en plus (HUM-006 et la transparence, par exemple) sortait
-- du socle pour rejoindre « propres à ce cas d'usage » : le socle cessait
-- d'être le même pour tous. Il y reste, avec le motif en plus.
do $$
declare v text;
begin
  select pg_get_functiondef('app.suggest_controls(uuid)'::regprocedure) into v;
  v := replace(v,
    $x$'tier', case when s.mandatory and array_length(s.reasons, 1) is null then 'baseline'$x$,
    $x$'tier', case when s.mandatory then 'baseline'$x$);
  execute v;
end $$;

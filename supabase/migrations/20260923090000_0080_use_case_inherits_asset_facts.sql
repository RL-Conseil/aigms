-- =============================================================================
-- AIGMS — 0080 — Un cas d'usage hérite des faits de ses actifs
-- =============================================================================
-- Rattacher un actif qui contient des données personnelles, ou un actif
-- fourni par un tiers, ne changeait rien au cas d'usage : le fait « données
-- personnelles » ne se lisait que sur la case de la fiche, et les fournisseurs
-- ne comptaient que rattachés explicitement. Les propositions de contrôles,
-- l'exigence d'évaluation d'impact, le gate « revue tiers », la règle de
-- transfert d'un risque et les actions proposées lisaient chacun leur coin.
--
-- Deux lectures uniques, dont tous héritent :
--   * app.use_case_vendor_all — les tiers impliqués : rattachés au cas
--     d'usage, ou fournisseurs d'un actif rattaché ;
--   * app.use_case_personal_data(cas) — la case de la fiche, ou un actif
--     rattaché qui en contient.
-- Détacher l'actif défait tout : rien n'est copié sur le cas d'usage.
-- =============================================================================

create or replace view app.use_case_vendor_all
with (security_invoker = true)
as
  select l.use_case_id, l.vendor_id, 'use_case'::text as via
  from public.use_case_vendor_link l
  union
  select al.use_case_id, a.vendor_id, 'asset'::text as via
  from public.use_case_asset_link al
  join public.ai_asset a on a.id = al.asset_id
  where a.vendor_id is not null;

comment on view app.use_case_vendor_all is
  'Les tiers impliqués dans un cas d''usage : rattachés explicitement, ou fournisseurs d''un actif rattaché.';

grant select on app.use_case_vendor_all to authenticated;

create or replace function app.use_case_personal_data(p_use_case_id uuid)
returns boolean
language sql stable
set search_path = app, public, pg_catalog
as $$
  select exists (select 1 from public.ai_use_case u where u.id = p_use_case_id and u.involves_personal_data)
      or exists (select 1 from public.use_case_asset_link l join public.ai_asset a on a.id = l.asset_id
                  where l.use_case_id = p_use_case_id and a.contains_personal_data);
$$;

comment on function app.use_case_personal_data is
  'Des données personnelles sont en jeu : la case de la fiche, ou un actif rattaché qui en contient.';

-- Ce que le rattachement d'un actif apporte au cas d'usage : lu par la fiche
-- au moment du geste, pour le dire.
create or replace function public.asset_link_effects(p_use_case_id uuid, p_asset_id uuid)
returns jsonb
language sql stable security invoker
set search_path = app, public, pg_catalog
as $$
  select jsonb_build_object(
    'personal_data', a.contains_personal_data,
    'personal_data_new', a.contains_personal_data and not app.use_case_personal_data(p_use_case_id),
    'vendor', case when v.id is not null then jsonb_build_object('id', v.id, 'name', v.name, 'review_status', v.review_status,
                                                                 'already_linked', exists (select 1 from public.use_case_vendor_link l
                                                                                             where l.use_case_id = p_use_case_id and l.vendor_id = v.id)) end,
    'impact_required_now', app.impact_assessment_required(p_use_case_id)
  )
  from public.ai_asset a
  left join public.vendor v on v.id = a.vendor_id
  where a.id = p_asset_id;
$$;

grant execute on function public.asset_link_effects(uuid, uuid) to authenticated;

-- -----------------------------------------------------------------------------
-- Les lecteurs héritent
-- -----------------------------------------------------------------------------
create or replace function app.impact_assessment_required(p_use_case_id uuid)
returns boolean
language sql
stable
security definer
set search_path = app, public, pg_catalog
as $$
  select exists (
    select 1
    from public.ai_use_case u
    left join public.regulatory_classification c
           on c.use_case_id = u.id and c.is_current
    where u.id = p_use_case_id
      and (
        app.use_case_personal_data(u.id)
        or u.involves_vulnerable_persons
        or u.autonomy_level in ('L3', 'L4')
        or u.criticality in ('high', 'critical')
        or 'high_risk_potential' = any (coalesce(c.flags, '{}'))
        or 'privacy_impact'      = any (coalesce(c.flags, '{}'))
      )
  );
$$;

comment on function app.impact_assessment_required is
  'Un AIIA est requis dès qu''il y a données personnelles (fiche ou actif rattaché), personnes vulnérables, autonomie L3+, criticité haute ou drapeau haut risque / vie privée.';

-- Les quatre autres ne changent que par leur source : on réécrit leur texte
-- plutôt que de recopier leur corps.
do $$
declare v text; f text;
begin
  foreach f in array array['app.evaluate_production_gate(uuid)', 'app.suggest_actions(uuid)', 'app.risk_is_settled(public.risk)', 'app.suggest_controls(uuid)'] loop
    select pg_get_functiondef(f::regprocedure) into v;
    v := replace(v, 'public.use_case_vendor_link', 'app.use_case_vendor_all');
    if f = 'app.suggest_controls(uuid)' then
      v := replace(v, 'if v_uc.involves_personal_data then', 'if app.use_case_personal_data(v_uc.id) then');
    end if;
    execute v;
  end loop;
end $$;

-- Lisible depuis l'application : l'étude d'impact pré-coche l'AIPD.
create or replace function public.use_case_personal_data(p_use_case_id uuid)
returns boolean language sql stable security invoker
set search_path = app, public, pg_catalog
as $$ select app.use_case_personal_data(p_use_case_id); $$;

grant execute on function public.use_case_personal_data(uuid) to authenticated;

do $$
declare v text;
begin
  select pg_get_functiondef('public.impact_study(uuid)'::regprocedure) into v;
  v := replace(v, $x$'involves_personal_data', u.involves_personal_data,$x$,
                  $x$'involves_personal_data', u.involves_personal_data, 'personal_data', app.use_case_personal_data(u.id),$x$);
  execute v;
end $$;

-- La fiche dit ce que chaque actif apporte : la revue de son fournisseur.
do $$
declare v text;
begin
  select pg_get_functiondef('public.use_case_assets(uuid)'::regprocedure) into v;
  v := replace(v, $x$'vendor', (select v.name from public.vendor v where v.id = a.vendor_id),$x$,
                  $x$'vendor', (select v.name from public.vendor v where v.id = a.vendor_id),
    'vendor_review_status', (select v.review_status from public.vendor v where v.id = a.vendor_id),$x$);
  execute v;
end $$;

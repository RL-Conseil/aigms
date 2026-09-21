-- =============================================================================
-- AIGMS — 0075 — La criticité se justifie, se grille, et se confronte aux faits
-- =============================================================================
-- La criticité d'un cas d'usage dose l'effort de gouvernance : elle exige
-- l'AIIA (0011), réserve le GO production au Comité de direction (0055), fixe
-- la cadence de revue (0067) et appelle des contrôles (0048). Elle se pose au
-- triage, A PRIORI — avant les risques, avant l'AIIA. Rien ne la confrontait
-- ensuite aux faits : un risque résiduel critique ouvert sous une criticité
-- « modérée » ne disait rien.
--
--   1. La justification et la grille de triage se conservent sur la fiche.
--      Jusqu'ici la justification exigée au formulaire n'était pas stockée.
--   2. `app.criticality_signal(cas d'usage)` compare la criticité retenue à ce
--      que les faits imposent : risque ouvert d'un niveau supérieur, personnes
--      vulnérables, autonomie L3+, AIIA achevée avec DPIA, drapeau haut risque.
--      Elle dit « à réviser » et pourquoi. Elle ne change rien : la criticité
--      reste un acte humain, tracé.
--   3. Quand les faits dépassent la criticité retenue, l'AI Governance Officer
--      est alerté ; réviser à la hausse lève l'alerte.
-- =============================================================================

alter table public.ai_use_case
  add column if not exists criticality_rationale text,
  add column if not exists criticality_grid      jsonb,
  add column if not exists criticality_set_at    timestamptz,
  add column if not exists criticality_set_by    uuid references public.user_profile (id) on delete set null;

comment on column public.ai_use_case.criticality_rationale is
  'Pourquoi ce niveau de criticité — relu à la revue.';
comment on column public.ai_use_case.criticality_grid is
  'Réponses de la grille de triage (affectés, réversibilité, portée, données) qui ont conduit au niveau proposé.';

-- Le rang d'un niveau, pour comparer.
create or replace function app.criticality_rank(p app.criticality)
returns integer
language sql immutable
as $$
  select case p when 'critical' then 4 when 'high' then 3 when 'moderate' then 2 when 'low' then 1 else 0 end;
$$;

create or replace function app.criticality_from_rank(p integer)
returns app.criticality
language sql immutable
as $$
  select case p when 4 then 'critical'::app.criticality when 3 then 'high' when 2 then 'moderate' when 1 then 'low' else null end;
$$;

-- -----------------------------------------------------------------------------
-- 2. Le signal : ce que les faits imposent, face à ce qui a été retenu
-- -----------------------------------------------------------------------------
create or replace function app.criticality_signal(p_use_case_id uuid)
returns jsonb
language plpgsql
stable
security definer
set search_path = app, public, pg_catalog
as $$
declare
  v_uc public.ai_use_case%rowtype;
  v_observed integer := 0;
  v_reasons text[] := '{}';
  v_risk record;
  v_flags app.classification_flag[];
  v_aiia record;
begin
  select * into v_uc from public.ai_use_case where id = p_use_case_id;
  if v_uc.id is null or not app.has_tenant_access(v_uc.tenant_id) then return null; end if;

  -- Le risque ouvert le plus élevé : résiduel s'il est évalué, sinon inhérent.
  select r.business_ref, coalesce(r.residual_level, r.inherent_level) as level
    into v_risk
    from public.risk r
   where r.use_case_id = p_use_case_id
     and r.status not in ('accepted', 'mitigated', 'closed')
   order by app.criticality_rank(coalesce(r.residual_level, r.inherent_level)::text::app.criticality) desc, r.business_ref
   limit 1;
  if v_risk.level is not null then
    v_observed := greatest(v_observed, app.criticality_rank(v_risk.level::text::app.criticality));
    if app.criticality_rank(v_risk.level::text::app.criticality) >= 3 then
      v_reasons := array_append(v_reasons,
        format('Risque %s ouvert de niveau %s.', v_risk.business_ref,
               case v_risk.level::text when 'critical' then 'critique' else 'élevé' end));
    end if;
  end if;

  if v_uc.involves_vulnerable_persons then
    v_observed := greatest(v_observed, 3);
    v_reasons := array_append(v_reasons, 'Des personnes vulnérables sont concernées.');
  end if;

  if v_uc.autonomy_level in ('L3', 'L4') then
    v_observed := greatest(v_observed, 3);
    v_reasons := array_append(v_reasons, format('Autonomie %s : le système exécute sans validation au cas par cas.', v_uc.autonomy_level));
  end if;

  select c.flags into v_flags from public.regulatory_classification c
   where c.use_case_id = p_use_case_id and c.is_current limit 1;
  if 'high_risk_potential' = any (coalesce(v_flags, '{}')) then
    v_observed := greatest(v_observed, 3);
    v_reasons := array_append(v_reasons, 'La qualification retient un potentiel haut risque au sens du règlement.');
  end if;
  if 'prohibited_practice_suspected' = any (coalesce(v_flags, '{}')) then
    v_observed := greatest(v_observed, 4);
    v_reasons := array_append(v_reasons, 'La qualification soupçonne une pratique interdite.');
  end if;

  select ia.business_ref, ia.dpia_required into v_aiia
    from public.impact_assessment ia
   where ia.use_case_id = p_use_case_id and ia.status = 'completed'
   order by ia.completed_at desc limit 1;
  if v_aiia.business_ref is not null and v_aiia.dpia_required then
    v_observed := greatest(v_observed, 3);
    v_reasons := array_append(v_reasons, format('L''évaluation d''impact %s conclut qu''une AIPD est requise.', v_aiia.business_ref));
  end if;

  return jsonb_build_object(
    'retained', v_uc.criticality,
    'observed', app.criticality_from_rank(v_observed),
    'exceeds', v_uc.criticality is not null and v_observed > app.criticality_rank(v_uc.criticality),
    'reasons', to_jsonb(v_reasons)
  );
end;
$$;

comment on function app.criticality_signal is
  'Compare la criticité retenue à ce que les faits imposent (risques ouverts, personnes vulnérables, autonomie, qualification, AIIA). Signale, ne change rien.';

create or replace function public.criticality_signal(p_use_case_id uuid)
returns jsonb
language sql stable security invoker
set search_path = app, public, pg_catalog
as $$ select app.criticality_signal(p_use_case_id); $$;

revoke all on function public.criticality_signal(uuid) from public, anon;
grant execute on function public.criticality_signal(uuid) to authenticated;

-- -----------------------------------------------------------------------------
-- 3. L'alerte : les faits dépassent la criticité retenue
-- -----------------------------------------------------------------------------
create or replace function app.check_criticality(p_use_case_id uuid)
returns void
language plpgsql
security definer
set search_path = app, public, pg_catalog
as $$
declare
  v_uc public.ai_use_case%rowtype;
  v_signal jsonb;
  v_officer uuid;
begin
  if current_setting('aigms.seed', true) = 'on' then return; end if;
  select * into v_uc from public.ai_use_case where id = p_use_case_id;
  if v_uc.id is null or v_uc.criticality is null then return; end if;
  v_signal := app.criticality_signal(p_use_case_id);
  if coalesce((v_signal ->> 'exceeds')::boolean, false) then
    v_officer := coalesce(app.person_for_role(v_uc.organization_id, 'AI Governance Officer'), v_uc.accountable_user_id);
    perform app.notify(
      v_uc.tenant_id, v_uc.organization_id, v_officer, 'criticality_review',
      format('Criticité à réviser — %s', v_uc.name),
      format('Retenue : %s. Les faits imposent : %s. %s',
             v_uc.criticality, v_signal ->> 'observed',
             coalesce((select string_agg(x, ' ') from jsonb_array_elements_text(v_signal -> 'reasons') x), '')),
      format('/admin/use-cases/%s', v_uc.id), 'ai_use_case', v_uc.id);
  else
    perform app.drop_pending_notifications(v_uc.id, array['criticality_review']::app.notification_kind[]);
  end if;
end;
$$;

create or replace function app.check_criticality_from_risk()
returns trigger
language plpgsql
security definer
set search_path = app, public, pg_catalog
as $$
begin
  perform app.check_criticality(new.use_case_id);
  return new;
end;
$$;

create trigger risk_check_criticality
  after insert or update of inherent_level, residual_level, status on public.risk
  for each row execute function app.check_criticality_from_risk();

create trigger impact_assessment_check_criticality
  after update of status, dpia_required on public.impact_assessment
  for each row execute function app.check_criticality_from_risk();

create or replace function app.check_criticality_from_use_case()
returns trigger
language plpgsql
security definer
set search_path = app, public, pg_catalog
as $$
begin
  perform app.check_criticality(new.id);
  return new;
end;
$$;

create trigger ai_use_case_check_criticality
  after update of criticality, autonomy_level, involves_vulnerable_persons on public.ai_use_case
  for each row execute function app.check_criticality_from_use_case();

create or replace function app.check_criticality_from_classification()
returns trigger
language plpgsql
security definer
set search_path = app, public, pg_catalog
as $$
begin
  perform app.check_criticality(new.use_case_id);
  return new;
end;
$$;

create trigger regulatory_classification_check_criticality
  after insert or update of flags, is_current on public.regulatory_classification
  for each row execute function app.check_criticality_from_classification();

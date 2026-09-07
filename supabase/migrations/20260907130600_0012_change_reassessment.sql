-- =============================================================================
-- AIGMS — 0012 — Change Management et Reassessment Engine
-- Vertical slice — Sprint 11
-- =============================================================================
-- Règle non négociable : un changement significatif rouvre l'évaluation.
-- `app.evaluate_governance_impact` retourne NO_REASSESSMENT,
-- PARTIAL_REASSESSMENT ou FULL_REASSESSMENT, motivé, historisé et révisable
-- par un humain : la recommandation du moteur n'est jamais la décision finale.
-- =============================================================================

create type app.change_type as enum (
  'MODEL', 'DATASET', 'PURPOSE', 'VENDOR', 'AUTONOMY',
  'POPULATION', 'TERRITORY', 'SECURITY', 'DEPLOYMENT'
);

create type app.change_status as enum (
  'DRAFT', 'IMPACT_SCREENING', 'REVIEW', 'APPROVED', 'REJECTED', 'IMPLEMENTED', 'VERIFIED', 'CANCELLED'
);

create type app.reassessment_verdict as enum (
  'NO_REASSESSMENT', 'PARTIAL_REASSESSMENT', 'FULL_REASSESSMENT'
);

create type app.reassessment_status as enum ('recommended', 'confirmed', 'overridden', 'in_progress', 'completed');

-- -----------------------------------------------------------------------------
-- change_request
-- -----------------------------------------------------------------------------
create table public.change_request (
  id                 uuid primary key default gen_random_uuid(),
  tenant_id          uuid not null references public.tenant (id) on delete cascade,
  organization_id    uuid not null references public.organization (id) on delete cascade,
  use_case_id        uuid not null references public.ai_use_case (id) on delete cascade,
  business_ref       text not null,

  title              text not null check (btrim(title) <> ''),
  description        text not null check (btrim(description) <> ''),
  change_types       app.change_type[] not null check (array_length(change_types, 1) >= 1),

  -- Éléments objectifs consommés par le moteur de réévaluation.
  increases_autonomy      boolean not null default false,
  new_autonomy_level      app.autonomy_level,
  changes_purpose         boolean not null default false,
  new_population_affected boolean not null default false,
  new_territory           boolean not null default false,
  changes_personal_data   boolean not null default false,
  changes_vendor          boolean not null default false,
  changes_model           boolean not null default false,
  changes_dataset         boolean not null default false,
  security_relevant       boolean not null default false,

  status             app.change_status not null default 'DRAFT',
  requested_by       uuid references public.user_profile (id) on delete set null,
  planned_at         date,
  implemented_at     timestamptz,
  verified_at        timestamptz,
  verification_note  text,

  created_at         timestamptz not null default now(),
  updated_at         timestamptz not null default now(),

  unique (tenant_id, business_ref),
  check (status <> 'VERIFIED' or (implemented_at is not null and verified_at is not null))
);

comment on table public.change_request is
  'Demande de changement sur un cas d''usage. Les champs booléens sont les entrées factuelles du moteur de réévaluation.';

create index change_request_use_case_idx on public.change_request (use_case_id, status);

create trigger change_request_touch_updated_at before update on public.change_request
  for each row execute function app.touch_updated_at();
create trigger change_request_assert_tenant before insert or update on public.change_request
  for each row execute function app.assert_tenant_consistency();

create or replace function app.set_change_business_ref()
returns trigger language plpgsql security definer
set search_path = app, public, pg_catalog as $$
begin
  if new.business_ref is null or btrim(new.business_ref) = '' then
    new.business_ref := app.next_business_ref(new.tenant_id, 'CHG');
  end if;
  return new;
end; $$;

create trigger change_request_set_business_ref before insert on public.change_request
  for each row execute function app.set_change_business_ref();

-- -----------------------------------------------------------------------------
-- reassessment — verdict du moteur et sa revue humaine
-- -----------------------------------------------------------------------------
create table public.reassessment (
  id                     uuid primary key default gen_random_uuid(),
  tenant_id              uuid not null references public.tenant (id) on delete cascade,
  organization_id        uuid not null references public.organization (id) on delete cascade,
  use_case_id            uuid not null references public.ai_use_case (id) on delete cascade,
  change_request_id      uuid not null references public.change_request (id) on delete cascade,
  business_ref           text not null,

  engine_verdict         app.reassessment_verdict not null,
  engine_rationale       jsonb not null,
  scope                  text[] not null default '{}',

  -- Révision humaine : le verdict retenu peut différer du verdict moteur.
  final_verdict          app.reassessment_verdict,
  status                 app.reassessment_status not null default 'recommended',
  reviewed_by            uuid references public.user_profile (id) on delete set null,
  reviewed_at            timestamptz,
  override_rationale     text,

  completed_at           timestamptz,
  created_at             timestamptz not null default now(),
  updated_at             timestamptz not null default now(),

  unique (tenant_id, business_ref),
  -- Écarter la recommandation du moteur exige une justification humaine.
  constraint reassessment_override_is_justified check (
    status <> 'overridden'
    or (final_verdict is not null
        and final_verdict <> engine_verdict
        and reviewed_by is not null
        and btrim(coalesce(override_rationale, '')) <> '')
  ),
  constraint reassessment_confirmation_is_signed check (
    status <> 'confirmed' or (reviewed_by is not null and reviewed_at is not null)
  )
);

comment on table public.reassessment is
  'Verdict de réévaluation. `engine_verdict` est une recommandation ; `final_verdict` porte la décision humaine, avec justification obligatoire en cas d''écart.';
comment on column public.reassessment.scope is
  'Objets de gouvernance à rouvrir : classification, risk, impact_assessment, oversight, vendor, controls.';

create index reassessment_use_case_idx on public.reassessment (use_case_id, status);

create trigger reassessment_touch_updated_at before update on public.reassessment
  for each row execute function app.touch_updated_at();
create trigger reassessment_assert_tenant before insert or update on public.reassessment
  for each row execute function app.assert_tenant_consistency();

create or replace function app.set_reassessment_business_ref()
returns trigger language plpgsql security definer
set search_path = app, public, pg_catalog as $$
begin
  if new.business_ref is null or btrim(new.business_ref) = '' then
    new.business_ref := app.next_business_ref(new.tenant_id, 'REA');
  end if;
  return new;
end; $$;

create trigger reassessment_set_business_ref before insert on public.reassessment
  for each row execute function app.set_reassessment_business_ref();

-- -----------------------------------------------------------------------------
-- Moteur : evaluateGovernanceImpact(change)
-- -----------------------------------------------------------------------------
create or replace function app.evaluate_governance_impact(p_change_request_id uuid)
returns jsonb
language plpgsql
stable
security definer
set search_path = app, public, pg_catalog
as $$
declare
  v_ch      public.change_request;
  v_uc      public.ai_use_case;
  v_reasons jsonb := '[]'::jsonb;
  v_scope   text[] := '{}';
  v_verdict app.reassessment_verdict;
  v_full    boolean := false;
  v_partial boolean := false;
begin
  select * into v_ch from public.change_request where id = p_change_request_id;
  if v_ch.id is null then
    raise exception 'Demande de changement % introuvable', p_change_request_id using errcode = 'no_data_found';
  end if;

  select * into v_uc from public.ai_use_case where id = v_ch.use_case_id;

  -- --- Déclencheurs de réévaluation complète ---------------------------------
  -- Ils modifient la raison d'être, le public concerné ou le degré d'autonomie :
  -- la classification réglementaire et l'AIIA ne tiennent plus.

  if v_ch.changes_purpose then
    v_full := true;
    v_scope := v_scope || array['classification', 'risk', 'impact_assessment', 'oversight', 'controls'];
    v_reasons := v_reasons || jsonb_build_object(
      'code', 'PURPOSE_CHANGED', 'weight', 'full',
      'detail', 'Le changement de finalité invalide la classification réglementaire et l''évaluation d''impact.');
  end if;

  if v_ch.new_population_affected then
    v_full := true;
    v_scope := v_scope || array['classification', 'impact_assessment', 'risk'];
    v_reasons := v_reasons || jsonb_build_object(
      'code', 'NEW_POPULATION', 'weight', 'full',
      'detail', 'Une nouvelle population affectée impose de reprendre l''évaluation d''impact et la classification.');
  end if;

  if v_ch.increases_autonomy
     and v_ch.new_autonomy_level is not null
     and v_ch.new_autonomy_level > v_uc.autonomy_level then
    v_full := true;
    v_scope := v_scope || array['oversight', 'risk', 'impact_assessment'];
    v_reasons := v_reasons || jsonb_build_object(
      'code', 'AUTONOMY_INCREASED', 'weight', 'full',
      'detail', format('Autonomie portée de %s à %s : le plan de supervision humaine doit être refait.',
                       v_uc.autonomy_level, v_ch.new_autonomy_level));
  end if;

  if v_ch.changes_personal_data then
    v_full := true;
    v_scope := v_scope || array['impact_assessment', 'classification', 'risk'];
    v_reasons := v_reasons || jsonb_build_object(
      'code', 'PERSONAL_DATA_CHANGED', 'weight', 'full',
      'detail', 'La modification du périmètre de données personnelles impose de reprendre l''AIIA et l''articulation DPIA.');
  end if;

  -- --- Déclencheurs de réévaluation partielle --------------------------------
  if v_ch.changes_model then
    v_partial := true;
    v_scope := v_scope || array['risk', 'controls'];
    v_reasons := v_reasons || jsonb_build_object(
      'code', 'MODEL_CHANGED', 'weight', 'partial',
      'detail', 'Le changement de modèle appelle une revue des risques de performance et de robustesse.');
  end if;

  if v_ch.changes_dataset then
    v_partial := true;
    v_scope := v_scope || array['risk', 'impact_assessment'];
    v_reasons := v_reasons || jsonb_build_object(
      'code', 'DATASET_CHANGED', 'weight', 'partial',
      'detail', 'Le changement de jeu de données appelle une revue des risques de biais et de qualité.');
  end if;

  if v_ch.changes_vendor then
    v_partial := true;
    v_scope := v_scope || array['vendor', 'risk', 'controls'];
    v_reasons := v_reasons || jsonb_build_object(
      'code', 'VENDOR_CHANGED', 'weight', 'partial',
      'detail', 'Le changement de fournisseur impose une nouvelle revue tiers.');
  end if;

  if v_ch.new_territory then
    v_partial := true;
    v_scope := v_scope || array['classification', 'controls'];
    v_reasons := v_reasons || jsonb_build_object(
      'code', 'TERRITORY_CHANGED', 'weight', 'partial',
      'detail', 'Un nouveau territoire peut modifier les obligations applicables.');
  end if;

  if v_ch.security_relevant then
    v_partial := true;
    v_scope := v_scope || array['risk', 'controls'];
    v_reasons := v_reasons || jsonb_build_object(
      'code', 'SECURITY_RELEVANT', 'weight', 'partial',
      'detail', 'Le changement touche la sécurité : contrôles et risques associés à revoir.');
  end if;

  -- --- Facteur aggravant : un cas d'usage à haut risque ne subit pas de
  -- --- changement anodin.
  if not v_full and v_partial
     and exists (select 1 from public.regulatory_classification c
                 where c.use_case_id = v_uc.id and c.is_current
                   and 'high_risk_potential' = any (c.flags)) then
    v_full := true;
    v_reasons := v_reasons || jsonb_build_object(
      'code', 'HIGH_RISK_ESCALATION', 'weight', 'full',
      'detail', 'Cas d''usage marqué haut risque potentiel : tout changement significatif déclenche une réévaluation complète.');
  end if;

  v_verdict := case
    when v_full    then 'FULL_REASSESSMENT'
    when v_partial then 'PARTIAL_REASSESSMENT'
    else                'NO_REASSESSMENT'
  end::app.reassessment_verdict;

  if v_verdict = 'NO_REASSESSMENT' then
    v_reasons := v_reasons || jsonb_build_object(
      'code', 'NO_SIGNIFICANT_TRIGGER', 'weight', 'none',
      'detail', 'Aucun déclencheur significatif identifié. Le changement reste tracé et la décision humaine demeure requise.');
  end if;

  return jsonb_build_object(
    'change_request_id', p_change_request_id,
    'use_case_id', v_uc.id,
    'verdict', v_verdict,
    'scope', to_jsonb(array(select distinct unnest(v_scope) order by 1)),
    'reasons', v_reasons,
    'evaluated_at', now(),
    'note', 'Recommandation du moteur. La confirmation ou l''écart relève d''un responsable humain.'
  );
end;
$$;

comment on function app.evaluate_governance_impact is
  'Moteur de réévaluation : qualifie un changement en NO / PARTIAL / FULL_REASSESSMENT, avec le détail des déclencheurs et le périmètre à rouvrir.';

-- -----------------------------------------------------------------------------
-- Screening : enregistre le verdict et rouvre les évaluations concernées
-- -----------------------------------------------------------------------------
create or replace function app.screen_change_request(p_change_request_id uuid)
returns jsonb
language plpgsql
security definer
set search_path = app, public, pg_catalog
as $$
declare
  v_ch         public.change_request;
  v_result     jsonb;
  v_verdict    app.reassessment_verdict;
  v_scope      text[];
  v_reassessment_id uuid;
begin
  select * into v_ch from public.change_request where id = p_change_request_id;
  if v_ch.id is null then
    raise exception 'Demande de changement % introuvable', p_change_request_id using errcode = 'no_data_found';
  end if;

  if not app.has_organization_role(v_ch.organization_id, app.roles_write_governance()) then
    raise exception 'Habilitation insuffisante pour qualifier le changement %.', v_ch.business_ref
      using errcode = 'insufficient_privilege';
  end if;

  v_result  := app.evaluate_governance_impact(p_change_request_id);
  v_verdict := (v_result ->> 'verdict')::app.reassessment_verdict;
  v_scope   := array(select jsonb_array_elements_text(v_result -> 'scope'));

  insert into public.reassessment (
    tenant_id, organization_id, use_case_id, change_request_id,
    engine_verdict, engine_rationale, scope, status
  )
  values (
    v_ch.tenant_id, v_ch.organization_id, v_ch.use_case_id, v_ch.id,
    v_verdict, v_result -> 'reasons', v_scope, 'recommended'
  )
  returning id into v_reassessment_id;

  update public.change_request
     set status = 'IMPACT_SCREENING'
   where id = p_change_request_id
     and status = 'DRAFT';

  -- Réouverture des évaluations concernées : la gouvernance ne peut rester
  -- adossée à une analyse périmée.
  if v_verdict = 'FULL_REASSESSMENT' then
    update public.assessment
       set status = 'reopened',
           reopened_reason = format('Changement significatif %s', v_ch.business_ref)
     where use_case_id = v_ch.use_case_id
       and status = 'completed';

    update public.impact_assessment
       set status = 'reopened',
           reopened_reason = format('Changement significatif %s', v_ch.business_ref)
     where use_case_id = v_ch.use_case_id
       and status = 'completed';
  elsif v_verdict = 'PARTIAL_REASSESSMENT' and 'impact_assessment' = any (v_scope) then
    update public.impact_assessment
       set status = 'reopened',
           reopened_reason = format('Changement %s : réévaluation partielle', v_ch.business_ref)
     where use_case_id = v_ch.use_case_id
       and status = 'completed';
  end if;

  perform app.log_audit(
    v_ch.tenant_id, 'reassessment_triggered', 'change_request', v_ch.id, v_ch.business_ref,
    format('Qualification du changement : %s', v_verdict),
    null, null, v_result
  );

  perform app.emit_event(v_ch.tenant_id, 'SignificantChangeDetected', 'change_request', v_ch.id, v_result);

  if v_verdict <> 'NO_REASSESSMENT' then
    perform app.emit_event(v_ch.tenant_id, 'ReassessmentTriggered', 'ai_use_case', v_ch.use_case_id, v_result);
  end if;

  return v_result || jsonb_build_object('reassessment_id', v_reassessment_id);
end;
$$;

comment on function app.screen_change_request is
  'Qualifie un changement, enregistre la réévaluation et rouvre les évaluations devenues périmées.';

revoke all on function app.evaluate_governance_impact(uuid) from public;
revoke all on function app.screen_change_request(uuid)      from public;
grant execute on function app.evaluate_governance_impact(uuid) to authenticated, service_role;
grant execute on function app.screen_change_request(uuid)      to authenticated, service_role;

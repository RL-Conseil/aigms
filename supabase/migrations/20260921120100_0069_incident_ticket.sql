-- =============================================================================
-- AIGMS — 0069 — Le ticket d'incident au format du kit de preuve
-- =============================================================================
-- Le kit (04_References/kit_preuve_ai_officer.md, § 2 et workflow C) attend
-- d'un ticket : le déclencheur, le système impacté, les droits fondamentaux,
-- qui rapporte, qui instruit (l'AI Officer), qui répond (le Porteur), une
-- qualification sous 24 h, un arrêt d'urgence tracé — recommandé, validé,
-- exécuté —, et une double signature à la clôture : validation de l'AI
-- Officer, approbation du Porteur.
--
--   * Colonnes du ticket ; l'AI Governance Officer en charge, par défaut.
--   * Qualification : un acte daté ; sans lui, rappel à l'officer 24 h après
--     la détection.
--   * Arrêt d'urgence : trois actes nominatifs et datés ; l'arrêt validé ouvre
--     une décision de suspension du cas d'usage en service.
--   * Clôture : refusée sans les deux signatures (l'acte d'une personne).
--   * `incident_ticket` : le ticket complet, pour l'impression et l'export.
-- =============================================================================

alter table public.incident
  add column if not exists trigger_source app.incident_trigger not null default 'other',
  add column if not exists asset_id uuid references public.ai_asset (id) on delete set null,
  add column if not exists fundamental_rights_impacted boolean not null default false,
  add column if not exists fundamental_rights_detail text,
  add column if not exists officer_user_id uuid references public.user_profile (id) on delete set null,
  add column if not exists qualified_at timestamptz,
  add column if not exists qualified_by uuid references public.user_profile (id) on delete set null,
  add column if not exists stop_recommended_by uuid references public.user_profile (id) on delete set null,
  add column if not exists stop_recommended_at timestamptz,
  add column if not exists stop_validated_by uuid references public.user_profile (id) on delete set null,
  add column if not exists stop_validated_at timestamptz,
  add column if not exists stop_executed_by uuid references public.user_profile (id) on delete set null,
  add column if not exists stop_executed_at timestamptz,
  add column if not exists stop_note text,
  add column if not exists closure_officer_by uuid references public.user_profile (id) on delete set null,
  add column if not exists closure_officer_at timestamptz,
  add column if not exists closure_owner_by uuid references public.user_profile (id) on delete set null,
  add column if not exists closure_owner_at timestamptz;

comment on column public.incident.officer_user_id is 'L''AI Governance Officer en charge du ticket. Par défaut, le premier officer de l''organisation.';
comment on column public.incident.qualified_at is 'La qualification — sévérité, nature, droits fondamentaux — est un acte daté ; attendu sous 24 h (workflow C).';

-- L'officer en charge, par défaut ; le rappel à 24 h.
create or replace function app.incident_defaults()
returns trigger
language plpgsql
security definer
set search_path = app, public, pg_catalog
as $$
begin
  if new.officer_user_id is null then
    new.officer_user_id := coalesce(app.person_for_role(new.organization_id, 'AI Governance Officer'), app.current_user_id());
  end if;
  if new.reported_by is null then new.reported_by := app.current_user_id(); end if;
  return new;
end;
$$;

create trigger incident_defaults before insert on public.incident
  for each row execute function app.incident_defaults();

create or replace function app.notify_incident_ticket()
returns trigger
language plpgsql
security definer
set search_path = app, public, pg_catalog
as $$
declare v_href text;
begin
  v_href := case when new.use_case_id is not null
                 then format('/admin/use-cases/%s?onglet=incidents', new.use_case_id)
                 else format('/admin/organizations/%s/suivi?vue=incidents', new.organization_id) end;

  if tg_op = 'INSERT' and new.qualified_at is null and new.officer_user_id is not null then
    perform app.notify(new.tenant_id, new.organization_id, new.officer_user_id, 'incident_new',
      format('Incident %s à qualifier sous 24 h : %s', new.business_ref, new.title),
      format('Détecté le %s. Sévérité, nature, droits fondamentaux : la qualification est attendue sous 24 h (workflow C).', to_char(new.detected_at, 'DD/MM/YYYY HH24:MI')),
      v_href, 'incident', new.id);
    perform app.notify(new.tenant_id, new.organization_id, new.officer_user_id, 'incident_qualify',
      format('Incident %s : 24 h écoulées sans qualification', new.business_ref),
      format('« %s ». L''auditeur lit la chronologie : qualifier maintenant, en disant pourquoi si tard.', new.title),
      v_href, 'incident', new.id, new.detected_at + interval '24 hours');
  end if;
  if tg_op = 'UPDATE' and new.qualified_at is not null and old.qualified_at is null then
    perform app.drop_pending_notifications(new.id, array['incident_new', 'incident_qualify']::app.notification_kind[]);
  end if;

  -- L'arrêt recommandé : le Porteur valide ; validé : qui exécute le sait.
  if tg_op = 'UPDATE' and new.stop_recommended_at is not null and old.stop_recommended_at is null and new.owner_user_id is not null then
    perform app.notify(new.tenant_id, new.organization_id, new.owner_user_id, 'incident_stop',
      format('Arrêt d''urgence recommandé : %s', new.title),
      format('%s. L''AI Governance Officer recommande l''arrêt (kill-switch). Vous validez — ou refusez en le disant.', new.business_ref),
      v_href, 'incident', new.id);
  end if;

  -- La clôture attend l'autre signature.
  if tg_op = 'UPDATE' and new.closure_officer_at is not null and old.closure_officer_at is null and new.owner_user_id is not null
     and new.closure_owner_at is null then
    perform app.notify(new.tenant_id, new.organization_id, new.owner_user_id, 'incident_closure',
      format('Clôture à approuver : %s', new.title),
      format('%s. L''AI Governance Officer a validé l''analyse et la remédiation ; votre approbation clôt le ticket.', new.business_ref),
      v_href, 'incident', new.id);
  end if;
  if tg_op = 'UPDATE' and new.closure_owner_at is not null and old.closure_owner_at is null and new.officer_user_id is not null
     and new.closure_officer_at is null then
    perform app.notify(new.tenant_id, new.organization_id, new.officer_user_id, 'incident_closure',
      format('Clôture à valider : %s', new.title),
      format('%s. Le Porteur a approuvé ; votre validation clôt le ticket.', new.business_ref),
      v_href, 'incident', new.id);
  end if;
  if new.status = 'CLOSED' then
    perform app.drop_pending_notifications(new.id, array['incident_new', 'incident_qualify', 'incident_stop', 'incident_closure']::app.notification_kind[]);
  end if;
  return new;
end;
$$;

create trigger incident_notify_ticket
  after insert or update of qualified_at, stop_recommended_at, closure_officer_at, closure_owner_at, status on public.incident
  for each row execute function app.notify_incident_ticket();

-- Les signatures sont nominatives ; la clôture les exige toutes deux.
create or replace function app.guard_incident_signatures()
returns trigger
language plpgsql
security definer
set search_path = app, public, pg_catalog
as $$
begin
  if app.current_user_id() is null or current_setting('aigms.seed', true) = 'on' then return new; end if;
  if new.qualified_at is not null and old.qualified_at is null then
    new.qualified_by := app.current_user_id();
  end if;
  if new.stop_recommended_at is not null and old.stop_recommended_at is null then new.stop_recommended_by := app.current_user_id(); end if;
  if new.stop_validated_at is not null and old.stop_validated_at is null then
    if new.stop_recommended_at is null then
      raise exception 'L''arrêt se valide après avoir été recommandé.' using errcode = 'check_violation';
    end if;
    new.stop_validated_by := app.current_user_id();
  end if;
  if new.stop_executed_at is not null and old.stop_executed_at is null then
    if new.stop_validated_at is null then
      raise exception 'L''arrêt s''exécute après avoir été validé par le Porteur.' using errcode = 'check_violation';
    end if;
    new.stop_executed_by := app.current_user_id();
  end if;
  if new.closure_officer_at is not null and old.closure_officer_at is null then new.closure_officer_by := app.current_user_id(); end if;
  if new.closure_owner_at is not null and old.closure_owner_at is null then
    new.closure_owner_by := app.current_user_id();
    if new.closure_officer_by is not null and new.closure_officer_by = new.closure_owner_by then
      raise exception 'La clôture porte deux signatures, de deux personnes : l''AI Governance Officer et le Porteur.'
        using errcode = 'check_violation';
    end if;
  end if;
  if new.status = 'CLOSED' and old.status <> 'CLOSED'
     and (new.closure_officer_at is null or new.closure_owner_at is null) then
    raise exception 'Incident % : la clôture attend la validation de l''AI Governance Officer et l''approbation du Porteur.', new.business_ref
      using errcode = 'check_violation';
  end if;
  return new;
end;
$$;

create trigger incident_guard_signatures before update on public.incident
  for each row execute function app.guard_incident_signatures();

-- L'arrêt validé suspend : une décision de suspension s'ouvre sur le cas
-- d'usage en service, soumise par qui a validé.
create or replace function app.open_suspension_on_stop()
returns trigger
language plpgsql
security definer
set search_path = app, public, pg_catalog
as $$
declare v_uc public.ai_use_case%rowtype;
begin
  if new.stop_validated_at is null or old.stop_validated_at is not null or new.use_case_id is null then return new; end if;
  select * into v_uc from public.ai_use_case where id = new.use_case_id;
  if v_uc.status not in ('PILOT', 'PRODUCTION', 'MONITORING') then return new; end if;
  if exists (select 1 from public.governance_decision d where d.use_case_id = v_uc.id and d.decision_type = 'suspension'
              and d.status in ('submitted', 'approved', 'approved_with_conditions') and d.applied_at is null) then
    return new;
  end if;
  insert into public.governance_decision (tenant_id, organization_id, use_case_id, decision_type, subject, context,
                                          decision_statement, rationale, status, submitted_by, submitted_at, effective_from)
  values (new.tenant_id, new.organization_id, v_uc.id, 'suspension',
          format('Suspension de « %s » — incident %s', v_uc.name, new.business_ref),
          format('Arrêt d''urgence recommandé puis validé sur l''incident %s : %s.', new.business_ref, new.title),
          format('Le cas d''usage est suspendu jusqu''à remédiation de l''incident %s.', new.business_ref),
          coalesce(new.stop_note, 'Kill-switch validé par le Porteur.'),
          'submitted', coalesce(new.stop_validated_by, app.current_user_id()), now(), current_date);
  return new;
end;
$$;

create trigger incident_open_suspension after update of stop_validated_at on public.incident
  for each row execute function app.open_suspension_on_stop();

-- Le ticket complet.
create or replace function public.incident_ticket(p_incident_id uuid)
returns jsonb
language sql
stable
security invoker
set search_path = app, public, pg_catalog
as $$
  select jsonb_build_object(
    'id', i.id, 'business_ref', i.business_ref, 'title', i.title, 'description', i.description,
    'kind', i.kind, 'severity', i.severity, 'status', i.status,
    'detected_at', i.detected_at, 'trigger_source', i.trigger_source,
    'organization', (select jsonb_build_object('name', o.name, 'role', o.ai_activity_profile) from public.organization o where o.id = i.organization_id),
    'use_case', (select jsonb_build_object('business_ref', u.business_ref, 'name', u.name, 'status', u.status,
                                           'classification', (select jsonb_build_object('flags', c.flags, 'role', c.organization_role, 'framework', c.framework_code || ' ' || c.framework_version)
                                                              from public.regulatory_classification c where c.use_case_id = u.id and c.is_current))
                 from public.ai_use_case u where u.id = i.use_case_id),
    'asset', (select jsonb_build_object('business_ref', a.business_ref, 'name', a.name, 'kind', a.kind, 'version', a.version) from public.ai_asset a where a.id = i.asset_id),
    'fundamental_rights_impacted', i.fundamental_rights_impacted, 'fundamental_rights_detail', i.fundamental_rights_detail,
    'reported_by', app.person_name(i.reported_by), 'officer', app.person_name(i.officer_user_id), 'owner', app.person_name(i.owner_user_id),
    'qualified_at', i.qualified_at, 'qualified_by', app.person_name(i.qualified_by),
    'qualification_delay_hours', case when i.qualified_at is null then null else round(extract(epoch from (i.qualified_at - i.detected_at)) / 3600)::integer end,
    'containment_action', i.containment_action, 'contained_at', i.contained_at, 'root_cause', i.root_cause, 'is_recurrence', i.is_recurrence,
    'stop', jsonb_build_object(
      'recommended_by', app.person_name(i.stop_recommended_by), 'recommended_at', i.stop_recommended_at,
      'validated_by', app.person_name(i.stop_validated_by), 'validated_at', i.stop_validated_at,
      'executed_by', app.person_name(i.stop_executed_by), 'executed_at', i.stop_executed_at, 'note', i.stop_note),
    'capa', coalesce((select jsonb_agg(jsonb_build_object('business_ref', c.business_ref, 'correction', c.correction, 'cause_analysis', c.cause_analysis,
                                                          'corrective_action', c.corrective_action, 'preventive_action', c.preventive_action,
                                                          'owner', app.person_name(c.owner_user_id), 'due_date', c.due_date, 'status', c.status) order by c.created_at)
                      from public.capa c where c.incident_id = i.id), '[]'::jsonb),
    'closure', jsonb_build_object(
      'closed_at', i.closed_at, 'note', i.closure_note,
      'officer_validated_by', app.person_name(i.closure_officer_by), 'officer_validated_at', i.closure_officer_at,
      'owner_approved_by', app.person_name(i.closure_owner_by), 'owner_approved_at', i.closure_owner_at),
    'timeline', coalesce((select jsonb_agg(jsonb_build_object('at', l.occurred_at, 'action', l.action, 'summary', l.summary, 'actor', l.actor_email) order by l.occurred_at)
                          from public.audit_log l where l.entity_id = i.id), '[]'::jsonb)
  )
  from public.incident i where i.id = p_incident_id;
$$;

grant execute on function public.incident_ticket(uuid) to authenticated;

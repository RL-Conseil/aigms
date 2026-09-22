-- =============================================================================
-- AIGMS — 0091 — L'étude d'impact se signe à deux
-- =============================================================================
-- Achever une étude d'impact était un seul geste : celui qui la rédige
-- concluait. Un auditeur ne pouvait donc pas distinguer deux choses de nature
-- différente — « l'étude est bien conduite » et « l'organisation assume ce
-- qui reste ». Le kit de preuve le demande (workflow B) ; la clôture d'un
-- incident le fait déjà (0069), on reprend le même mécanisme.
--
--   1. VISA DE MÉTHODE — l'AI Governance Officer, ou l'Administrateur client
--      s'il a conduit l'étude : périmètre juste, parties prenantes
--      identifiées, domaines examinés, mesures proportionnées. Il ne peut
--      viser qu'une étude sans manque.
--   2. ACCEPTATION DES RISQUES RÉSIDUELS — le Porteur de l'IA, nommément :
--      après les mesures, il demeure des préjudices possibles, et quelqu'un
--      dit qu'il les assume pour son système. Il peut aussi RENVOYER À
--      L'ÉTUDE, avec un motif : le visa tombe, l'étude repart.
--
-- Nul ne signe au nom d'un autre, et nul ne pose les deux signatures. Entre
-- les deux, l'étude est « en attente de signature » — un statut visible.
-- Relances : J+7 vers le Porteur, J+14 vers l'officer, posées d'avance (0084).
-- Le jalon Production exige les deux signatures.
-- =============================================================================

alter table public.impact_assessment
  add column if not exists method_signed_by  uuid references public.user_profile (id) on delete set null,
  add column if not exists method_signed_at  timestamptz,
  add column if not exists residual_accepted_by uuid references public.user_profile (id) on delete set null,
  add column if not exists residual_accepted_at timestamptz,
  add column if not exists residual_statement   text,
  add column if not exists returned_reason      text,
  add column if not exists returned_at          timestamptz;

comment on column public.impact_assessment.method_signed_by is
  'Visa de méthode : l''étude est conduite correctement. AI Governance Officer ou Administrateur client.';
comment on column public.impact_assessment.residual_accepted_by is
  'Acceptation des risques résiduels : le Porteur de l''IA assume ce qui reste après les mesures.';
comment on column public.impact_assessment.residual_statement is
  'Ce que le Porteur assume, et sous quelles conditions. Repris à l''impression et à l''export.';

-- -----------------------------------------------------------------------------
-- 1. Les signatures sont nominatives, et distinctes
-- -----------------------------------------------------------------------------
create or replace function app.guard_impact_signatures()
returns trigger
language plpgsql
security definer
set search_path = app, public, pg_catalog
as $$
declare v_uc public.ai_use_case%rowtype;
begin
  if app.current_user_id() is null or current_setting('aigms.seed', true) = 'on' then return new; end if;
  select * into v_uc from public.ai_use_case where id = new.use_case_id;

  -- Le visa : porté par qui le pose, et par personne d'autre.
  if new.method_signed_at is not null and coalesce(old.method_signed_at, null) is null then
    if not app.has_tenant_role(new.tenant_id, array['governance_officer', 'client_admin', 'platform_admin']::app.app_role[]) then
      raise exception 'Le visa de méthode revient à l''AI Governance Officer ou à l''Administrateur client.'
        using errcode = 'insufficient_privilege';
    end if;
    new.method_signed_by := app.current_user_id();
  end if;

  -- L'acceptation : le Porteur de l'IA, en son propre nom.
  if new.residual_accepted_at is not null and coalesce(old.residual_accepted_at, null) is null then
    if new.method_signed_at is null then
      raise exception 'Les risques résiduels s''acceptent après le visa de méthode : l''étude n''est pas encore visée.'
        using errcode = 'check_violation';
    end if;
    if v_uc.owner_user_id is not null and v_uc.owner_user_id <> app.current_user_id() then
      raise exception 'L''acceptation des risques résiduels revient au Porteur de l''IA : %.',
        coalesce(app.person_name(v_uc.owner_user_id), 'le porteur désigné')
        using errcode = 'insufficient_privilege';
    end if;
    if new.method_signed_by = app.current_user_id() then
      raise exception 'Une même personne ne pose pas les deux signatures : le visa de méthode et l''acceptation des risques résiduels se répondent.'
        using errcode = 'check_violation';
    end if;
    if btrim(coalesce(new.residual_statement, '')) = '' then
      raise exception 'L''acceptation des risques résiduels se dit : ce que vous assumez, et sous quelles conditions.'
        using errcode = 'check_violation';
    end if;
    new.residual_accepted_by := app.current_user_id();
  end if;

  -- Une étude n'est achevée que signée deux fois.
  if new.status = 'completed' and (old.status is distinct from 'completed')
     and (new.method_signed_at is null or new.residual_accepted_at is null) then
    raise exception 'Une étude d''impact s''achève à deux signatures : le visa de méthode et l''acceptation des risques résiduels.'
      using errcode = 'check_violation';
  end if;

  return new;
end;
$$;

create trigger impact_assessment_guard_signatures before update on public.impact_assessment
  for each row execute function app.guard_impact_signatures();

-- -----------------------------------------------------------------------------
-- 2. Ce que chaque signature déclenche
-- -----------------------------------------------------------------------------
create or replace function app.notify_impact_signature()
returns trigger
language plpgsql
security definer
set search_path = app, public, pg_catalog
as $$
declare
  v_uc public.ai_use_case%rowtype;
  v_officer uuid;
  v_href text;
begin
  select * into v_uc from public.ai_use_case where id = new.use_case_id;
  v_href := format('/admin/organizations/%s/etudes-impact/%s', new.organization_id, new.id);
  v_officer := coalesce(new.performed_by, new.method_signed_by,
                        app.person_for_role(new.organization_id, 'AI Governance Officer'));

  -- Visée : le Porteur est appelé à accepter ce qui reste, et relancé.
  if new.method_signed_at is not null and old.method_signed_at is null
     and new.residual_accepted_at is null and v_uc.owner_user_id is not null then
    perform app.notify(new.tenant_id, new.organization_id, v_uc.owner_user_id, 'impact_signature',
      format('Risques résiduels à accepter : %s', v_uc.name),
      format('%s. %s a visé l''étude : sa méthode tient. Il vous revient d''accepter ce qui reste après les mesures — ou de la renvoyer à l''étude en disant pourquoi. Le jalon Production l''exige.',
             new.business_ref, coalesce(app.person_name(new.method_signed_by), 'L''AI Governance Officer')),
      v_href, 'impact_assessment', new.id);

    -- Relances posées d'avance : elles n'apparaissent que le jour dit.
    perform app.notify(new.tenant_id, new.organization_id, v_uc.owner_user_id, 'impact_signature_late',
      format('Toujours à accepter : %s', v_uc.name),
      format('%s attend votre acceptation depuis une semaine. Sans elle, la mise en production reste retenue.', new.business_ref),
      v_href, 'impact_assessment', new.id, now() + interval '7 days');
    perform app.notify(new.tenant_id, new.organization_id, v_officer, 'impact_signature_late',
      format('Signature attendue depuis deux semaines : %s', v_uc.name),
      format('%s attend l''acceptation des risques résiduels par %s. À relancer.',
             new.business_ref, coalesce(app.person_name(v_uc.owner_user_id), 'le Porteur')),
      v_href, 'impact_assessment', new.id, now() + interval '14 days');
  end if;

  -- Acceptée : plus rien à relancer, l'officer l'apprend.
  if new.residual_accepted_at is not null and old.residual_accepted_at is null then
    perform app.drop_pending_notifications(new.id,
      array['impact_signature', 'impact_signature_late']::app.notification_kind[]);
    perform app.notify(new.tenant_id, new.organization_id, v_officer, 'impact_signature',
      format('Risques résiduels acceptés : %s', v_uc.name),
      format('%s. %s assume ce qui reste. L''étude est achevée : son dépôt au registre des preuves la clôt.',
             new.business_ref, coalesce(app.person_name(new.residual_accepted_by), 'Le Porteur')),
      v_href, 'impact_assessment', new.id);
  end if;

  -- Renvoyée à l'étude : le visa tombe, l'officer reprend la main.
  if new.returned_at is not null and old.returned_at is distinct from new.returned_at then
    perform app.drop_pending_notifications(new.id,
      array['impact_signature', 'impact_signature_late']::app.notification_kind[]);
    perform app.notify(new.tenant_id, new.organization_id, v_officer, 'impact_returned',
      format('Étude renvoyée à l''étude : %s', v_uc.name),
      format('%s. %s ne l''accepte pas en l''état : « %s »',
             new.business_ref, coalesce(app.person_name(v_uc.owner_user_id), 'Le Porteur'),
             left(coalesce(new.returned_reason, ''), 300)),
      v_href, 'impact_assessment', new.id);
  end if;

  return new;
end;
$$;

create trigger impact_assessment_notify_signature
  after update of method_signed_at, residual_accepted_at, returned_at on public.impact_assessment
  for each row execute function app.notify_impact_signature();

-- -----------------------------------------------------------------------------
-- 3. Le jalon Production exige les deux signatures
-- -----------------------------------------------------------------------------
do $$
declare v text;
begin
  select pg_get_functiondef('app.evaluate_production_gate(uuid)'::regprocedure) into v;
  v := replace(v,
    $x$  select exists (
    select 1 from public.impact_assessment ia
    where ia.use_case_id = p_use_case_id and ia.status = 'completed'
  ) into v_aiia_ok;$x$,
    $x$  -- Achevée ET signée deux fois : la méthode et ce qui reste.
  select exists (
    select 1 from public.impact_assessment ia
    where ia.use_case_id = p_use_case_id and ia.status = 'completed'
      and ia.method_signed_at is not null and ia.residual_accepted_at is not null
  ) into v_aiia_ok;$x$);
  v := replace(v,
    $x$else format('AIIA requis (%s) mais non terminé.', coalesce(app.impact_assessment_reason(p_use_case_id), 'faits du cas d''usage')) end$x$,
    $x$else format('AIIA requis (%s) : %s.', coalesce(app.impact_assessment_reason(p_use_case_id), 'faits du cas d''usage'),
                       coalesce((select case
                                   when ia.status = 'awaiting_signature' or (ia.method_signed_at is not null and ia.residual_accepted_at is null)
                                     then format('visé le %s, en attente de l''acceptation des risques résiduels par %s',
                                                 app.fr_date(ia.method_signed_at::date),
                                                 coalesce((select app.person_name(u.owner_user_id) from public.ai_use_case u where u.id = p_use_case_id), 'le Porteur'))
                                   when ia.returned_at is not null then 'renvoyée à l''étude par le Porteur'
                                   else 'conduite non achevée' end
                                 from public.impact_assessment ia
                                 where ia.use_case_id = p_use_case_id and ia.status <> 'superseded'
                                 order by ia.created_at desc limit 1), 'aucune étude ouverte')) end$x$);
  execute v;
end $$;

-- -----------------------------------------------------------------------------
-- 4. La lecture d'une étude porte ses signatures
-- -----------------------------------------------------------------------------
do $$
declare v text;
begin
  select pg_get_functiondef('public.impact_study(uuid)'::regprocedure) into v;
  v := replace(v,
    $x$    'reopened_reason', ia.reopened_reason,$x$,
    $x$    'reopened_reason', ia.reopened_reason,
    'method_signed_at', ia.method_signed_at,
    'method_signed_by', (select coalesce(nullif(p.full_name, ''), p.email) from public.user_profile p where p.id = ia.method_signed_by),
    'residual_accepted_at', ia.residual_accepted_at,
    'residual_accepted_by', (select coalesce(nullif(p.full_name, ''), p.email) from public.user_profile p where p.id = ia.residual_accepted_by),
    'residual_statement', ia.residual_statement,
    'returned_at', ia.returned_at,
    'returned_reason', ia.returned_reason,$x$);
  execute v;
end $$;

-- -----------------------------------------------------------------------------
-- 5. Administrateur client : un rôle qu'on peut enfin attribuer
-- -----------------------------------------------------------------------------
-- Il portait les mêmes prérogatives que l'AI Governance Officer sans figurer
-- parmi les rôles attribuables : visible dans la matrice, introuvable dans la
-- liste des rôles. Il devient un rôle à part entière — l'officer chez le
-- client, quand le cabinet tient le rôle d'officer prestataire. Il ne compte
-- pas pour la règle des six rôles : il double l'officer, il ne le remplace
-- pas.
create or replace function app.assignable_roles()
returns app.app_role[]
language sql immutable set search_path = pg_catalog
as $$
  select array[
    'governance_officer',
    'client_admin',
    'system_owner',
    'risk_owner',
    'reviewer',
    'auditor',
    'executive_viewer'
  ]::app.app_role[];
$$;

comment on function app.assignable_roles is
  'Rôles qu''une administration peut attribuer. Hors liste : platform_admin, qui ne se donne pas depuis l''application.';


-- Une signature attendue retient le jalon Production : elle ne patiente pas
-- jusqu'à la synthèse du lendemain (0086).
create or replace function app.immediate_kinds()
returns app.notification_kind[]
language sql immutable set search_path = pg_catalog
as $$
  select array['incident_stop', 'incident_new', 'incident_qualify', 'incident_closure',
               'decision_to_approve', 'decision_blocked', 'criticality_review',
               'evidence_expired', 'impact_signature', 'impact_returned']::app.notification_kind[];
$$;

-- -----------------------------------------------------------------------------
-- 6. L'acceptation est un ACTE, pas une écriture
-- -----------------------------------------------------------------------------
-- Écrire une étude d'impact revient à l'AI Governance Officer et à
-- l'Administrateur client (`roles_write_governance`) : le Porteur de l'IA n'y
-- touche pas, et c'est bien ainsi — il ne doit pas pouvoir la réécrire. Mais
-- il doit pouvoir poser SA signature, et elle seule. Deux fonctions, comme
-- pour les transitions : l'acte est offert, l'écriture reste fermée.
create or replace function app.accept_residual_risks(p_study_id uuid, p_statement text)
returns public.impact_assessment
language plpgsql
security definer
set search_path = app, public, pg_catalog
as $$
declare
  v_study public.impact_assessment%rowtype;
  v_uc public.ai_use_case%rowtype;
begin
  select * into v_study from public.impact_assessment where id = p_study_id;
  if v_study.id is null or not app.has_tenant_access(v_study.tenant_id) then
    raise exception 'Étude d''impact introuvable.' using errcode = 'no_data_found';
  end if;
  select * into v_uc from public.ai_use_case where id = v_study.use_case_id;
  if v_uc.owner_user_id is not null and v_uc.owner_user_id <> app.current_user_id() then
    raise exception 'L''acceptation des risques résiduels revient au Porteur de l''IA : %.',
      coalesce(app.person_name(v_uc.owner_user_id), 'le porteur désigné')
      using errcode = 'insufficient_privilege';
  end if;

  update public.impact_assessment
     set residual_accepted_at = now(),
         residual_statement = p_statement,
         status = 'completed',
         completed_at = now()
   where id = p_study_id
  returning * into v_study;
  return v_study;
end;
$$;

create or replace function public.accept_residual_risks(p_study_id uuid, p_statement text)
returns public.impact_assessment
language sql security invoker
set search_path = app, public, pg_catalog
as $$ select app.accept_residual_risks(p_study_id, p_statement); $$;

grant execute on function public.accept_residual_risks(uuid, text) to authenticated;

create or replace function app.return_impact_study(p_study_id uuid, p_reason text)
returns public.impact_assessment
language plpgsql
security definer
set search_path = app, public, pg_catalog
as $$
declare
  v_study public.impact_assessment%rowtype;
  v_uc public.ai_use_case%rowtype;
begin
  select * into v_study from public.impact_assessment where id = p_study_id;
  if v_study.id is null or not app.has_tenant_access(v_study.tenant_id) then
    raise exception 'Étude d''impact introuvable.' using errcode = 'no_data_found';
  end if;
  select * into v_uc from public.ai_use_case where id = v_study.use_case_id;
  if v_uc.owner_user_id is not null and v_uc.owner_user_id <> app.current_user_id()
     and not app.has_tenant_role(v_study.tenant_id, app.roles_write_governance()) then
    raise exception 'Renvoyer l''étude revient au Porteur de l''IA, ou à qui la conduit.'
      using errcode = 'insufficient_privilege';
  end if;
  if btrim(coalesce(p_reason, '')) = '' then
    raise exception 'Un renvoi se motive : dire ce qui manque ou ce qui ne va pas.'
      using errcode = 'check_violation';
  end if;

  update public.impact_assessment
     set status = 'in_progress',
         method_signed_at = null,
         method_signed_by = null,
         returned_at = now(),
         returned_reason = p_reason
   where id = p_study_id
  returning * into v_study;
  return v_study;
end;
$$;

create or replace function public.return_impact_study(p_study_id uuid, p_reason text)
returns public.impact_assessment
language sql security invoker
set search_path = app, public, pg_catalog
as $$ select app.return_impact_study(p_study_id, p_reason); $$;

grant execute on function public.return_impact_study(uuid, text) to authenticated;

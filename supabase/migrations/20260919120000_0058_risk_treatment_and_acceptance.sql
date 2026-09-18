-- =============================================================================
-- AIGMS — 0058 — Un traitement a un responsable et une alerte ; une
--                 acceptation revient à la personne désignée
-- =============================================================================
-- 1. Un plan de traitement sans responsable n'engage personne : le
--    responsable devient obligatoire pour tout nouveau traitement. Il en est
--    averti, et rappelé à l'échéance — comme pour une action (0053).
-- 2. Accepter un risque engage nominativement. Quand le risque a un
--    responsable désigné, c'est à lui — et à lui seul — de l'accepter : un
--    AI Governance Officer peut être ce responsable, il ne se substitue pas à
--    lui. Un risque sans responsable reste acceptable par qui tient le rôle
--    (Comité des risques, AI Governance Officer), comme avant.
-- Les deux règles portent sur l'acte d'une personne authentifiée.
-- =============================================================================

alter type app.notification_kind add value if not exists 'treatment_owner';
alter type app.notification_kind add value if not exists 'treatment_due';

-- -----------------------------------------------------------------------------
-- 1. Traitement : responsable obligatoire, averti, rappelé
-- -----------------------------------------------------------------------------
create or replace function app.guard_treatment_owner()
returns trigger
language plpgsql
set search_path = app, public, pg_catalog
as $$
begin
  if app.current_user_id() is not null and new.owner_user_id is null then
    raise exception 'Un traitement de risque désigne son responsable : sans lui, rien ne l''exécute.'
      using errcode = 'check_violation';
  end if;
  return new;
end;
$$;

create trigger risk_treatment_guard_owner before insert on public.risk_treatment
  for each row execute function app.guard_treatment_owner();

create or replace function app.notify_treatment_owner()
returns trigger
language plpgsql
security definer
set search_path = app, public, pg_catalog
as $$
declare
  v_risk public.risk%rowtype;
  v_href text;
begin
  select * into v_risk from public.risk where id = new.risk_id;
  v_href := format('/admin/use-cases/%s?onglet=risques', v_risk.use_case_id);

  if new.status in ('implemented', 'verified', 'abandoned') then
    perform app.drop_pending_notifications(new.id, array['treatment_owner', 'treatment_due']::app.notification_kind[]);
    return new;
  end if;
  if new.owner_user_id is null then return new; end if;

  if tg_op = 'INSERT' or new.owner_user_id is distinct from old.owner_user_id then
    perform app.notify(
      new.tenant_id, v_risk.organization_id, new.owner_user_id, 'treatment_owner',
      format('Vous portez le traitement du risque %s', v_risk.business_ref),
      format('« %s » — %s. %s%s', v_risk.title, new.description,
             case when new.due_date is null then 'Sans échéance.'
                  else format('Échéance le %s.', app.fr_date(new.due_date)) end,
             case when new.control_id is not null then '' else ' Aucun contrôle ne le met en œuvre pour l''instant.' end),
      v_href, 'risk_treatment', new.id
    );
  end if;

  if new.due_date is not null
     and (tg_op = 'INSERT' or new.due_date is distinct from old.due_date
          or new.owner_user_id is distinct from old.owner_user_id) then
    perform app.notify(
      new.tenant_id, v_risk.organization_id, new.owner_user_id, 'treatment_due',
      format('Échéance aujourd''hui : traitement du risque %s', v_risk.business_ref),
      format('« %s » — %s. Recoter le risque une fois le traitement en place, ou replanifier en le disant.',
             v_risk.title, new.description),
      v_href, 'risk_treatment', new.id, new.due_date::timestamptz
    );
  elsif new.due_date is null and tg_op = 'UPDATE' and old.due_date is not null then
    perform app.drop_pending_notifications(new.id, array['treatment_due']::app.notification_kind[]);
  end if;
  return new;
end;
$$;

create trigger risk_treatment_notify_owner
  after insert or update of owner_user_id, due_date, status on public.risk_treatment
  for each row execute function app.notify_treatment_owner();

-- -----------------------------------------------------------------------------
-- 2. Acceptation : par la personne désignée
-- -----------------------------------------------------------------------------
create or replace function app.guard_risk_acceptance()
returns trigger
language plpgsql
security definer
set search_path = app, public, pg_catalog
as $$
begin
  if app.current_user_id() is null then return new; end if;
  if new.status = 'accepted' and (tg_op = 'INSERT' or old.status is distinct from 'accepted') then
    if new.accepted_by is distinct from app.current_user_id() then
      raise exception 'Un risque s''accepte en son propre nom.' using errcode = 'check_violation';
    end if;
    if new.owner_user_id is not null and new.owner_user_id <> app.current_user_id() then
      raise exception 'Ce risque s''accepte par la personne désignée responsable : %.',
        coalesce(app.person_name(new.owner_user_id), 'son responsable')
        using errcode = 'insufficient_privilege';
    end if;
  end if;
  return new;
end;
$$;

comment on function app.guard_risk_acceptance is
  'Une acceptation est nominative, et revient au responsable désigné du risque quand il y en a un (0058).';

create trigger risk_guard_acceptance before insert or update of status on public.risk
  for each row execute function app.guard_risk_acceptance();

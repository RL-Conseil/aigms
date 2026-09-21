-- =============================================================================
-- AIGMS — 0070 — Une revue annulée le dit, et les présents ne sont pas les attendus
-- =============================================================================
-- Une revue s'annule pour une raison ; la raison se lit sur la fiche et
-- s'imprime. Les participants attendus à la planification restent lisibles
-- une fois la revue tenue, à côté des présents.
-- =============================================================================
alter table public.governance_review
  add column if not exists expected_attendees text[],
  add column if not exists cancellation_reason text,
  add column if not exists cancelled_at timestamptz,
  add column if not exists cancelled_by uuid references public.user_profile (id) on delete set null;

-- Ce qui a ete saisi comme « attendus » a la planification l'est aussi ici.
update public.governance_review set expected_attendees = attendees where expected_attendees is null and status = 'planned';

create or replace function app.guard_review_cancellation()
returns trigger
language plpgsql
set search_path = app, public, pg_catalog
as $$
begin
  if new.status = 'cancelled' and old.status is distinct from 'cancelled' then
    if btrim(coalesce(new.cancellation_reason, '')) = '' then
      raise exception 'Une revue s''annule pour une raison : dire laquelle.' using errcode = 'check_violation';
    end if;
    new.cancelled_at := now();
    new.cancelled_by := coalesce(app.current_user_id(), new.cancelled_by);
  end if;
  return new;
end;
$$;

create trigger governance_review_guard_cancellation before update of status on public.governance_review
  for each row execute function app.guard_review_cancellation();

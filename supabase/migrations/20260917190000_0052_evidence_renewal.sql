-- =============================================================================
-- AIGMS — 0052 — Renouveler une preuve, et ce que cela clôt
-- =============================================================================
-- Une action « Renouveler la preuve EVD-… » s'ouvrait sur la fiche du cas
-- d'usage, et le registre des preuves n'en savait rien ; quand la pièce à jour
-- était déposée, l'action restait ouverte. Les deux bouts ne se parlaient pas.
--
-- 1. Une preuve déposée EN REMPLACEMENT d'une autre le dit
--    (`replaces_evidence_id`). Le dépôt ne remplace rien encore — un dépôt
--    n'est pas une validation. C'est la VALIDATION de la nouvelle pièce qui
--    marque l'ancienne « remplacée » : jusque-là, l'ancienne reste ce qui vaut.
-- 2. Quand une preuve est remplacée, l'action de renouvellement ouverte sur
--    elle se clôt d'elle-même — c'est un fait, pas une décision — avec une note
--    qui dit par quoi. La clôture est journalisée comme toute écriture.
-- =============================================================================

alter table public.evidence
  add column replaces_evidence_id uuid references public.evidence (id) on delete set null;

comment on column public.evidence.replaces_evidence_id is
  'La preuve que celle-ci remplace. Prend effet à la validation : l''ancienne passe « remplacée » et son action de renouvellement se clôt.';

create index evidence_replaces_idx on public.evidence (replaces_evidence_id) where replaces_evidence_id is not null;

-- Une preuve ne remplace qu'une preuve de la même organisation.
create or replace function app.guard_evidence_replacement()
returns trigger
language plpgsql
security definer
set search_path = app, public, pg_catalog
as $$
begin
  if new.replaces_evidence_id is null then return new; end if;
  if new.replaces_evidence_id = new.id then
    raise exception 'Une preuve ne se remplace pas elle-même.' using errcode = 'check_violation';
  end if;
  if not exists (select 1 from public.evidence e
                  where e.id = new.replaces_evidence_id and e.organization_id = new.organization_id) then
    raise exception 'La preuve remplacée doit appartenir à la même organisation.' using errcode = 'check_violation';
  end if;
  return new;
end;
$$;

create trigger evidence_guard_replacement
  before insert or update of replaces_evidence_id on public.evidence
  for each row execute function app.guard_evidence_replacement();

-- La validation de la nouvelle piece fait passer l'ancienne « remplacée ».
create or replace function app.apply_evidence_replacement()
returns trigger
language plpgsql
security definer
set search_path = app, public, pg_catalog
as $$
begin
  if new.validation_status = 'validated'
     and (tg_op = 'INSERT' or old.validation_status is distinct from 'validated')
     and new.replaces_evidence_id is not null then
    update public.evidence
       set superseded_by = new.id,
           validation_status = 'superseded'
     where id = new.replaces_evidence_id
       and superseded_by is null;
  end if;
  return new;
end;
$$;

create trigger evidence_apply_replacement
  after insert or update of validation_status on public.evidence
  for each row execute function app.apply_evidence_replacement();

-- L'action de renouvellement ouverte sur une preuve remplacée se clot.
create or replace function app.close_renewal_actions()
returns trigger
language plpgsql
security definer
set search_path = app, public, pg_catalog
as $$
declare v_new public.evidence;
begin
  if new.superseded_by is null or old.superseded_by is not null then return new; end if;
  select * into v_new from public.evidence where id = new.superseded_by;
  update public.action a
     set status = 'done',
         closed_at = now(),
         closure_note = format('Clôturée automatiquement : la preuve %s a été remplacée par %s « %s », validée le %s.',
                               new.business_ref, v_new.business_ref, v_new.title,
                               to_char(coalesce(v_new.validated_at, now()), 'DD/MM/YYYY'))
   where a.source_id = new.id
     and a.status not in ('done', 'cancelled');
  return new;
end;
$$;

create trigger evidence_close_renewal_actions
  after update of superseded_by on public.evidence
  for each row execute function app.close_renewal_actions();

-- -----------------------------------------------------------------------------
-- Le registre sait qu'une action est ouverte sur une preuve
-- -----------------------------------------------------------------------------
-- Une lecture a part, jointe par l'ecran : le registre lui-meme ne change pas.
create or replace function public.evidence_open_actions(p_organization_id uuid)
returns table (evidence_id uuid, action_id uuid, title text, due_date date, use_case_id uuid, is_blocking boolean)
language sql stable security invoker
set search_path = app, public, pg_catalog
as $$
  select e.id, a.id, a.title, a.due_date, a.use_case_id, a.is_blocking
  from public.evidence e
  join public.action a on a.source_id = e.id and a.status not in ('done', 'cancelled')
  where e.organization_id = p_organization_id
  order by a.due_date nulls last;
$$;

grant execute on function public.evidence_open_actions(uuid) to authenticated;

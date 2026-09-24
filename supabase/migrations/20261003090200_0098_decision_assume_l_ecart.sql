-- =============================================================================
-- AIGMS — 0098 — La décision de mise en production assume l'écart de preuve
-- =============================================================================
-- Suite de 0097. Le gate avertit ; ici, quelqu'un répond de l'avertissement.
--
--   1. L'écart est FIGÉ sur la décision au moment de sa soumission. Une preuve
--      déposée le lendemain ne réécrit pas ce que l'approbateur a lu.
--   2. L'AI Governance Officer DOIT dire ce qu'il en est — remédiation en
--      cours, pièce non encore présentée par l'organisation. Un écart sans
--      explication ne se soumet pas.
--   3. L'approbation exige une PRISE DE CONNAISSANCE explicite. Refusée en
--      base : une case cochée seulement à l'écran ne prouve rien.
--   4. La personne appelée à se prononcer est, par défaut, l'Administrateur
--      client — le DSI côté client — à défaut le Comité de direction.
-- =============================================================================

alter table public.governance_decision
  add column evidence_gap                   jsonb,
  add column evidence_gap_statement         text,
  add column evidence_gap_acknowledged_at   timestamptz,
  add column evidence_gap_acknowledged_by   uuid references public.user_profile (id) on delete set null;

comment on column public.governance_decision.evidence_gap is
  'Les contrôles applicables sans preuve validée, tels qu''ils étaient AU MOMENT DE LA SOUMISSION. Figé : une preuve déposée ensuite ne réécrit pas ce que l''approbateur a lu (0098).';
comment on column public.governance_decision.evidence_gap_statement is
  'Ce que l''AI Governance Officer dit de cet écart : remédiation en cours, pièce non présentée. Obligatoire dès que l''écart n''est pas vide.';
comment on column public.governance_decision.evidence_gap_acknowledged_at is
  'Quand la personne appelée à se prononcer a déclaré avoir pris connaissance de l''écart. Sans elle, l''approbation est refusée.';

-- -----------------------------------------------------------------------------
-- 1. Qui se prononce, par défaut, sur une mise en production
-- -----------------------------------------------------------------------------
create or replace function app.default_decision_approver(
  p_organization_id uuid,
  p_type app.decision_type
)
returns uuid
language sql
stable
security definer
set search_path = app, public, pg_catalog
as $$
  -- L'Administrateur client d'abord : c'est la DSI du client, celle qui met en
  -- service. Le Comité de direction ensuite, qui arbitre quand elle n'existe
  -- pas. Au-delà, personne : on ne désigne pas un approbateur au hasard.
  select ra.user_id
  from public.role_assignment ra
  where ra.organization_id = p_organization_id
    and ra.role = any (case when p_type = 'go_production'
                            then array['client_admin', 'executive_viewer']::app.app_role[]
                            else array['executive_viewer']::app.app_role[] end)
    and (ra.valid_until is null or ra.valid_until > now())
  order by case ra.role when 'client_admin' then 0 else 1 end, ra.valid_from
  limit 1;
$$;

comment on function app.default_decision_approver is
  'La personne appelée à se prononcer, à défaut de désignation : l''Administrateur client sur une mise en production, sinon le Comité de direction (0098).';

-- -----------------------------------------------------------------------------
-- 2. À la soumission : figer l'écart, exiger qu'on en dise quelque chose
-- -----------------------------------------------------------------------------
create or replace function app.snapshot_evidence_gap()
returns trigger
language plpgsql
security definer
set search_path = app, public, pg_catalog
as $$
declare v_gap jsonb;
begin
  if new.decision_type <> 'go_production' or new.use_case_id is null then
    return new;
  end if;

  -- La désignation par défaut vaut à la création comme à la soumission : une
  -- décision qui part sans destinataire n'avertit personne.
  if new.expected_approver_user_id is null then
    new.expected_approver_user_id :=
      app.default_decision_approver(new.organization_id, new.decision_type);
  end if;

  if new.status = 'submitted'
     and (tg_op = 'INSERT' or old.status is distinct from 'submitted') then
    v_gap := app.control_evidence_gap(new.use_case_id);
    new.evidence_gap := v_gap;

    if jsonb_array_length(v_gap) > 0
       and btrim(coalesce(new.evidence_gap_statement, '')) = '' then
      raise exception 'Cette mise en production laisse % contrôle(s) applicable(s) sans preuve (%). Dire ce qu''il en est — remédiation en cours, pièce non présentée — avant de la soumettre.',
        jsonb_array_length(v_gap),
        (select string_agg(g ->> 'code', ', ' order by g ->> 'code') from jsonb_array_elements(v_gap) g)
        using errcode = 'check_violation';
    end if;
  end if;

  return new;
end;
$$;

create trigger governance_decision_snapshot_gap
  before insert or update of status, expected_approver_user_id on public.governance_decision
  for each row execute function app.snapshot_evidence_gap();

-- -----------------------------------------------------------------------------
-- 3. À l'approbation : la prise de connaissance est un acte
-- -----------------------------------------------------------------------------
create or replace function app.guard_evidence_gap_acknowledged()
returns trigger
language plpgsql
security definer
set search_path = app, public, pg_catalog
as $$
begin
  if new.status not in ('approved', 'approved_with_conditions')
     or old.status = new.status
     or coalesce(jsonb_array_length(new.evidence_gap), 0) = 0 then
    return new;
  end if;

  if new.evidence_gap_acknowledged_at is null then
    raise exception 'Cette décision porte un écart de preuve : l''approbation exige d''en avoir pris connaissance.'
      using errcode = 'check_violation';
  end if;

  -- Celui qui prend connaissance est celui qui approuve : la trace ne vaut que
  -- nominative.
  new.evidence_gap_acknowledged_by := coalesce(new.evidence_gap_acknowledged_by, new.approver_user_id);
  return new;
end;
$$;

create trigger governance_decision_guard_gap before update of status on public.governance_decision
  for each row execute function app.guard_evidence_gap_acknowledged();

-- -----------------------------------------------------------------------------
-- 4. L'avertissement part nommé — et l'officer est en copie
-- -----------------------------------------------------------------------------
create or replace function app.evidence_gap_sentence(p_decision public.governance_decision)
returns text
language sql
stable
set search_path = app, public, pg_catalog
as $$
  select case when coalesce(jsonb_array_length(p_decision.evidence_gap), 0) = 0 then null
    else format('%s contrôle(s) applicable(s) sans preuve validée : %s.%s',
      jsonb_array_length(p_decision.evidence_gap),
      (select string_agg(g ->> 'code', ', ' order by g ->> 'code')
         from jsonb_array_elements(p_decision.evidence_gap) g),
      case when btrim(coalesce(p_decision.evidence_gap_statement, '')) = '' then ''
           else ' ' || p_decision.evidence_gap_statement end)
  end;
$$;

comment on function app.evidence_gap_sentence is
  'L''écart en une phrase, contrôles nommés et parole de l''officer : le même texte dans l''alerte, le courriel et la pièce remise (0098).';

do $$
declare v_def text; v_avant text;
begin
  v_def   := pg_get_functiondef('app.notify_decision()'::regprocedure);
  v_avant := v_def;

  -- L'avertissement s'ajoute au corps de l'alerte destinée à celui qui statue.
  v_def := replace(v_def,
$old$        format('Décision %s, soumise par %s.', new.business_ref, coalesce(app.person_name(v_submitter), 'un membre')),$old$,
$new$        format('Décision %s, soumise par %s.%s', new.business_ref, coalesce(app.person_name(v_submitter), 'un membre'),
               case when app.evidence_gap_sentence(new) is null then ''
                    else ' ATTENTION — ' || app.evidence_gap_sentence(new) end),$new$);

  -- Et l'AI Governance Officer est prévenu : il répond de la remédiation, il
  -- ne décide pas.
  v_def := replace(v_def,
$old$  end if;

  -- Rappel à la date d'effet$old$,
$new$    if app.evidence_gap_sentence(new) is not null then
      perform app.notify(
        new.tenant_id, new.organization_id,
        app.person_for_role(new.organization_id, 'AI Governance Officer'),
        'decision_gap_notice',
        format('Écart de preuve signalé : %s', new.subject),
        format('Décision %s. %s Vous en êtes averti parce que la remédiation vous revient — %s se prononce.',
               new.business_ref, app.evidence_gap_sentence(new),
               coalesce(v_approver_name, 'la personne désignée')),
        v_href, 'governance_decision', new.id
      );
    end if;
  end if;

  -- Rappel à la date d'effet$new$);

  if v_def = v_avant or position('decision_gap_notice' in v_def) = 0
     or position('ATTENTION — ' in v_def) = 0 then
    raise exception 'Réécriture de notify_decision incomplète : le texte attendu n''a pas été trouvé.';
  end if;

  execute v_def;
end;
$$;

comment on function app.notify_decision is
  'Alerte la personne appelée à statuer, et porte l''écart de preuve quand il y en a un. L''AI Governance Officer est en copie (0098).';

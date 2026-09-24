-- =============================================================================
-- AIGMS — 0105 — La voie douce a une fin, et elle se fixe dans l'interface
-- =============================================================================
-- 0097 a fait de l'absence de preuve une vérification d'AVERTISSEMENT : elle
-- figure au détail du gate, elle ne le retient pas. C'était la seule façon de
-- l'introduire sans rendre non conformes, du jour au lendemain, tous les cas
-- d'usage déjà en production.
--
-- Une voie douce sans terme n'est pas une voie douce : c'est un renoncement.
-- D'où une DATE, posée par organisation, à partir de laquelle la vérification
-- devient bloquante. Avant elle, on avertit ; à partir d'elle, on retient.
--
-- ELLE SE FIXE DANS L'INTERFACE, et non dans le code : c'est un engagement pris
-- envers un client, il se négocie, se reporte, et doit se lire. Une date écrite
-- dans une migration se serait appliquée à tout le monde le même jour.
--
-- CE QUE POSER LA DATE DÉCLENCHE :
--   * l'AI Governance Officer et l'Administrateur client en sont avertis ;
--   * chaque cas d'usage en pilote qui porte un écart reçoit sa relance,
--     adressée à son porteur : il ne passera plus en production sans ses
--     preuves ;
--   * deux rappels sont posés d'avance, à J-30 et J-7, sans tâche planifiée —
--     `app.notify` accepte une date d'échéance, et `my_notifications` ne rend
--     que ce qui est dû.
--
-- La changer rejoue tout : les alertes non lues de même nature sont remplacées
-- (c'est ce que fait `app.notify`), et les rappels se reposent sur la nouvelle
-- date. Reporter une échéance ne laisse donc pas traîner l'ancienne.
-- =============================================================================

alter table public.organization
  add column evidence_gate_enforced_from date;

comment on column public.organization.evidence_gate_enforced_from is
  'À partir de cette date, un contrôle applicable sans preuve validée RETIENT la mise en production. Nulle : la vérification reste un avertissement (0105).';

-- -----------------------------------------------------------------------------
-- 1. Le gate : la sévérité se calcule, elle n'est plus écrite
-- -----------------------------------------------------------------------------
do $$
declare v_def text; v_avant text;
begin
  v_def   := pg_get_functiondef('app.evaluate_production_gate(uuid)'::regprocedure);
  v_avant := v_def;

  v_def := replace(v_def,
    '  v_gap           jsonb;',
    '  v_gap           jsonb;' || chr(10) || '  v_enforced      date;');

  v_def := replace(v_def,
    '  v_gap := app.control_evidence_gap(p_use_case_id);',
$new$  v_gap := app.control_evidence_gap(p_use_case_id);
  select o.evidence_gate_enforced_from into v_enforced
    from public.organization o where o.id = v_uc.organization_id;$new$);

  v_def := replace(v_def,
    $old$    'severity', 'warning',$old$,
    $new$    'severity', case when v_enforced is not null and current_date >= v_enforced
                     then 'blocking' else 'warning' end,$new$);

  -- Le détail dit l'échéance : un avertissement qui ne dit pas jusqu'à quand
  -- il reste un avertissement se lit comme une tolérance définitive.
  v_def := replace(v_def,
    $old$                   else format('%s contrôle(s) applicable(s) sans preuve validée : %s. La mise en production reste possible — la personne appelée à se prononcer en est avertie et doit l''assumer.',$old$,
    $new$                   else format('%s contrôle(s) applicable(s) sans preuve validée : %s.%s',$new$);

  v_def := replace(v_def,
    $old$                               (select string_agg(g ->> 'code', ', ' order by g ->> 'code')
                                  from jsonb_array_elements(v_gap) g)) end,$old$,
    $new$                               (select string_agg(g ->> 'code', ', ' order by g ->> 'code')
                                  from jsonb_array_elements(v_gap) g),
                               case
                                 when v_enforced is null then ' La mise en production reste possible — la personne appelée à se prononcer en est avertie et doit l''assumer.'
                                 when current_date >= v_enforced then format(' Depuis le %s, cet écart retient la mise en production.', app.fr_date(v_enforced))
                                 else format(' Jusqu''au %s, la mise en production reste possible sous réserve d''acceptation ; après, cet écart la retiendra.', app.fr_date(v_enforced))
                               end) end,$new$);

  if v_def = v_avant
     or position('v_enforced      date;' in v_def) = 0
     or position('evidence_gate_enforced_from into v_enforced' in v_def) = 0
     or position('then ''blocking'' else ''warning'' end' in v_def) = 0
     or position('retient la mise en production' in v_def) = 0 then
    raise exception 'Réécriture du gate incomplète : le texte attendu n''a pas été trouvé.';
  end if;

  execute v_def;
end;
$$;

comment on function app.evaluate_production_gate is
  'Les préconditions de mise en production. CONTROLS_EVIDENCED avertit, puis retient à partir de la date posée sur l''organisation (0105).';

-- -----------------------------------------------------------------------------
-- 2. Poser la date avertit, relance, et pose ses rappels
-- -----------------------------------------------------------------------------
create or replace function app.notify_evidence_deadline()
returns trigger
language plpgsql
security definer
set search_path = app, public, pg_catalog
as $$
declare
  v_officer uuid;
  v_admin   uuid;
  v_href    text;
  v_quand   text;
  r         record;
begin
  if new.evidence_gate_enforced_from is not distinct from old.evidence_gate_enforced_from then
    return new;
  end if;

  v_href := format('/admin/organizations/%s/controles', new.id);

  -- Retirer l'échéance retire aussi ce qu'elle annonçait : une alerte qui
  -- survit à la règle qu'elle portait fait douter de toutes les autres.
  if new.evidence_gate_enforced_from is null then
    delete from public.notification
     where organization_id = new.id and kind = 'evidence_deadline' and read_at is null;
    return new;
  end if;

  v_officer := app.person_for_role(new.id, 'AI Governance Officer');
  select ra.user_id into v_admin
    from public.role_assignment ra
   where ra.organization_id = new.id and ra.role = 'client_admin'
     and (ra.valid_until is null or ra.valid_until > now())
   order by ra.valid_from limit 1;

  v_quand := app.fr_date(new.evidence_gate_enforced_from);

  -- a. Ceux qui répondent de la règle.
  perform app.notify(
    new.tenant_id, new.id, v_officer, 'evidence_deadline',
    format('Preuves exigées à la mise en production le %s', v_quand),
    format('À partir de cette date, un contrôle applicable qu''aucune preuve validée ne démontre RETIENDRA la mise en production. D''ici là, l''écart se signale et s''assume. Ce qu''il reste à produire se lit au registre des contrôles.'),
    v_href, 'organization', new.id);

  if v_admin is not null and v_admin is distinct from v_officer then
    perform app.notify(
      new.tenant_id, new.id, v_admin, 'evidence_deadline',
      format('Preuves exigées à la mise en production le %s', v_quand),
      'À partir de cette date, vous ne pourrez plus approuver une mise en production dont des contrôles applicables ne sont pas démontrés. D''ici là, vous pouvez l''assumer en le déclarant.',
      v_href, 'organization', new.id);
  end if;

  -- b. La relance, cas d'usage par cas d'usage : celle qui sert vraiment.
  --    Elle ne part que là où il y a un écart, et elle nomme les contrôles.
  for r in
    select u.id, u.business_ref, u.name, u.owner_user_id,
           app.control_evidence_gap(u.id) as gap
    from public.ai_use_case u
    where u.organization_id = new.id
      and u.status in ('PILOT', 'REVIEW', 'APPROVED')
  loop
    if jsonb_array_length(r.gap) > 0 then
      perform app.notify(
        new.tenant_id, new.id, coalesce(r.owner_user_id, v_officer), 'evidence_deadline',
        format('%s ne passera plus en production sans ses preuves', r.business_ref),
        format('%s — %s contrôle(s) applicable(s) sans preuve validée : %s. À partir du %s, cet écart retiendra le jalon PRODUCTION.',
               r.name, jsonb_array_length(r.gap),
               (select string_agg(g ->> 'code', ', ' order by g ->> 'code') from jsonb_array_elements(r.gap) g),
               v_quand),
        format('/admin/use-cases/%s?onglet=controles&preuve=sans', r.id),
        'ai_use_case', r.id);
    end if;
  end loop;

  -- c. Deux rappels posés d'avance, sans tâche planifiée : `my_notifications`
  --    ne rend que ce qui est dû.
  if v_officer is not null then
    perform app.notify(
      new.tenant_id, new.id, v_officer, 'evidence_deadline',
      format('Dans un mois : preuves exigées à la mise en production (%s)', v_quand),
      'Ce qui n''est pas démontré d''ici là retiendra les mises en production.',
      v_href, 'organization', new.id,
      (new.evidence_gate_enforced_from - 30)::timestamptz);

    perform app.notify(
      new.tenant_id, new.id, v_officer, 'evidence_deadline',
      format('Dans une semaine : preuves exigées à la mise en production (%s)', v_quand),
      'Dernier rappel avant que l''écart ne devienne bloquant.',
      v_href, 'organization', new.id,
      (new.evidence_gate_enforced_from - 7)::timestamptz);
  end if;

  return new;
end;
$$;

comment on function app.notify_evidence_deadline is
  'Poser ou déplacer l''échéance avertit ceux qui en répondent, relance chaque cas d''usage qui porte un écart, et repose les rappels J-30 et J-7 (0105).';

create trigger organization_notify_evidence_deadline
  after update of evidence_gate_enforced_from on public.organization
  for each row execute function app.notify_evidence_deadline();

-- 0106 — Trois alertes sur la même échéance, et non une qui efface les deux autres.
--
-- `app.notify` dédoublonne sur (destinataire, nature, entité) : une seconde
-- alerte de même nature sur la même entité REMPLACE la première non lue. C'est
-- voulu, et c'est ce qui fait qu'un rappel ne s'empile pas.
--
-- Mais 0105 en pose trois d'un coup au même officer, sur la même organisation :
-- l'avis immédiat, le rappel J-30 et le rappel J-7. Chacune effaçait la
-- précédente, et il n'en restait qu'une — la dernière, muette jusqu'à J-7.
-- Constaté par le test, avant la démonstration.
--
-- Le remède garde la propriété qui compte — déplacer l'échéance ne laisse rien
-- traîner — en la déplaçant d'un cran : la fonction efface elle-même, UNE FOIS,
-- tout ce qui concerne cette organisation, puis insère sans passer par le
-- dédoublonnage.

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

  -- Insère sans dédoublonner : l'effacement est fait une fois, plus haut.
  procedure_note text := null;
begin
  if new.evidence_gate_enforced_from is not distinct from old.evidence_gate_enforced_from then
    return new;
  end if;

  -- Une échéance déplacée ou retirée n'a pas à laisser derrière elle ce
  -- qu'elle annonçait : on repart d'une table nette pour cette organisation.
  delete from public.notification
   where organization_id = new.id and kind = 'evidence_deadline' and read_at is null;

  if new.evidence_gate_enforced_from is null then
    return new;
  end if;

  v_href  := format('/admin/organizations/%s/controles', new.id);
  v_quand := app.fr_date(new.evidence_gate_enforced_from);

  v_officer := app.person_for_role(new.id, 'AI Governance Officer');
  select ra.user_id into v_admin
    from public.role_assignment ra
   where ra.organization_id = new.id and ra.role = 'client_admin'
     and (ra.valid_until is null or ra.valid_until > now())
   order by ra.valid_from limit 1;

  -- a. Ceux qui répondent de la règle.
  if v_officer is not null then
    insert into public.notification (tenant_id, organization_id, recipient_user_id, kind, title, body, href, entity_type, entity_id, due_at)
    values (new.tenant_id, new.id, v_officer, 'evidence_deadline',
      format('Preuves exigées à la mise en production le %s', v_quand),
      'À partir de cette date, un contrôle applicable qu''aucune preuve validée ne démontre RETIENDRA la mise en production. D''ici là, l''écart se signale et s''assume. Ce qu''il reste à produire se lit au registre des contrôles.',
      v_href, 'organization', new.id, now());
  end if;

  if v_admin is not null and v_admin is distinct from v_officer then
    insert into public.notification (tenant_id, organization_id, recipient_user_id, kind, title, body, href, entity_type, entity_id, due_at)
    values (new.tenant_id, new.id, v_admin, 'evidence_deadline',
      format('Preuves exigées à la mise en production le %s', v_quand),
      'À partir de cette date, vous ne pourrez plus approuver une mise en production dont des contrôles applicables ne sont pas démontrés. D''ici là, vous pouvez l''assumer en le déclarant.',
      v_href, 'organization', new.id, now());
  end if;

  -- b. La relance, cas d'usage par cas d'usage : celle qui sert vraiment. Elle
  --    ne part que là où il y a un écart, et elle nomme les contrôles.
  for r in
    select u.id, u.business_ref, u.name, u.owner_user_id,
           app.control_evidence_gap(u.id) as gap
    from public.ai_use_case u
    where u.organization_id = new.id
      and u.status in ('PILOT', 'REVIEW', 'APPROVED')
  loop
    if jsonb_array_length(r.gap) > 0 and coalesce(r.owner_user_id, v_officer) is not null then
      insert into public.notification (tenant_id, organization_id, recipient_user_id, kind, title, body, href, entity_type, entity_id, due_at)
      values (new.tenant_id, new.id, coalesce(r.owner_user_id, v_officer), 'evidence_deadline',
        format('%s ne passera plus en production sans ses preuves', r.business_ref),
        format('%s — %s contrôle(s) applicable(s) sans preuve validée : %s. À partir du %s, cet écart retiendra le jalon PRODUCTION.',
               r.name, jsonb_array_length(r.gap),
               (select string_agg(g ->> 'code', ', ' order by g ->> 'code') from jsonb_array_elements(r.gap) g),
               v_quand),
        format('/admin/use-cases/%s?onglet=controles&preuve=sans', r.id),
        'ai_use_case', r.id, now());
    end if;
  end loop;

  -- c. Deux rappels posés d'avance, sans tâche planifiée : `my_notifications`
  --    ne rend que ce qui est dû. Ils ne partent pas si la date est déjà là.
  if v_officer is not null then
    if new.evidence_gate_enforced_from - 30 > current_date then
      insert into public.notification (tenant_id, organization_id, recipient_user_id, kind, title, body, href, entity_type, entity_id, due_at)
      values (new.tenant_id, new.id, v_officer, 'evidence_deadline',
        format('Dans un mois : preuves exigées à la mise en production (%s)', v_quand),
        'Ce qui n''est pas démontré d''ici là retiendra les mises en production.',
        v_href, 'organization', new.id, (new.evidence_gate_enforced_from - 30)::timestamptz);
    end if;

    if new.evidence_gate_enforced_from - 7 > current_date then
      insert into public.notification (tenant_id, organization_id, recipient_user_id, kind, title, body, href, entity_type, entity_id, due_at)
      values (new.tenant_id, new.id, v_officer, 'evidence_deadline',
        format('Dans une semaine : preuves exigées à la mise en production (%s)', v_quand),
        'Dernier rappel avant que l''écart ne devienne bloquant.',
        v_href, 'organization', new.id, (new.evidence_gate_enforced_from - 7)::timestamptz);
    end if;
  end if;

  return new;
end;
$$;

comment on function app.notify_evidence_deadline is
  'Poser ou déplacer l''échéance efface ce qu''elle annonçait, avertit ceux qui en répondent, relance chaque cas d''usage qui porte un écart, et repose les rappels J-30 et J-7 (0106).';

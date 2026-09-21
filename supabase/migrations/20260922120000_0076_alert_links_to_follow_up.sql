-- =============================================================================
-- AIGMS — 0076 — Les alertes conduisent à l'action ou à l'incident lui-même
-- =============================================================================
-- Le suivi d'actions et d'incidents surligne désormais la ligne visée
-- (`?vue=actions&action=<id>`, `?vue=incidents&incident=<id>`). Les alertes y
-- conduisent directement, au lieu d'ouvrir une rubrique de fiche où il fallait
-- encore chercher. Et la rubrique « changements » de la fiche a rejoint
-- « Décisions et changements » : le lien suit.
--
-- Les trois fonctions ne changent que par leurs liens : on réécrit leur texte
-- plutôt que de recopier leur corps.
-- =============================================================================

do $$
declare v text;
begin
  select pg_get_functiondef('app.notify_action_owner()'::regprocedure) into v;
  v := replace(v,
    $x$case when new.use_case_id is not null
                 then format('/admin/use-cases/%s?onglet=actions', new.use_case_id)
                 else format('/admin/organizations/%s/suivi', new.organization_id) end$x$,
    $x$format('/admin/organizations/%s/suivi?vue=actions&action=%s#action-%s', new.organization_id, new.id, new.id)$x$);
  execute v;

  select pg_get_functiondef('app.notify_incident_ticket()'::regprocedure) into v;
  v := replace(v,
    $x$case when new.use_case_id is not null
                 then format('/admin/use-cases/%s?onglet=incidents', new.use_case_id)
                 else format('/admin/organizations/%s/suivi?vue=incidents', new.organization_id) end$x$,
    $x$format('/admin/organizations/%s/suivi?vue=incidents&incident=%s#incident-%s', new.organization_id, new.id, new.id)$x$);
  execute v;

  select pg_get_functiondef('app.notify_change_request()'::regprocedure) into v;
  v := replace(v, '?onglet=changements', '?onglet=decisions');
  execute v;
end $$;

-- Les alertes déjà posées suivent. Le garde interdit toute modification hors
-- lecture : on l'écarte le temps de cette seule correction de liens.
alter table public.notification disable trigger notification_guard_update;
update public.notification n
   set href = format('/admin/organizations/%s/suivi?vue=actions&action=%s#action-%s', n.organization_id, n.entity_id, n.entity_id)
 where n.kind in ('action_owner', 'action_due') and n.entity_id is not null and n.organization_id is not null;

update public.notification n
   set href = format('/admin/organizations/%s/suivi?vue=incidents&incident=%s#incident-%s', n.organization_id, n.entity_id, n.entity_id)
 where n.kind in ('incident_new', 'incident_qualify', 'incident_stop', 'incident_closure') and n.entity_id is not null and n.organization_id is not null;

update public.notification
   set href = replace(href, '?onglet=changements', '?onglet=decisions')
 where href like '%?onglet=changements%';

alter table public.notification enable trigger notification_guard_update;

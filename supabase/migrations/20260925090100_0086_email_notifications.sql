-- =============================================================================
-- AIGMS — 0086 — Les alertes sortent de l'écran : courriel et synthèse
-- =============================================================================
-- « Mes alertes » suppose qu'on ouvre la plateforme. Un responsable d'action
-- qui ne s'y connecte pas n'apprend rien. Trois pièces :
--
--   1. une PRÉFÉRENCE par personne — courriel activé ou non, cadence de la
--      synthèse — qu'elle règle elle-même et que l'administration peut poser
--      à la déclaration du compte, ou retirer ;
--   2. ce qui est DÛ À L'ENVOI : les alertes non lues, non encore envoyées,
--      d'une nature qui ne peut pas attendre (arrêt d'urgence, incident à
--      qualifier, décision à statuer, jalon bloqué) ;
--   3. la SYNTHÈSE : ce qui reste à faire avancer, par organisation, avec les
--      liens qui y conduisent.
--
-- L'envoi lui-même n'est pas l'affaire de la base : une route appelée par une
-- tâche planifiée lit ces fonctions avec la clé de service, envoie, et marque
-- ce qui est parti. La base ne connaît aucune adresse de serveur.
-- =============================================================================

alter table public.notification
  add column if not exists emailed_at timestamptz;

comment on column public.notification.emailed_at is
  'Quand cette alerte est partie par courriel. Nul si elle n''a pas à partir, ou pas encore.';

-- Le garde d'immuabilité des alertes n'interdit que la réécriture du fait :
-- marquer lue, ou marquer envoyée, reste possible.
create table if not exists public.notification_preference (
  user_id           uuid primary key references public.user_profile (id) on delete cascade,
  email_enabled     boolean not null default true,
  digest            app.digest_frequency not null default 'daily',
  -- Ce qui ne peut pas attendre la synthèse part tout de suite.
  immediate_enabled boolean not null default true,
  last_digest_at    timestamptz,
  updated_at        timestamptz not null default now()
);

comment on table public.notification_preference is
  'Comment une personne veut être prévenue. Absente, la règle par défaut s''applique : courriel activé, synthèse quotidienne.';

alter table public.notification_preference enable row level security;
alter table public.notification_preference force row level security;

create policy notification_preference_select on public.notification_preference
  for select to authenticated
  using (user_id = app.current_user_id()
         or app.is_platform_admin()
         or exists (select 1 from public.membership m
                     where m.user_id = public.notification_preference.user_id
                       and app.has_tenant_role(m.tenant_id, array['platform_admin', 'client_admin']::app.app_role[])));

create policy notification_preference_write on public.notification_preference
  for all to authenticated
  using (user_id = app.current_user_id()
         or app.is_platform_admin()
         or exists (select 1 from public.membership m
                     where m.user_id = public.notification_preference.user_id
                       and app.has_tenant_role(m.tenant_id, array['platform_admin', 'client_admin']::app.app_role[])))
  with check (user_id = app.current_user_id()
              or app.is_platform_admin()
              or exists (select 1 from public.membership m
                          where m.user_id = public.notification_preference.user_id
                            and app.has_tenant_role(m.tenant_id, array['platform_admin', 'client_admin']::app.app_role[])));

create trigger notification_preference_touch_updated_at before update on public.notification_preference
  for each row execute function app.touch_updated_at();

create trigger notification_preference_audit
  after insert or update or delete on public.notification_preference
  for each row execute function app.audit_business();

-- La préférence d'une personne, défaut compris.
create or replace function app.notification_preference_of(p_user_id uuid)
returns public.notification_preference
language sql stable
set search_path = app, public, pg_catalog
as $$
  select coalesce(
    (select p from public.notification_preference p where p.user_id = p_user_id),
    row(p_user_id, true, 'daily'::app.digest_frequency, true, null, now())::public.notification_preference);
$$;

create or replace function public.my_notification_preference()
returns public.notification_preference
language sql stable security invoker
set search_path = app, public, pg_catalog
as $$ select app.notification_preference_of(app.current_user_id()); $$;

grant execute on function public.my_notification_preference() to authenticated;

-- -----------------------------------------------------------------------------
-- 2. Ce qui ne peut pas attendre
-- -----------------------------------------------------------------------------
create or replace function app.immediate_kinds()
returns app.notification_kind[]
language sql immutable set search_path = pg_catalog
as $$
  select array['incident_stop', 'incident_new', 'incident_qualify', 'incident_closure',
               'decision_to_approve', 'decision_blocked', 'criticality_review',
               'evidence_expired']::app.notification_kind[];
$$;

comment on function app.immediate_kinds is
  'Les natures d''alerte qui partent tout de suite : un arrêt d''urgence ou une décision qui retient un jalon n''attendent pas la synthèse du lendemain.';

-- Lue par la tâche planifiée, avec la clé de service : jamais par un client.
create or replace function app.notifications_to_email()
returns table (
  notification_id uuid, user_id uuid, email text, full_name text,
  kind text, title text, body text, href text, organization_name text
)
language sql
stable
security definer
set search_path = app, public, pg_catalog
as $$
  select n.id, n.recipient_user_id, u.email, u.full_name, n.kind::text, n.title, n.body, n.href, o.name
  from public.notification n
  join public.user_profile u on u.id = n.recipient_user_id
  left join public.organization o on o.id = n.organization_id
  cross join lateral app.notification_preference_of(n.recipient_user_id) p
  where n.read_at is null
    and n.emailed_at is null
    and n.due_at <= now()
    and p.email_enabled
    and p.immediate_enabled
    and n.kind = any (app.immediate_kinds())
  order by n.due_at
  limit 200;
$$;

revoke all on function app.notifications_to_email() from public, anon, authenticated;

create or replace function app.mark_notifications_emailed(p_ids uuid[])
returns integer
language sql
security definer
set search_path = app, public, pg_catalog
as $$
  with touched as (
    update public.notification set emailed_at = now()
     where id = any (p_ids) and emailed_at is null
     returning 1)
  select count(*)::integer from touched;
$$;

revoke all on function app.mark_notifications_emailed(uuid[]) from public, anon, authenticated;

-- -----------------------------------------------------------------------------
-- 3. La synthèse : ce qui reste à faire avancer
-- -----------------------------------------------------------------------------
create or replace function app.notification_digest(p_user_id uuid)
returns jsonb
language sql
stable
security definer
set search_path = app, public, pg_catalog
as $$
  with orgs as (
    select distinct o.id, o.name
    from public.organization o
    where exists (select 1 from public.action a where a.organization_id = o.id
                    and a.owner_user_id = p_user_id and a.status not in ('done', 'cancelled'))
       or exists (select 1 from public.notification n where n.organization_id = o.id
                    and n.recipient_user_id = p_user_id and n.read_at is null and n.due_at <= now())
       or exists (select 1 from public.incident i where i.organization_id = o.id
                    and i.status <> 'CLOSED' and (i.owner_user_id = p_user_id or i.officer_user_id = p_user_id))
  )
  select jsonb_build_object(
    'generated_at', now(),
    'organizations', coalesce((
      select jsonb_agg(jsonb_build_object(
        'id', o.id, 'name', o.name,
        'actions_open', (select count(*) from public.action a where a.organization_id = o.id
                           and a.owner_user_id = p_user_id and a.status not in ('done', 'cancelled')),
        'actions_overdue', (select count(*) from public.action a where a.organization_id = o.id
                              and a.owner_user_id = p_user_id and a.status not in ('done', 'cancelled')
                              and a.due_date is not null and a.due_date < current_date),
        'actions', coalesce((select jsonb_agg(jsonb_build_object(
              'id', a.id, 'business_ref', a.business_ref, 'title', a.title, 'due_date', a.due_date,
              'blocking', a.is_blocking,
              'href', format('/admin/organizations/%s/suivi?vue=actions&action=%s#action-%s', o.id, a.id, a.id))
            order by a.due_date nulls last)
          from public.action a where a.organization_id = o.id and a.owner_user_id = p_user_id
            and a.status not in ('done', 'cancelled') limit 10), '[]'::jsonb),
        'incidents', coalesce((select jsonb_agg(jsonb_build_object(
              'id', i.id, 'business_ref', i.business_ref, 'title', i.title, 'status', i.status, 'severity', i.severity,
              'href', format('/admin/organizations/%s/suivi?vue=incidents&incident=%s#incident-%s', o.id, i.id, i.id))
            order by i.detected_at desc)
          from public.incident i where i.organization_id = o.id and i.status <> 'CLOSED'
            and (i.owner_user_id = p_user_id or i.officer_user_id = p_user_id) limit 10), '[]'::jsonb),
        'alerts', coalesce((select jsonb_agg(jsonb_build_object(
              'kind', n.kind, 'title', n.title, 'href', n.href) order by n.due_at desc)
          from public.notification n where n.organization_id = o.id and n.recipient_user_id = p_user_id
            and n.read_at is null and n.due_at <= now() limit 15), '[]'::jsonb),
        'follow_up_href', format('/admin/organizations/%s/suivi', o.id)
      ) order by o.name)
      from orgs o), '[]'::jsonb)
  );
$$;

revoke all on function app.notification_digest(uuid) from public, anon;
grant execute on function app.notification_digest(uuid) to authenticated;

-- Ma propre synthèse : l'aperçu que l'écran montre avant de l'envoyer.
create or replace function public.my_notification_digest()
returns jsonb
language sql stable security invoker
set search_path = app, public, pg_catalog
as $$ select app.notification_digest(app.current_user_id()); $$;

grant execute on function public.my_notification_digest() to authenticated;

-- Qui doit recevoir une synthèse maintenant : cadence atteinte, courriel
-- activé, et quelque chose à dire.
create or replace function app.digest_recipients()
returns table (user_id uuid, email text, full_name text, digest text, payload jsonb)
language sql
stable
security definer
set search_path = app, public, pg_catalog
as $$
  select u.id, u.email, u.full_name, p.digest::text, app.notification_digest(u.id)
  from public.user_profile u
  cross join lateral app.notification_preference_of(u.id) p
  where p.email_enabled
    and p.digest <> 'none'
    and (p.last_digest_at is null
         or p.last_digest_at < now() - (case p.digest when 'weekly' then interval '7 days' else interval '20 hours' end))
    and jsonb_array_length(app.notification_digest(u.id) -> 'organizations') > 0;
$$;

revoke all on function app.digest_recipients() from public, anon, authenticated;

create or replace function app.mark_digest_sent(p_user_id uuid)
returns void
language sql
security definer
set search_path = app, public, pg_catalog
as $$
  insert into public.notification_preference (user_id, last_digest_at)
  values (p_user_id, now())
  on conflict (user_id) do update set last_digest_at = now();
$$;

revoke all on function app.mark_digest_sent(uuid) from public, anon, authenticated;

-- Les enveloppes publiques que la tâche planifiée appelle avec la clé de
-- service. Elles restent refusées aux rôles authentifiés.
create or replace function public.notifications_to_email()
returns table (
  notification_id uuid, user_id uuid, email text, full_name text,
  kind text, title text, body text, href text, organization_name text
)
language sql stable security definer
set search_path = app, public, pg_catalog
as $$ select * from app.notifications_to_email(); $$;

create or replace function public.mark_notifications_emailed(p_ids uuid[])
returns integer language sql security definer
set search_path = app, public, pg_catalog
as $$ select app.mark_notifications_emailed(p_ids); $$;

create or replace function public.digest_recipients()
returns table (user_id uuid, email text, full_name text, digest text, payload jsonb)
language sql stable security definer
set search_path = app, public, pg_catalog
as $$ select * from app.digest_recipients(); $$;

create or replace function public.mark_digest_sent(p_user_id uuid)
returns void language sql security definer
set search_path = app, public, pg_catalog
as $$ select app.mark_digest_sent(p_user_id); $$;

revoke all on function public.notifications_to_email() from public, anon, authenticated;
revoke all on function public.mark_notifications_emailed(uuid[]) from public, anon, authenticated;
revoke all on function public.digest_recipients() from public, anon, authenticated;
revoke all on function public.mark_digest_sent(uuid) from public, anon, authenticated;
grant execute on function public.notifications_to_email() to service_role;
grant execute on function public.mark_notifications_emailed(uuid[]) to service_role;
grant execute on function public.digest_recipients() to service_role;
grant execute on function public.mark_digest_sent(uuid) to service_role;

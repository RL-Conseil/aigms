-- =============================================================================
-- AIGMS — 0100 — L'avertissement d'une mise en production ne dort pas la nuit
-- =============================================================================
-- `decision_to_approve` figure déjà parmi les natures qui ne rejoignent pas la
-- synthèse (0086). Mais l'envoi passe par la tâche planifiée, qui tourne UNE
-- FOIS PAR JOUR à 7 h : une mise en production soumise à 8 h attend vingt-trois
-- heures. Pour la décision la plus tendue du registre, c'est trop.
--
-- Plutôt que d'accélérer la cadence générale — ce qui multiplierait les
-- réveils pour tout le reste — l'application envoie CE courriel-là au moment
-- de la soumission. Il faut alors qu'un seul des deux l'envoie, jamais les
-- deux : cette fonction rend les messages ET les marque comme partis, en un
-- seul acte.
--
-- `security definer`, mais bornée : on ne réclame que les alertes attachées à
-- UNE décision, et seulement si l'appelant a accès à son tenant. Il ne s'agit
-- pas d'ouvrir la boîte des autres — il s'agit de prendre en charge l'envoi de
-- ce qu'on vient soi-même de déclencher.
-- =============================================================================

create or replace function public.claim_decision_notices(p_decision_id uuid)
returns table (
  notification_id uuid, email text, full_name text,
  kind text, title text, body text, href text, organization_name text
)
language plpgsql
volatile
security definer
set search_path = app, public, pg_catalog
as $$
declare v_decision public.governance_decision%rowtype;
begin
  select * into v_decision from public.governance_decision where id = p_decision_id;
  if v_decision.id is null or not app.has_tenant_access(v_decision.tenant_id) then
    return;
  end if;

  return query
  with dues as (
    update public.notification n
       set emailed_at = now()
     where n.subject_type = 'governance_decision'
       and n.subject_id = p_decision_id
       and n.emailed_at is null
       and n.read_at is null
       and n.due_at <= now()
       and n.kind in ('decision_to_approve', 'decision_gap_notice')
       and (select p.email_enabled and p.immediate_enabled
              from app.notification_preference_of(n.recipient_user_id) p)
    returning n.id, n.recipient_user_id, n.kind, n.title, n.body, n.href, n.organization_id
  )
  select d.id, u.email, u.full_name, d.kind::text, d.title, d.body, d.href, o.name
  from dues d
  join public.user_profile u on u.id = d.recipient_user_id
  left join public.organization o on o.id = d.organization_id;
end;
$$;

comment on function public.claim_decision_notices is
  'Rend les avertissements d''une décision et les marque comme partis, pour que l''application les envoie sans attendre la tâche planifiée. Un seul des deux envoie (0100).';

revoke all on function public.claim_decision_notices(uuid) from public, anon;
grant execute on function public.claim_decision_notices(uuid) to authenticated;

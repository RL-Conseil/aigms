-- =============================================================================
-- AIGMS — 0031 — Ce qui appelle une action
-- =============================================================================
-- Un menu qui ne porte que des noms de pages oblige à ouvrir chaque écran pour
-- savoir s'il s'y passe quelque chose. Cette fonction rend, en une lecture, ce
-- qui est en retard ou en attente, organisation par organisation : la
-- navigation peut alors dire où aller avant qu'on ait à chercher.
--
-- Sept compteurs, et pas un de plus. Chacun désigne un acte précis, jamais un
-- état général :
--
--   * actions échues            — quelqu'un devait faire quelque chose ;
--   * revues en retard          — un cas d'usage devait être réexaminé ;
--   * preuves à renouveler      — une preuve validée n'est plus fraîche ;
--   * preuves à valider         — une pièce déposée attend un verdict ;
--   * incidents ouverts         — un fait est survenu et n'est pas clos ;
--   * risques élevés ouverts    — ni traités, ni acceptés ;
--   * exigences sans décision   — la règle d'or de la Déclaration.
--
-- Ce qui n'y figure pas, volontairement : aucun indicateur de volume. « 12 cas
-- d'usage » n'appelle aucune action et encombrerait ce qui en appelle une.
-- =============================================================================

create or replace function app.attention_by_organization()
returns table (
  organization_id     uuid,
  organization_name   text,
  organization_ref    text,
  overdue_actions     integer,
  reviews_due         integer,
  stale_evidence      integer,
  evidence_to_review  integer,
  open_incidents      integer,
  high_risks_open     integer,
  soa_undecided       integer,
  total               integer
)
language sql
stable
security definer
set search_path = app, public, pg_catalog
as $$
  with scope as (
    select o.id, o.name, o.business_ref, o.tenant_id
    from public.organization o
    where app.has_tenant_access(o.tenant_id)
  ),
  -- Le nombre d'exigences de l'Annexe A est le meme pour tous : on le calcule
  -- une fois plutot qu'une fois par organisation.
  annex as (
    select count(*)::integer as requirements
    from public.requirement r
    join public.framework f on f.id = r.framework_id
    where f.code = 'ISO_IEC_42001' and f.version = '2023'
      and r.objective_code is not null
  ),
  counted as (
    select
      s.id, s.name, s.business_ref,
      (select count(*) from public.action a
        where a.organization_id = s.id
          and a.status not in ('done', 'cancelled')
          and a.due_date is not null and a.due_date <= current_date)::integer as overdue_actions,
      (select count(*) from public.ai_use_case u
        where u.organization_id = s.id
          and u.next_review_at is not null and u.next_review_at <= current_date)::integer as reviews_due,
      (select count(*) from public.evidence e
        where e.organization_id = s.id
          and e.validation_status = 'validated'
          and app.evidence_freshness(e.valid_until) in ('expired', 'expiring'))::integer as stale_evidence,
      (select count(*) from public.evidence e
        where e.organization_id = s.id
          and e.validation_status = 'pending')::integer as evidence_to_review,
      (select count(*) from public.incident i
        where i.organization_id = s.id
          and i.status <> 'CLOSED')::integer as open_incidents,
      (select count(*) from public.risk r
        where r.organization_id = s.id
          and coalesce(r.residual_level, r.inherent_level) in ('high', 'critical')
          and r.status not in ('mitigated', 'closed', 'accepted'))::integer as high_risks_open,
      greatest(
        (select requirements from annex)
        - (select count(*)::integer from public.soa_decision d where d.organization_id = s.id),
        0) as soa_undecided
    from scope s
  )
  select
    id, name, business_ref,
    overdue_actions, reviews_due, stale_evidence, evidence_to_review,
    open_incidents, high_risks_open, soa_undecided,
    (overdue_actions + reviews_due + stale_evidence + evidence_to_review
     + open_incidents + high_risks_open + soa_undecided)::integer
  from counted
  order by
    (overdue_actions + reviews_due + stale_evidence + evidence_to_review
     + open_incidents + high_risks_open + soa_undecided) desc,
    name;
$$;

comment on function app.attention_by_organization is
  'Ce qui appelle une action, organisation par organisation. Chaque compteur designe un acte precis, jamais un volume : un menu doit dire ou aller, pas combien il y a de choses.';

create or replace function public.attention_by_organization()
returns table (
  organization_id uuid, organization_name text, organization_ref text,
  overdue_actions integer, reviews_due integer, stale_evidence integer,
  evidence_to_review integer, open_incidents integer, high_risks_open integer,
  soa_undecided integer, total integer
)
language sql stable security invoker
set search_path = app, public, pg_catalog
as $$ select * from app.attention_by_organization(); $$;

revoke all on function public.attention_by_organization() from public, anon;
grant execute on function public.attention_by_organization() to authenticated;

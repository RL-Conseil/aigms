-- =============================================================================
-- AIGMS — 0027 — AI Control Graph et chemin du risque
-- Incrément 4 de la cartographie orientée process
-- =============================================================================
-- L'arbre de l'incrément 1 montre une hiérarchie. Il ne sait pas montrer ce qui
-- la traverse : un contrôle qui sert plusieurs cas d'usage, une preuve unique
-- adossée à plusieurs contrôles, un risque dont rien ne redescend vers une
-- preuve. C'est ce que le graphe apporte, et rien d'autre.
--
-- Deux apports, dans cet ordre :
--
--   1. `risk_treatment.control_id` — jusqu'ici, aucun lien ne reliait un risque
--      au contrôle censé le réduire. Le rapprochement ne pouvait être
--      qu'inféré « ces contrôles s'appliquent au même cas d'usage », ce qui ne
--      démontre rien devant un auditeur. Le lien devient déclaré, nominatif et
--      porté par le plan de traitement.
--
--   2. `control_graph` et `risk_path` — le graphe des six couches, puis le
--      diagnostic d'une chaîne : d'un risque jusqu'à la preuve, avec le point
--      exact où elle rompt. Le diagnostic est une règle de gouvernance : il
--      reste en base, pas dans l'écran.
-- =============================================================================

-- -----------------------------------------------------------------------------
-- Le contrôle qui met en œuvre un traitement
-- -----------------------------------------------------------------------------
alter table public.risk_treatment
  add column control_id uuid references public.control (id) on delete set null;

comment on column public.risk_treatment.control_id is
  'Contrôle qui met en œuvre ce traitement. Nul tant que le traitement n''est pas outillé : le graphe signale alors le risque comme non redescendu vers une mesure, plutôt que d''inférer un lien qui ne se démontre pas.';

create index risk_treatment_control_idx on public.risk_treatment (control_id)
  where control_id is not null;

create or replace function app.assert_treatment_control()
returns trigger
language plpgsql
security definer
set search_path = app, public, pg_catalog
as $$
declare
  v_control_org uuid;
  v_risk_org    uuid;
begin
  if new.control_id is null then
    return new;
  end if;

  select organization_id into v_control_org from public.control where id = new.control_id;
  select organization_id into v_risk_org    from public.risk    where id = new.risk_id;

  if v_control_org is null then
    raise exception 'Contrôle % introuvable', new.control_id using errcode = 'foreign_key_violation';
  end if;
  if v_control_org <> v_risk_org then
    raise exception 'Le contrôle et le risque qu''il traite doivent relever de la même organisation.'
      using errcode = 'check_violation';
  end if;
  return new;
end;
$$;

create trigger risk_treatment_assert_control before insert or update on public.risk_treatment
  for each row execute function app.assert_treatment_control();

-- -----------------------------------------------------------------------------
-- Le graphe
-- -----------------------------------------------------------------------------
-- Six couches, de ce que fait l'organisation jusqu'à ce qu'elle peut produire :
--
--   processus → activité → cas d'usage → risque → contrôle → preuve
--
-- Les identifiants de nœuds sont préfixés par leur couche : deux entités de
-- tables différentes ne peuvent pas entrer en collision, et l'écran n'a pas à
-- deviner de quoi il parle.
-- -----------------------------------------------------------------------------
create or replace function app.control_graph(
  p_organization_id uuid,
  p_activity_id     uuid default null
)
returns jsonb
language sql
stable
security definer
set search_path = app, public, pg_catalog
as $$
  with scope as (
    select o.id, o.tenant_id
    from public.organization o
    where o.id = p_organization_id
      and app.has_tenant_access(o.tenant_id)
  ),
  -- Cas d'usage retenus. Le filtre par activité restreint tout le graphe :
  -- au-delà d'une trentaine de nœuds, une vue d'ensemble ne se lit plus.
  uc as (
    select u.*
    from public.ai_use_case u
    join scope s on s.id = u.organization_id
    where u.activity_id is not null
      and (p_activity_id is null or u.activity_id = p_activity_id)
  ),
  act as (
    select a.* from public.activity a
    join scope s on s.id = a.organization_id
    where p_activity_id is null or a.id = p_activity_id
  ),
  proc as (
    select distinct p.*
    from public.process p
    join act a on a.process_id = p.id
  ),
  rsk as (
    select r.* from public.risk r
    join uc on uc.id = r.use_case_id
  ),
  -- Un contrôle entre dans le graphe par deux portes : il s'applique à un cas
  -- d'usage du périmètre, ou il a été désigné pour traiter l'un de ses risques.
  -- La seconde porte compte : un contrôle désigné dont personne n'a statué
  -- l'applicabilité doit rester visible, pas disparaître.
  ctl as (
    select distinct c.*
    from public.control c
    where exists (
      select 1 from public.control_applicability ca
      join uc on uc.id = ca.use_case_id
      where ca.control_id = c.id and ca.status = 'applicable'
    )
    or exists (
      select 1 from public.risk_treatment t
      join rsk on rsk.id = t.risk_id
      where t.control_id = c.id and t.status <> 'abandoned'
    )
  ),
  ctl_evidenced as (
    select c.id,
           exists (
             select 1 from public.control_evidence ce
             join public.evidence e on e.id = ce.evidence_id
             where ce.control_id = c.id
               and e.validation_status = 'validated'
               and app.evidence_freshness(e.valid_until) <> 'expired'
           ) as evidenced
    from ctl c
  ),
  ev as (
    select distinct e.*
    from public.evidence e
    join public.control_evidence ce on ce.evidence_id = e.id
    join ctl c on c.id = ce.control_id
  ),
  nodes as (
    select jsonb_build_object(
      'id', 'process:' || p.id, 'layer', 'process', 'entity_id', p.id,
      'ref', p.code, 'label', p.name,
      'meta', jsonb_build_object('category', p.category), 'tone', 'neutral'
    ) as node, 0 as ord, p.display_order as sub, p.name as lbl
    from proc p
    union all
    select jsonb_build_object(
      'id', 'activity:' || a.id, 'layer', 'activity', 'entity_id', a.id,
      'ref', a.business_ref, 'label', a.name,
      'meta', '{}'::jsonb, 'tone', 'neutral'
    ), 1, a.display_order, a.name
    from act a
    union all
    select jsonb_build_object(
      'id', 'use_case:' || u.id, 'layer', 'use_case', 'entity_id', u.id,
      'ref', u.business_ref, 'label', u.name,
      'meta', jsonb_build_object('status', u.status, 'criticality', u.criticality),
      'tone', case when u.status in ('PRODUCTION', 'MONITORING') then 'live' else 'neutral' end
    ), 2, 0, u.name
    from uc u
    union all
    select jsonb_build_object(
      'id', 'risk:' || r.id, 'layer', 'risk', 'entity_id', r.id,
      'ref', r.business_ref, 'label', r.title,
      'meta', jsonb_build_object(
        'level', coalesce(r.residual_level, r.inherent_level),
        'status', r.status,
        'accepted', r.status = 'accepted'),
      'tone', case
        when coalesce(r.residual_level, r.inherent_level) in ('critical', 'high')
             and r.status not in ('mitigated', 'closed', 'accepted') then 'stop'
        when coalesce(r.residual_level, r.inherent_level) = 'moderate' then 'warn'
        else 'neutral' end
    ), 3, 0, r.title
    from rsk r
    union all
    select jsonb_build_object(
      'id', 'control:' || c.id, 'layer', 'control', 'entity_id', c.id,
      'ref', c.code, 'label', c.name,
      'meta', jsonb_build_object(
        'status', c.status, 'mandatory', c.is_mandatory,
        'evidenced', ce.evidenced, 'last_tested_at', c.last_tested_at),
      -- Un contrôle n'est « tenu » que s'il est opérant ET prouvé : c'est la
      -- même exigence que le taux de couverture, elle ne varie pas d'un écran
      -- à l'autre.
      'tone', case
        when c.status = 'operating' and ce.evidenced then 'ok'
        when c.status = 'operating' then 'warn'
        else 'stop' end
    ), 4, 0, c.name
    from ctl c
    join ctl_evidenced ce on ce.id = c.id
    union all
    select jsonb_build_object(
      'id', 'evidence:' || e.id, 'layer', 'evidence', 'entity_id', e.id,
      'ref', e.business_ref, 'label', e.title,
      'meta', jsonb_build_object(
        'validation_status', e.validation_status,
        'freshness', app.evidence_freshness(e.valid_until),
        'valid_until', e.valid_until),
      'tone', case
        when e.validation_status <> 'validated' then 'stop'
        when app.evidence_freshness(e.valid_until) = 'expired' then 'stop'
        when app.evidence_freshness(e.valid_until) = 'expiring' then 'warn'
        else 'ok' end
    ), 5, 0, e.title
    from ev e
  ),
  edges as (
    select jsonb_build_object(
      'id', 'structure:' || a.process_id || ':' || a.id,
      'source', 'process:' || a.process_id, 'target', 'activity:' || a.id,
      'kind', 'structure') as edge
    from act a
    join proc p on p.id = a.process_id
    union all
    select jsonb_build_object(
      'id', 'structure:' || u.activity_id || ':' || u.id,
      'source', 'activity:' || u.activity_id, 'target', 'use_case:' || u.id,
      'kind', 'structure')
    from uc u
    union all
    select jsonb_build_object(
      'id', 'exposure:' || r.use_case_id || ':' || r.id,
      'source', 'use_case:' || r.use_case_id, 'target', 'risk:' || r.id,
      'kind', 'exposure')
    from rsk r
    union all
    -- Applicabilité : ce contrôle a été jugé applicable à ce cas d'usage.
    select distinct jsonb_build_object(
      'id', 'applicability:' || ca.use_case_id || ':' || ca.control_id,
      'source', 'use_case:' || ca.use_case_id, 'target', 'control:' || ca.control_id,
      'kind', 'applicability')
    from public.control_applicability ca
    join uc on uc.id = ca.use_case_id
    join ctl c on c.id = ca.control_id
    where ca.status = 'applicable'
    union all
    -- Traitement : ce contrôle a été DÉSIGNÉ pour réduire ce risque. C'est un
    -- lien déclaré par un humain, pas une proximité déduite.
    select distinct jsonb_build_object(
      'id', 'mitigation:' || t.risk_id || ':' || t.control_id,
      'source', 'risk:' || t.risk_id, 'target', 'control:' || t.control_id,
      'kind', 'mitigation',
      'meta', jsonb_build_object('strategy', t.strategy, 'status', t.status))
    from public.risk_treatment t
    join rsk r on r.id = t.risk_id
    join ctl c on c.id = t.control_id
    where t.control_id is not null
    union all
    select distinct jsonb_build_object(
      'id', 'evidence:' || ce.control_id || ':' || ce.evidence_id,
      'source', 'control:' || ce.control_id, 'target', 'evidence:' || ce.evidence_id,
      'kind', 'evidence')
    from public.control_evidence ce
    join ctl c on c.id = ce.control_id
    join ev e on e.id = ce.evidence_id
  )
  select case
    when not exists (select 1 from scope) then jsonb_build_object('available', false)
    else jsonb_build_object(
      'available', true,
      'nodes', coalesce((select jsonb_agg(node order by ord, sub, lbl) from nodes), '[]'::jsonb),
      'edges', coalesce((select jsonb_agg(edge) from edges), '[]'::jsonb))
  end;
$$;

comment on function app.control_graph is
  'Graphe de gouvernance à six couches : processus, activité, cas d''usage, risque, contrôle, preuve. Distingue un contrôle applicable d''un contrôle désigné pour traiter un risque.';

-- -----------------------------------------------------------------------------
-- Le chemin du risque
-- -----------------------------------------------------------------------------
-- « Ce risque est-il tenu, et par quoi ? » Le graphe montre des liens ; cette
-- fonction rend un verdict, et surtout nomme l'endroit exact où la chaîne
-- rompt. Un chemin qui s'arrête au traitement et un chemin qui s'arrête à la
-- preuve n'appellent pas la même action.
-- -----------------------------------------------------------------------------
create or replace function app.risk_path(p_risk_id uuid)
returns jsonb
language plpgsql
stable
security definer
set search_path = app, public, pg_catalog
as $$
declare
  r            record;
  v_controls   jsonb := '[]'::jsonb;
  v_nodes      jsonb;
  v_edges      jsonb;
  v_total      integer := 0;
  v_operating  integer := 0;
  v_evidenced  integer := 0;
  v_treatments integer := 0;
  v_break      text;
  v_message    text;
begin
  select rk.id, rk.business_ref, rk.title, rk.status,
         coalesce(rk.residual_level, rk.inherent_level) as level,
         u.id as use_case_id, u.name as use_case_name, u.business_ref as use_case_ref,
         a.id as activity_id, a.name as activity_name,
         p.id as process_id, p.name as process_name
    into r
  from public.risk rk
  join public.ai_use_case u on u.id = rk.use_case_id
  left join public.activity a on a.id = u.activity_id
  left join public.process p  on p.id = a.process_id
  where rk.id = p_risk_id
    and app.has_tenant_access(rk.tenant_id);

  if not found then
    return jsonb_build_object('available', false);
  end if;

  select count(*) into v_treatments
  from public.risk_treatment t
  where t.risk_id = p_risk_id and t.status <> 'abandoned';

  select
    coalesce(jsonb_agg(jsonb_build_object(
      'id', c.id, 'code', c.code, 'name', c.name, 'status', c.status,
      'evidenced', x.evidenced, 'treatment_status', x.treatment_status,
      'strategy', x.strategy) order by c.code), '[]'::jsonb),
    count(*),
    count(*) filter (where c.status = 'operating'),
    count(*) filter (where c.status = 'operating' and x.evidenced)
  into v_controls, v_total, v_operating, v_evidenced
  from (
    select distinct on (t.control_id)
      t.control_id, t.status as treatment_status, t.strategy,
      exists (
        select 1 from public.control_evidence ce
        join public.evidence e on e.id = ce.evidence_id
        where ce.control_id = t.control_id
          and e.validation_status = 'validated'
          and app.evidence_freshness(e.valid_until) <> 'expired'
      ) as evidenced
    from public.risk_treatment t
    where t.risk_id = p_risk_id
      and t.control_id is not null
      and t.status <> 'abandoned'
    order by t.control_id, t.status
  ) x
  join public.control c on c.id = x.control_id;

  -- Le verdict. L'ordre compte : on nomme la première rupture rencontrée en
  -- descendant, parce que c'est celle qu'il faut traiter en premier.
  if r.status = 'accepted' then
    v_break := null;
    v_message := 'Risque accepté : la chaîne de maîtrise n’est pas requise, l’acceptation est nominative, justifiée et datée.';
  elsif v_treatments = 0 then
    v_break := 'no_treatment';
    v_message := 'Aucun plan de traitement. Le risque est identifié mais rien n’est engagé pour le réduire.';
  elsif v_total = 0 then
    v_break := 'no_control';
    v_message := 'Un traitement est prévu mais aucun contrôle ne le met en œuvre. Le chemin s’arrête à l’intention.';
  elsif v_operating = 0 then
    v_break := 'control_not_operating';
    v_message := 'Les contrôles désignés ne sont pas opérants. Un contrôle décrit ne réduit rien.';
  elsif v_evidenced = 0 then
    v_break := 'no_evidence';
    v_message := 'Aucun contrôle opérant n’est adossé à une preuve validée et non échue. Le contrôle tient peut-être, mais rien ne le démontre.';
  else
    v_break := null;
    v_message := format('Chaîne complète : %s contrôle(s) opérant(s) et prouvé(s) sur %s désigné(s).', v_evidenced, v_total);
  end if;

  -- Les nœuds et arêtes à mettre en évidence dans le graphe.
  select
    to_jsonb(array_remove(array[
      case when r.process_id  is not null then 'process:'  || r.process_id  end,
      case when r.activity_id is not null then 'activity:' || r.activity_id end,
      'use_case:' || r.use_case_id,
      'risk:' || r.id
    ], null)) || coalesce(
      (select jsonb_agg(t.node) from (
        select 'control:' || (elem.value ->> 'id') as node from jsonb_array_elements(v_controls) elem
        union all
        select 'evidence:' || ce.evidence_id
        from public.control_evidence ce
        join public.evidence e on e.id = ce.evidence_id
        where ce.control_id in (select (elem.value ->> 'id')::uuid from jsonb_array_elements(v_controls) elem)
      ) t), '[]'::jsonb)
  into v_nodes;

  select coalesce(jsonb_agg(edge), '[]'::jsonb) into v_edges
  from (
    select 'structure:' || r.process_id || ':' || r.activity_id as edge
    where r.process_id is not null and r.activity_id is not null
    union all
    select 'structure:' || r.activity_id || ':' || r.use_case_id
    where r.activity_id is not null
    union all
    select 'exposure:' || r.use_case_id || ':' || r.id
    union all
    select 'mitigation:' || r.id || ':' || (elem.value ->> 'id') from jsonb_array_elements(v_controls) elem
    union all
    select 'evidence:' || ce.control_id || ':' || ce.evidence_id
    from public.control_evidence ce
    where ce.control_id in (select (elem.value ->> 'id')::uuid from jsonb_array_elements(v_controls) elem)
  ) e;

  return jsonb_build_object(
    'available', true,
    'risk', jsonb_build_object(
      'id', r.id, 'ref', r.business_ref, 'title', r.title,
      'level', r.level, 'status', r.status),
    'anchor', jsonb_build_object(
      'process', r.process_name, 'activity', r.activity_name,
      'use_case', r.use_case_name, 'use_case_ref', r.use_case_ref,
      'use_case_id', r.use_case_id),
    'controls', v_controls,
    'counts', jsonb_build_object(
      'treatments', v_treatments, 'controls', v_total,
      'operating', v_operating, 'evidenced', v_evidenced),
    'chain_complete', v_break is null,
    'break', v_break,
    'message', v_message,
    'highlight_nodes', v_nodes,
    'highlight_edges', v_edges);
end;
$$;

comment on function app.risk_path is
  'Chemin d''un risque, du processus jusqu''à la preuve, et point exact où la chaîne rompt. Un risque accepté n''est pas une chaîne rompue : c''est une décision humaine assumée.';

-- -----------------------------------------------------------------------------
-- Surface d'API
-- -----------------------------------------------------------------------------
create or replace function public.control_graph(
  p_organization_id uuid,
  p_activity_id     uuid default null
)
returns jsonb
language sql stable security invoker
set search_path = app, public, pg_catalog
as $$ select app.control_graph(p_organization_id, p_activity_id); $$;

create or replace function public.risk_path(p_risk_id uuid)
returns jsonb
language sql stable security invoker
set search_path = app, public, pg_catalog
as $$ select app.risk_path(p_risk_id); $$;

revoke all on function public.control_graph(uuid, uuid) from public, anon;
revoke all on function public.risk_path(uuid)           from public, anon;
grant execute on function public.control_graph(uuid, uuid) to authenticated;
grant execute on function public.risk_path(uuid)           to authenticated;

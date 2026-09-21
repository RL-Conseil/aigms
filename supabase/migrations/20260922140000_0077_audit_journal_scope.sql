-- =============================================================================
-- AIGMS — 0077 — Le journal d'audit sait de quelle organisation et de quel
--                cas d'usage chaque entrée parle
-- =============================================================================
-- Le journal ne portait que le tenant : lire « tout ce qui s'est passé sur ce
-- cas d'usage » se limitait aux entrées dont l'entité ÉTAIT le cas d'usage —
-- pas ses risques, ses décisions, ses preuves. Il devient une lecture
-- d'organisation, filtrable par cas d'usage, et quitte la fiche.
--
-- Chaque entrée se situe à l'écriture : l'organisation et le cas d'usage se
-- lisent dans l'état journalisé, ou par la ligne parente (une CAPA par son
-- incident, un constat par son évaluation, un lien par sa décision). Les
-- entrées existantes sont situées une fois, le garde d'immutabilité écarté
-- le temps de ce seul complément — la trace elle-même ne change pas.
-- =============================================================================

alter table public.audit_log
  add column if not exists organization_id uuid,
  add column if not exists use_case_id     uuid;

create index if not exists audit_log_org_time_idx on public.audit_log (organization_id, occurred_at desc)
  where organization_id is not null;
create index if not exists audit_log_use_case_time_idx on public.audit_log (use_case_id, occurred_at desc)
  where use_case_id is not null;

create or replace function app.audit_locate(
  p_entity_type text, p_entity_id uuid, p_state jsonb, p_meta jsonb,
  out o_organization_id uuid, out o_use_case_id uuid
)
language plpgsql
stable
security definer
set search_path = app, public, pg_catalog
as $$
declare
  v_state jsonb := coalesce(p_state, '{}'::jsonb);
begin
  o_organization_id := (v_state ->> 'organization_id')::uuid;
  o_use_case_id := coalesce((v_state ->> 'use_case_id')::uuid,
                            (coalesce(p_meta, '{}'::jsonb) ->> 'use_case_id')::uuid,
                            (coalesce(p_meta, '{}'::jsonb) #>> '{gate,use_case_id}')::uuid);

  -- Un état partiel (une validation de preuve, un choix de SoA) ne porte pas
  -- toujours l'organisation : la ligne elle-même, si elle existe encore.
  if (o_organization_id is null or o_use_case_id is null) and p_entity_id is not null
     and exists (select 1 from information_schema.tables t where t.table_schema = 'public' and t.table_name = p_entity_type) then
    if o_organization_id is null and exists (select 1 from information_schema.columns c
        where c.table_schema = 'public' and c.table_name = p_entity_type and c.column_name = 'organization_id') then
      execute format('select organization_id from public.%I where id = $1', p_entity_type) into o_organization_id using p_entity_id;
    end if;
    if o_use_case_id is null and exists (select 1 from information_schema.columns c
        where c.table_schema = 'public' and c.table_name = p_entity_type and c.column_name = 'use_case_id') then
      execute format('select use_case_id from public.%I where id = $1', p_entity_type) into o_use_case_id using p_entity_id;
    end if;
  end if;

  if p_entity_type = 'ai_use_case' then
    o_use_case_id := coalesce(o_use_case_id, p_entity_id);
  elsif o_use_case_id is null then
    if p_entity_type = 'capa' then
      select i.use_case_id into o_use_case_id from public.incident i where i.id = (v_state ->> 'incident_id')::uuid;
    elsif p_entity_type in ('impact_finding', 'impact_stakeholder') then
      select ia.use_case_id into o_use_case_id from public.impact_assessment ia where ia.id = (v_state ->> 'impact_assessment_id')::uuid;
    elsif p_entity_type = 'decision_link' then
      select d.use_case_id into o_use_case_id from public.governance_decision d where d.id = (v_state ->> 'decision_id')::uuid;
    elsif p_entity_type = 'risk_treatment' then
      select r.use_case_id into o_use_case_id from public.risk r where r.id = (v_state ->> 'risk_id')::uuid;
    elsif p_entity_type = 'reassessment' then
      select c.use_case_id into o_use_case_id from public.change_request c where c.id = (v_state ->> 'change_request_id')::uuid;
    elsif p_entity_type = 'assessment_answer' then
      select a.use_case_id into o_use_case_id from public.assessment a where a.id = (v_state ->> 'assessment_id')::uuid;
    end if;
  end if;

  if o_organization_id is null and o_use_case_id is not null then
    select u.organization_id into o_organization_id from public.ai_use_case u where u.id = o_use_case_id;
  end if;
  if o_organization_id is null then
    if p_entity_type = 'organization' then
      o_organization_id := p_entity_id;
    elsif p_entity_type = 'control_evidence' then
      select c.organization_id into o_organization_id from public.control c where c.id = (v_state ->> 'control_id')::uuid;
    elsif p_entity_type = 'control_requirement_map' then
      select c.organization_id into o_organization_id from public.control c where c.id = (v_state ->> 'control_id')::uuid;
    elsif p_entity_type = 'capa' then
      select i.organization_id into o_organization_id from public.incident i where i.id = (v_state ->> 'incident_id')::uuid;
    elsif p_entity_type in ('impact_finding', 'impact_stakeholder') then
      select ia.organization_id into o_organization_id from public.impact_assessment ia where ia.id = (v_state ->> 'impact_assessment_id')::uuid;
    elsif p_entity_type = 'decision_link' then
      select d.organization_id into o_organization_id from public.governance_decision d where d.id = (v_state ->> 'decision_id')::uuid;
    elsif p_entity_type = 'risk_treatment' then
      select r.organization_id into o_organization_id from public.risk r where r.id = (v_state ->> 'risk_id')::uuid;
    elsif p_entity_type = 'reassessment' then
      select c.organization_id into o_organization_id from public.change_request c where c.id = (v_state ->> 'change_request_id')::uuid;
    end if;
  end if;
end;
$$;

comment on function app.audit_locate is
  'Situe une entrée de journal : organisation et cas d''usage, lus dans l''état journalisé ou par la ligne parente.';

create or replace function app.audit_log_locate()
returns trigger
language plpgsql
security definer
set search_path = app, public, pg_catalog
as $$
declare v record;
begin
  if new.organization_id is not null and new.use_case_id is not null then return new; end if;
  select * into v from app.audit_locate(new.entity_type, new.entity_id, coalesce(new.after_state, new.before_state), new.metadata);
  new.organization_id := coalesce(new.organization_id, v.o_organization_id);
  new.use_case_id := coalesce(new.use_case_id, v.o_use_case_id);
  return new;
end;
$$;

create trigger audit_log_locate before insert on public.audit_log
  for each row execute function app.audit_log_locate();

-- Les entrées existantes se situent une fois. Le garde interdit toute
-- modification : on l'écarte pour ce seul complément, qui ne touche ni au
-- fait, ni à l'auteur, ni à l'heure, ni aux états.
alter table public.audit_log disable trigger audit_log_immutable;

update public.audit_log a
   set organization_id = (app.audit_locate(a.entity_type, a.entity_id, coalesce(a.after_state, a.before_state), a.metadata)).o_organization_id,
       use_case_id = (app.audit_locate(a.entity_type, a.entity_id, coalesce(a.after_state, a.before_state), a.metadata)).o_use_case_id
 where a.organization_id is null and a.use_case_id is null;

alter table public.audit_log enable trigger audit_log_immutable;

-- La lecture paginée sait désormais se restreindre à une organisation et à
-- un cas d'usage. Même fonction pour l'écran et l'export.
drop function if exists public.audit_log_page(timestamptz, timestamptz, text, text, text, text, integer, integer);

create or replace function public.audit_log_page(
  p_since           timestamptz default null,
  p_until           timestamptz default null,
  p_action          text        default null,
  p_entity_type     text        default null,
  p_actor           text        default null,
  p_search          text        default null,
  p_limit           integer     default 200,
  p_offset          integer     default 0,
  p_organization_id uuid        default null,
  p_use_case_id     uuid        default null,
  p_actions         text[]      default null
)
returns setof public.audit_log
language sql
stable
security invoker
set search_path = app, public, pg_catalog
as $$
  select *
  from public.audit_log a
  where (p_since is null or a.occurred_at >= p_since)
    and (p_until is null or a.occurred_at < p_until)
    and (p_action is null or a.action::text = p_action)
    and (p_actions is null or a.action::text = any (p_actions))
    and (p_entity_type is null or a.entity_type = p_entity_type)
    and (p_actor is null or a.actor_email ilike '%' || p_actor || '%')
    and (p_organization_id is null or a.organization_id = p_organization_id)
    and (p_use_case_id is null or a.use_case_id = p_use_case_id)
    and (p_search is null
         or a.summary ilike '%' || p_search || '%'
         or a.entity_ref ilike '%' || p_search || '%')
  order by a.occurred_at desc, a.id desc
  limit least(greatest(p_limit, 1), 5000)
  offset greatest(p_offset, 0);
$$;

grant execute on function public.audit_log_page(timestamptz, timestamptz, text, text, text, text, integer, integer, uuid, uuid, text[])
  to authenticated;

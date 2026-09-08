-- =============================================================================
-- AIGMS — 0023 — Correspondances et Déclaration d'Applicabilité
-- =============================================================================
-- Deux apports :
--
-- 1. Une correspondance SUGGÉRÉE entre les domaines du catalogue AIGMS et les
--    objectifs de contrôle de l'Annexe A. Au niveau du domaine, pas du contrôle
--    individuel : proposer 120 × N correspondances automatiques produirait du
--    bruit qu'il faudrait ensuite démêler. Le rapprochement fin reste un acte
--    humain, tracé par `control_requirement_map`.
--
-- 2. La Déclaration d'Applicabilité — le document qu'un auditeur ouvre en
--    premier. Elle se construit à partir de ce qui existe déjà : les contrôles
--    de l'organisation, leur applicabilité et leurs correspondances.
-- =============================================================================

-- -----------------------------------------------------------------------------
-- Correspondance suggérée domaine → objectif de contrôle
-- -----------------------------------------------------------------------------
create table public.catalog_domain_objective_map (
  id                uuid primary key default gen_random_uuid(),
  domain_code       text not null check (domain_code ~ '^[A-Z]{2,8}$'),
  framework_code    text not null,
  framework_version text not null,
  objective_code    text not null,
  rationale         text not null check (btrim(rationale) <> ''),
  created_at        timestamptz not null default now(),
  unique (domain_code, framework_code, framework_version, objective_code)
);

comment on table public.catalog_domain_objective_map is
  'Correspondance suggérée entre un domaine du catalogue AIGMS et un objectif de contrôle normatif. Une aide au cadrage : elle oriente le rapprochement, elle ne le remplace pas.';

alter table public.catalog_domain_objective_map enable row level security;
alter table public.catalog_domain_objective_map force  row level security;

create policy catalog_domain_objective_map_select on public.catalog_domain_objective_map
  for select to authenticated using (true);

create policy catalog_domain_objective_map_write on public.catalog_domain_objective_map
  for all to authenticated
  using (app.is_platform_admin()) with check (app.is_platform_admin());

grant select, insert, update, delete on public.catalog_domain_objective_map to authenticated;
revoke all on public.catalog_domain_objective_map from anon;

insert into public.catalog_domain_objective_map
  (domain_code, framework_code, framework_version, objective_code, rationale)
values
  ('GOV', 'ISO_IEC_42001', '2023', 'A.2',  'La gouvernance porte la politique d''IA, son articulation avec les autres politiques et son réexamen.'),
  ('GOV', 'ISO_IEC_42001', '2023', 'A.3',  'Elle attribue les rôles et ouvre la voie de signalement.'),
  ('INV', 'ISO_IEC_42001', '2023', 'A.4',  'L''inventaire recense les ressources dont dépendent les systèmes : données, outillage, calcul, compétences.'),
  ('USE', 'ISO_IEC_42001', '2023', 'A.9',  'La gestion des cas d''usage définit l''usage prévu et encadre l''emploi réel.'),
  ('RSK', 'ISO_IEC_42001', '2023', 'A.5',  'Le management du risque conduit et documente les évaluations d''impact.'),
  ('DAT', 'ISO_IEC_42001', '2023', 'A.7',  'La gouvernance des données couvre acquisition, qualité, provenance et préparation.'),
  ('SEC', 'ISO_IEC_42001', '2023', 'A.6',  'La sécurité intervient dans le cycle de vie : spécification, validation, journalisation.'),
  ('SEC', 'ISO_IEC_42001', '2023', 'A.4',  'Elle encadre aussi les ressources système et de calcul.'),
  ('SUP', 'ISO_IEC_42001', '2023', 'A.10', 'La gestion des fournisseurs et des modèles tiers relève des relations avec les tiers.'),
  ('HUM', 'ISO_IEC_42001', '2023', 'A.9',  'La supervision humaine encadre l''utilisation responsable.'),
  ('HUM', 'ISO_IEC_42001', '2023', 'A.3',  'Elle nomme les responsables et leurs prérogatives.'),
  ('OPS', 'ISO_IEC_42001', '2023', 'A.6',  'L''exploitation couvre déploiement, surveillance et documentation technique.'),
  ('MON', 'ISO_IEC_42001', '2023', 'A.6',  'La surveillance de la performance relève de l''exploitation du cycle de vie.'),
  ('INC', 'ISO_IEC_42001', '2023', 'A.8',  'La gestion des incidents porte leur communication aux parties concernées.'),
  ('CMP', 'ISO_IEC_42001', '2023', 'A.2',  'L''assurance conformité vérifie que la politique est appliquée et réexaminée.'),
  ('CMP', 'ISO_IEC_42001', '2023', 'A.8',  'Elle porte l''information due aux parties intéressées.');

-- -----------------------------------------------------------------------------
-- Déclaration d'Applicabilité
-- -----------------------------------------------------------------------------
-- Pour une organisation et un référentiel, l'état de couverture exigence par
-- exigence : quels contrôles la servent, dans quel état, et — lorsqu'elle n'est
-- couverte par rien — le dire franchement plutôt que de laisser une ligne vide.
-- -----------------------------------------------------------------------------
create or replace function app.statement_of_applicability(
  p_organization_id uuid,
  p_framework_code  text default 'ISO_IEC_42001',
  p_framework_version text default '2023'
)
returns table (
  objective_code   text,
  objective_title  text,
  requirement_reference text,
  requirement_title     text,
  internal_summary      text,
  expected_evidence     text,
  display_order         integer,
  control_count         integer,
  operating_count       integer,
  evidence_count        integer,
  controls              jsonb,
  coverage              text
)
language sql
stable
security definer
set search_path = app, public, pg_catalog
as $$
  with scope as (
    select o.id as organization_id, o.tenant_id
    from public.organization o
    where o.id = p_organization_id
      and app.has_tenant_access(o.tenant_id)
  ),
  reqs as (
    select r.id, r.objective_code, r.objective_title, r.requirement_reference,
           r.title, r.internal_summary, r.expected_evidence, r.display_order
    from public.requirement r
    join public.framework f on f.id = r.framework_id
    where f.code = p_framework_code
      and f.version = p_framework_version
      and r.objective_code is not null
  ),
  linked as (
    select m.requirement_id,
           c.id as control_id, c.code, c.name, c.status, c.is_mandatory,
           (select count(*) from public.control_evidence ce where ce.control_id = c.id) as evidences
    from public.control_requirement_map m
    join public.control c on c.id = m.control_id
    join scope s on s.organization_id = c.organization_id
  )
  select
    reqs.objective_code,
    reqs.objective_title,
    reqs.requirement_reference,
    reqs.title,
    reqs.internal_summary,
    reqs.expected_evidence,
    reqs.display_order,
    coalesce(count(linked.control_id), 0)::integer,
    coalesce(count(linked.control_id) filter (where linked.status = 'operating'), 0)::integer,
    coalesce(sum(linked.evidences), 0)::integer,
    coalesce(
      jsonb_agg(
        jsonb_build_object(
          'code', linked.code, 'name', linked.name,
          'status', linked.status, 'is_mandatory', linked.is_mandatory,
          'evidences', linked.evidences
        ) order by linked.code
      ) filter (where linked.control_id is not null),
      '[]'::jsonb
    ),
    case
      when count(linked.control_id) = 0 then 'uncovered'
      when count(linked.control_id) filter (where linked.status = 'operating') = 0 then 'declared'
      when sum(linked.evidences) = 0 then 'operating_without_evidence'
      else 'evidenced'
    end
  from reqs
  left join linked on linked.requirement_id = reqs.id
  group by reqs.objective_code, reqs.objective_title, reqs.requirement_reference,
           reqs.title, reqs.internal_summary, reqs.expected_evidence, reqs.display_order
  order by reqs.display_order;
$$;

comment on function app.statement_of_applicability is
  'Déclaration d''Applicabilité : couverture exigence par exigence pour une organisation. Quatre états — non couverte, contrôle déclaré, contrôle opérant sans preuve, couverte et prouvée.';

create or replace function public.statement_of_applicability(
  p_organization_id uuid,
  p_framework_code  text default 'ISO_IEC_42001',
  p_framework_version text default '2023'
)
returns table (
  objective_code text, objective_title text, requirement_reference text,
  requirement_title text, internal_summary text, expected_evidence text,
  display_order integer, control_count integer, operating_count integer,
  evidence_count integer, controls jsonb, coverage text
)
language sql stable security invoker
set search_path = app, public, pg_catalog
as $$
  select * from app.statement_of_applicability(p_organization_id, p_framework_code, p_framework_version);
$$;

revoke all on function public.statement_of_applicability(uuid, text, text) from public, anon;
grant execute on function public.statement_of_applicability(uuid, text, text) to authenticated;

-- =============================================================================
-- AIGMS — 0029 — Matrice des preuves et profil d'activité
-- =============================================================================
-- FICHIER GÉNÉRÉ — ne pas modifier à la main.
--   Source    : knowledge/frameworks/aigms/evidence-matrix/v1/matrice-preuves.json
--   Générateur: scripts/generate-evidence-matrix.mjs
--   Vérifié   : tests/rls/evidence-matrix.test.ts
--
-- Une organisation n'a pas les mêmes preuves à produire selon ce qu'elle fait
-- de l'IA. Un hébergeur doit démontrer l'isolation de ses calculs et son
-- empreinte énergétique ; il n'a rien à dire sur l'équité d'un modèle qu'il
-- n'entraîne pas. Un utilisateur métier, à l'inverse, répond de la dérive du
-- système qu'il exploite, pas de son alignement.
--
-- La matrice porte cette différence : 8 typologies de preuves × 4 profils
-- d'activité, chaque case donnant un niveau de criticité. De ce niveau
-- découle ce que la Déclaration d'Applicabilité exige — preuve technique,
-- preuve organisationnelle, ou justification formelle d'exclusion.
--
-- Les niveaux de criticité et les références normatives sont ceux de la matrice source. Les résumés techniques sont rédigés en propre. Une relecture humaine est un préalable à tout usage commercial.
-- =============================================================================

-- -----------------------------------------------------------------------------
-- Profil d'activité de l'organisation
-- -----------------------------------------------------------------------------
create type app.ai_activity_profile as enum (
  'infrastructure_host', 'model_developer', 'integrator_consultant', 'business_user');

comment on type app.ai_activity_profile is
  'infrastructure_host : Fournit la capacité de calcul et l''hébergement. Ne conçoit ni n''entraîne de modèle. | model_developer : Conçoit, entraîne, évalue et publie des modèles ou des systèmes d''IA. | integrator_consultant : Assemble, paramètre et déploie des systèmes d''IA pour le compte de tiers. | business_user : Exploite des systèmes d''IA acquis auprès de tiers dans ses propres processus.';

alter table public.organization
  add column ai_activity_profile app.ai_activity_profile;

comment on column public.organization.ai_activity_profile is
  'Role de l''organisation vis-a-vis de l''IA, au sens d''ISO/IEC 42001. Determine les typologies de preuves attendues et leur criticite. Nul tant qu''il n''est pas renseigne : toutes les typologies sont alors proposees, et l''ecran le signale plutot que de supposer un profil.';

-- -----------------------------------------------------------------------------
-- Criticité
-- -----------------------------------------------------------------------------
-- L'ordre de l'enum porte la hiérarchie : max() sur plusieurs typologies rend
-- la plus exigeante, ce qui est la lecture prudente.
create type app.evidence_criticality as enum (
  'negligible', 'low', 'moderate', 'high', 'critical');

-- -----------------------------------------------------------------------------
-- Typologies de preuves
-- -----------------------------------------------------------------------------
create table public.evidence_typology (
  id                    uuid primary key default gen_random_uuid(),
  code                  text not null unique,
  ordinal               integer not null,
  name                  text not null check (btrim(name) <> ''),
  technical_description text not null check (btrim(technical_description) <> ''),
  deliverables          text[] not null check (cardinality(deliverables) > 0),
  review_status         text not null default 'to_review'
                          check (review_status in ('to_review', 'reviewed')),
  created_at            timestamptz not null default now()
);

comment on table public.evidence_typology is
  'Typologie de preuve technique. Les resumes sont rediges en propre et portent review_status = to_review : une interpretation engage vis-a-vis d''un client ou d''un auditeur.';

create table public.evidence_typology_profile (
  typology_id  uuid not null references public.evidence_typology (id) on delete cascade,
  profile      app.ai_activity_profile not null,
  criticality  app.evidence_criticality not null,
  primary key (typology_id, profile)
);

comment on table public.evidence_typology_profile is
  'Criticite d''une typologie pour un profil d''activite. C''est la matrice elle-meme.';

create table public.evidence_typology_reference (
  typology_id       uuid not null references public.evidence_typology (id) on delete cascade,
  framework_code    text not null,
  framework_version text not null,
  reference         text not null,
  primary key (typology_id, framework_code, framework_version, reference)
);

comment on table public.evidence_typology_reference is
  'Reference normative citee par la matrice. Conservee telle qu''enoncee : elle se resout par jointure sur requirement, et app.evidence_matrix_gaps() nomme celles qui ne se resolvent pas.';

alter table public.evidence_typology enable row level security;
alter table public.evidence_typology force  row level security;
create policy evidence_typology_select on public.evidence_typology
  for select to authenticated using (true);
create policy evidence_typology_write on public.evidence_typology
  for all to authenticated
  using (app.is_platform_admin()) with check (app.is_platform_admin());
grant select, insert, update, delete on public.evidence_typology to authenticated;
revoke all on public.evidence_typology from anon;

alter table public.evidence_typology_profile enable row level security;
alter table public.evidence_typology_profile force  row level security;
create policy evidence_typology_profile_select on public.evidence_typology_profile
  for select to authenticated using (true);
create policy evidence_typology_profile_write on public.evidence_typology_profile
  for all to authenticated
  using (app.is_platform_admin()) with check (app.is_platform_admin());
grant select, insert, update, delete on public.evidence_typology_profile to authenticated;
revoke all on public.evidence_typology_profile from anon;

alter table public.evidence_typology_reference enable row level security;
alter table public.evidence_typology_reference force  row level security;
create policy evidence_typology_reference_select on public.evidence_typology_reference
  for select to authenticated using (true);
create policy evidence_typology_reference_write on public.evidence_typology_reference
  for all to authenticated
  using (app.is_platform_admin()) with check (app.is_platform_admin());
grant select, insert, update, delete on public.evidence_typology_reference to authenticated;
revoke all on public.evidence_typology_reference from anon;

-- -----------------------------------------------------------------------------
-- Contenu de la matrice
-- -----------------------------------------------------------------------------
insert into public.evidence_typology (code, ordinal, name, technical_description, deliverables) values
  ('ISOL', 1, 'Isolation et souveraineté physique (multi-tenancy IA)',
   'Isolation des calculs, absence de contamination croisée des caches, cloisonnement réseau et effacement obligatoire de la VRAM entre sessions clients.',
   array['Fichiers YAML Kubernetes (NetworkPolicies, namespaces, taints/tolerations GPU)', 'Scripts Terraform', 'Logs JSON horodatés d''exécution de purge GPU (nvidia-smi --gpu-reset)']::text[]),
  ('INTG', 2, 'Intégrité des données et des systèmes (anti-empoisonnement)',
   'Protection contre l''altération ou la modification non autorisée des jeux de données d''entraînement et des points de reprise de modèles. Intégrité des pilotes bas niveau.',
   array['Registre d''empreintes cryptographiques SHA-256 des jeux de données, dans une base immuable', 'Rapports d''intégrité de démarrage matériel (Secure Boot, valeurs TPM PCR)']::text[]),
  ('FAIR', 3, 'Éthique, biais et équité algorithmique',
   'Mesure statistique de la disparité des résultats et évaluation de la représentativité des données au regard des variables protégées, contre les biais discriminatoires.',
   array['Rapports JSON d''outils d''équité (AIF360, Fairlearn) avec métriques Disparate Impact Ratio et Equalized Odds', 'Fiches d''identité standardisées Model Cards / Data Cards']::text[]),
  ('XAI', 4, 'Explicabilité et transparence (XAI)',
   'Enregistrement des logiques d''attribution de caractéristiques, pour documenter et rendre auditable chaque décision ou prédiction critique du système.',
   array['Charges utiles d''API conservant les vecteurs SHAP ou LIME', 'Logs système des chaînes RAG traçant l''origine des extraits injectés (scores de similarité cosinus)']::text[]),
  ('ALIGN', 5, 'Alignement, garde-fous et validation du modèle',
   'Évaluations et contrôles menés pour valider la sécurité logique du modèle et s''assurer qu''il reste confiné dans ses paramètres, hallucinations comprises.',
   array['Rapports de scores de bancs d''essai automatisés (MMLU, AdvGLUE)', 'Registres immuables d''annotations et de corrections issus des boucles de validation humaine (RLHF)']::text[]),
  ('CYBER', 6, 'Cybersécurité spécifique à l''IA',
   'Journalisation des mécanismes bloquant les attaques propres aux modèles d''IA : injection de consignes, contournement des garde-fous, extraction de modèle, déni de service par consommation de jetons.',
   array['Flux Syslog/CEF d''une passerelle de sécurité IA capturant les attaques', 'Rapports de campagnes de simulation d''attaques adverses (red teaming IA)']::text[]),
  ('DRIFT', 7, 'Surveillance continue et dérive',
   'Détection précoce de la dégradation des performances due aux dérives statistiques des données de production, et suivi des interventions humaines de correction.',
   array['Alertes automatisées d''outils de surveillance (Evidently AI, Whylogs) mesurant la dérive (test de Kolmogorov-Smirnov)', 'Journaux d''audit des arbitrages humains (human override)']::text[]),
  ('GREEN', 8, 'Empreinte environnementale',
   'Mesure et historisation de la consommation électrique et de l''efficience énergétique des infrastructures pendant les tâches de calcul intensives.',
   array['Séries temporelles Prometheus/Grafana issues de l''interface NVML ou d''agents libres (Scaphandre)', 'Rapports automatisés d''équivalents CO2 par conteneur ou par tâche']::text[]);

insert into public.evidence_typology_profile (typology_id, profile, criticality)
select t.id, v.profile::app.ai_activity_profile, v.criticality::app.evidence_criticality
from (values
  ('ISOL', 'infrastructure_host', 'critical'),
  ('ISOL', 'model_developer', 'critical'),
  ('ISOL', 'integrator_consultant', 'low'),
  ('ISOL', 'business_user', 'low'),
  ('INTG', 'infrastructure_host', 'moderate'),
  ('INTG', 'model_developer', 'critical'),
  ('INTG', 'integrator_consultant', 'moderate'),
  ('INTG', 'business_user', 'low'),
  ('FAIR', 'infrastructure_host', 'negligible'),
  ('FAIR', 'model_developer', 'critical'),
  ('FAIR', 'integrator_consultant', 'high'),
  ('FAIR', 'business_user', 'low'),
  ('XAI', 'infrastructure_host', 'negligible'),
  ('XAI', 'model_developer', 'critical'),
  ('XAI', 'integrator_consultant', 'high'),
  ('XAI', 'business_user', 'moderate'),
  ('ALIGN', 'infrastructure_host', 'negligible'),
  ('ALIGN', 'model_developer', 'critical'),
  ('ALIGN', 'integrator_consultant', 'high'),
  ('ALIGN', 'business_user', 'low'),
  ('CYBER', 'infrastructure_host', 'high'),
  ('CYBER', 'model_developer', 'critical'),
  ('CYBER', 'integrator_consultant', 'moderate'),
  ('CYBER', 'business_user', 'moderate'),
  ('DRIFT', 'infrastructure_host', 'negligible'),
  ('DRIFT', 'model_developer', 'critical'),
  ('DRIFT', 'integrator_consultant', 'moderate'),
  ('DRIFT', 'business_user', 'critical'),
  ('GREEN', 'infrastructure_host', 'critical'),
  ('GREEN', 'model_developer', 'moderate'),
  ('GREEN', 'integrator_consultant', 'low'),
  ('GREEN', 'business_user', 'low')
) as v(code, profile, criticality)
join public.evidence_typology t on t.code = v.code;

insert into public.evidence_typology_reference (typology_id, framework_code, framework_version, reference)
select t.id, v.framework, v.version, v.reference
from (values
  ('ISOL', 'ISO_IEC_42001', '2023', 'A.7.3'),
  ('ISOL', 'ISO_IEC_42001', '2023', 'A.7.4'),
  ('ISOL', 'ISO_IEC_27001', '2022', 'A.11'),
  ('ISOL', 'ISO_IEC_27001', '2022', 'A.12'),
  ('INTG', 'ISO_IEC_42001', '2023', 'A.7.2'),
  ('INTG', 'ISO_IEC_42001', '2023', 'A.7.5'),
  ('INTG', 'EU_AI_ACT', '2024/1689', 'Art. 10'),
  ('FAIR', 'ISO_IEC_42001', '2023', 'A.7.2'),
  ('FAIR', 'EU_AI_ACT', '2024/1689', 'Art. 10'),
  ('XAI', 'ISO_IEC_42001', '2023', 'A.10.2'),
  ('XAI', 'ISO_IEC_42001', '2023', 'A.10.4'),
  ('XAI', 'EU_AI_ACT', '2024/1689', 'Art. 13'),
  ('ALIGN', 'ISO_IEC_42001', '2023', '6.1.2'),
  ('ALIGN', 'EU_AI_ACT', '2024/1689', 'Sécurité IA'),
  ('CYBER', 'ISO_IEC_42001', '2023', 'A.6.2.2'),
  ('CYBER', 'ISO_IEC_42001', '2023', 'A.6.2.3'),
  ('CYBER', 'EU_AI_ACT', '2024/1689', 'Art. 15'),
  ('DRIFT', 'ISO_IEC_42001', '2023', 'A.10.5'),
  ('DRIFT', 'ISO_IEC_42001', '2023', 'A.10.6'),
  ('DRIFT', 'EU_AI_ACT', '2024/1689', 'Art. 14'),
  ('DRIFT', 'EU_AI_ACT', '2024/1689', 'Art. 61'),
  ('GREEN', 'ISO_IEC_42001', '2023', 'A.8.4'),
  ('GREEN', 'EU_AI_ACT', '2024/1689', 'Art. 40')
) as v(code, framework, version, reference)
join public.evidence_typology t on t.code = v.code;

-- -----------------------------------------------------------------------------
-- La preuve porte sa typologie
-- -----------------------------------------------------------------------------
alter table public.evidence
  add column typology_id uuid references public.evidence_typology (id) on delete set null;

comment on column public.evidence.typology_id is
  'Typologie de preuve de la matrice. Nulle sur une piece qui n''en releve d''aucune : la matrice couvre la preuve technique, pas tout le dossier de gouvernance.';

create index evidence_typology_idx on public.evidence (typology_id) where typology_id is not null;

-- -----------------------------------------------------------------------------
-- Profil d'activité, sous habilitation
-- -----------------------------------------------------------------------------
create or replace function app.organization_profile(p_organization_id uuid)
returns app.ai_activity_profile
language sql
stable
security definer
set search_path = app, public, pg_catalog
as $$
  select o.ai_activity_profile
  from public.organization o
  where o.id = p_organization_id
    and app.has_tenant_access(o.tenant_id);
$$;

comment on function app.organization_profile is
  'Profil d''activite d''une organisation, sous habilitation. Rend null si le profil n''est pas renseigne comme si l''organisation est hors perimetre : dans les deux cas, rien n''est presume.';

-- -----------------------------------------------------------------------------
-- Typologies attendues d'une organisation
-- -----------------------------------------------------------------------------
-- Ordonnées par criticité décroissante : ce qui pèse le plus sur ce profil se
-- propose en premier. Sans profil renseigné, toutes les typologies sont rendues
-- sans criticité — l'écran le dit, il ne suppose pas.
create or replace function app.evidence_typologies(p_organization_id uuid)
returns table (
  id                    uuid,
  code                  text,
  ordinal               integer,
  name                  text,
  technical_description text,
  deliverables          text[],
  normative_references  text[],
  criticality           app.evidence_criticality,
  profile               app.ai_activity_profile
)
language sql
stable
security definer
set search_path = app, public, pg_catalog
as $$
  with p as (select app.organization_profile(p_organization_id) as profile)
  select
    t.id, t.code, t.ordinal, t.name, t.technical_description, t.deliverables,
    coalesce((
      select array_agg(tr.framework_code || ' ' || tr.reference order by tr.framework_code, tr.reference)
      from public.evidence_typology_reference tr
      where tr.typology_id = t.id
    ), array[]::text[]),
    tp.criticality,
    p.profile
  from public.evidence_typology t
  cross join p
  left join public.evidence_typology_profile tp
    on tp.typology_id = t.id and tp.profile = p.profile
  where exists (
    select 1 from public.organization o
    where o.id = p_organization_id and app.has_tenant_access(o.tenant_id)
  )
  order by
    case tp.criticality
      when 'critical'   then 1
      when 'high'       then 2
      when 'moderate'   then 3
      when 'low'        then 4
      when 'negligible' then 5
      else 6
    end,
    t.ordinal;
$$;

comment on function app.evidence_typologies is
  'Typologies de preuves attendues d''une organisation, les plus critiques pour son profil en tete.';

-- -----------------------------------------------------------------------------
-- Références de la matrice qui ne se résolvent pas
-- -----------------------------------------------------------------------------
-- La matrice cite des articles que le référentiel chargé ne porte pas encore.
-- Les taire produirait une Déclaration d'Applicabilité qui semble complète en
-- omettant ce qu'elle ne sait pas rapprocher. On les nomme.
create or replace function app.evidence_matrix_gaps()
returns table (
  typology_code     text,
  typology_name     text,
  framework_code    text,
  framework_version text,
  reference         text
)
language sql
stable
security definer
set search_path = app, public, pg_catalog
as $$
  select t.code, t.name, tr.framework_code, tr.framework_version, tr.reference
  from public.evidence_typology_reference tr
  join public.evidence_typology t on t.id = tr.typology_id
  where not exists (
    select 1
    from public.requirement r
    join public.framework f on f.id = r.framework_id
    where f.code = tr.framework_code
      and f.version = tr.framework_version
      and r.requirement_reference = tr.reference
  )
  order by t.ordinal, tr.framework_code, tr.reference;
$$;

comment on function app.evidence_matrix_gaps is
  'References normatives citees par la matrice et absentes du referentiel charge. Une Declaration d''Applicabilite qui les tairait paraitrait complete en omettant ce qu''elle ne sait pas rapprocher.';

-- -----------------------------------------------------------------------------
-- Décision de la Déclaration d'Applicabilité
-- -----------------------------------------------------------------------------
-- La règle d'or d'ISO/IEC 42001 : aucune case vide. Une exigence de l'Annexe A
-- est SÉLECTIONNÉE ou EXCLUE, jamais ignorée, et les deux appellent une
-- justification écrite. C'est la contrainte `not null` sur `justification` qui
-- porte cette règle, pas un contrôle d'écran.
create type app.soa_status as enum ('selected', 'excluded');

create table public.soa_decision (
  id              uuid primary key default gen_random_uuid(),
  tenant_id       uuid not null references public.tenant (id) on delete cascade,
  organization_id uuid not null references public.organization (id) on delete cascade,
  requirement_id  uuid not null references public.requirement (id) on delete cascade,
  status          app.soa_status not null,
  justification   text not null check (btrim(justification) <> ''),
  decided_by      uuid references public.user_profile (id) on delete set null,
  decided_at      timestamptz not null default now(),
  created_at      timestamptz not null default now(),
  updated_at      timestamptz not null default now(),
  unique (organization_id, requirement_id)
);

comment on table public.soa_decision is
  'Decision de Declaration d''Applicabilite, exigence par exigence. Selectionnee ou exclue, et dans les deux cas justifiee : c''est la regle d''or d''ISO/IEC 42001, portee par une contrainte et non par un ecran.';

create index soa_decision_org_idx on public.soa_decision (organization_id, status);

create trigger soa_decision_touch_updated_at before update on public.soa_decision
  for each row execute function app.touch_updated_at();
create trigger soa_decision_assert_tenant before insert or update on public.soa_decision
  for each row execute function app.assert_tenant_consistency();

create or replace function app.guard_soa_decision()
returns trigger
language plpgsql
security definer
set search_path = app, public, pg_catalog
as $$
begin
  -- Une declaration engage celui qui la porte : on decide en son propre nom.
  if new.decided_by is distinct from app.current_user_id() then
    raise exception 'Une décision d''applicabilité se prend en son propre nom.'
      using errcode = 'check_violation';
  end if;
  new.decided_at := now();
  return new;
end;
$$;

create trigger soa_decision_guard before insert or update on public.soa_decision
  for each row execute function app.guard_soa_decision();

create or replace function app.audit_soa_decision()
returns trigger
language plpgsql
security definer
set search_path = app, public, pg_catalog
as $$
declare
  v_reference text;
begin
  select r.requirement_reference into v_reference
  from public.requirement r where r.id = new.requirement_id;

  perform app.log_audit(
    new.tenant_id, 'update', 'soa_decision', new.id, v_reference,
    format('Exigence %s %s', v_reference,
           case new.status when 'selected' then 'sélectionnée' else 'exclue' end),
    case when tg_op = 'UPDATE'
         then jsonb_build_object('status', old.status, 'justification', old.justification)
         else null end,
    jsonb_build_object('status', new.status, 'justification', new.justification));
  return new;
end;
$$;

create trigger soa_decision_audit after insert or update on public.soa_decision
  for each row execute function app.audit_soa_decision();

alter table public.soa_decision enable row level security;
alter table public.soa_decision force  row level security;

create policy soa_decision_select on public.soa_decision
  for select to authenticated
  using (app.has_tenant_access(tenant_id));

create policy soa_decision_write on public.soa_decision
  for all to authenticated
  using (app.has_tenant_role(tenant_id, app.roles_write_governance()))
  with check (app.has_tenant_role(tenant_id, app.roles_write_governance()));

grant select, insert, update, delete on public.soa_decision to authenticated;
revoke all on public.soa_decision from anon;

-- -----------------------------------------------------------------------------
-- Déclaration d'Applicabilité, ajustée à la criticité
-- -----------------------------------------------------------------------------
-- Le niveau de criticité attendu pour le profil de l'organisation détermine ce
-- que la Déclaration exige :
--
--   critique / élevé  -> preuve TECHNIQUE : un contrôle opérant et prouvé ;
--   modéré / faible   -> preuve ORGANISATIONNELLE : politique, clause, procédure ;
--   négligeable       -> EXCLUSION formelle, motivée par le profil d'activité.
--
-- Ce que la fonction ne fait pas : décider à la place de quiconque. Elle dit ce
-- qui est attendu, ce qui est déclaré, et où les deux s'écartent.
-- -----------------------------------------------------------------------------
drop function if exists public.statement_of_applicability(uuid, text, text);
drop function if exists app.statement_of_applicability(uuid, text, text);

create or replace function app.statement_of_applicability(
  p_organization_id uuid,
  p_framework_code  text default 'ISO_IEC_42001',
  p_framework_version text default '2023'
)
returns table (
  objective_code        text,
  objective_title       text,
  requirement_reference text,
  requirement_title     text,
  internal_summary      text,
  expected_evidence     text,
  display_order         integer,
  control_count         integer,
  operating_count       integer,
  evidence_count        integer,
  controls              jsonb,
  coverage              text,
  expected_criticality  app.evidence_criticality,
  evidence_regime       text,
  typologies            jsonb,
  soa_status            app.soa_status,
  soa_justification     text,
  decided_by_name       text,
  gap                   text
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
  prof as (select app.organization_profile(p_organization_id) as profile),
  reqs as (
    select r.id, r.objective_code, r.objective_title, r.requirement_reference,
           r.title, r.internal_summary, r.expected_evidence, r.display_order
    from public.requirement r
    join public.framework f on f.id = r.framework_id
    where f.code = p_framework_code
      and f.version = p_framework_version
      and r.objective_code is not null
      -- Le referentiel est une donnee publique, mais la Declaration ne l'est
      -- pas : elle porte desormais les justifications d'inclusion et
      -- d'exclusion du client. La fonction etant SECURITY DEFINER, la RLS ne
      -- s'applique pas ; l'habilitation se verifie donc ici, en tete, et rien
      -- ne sort du perimetre du tenant.
      and exists (select 1 from scope)
  ),
  linked as (
    select m.requirement_id,
           c.id as control_id, c.code, c.name, c.status, c.is_mandatory,
           (select count(*) from public.control_evidence ce where ce.control_id = c.id) as evidences
    from public.control_requirement_map m
    join public.control c on c.id = m.control_id
    join scope s on s.organization_id = c.organization_id
  ),
  -- Typologies de la matrice qui touchent cette exigence, avec la criticité
  -- du profil de l'organisation.
  typo as (
    select
      reqs.id as requirement_id,
      max(tp.criticality) as expected,
      jsonb_agg(distinct jsonb_build_object(
        'code', t.code, 'name', t.name, 'criticality', tp.criticality))
        filter (where t.id is not null) as items
    from reqs
    join public.evidence_typology_reference tr
      on tr.framework_code = p_framework_code
     and tr.framework_version = p_framework_version
     and tr.reference = reqs.requirement_reference
    join public.evidence_typology t on t.id = tr.typology_id
    cross join prof
    left join public.evidence_typology_profile tp
      on tp.typology_id = t.id and tp.profile = prof.profile
    group by reqs.id
  ),
  cov as (
    select
      reqs.id as requirement_id,
      reqs.objective_code, reqs.objective_title, reqs.requirement_reference,
      reqs.title, reqs.internal_summary, reqs.expected_evidence, reqs.display_order,
      coalesce(count(linked.control_id), 0)::integer as control_count,
      coalesce(count(linked.control_id) filter (where linked.status = 'operating'), 0)::integer as operating_count,
      coalesce(sum(linked.evidences), 0)::integer as evidence_count,
      coalesce(
        jsonb_agg(
          jsonb_build_object(
            'code', linked.code, 'name', linked.name,
            'status', linked.status, 'is_mandatory', linked.is_mandatory,
            'evidences', linked.evidences
          ) order by linked.code
        ) filter (where linked.control_id is not null),
        '[]'::jsonb) as controls,
      case
        when count(linked.control_id) = 0 then 'uncovered'
        when count(linked.control_id) filter (where linked.status = 'operating') = 0 then 'declared'
        when sum(linked.evidences) = 0 then 'operating_without_evidence'
        else 'evidenced'
      end as coverage
    from reqs
    left join linked on linked.requirement_id = reqs.id
    group by reqs.id, reqs.objective_code, reqs.objective_title, reqs.requirement_reference,
             reqs.title, reqs.internal_summary, reqs.expected_evidence, reqs.display_order
  ),
  judged as (
    select
      cov.*,
      typo.expected,
      coalesce(typo.items, '[]'::jsonb) as typologies,
      d.status as soa_status,
      d.justification as soa_justification,
      coalesce(u.full_name, u.email) as decided_by_name,
      case
        when (select profile from prof) is null then 'unspecified'
        when typo.expected in ('critical', 'high')     then 'technical'
        when typo.expected in ('moderate', 'low')      then 'organisational'
        when typo.expected = 'negligible'              then 'exclusion'
        else 'unspecified'
      end as regime
    from cov
    left join typo on typo.requirement_id = cov.requirement_id
    left join public.soa_decision d
      on d.requirement_id = cov.requirement_id
     and d.organization_id = p_organization_id
    left join public.user_profile u on u.id = d.decided_by
  )
  select
    objective_code, objective_title, requirement_reference, title,
    internal_summary, expected_evidence, display_order,
    control_count, operating_count, evidence_count, controls, coverage,
    expected, regime, typologies, soa_status, soa_justification, decided_by_name,
    case
      -- La règle d'or d'abord : une case vide est le seul défaut qu'un auditeur
      -- ne pardonne jamais.
      when soa_status is null then 'undecided'
      when soa_status = 'excluded' and regime in ('technical', 'organisational')
        then 'exclusion_contested'
      when soa_status = 'selected' and regime = 'technical' and coverage <> 'evidenced'
        then 'technical_evidence_missing'
      when soa_status = 'selected' and coverage = 'uncovered'
        then 'evidence_missing'
      else null
    end
  from judged
  order by display_order;
$$;

comment on function app.statement_of_applicability is
  'Declaration d''Applicabilite ajustee au profil d''activite : couverture, criticite attendue par la matrice des preuves, regime de preuve exige, decision portee et ecart constate.';

-- -----------------------------------------------------------------------------
-- Etat d'avancement de la Déclaration
-- -----------------------------------------------------------------------------
create or replace function app.soa_readiness(
  p_organization_id uuid,
  p_framework_code  text default 'ISO_IEC_42001',
  p_framework_version text default '2023'
)
returns jsonb
language sql
stable
security definer
set search_path = app, public, pg_catalog
as $$
  with rows as (
    select * from app.statement_of_applicability(
      p_organization_id, p_framework_code, p_framework_version)
  )
  select case
    when not exists (
      select 1 from public.organization o
      where o.id = p_organization_id and app.has_tenant_access(o.tenant_id)
    ) then jsonb_build_object('available', false)
    else jsonb_build_object(
      'available', true,
      'profile', app.organization_profile(p_organization_id),
      'requirements', (select count(*) from rows),
      'decided',      (select count(*) from rows where soa_status is not null),
      'selected',     (select count(*) from rows where soa_status = 'selected'),
      'excluded',     (select count(*) from rows where soa_status = 'excluded'),
      'undecided',    (select count(*) from rows where gap = 'undecided'),
      'technical_expected', (select count(*) from rows where evidence_regime = 'technical'),
      'gaps', (select coalesce(jsonb_object_agg(gap, n), '{}'::jsonb)
               from (select gap, count(*) as n from rows where gap is not null group by gap) g))
  end;
$$;

comment on function app.soa_readiness is
  'Avancement de la Declaration d''Applicabilite : ce qui est decide, ce qui ne l''est pas, et la nature des ecarts.';

-- -----------------------------------------------------------------------------
-- Surface d'API
-- -----------------------------------------------------------------------------
create or replace function public.statement_of_applicability(
  p_organization_id uuid,
  p_framework_code  text default 'ISO_IEC_42001',
  p_framework_version text default '2023'
)
returns table (
  objective_code text, objective_title text, requirement_reference text,
  requirement_title text, internal_summary text, expected_evidence text,
  display_order integer, control_count integer, operating_count integer,
  evidence_count integer, controls jsonb, coverage text,
  expected_criticality app.evidence_criticality, evidence_regime text,
  typologies jsonb, soa_status app.soa_status, soa_justification text,
  decided_by_name text, gap text
)
language sql stable security invoker
set search_path = app, public, pg_catalog
as $$
  select * from app.statement_of_applicability(p_organization_id, p_framework_code, p_framework_version);
$$;

create or replace function public.evidence_typologies(p_organization_id uuid)
returns table (
  id uuid, code text, ordinal integer, name text,
  technical_description text, deliverables text[], normative_references text[],
  criticality app.evidence_criticality, profile app.ai_activity_profile
)
language sql stable security invoker
set search_path = app, public, pg_catalog
as $$ select * from app.evidence_typologies(p_organization_id); $$;

create or replace function public.evidence_matrix_gaps()
returns table (
  typology_code text, typology_name text,
  framework_code text, framework_version text, reference text
)
language sql stable security invoker
set search_path = app, public, pg_catalog
as $$ select * from app.evidence_matrix_gaps(); $$;

create or replace function public.soa_readiness(
  p_organization_id uuid,
  p_framework_code  text default 'ISO_IEC_42001',
  p_framework_version text default '2023'
)
returns jsonb
language sql stable security invoker
set search_path = app, public, pg_catalog
as $$ select app.soa_readiness(p_organization_id, p_framework_code, p_framework_version); $$;

revoke all on function public.statement_of_applicability(uuid, text, text) from public, anon;
revoke all on function public.evidence_typologies(uuid)                     from public, anon;
revoke all on function public.evidence_matrix_gaps()                        from public, anon;
revoke all on function public.soa_readiness(uuid, text, text)               from public, anon;
grant execute on function public.statement_of_applicability(uuid, text, text) to authenticated;
grant execute on function public.evidence_typologies(uuid)                    to authenticated;
grant execute on function public.evidence_matrix_gaps()                       to authenticated;
grant execute on function public.soa_readiness(uuid, text, text)              to authenticated;

-- -----------------------------------------------------------------------------
-- Le registre porte la typologie
-- -----------------------------------------------------------------------------
-- Une preuve se lit d'abord par ce qu'elle démontre techniquement. Sans sa
-- typologie, le registre est une liste de fichiers ; avec elle, il devient un
-- état de la couverture technique attendue pour le profil de l'organisation.
drop function if exists public.evidence_register(uuid);
drop function if exists app.evidence_register(uuid);

create or replace function app.evidence_register(p_organization_id uuid)
returns table (
  id                   uuid,
  business_ref         text,
  title                text,
  evidence_type        app.evidence_type,
  source               text,
  file_name            text,
  file_size_bytes      bigint,
  mime_type            text,
  storage_bucket       text,
  storage_path         text,
  external_url         text,
  content_hash         text,
  version              text,
  collected_at         timestamptz,
  valid_until          date,
  freshness            app.evidence_freshness,
  validation_status    app.evidence_validation_status,
  owner_name           text,
  validated_by_name    text,
  validated_at         timestamptz,
  superseded_by        uuid,
  control_count        integer,
  control_codes        text[],
  typology_code        text,
  typology_name        text,
  typology_criticality app.evidence_criticality
)
language sql
stable
security definer
set search_path = app, public, pg_catalog
as $$
  with p as (select app.organization_profile(p_organization_id) as profile)
  select
    e.id, e.business_ref, e.title, e.evidence_type, e.source,
    e.file_name, e.file_size_bytes, e.mime_type,
    e.storage_bucket, e.storage_path, e.external_url, e.content_hash, e.version,
    e.collected_at, e.valid_until,
    app.evidence_freshness(e.valid_until),
    e.validation_status,
    coalesce(owner.full_name, owner.email),
    coalesce(validator.full_name, validator.email),
    e.validated_at,
    e.superseded_by,
    count(ce.control_id)::integer,
    coalesce(array_agg(c.code order by c.code) filter (where c.code is not null), array[]::text[]),
    t.code, t.name, tp.criticality
  from public.evidence e
  join public.organization o on o.id = e.organization_id
  cross join p
  left join public.user_profile owner     on owner.id = e.owner_user_id
  left join public.user_profile validator on validator.id = e.validated_by
  left join public.control_evidence ce on ce.evidence_id = e.id
  left join public.control c on c.id = ce.control_id
  left join public.evidence_typology t on t.id = e.typology_id
  left join public.evidence_typology_profile tp
    on tp.typology_id = t.id and tp.profile = p.profile
  where e.organization_id = p_organization_id
    and app.has_tenant_access(o.tenant_id)
  group by e.id, e.business_ref, e.title, e.evidence_type, e.source,
           e.file_name, e.file_size_bytes, e.mime_type, e.storage_bucket,
           e.storage_path, e.external_url, e.content_hash, e.version,
           e.collected_at, e.valid_until, e.validation_status,
           owner.full_name, owner.email, validator.full_name, validator.email,
           e.validated_at, e.superseded_by, t.code, t.name, tp.criticality
  order by e.collected_at desc;
$$;

comment on function app.evidence_register is
  'Registre des preuves d''une organisation : fraicheur, validation, controles adosses et typologie technique avec sa criticite pour le profil.';

create or replace function public.evidence_register(p_organization_id uuid)
returns table (
  id uuid, business_ref text, title text, evidence_type app.evidence_type, source text,
  file_name text, file_size_bytes bigint, mime_type text,
  storage_bucket text, storage_path text, external_url text, content_hash text, version text,
  collected_at timestamptz, valid_until date, freshness app.evidence_freshness,
  validation_status app.evidence_validation_status, owner_name text,
  validated_by_name text, validated_at timestamptz, superseded_by uuid,
  control_count integer, control_codes text[],
  typology_code text, typology_name text, typology_criticality app.evidence_criticality
)
language sql stable security invoker
set search_path = app, public, pg_catalog
as $$ select * from app.evidence_register(p_organization_id); $$;

revoke all on function public.evidence_register(uuid) from public, anon;
grant execute on function public.evidence_register(uuid) to authenticated;

-- -----------------------------------------------------------------------------
-- Couverture des typologies attendues
-- -----------------------------------------------------------------------------
-- Combien de preuves valides par typologie, au regard de ce que le profil
-- appelle. C'est la lecture qui manque a un dossier : « la matrice attend du
-- lourd sur l'explicabilite, et nous n'avons rien ».
create or replace function app.typology_coverage(p_organization_id uuid)
returns table (
  code            text,
  name            text,
  criticality     app.evidence_criticality,
  evidence_total  integer,
  evidence_valid  integer
)
language sql
stable
security definer
set search_path = app, public, pg_catalog
as $$
  select
    t.code, t.name, t.criticality,
    count(e.id)::integer,
    count(e.id) filter (
      where e.validation_status = 'validated'
        and app.evidence_freshness(e.valid_until) <> 'expired')::integer
  from app.evidence_typologies(p_organization_id) t
  left join public.evidence e
    on e.typology_id = t.id and e.organization_id = p_organization_id
  group by t.code, t.name, t.criticality, t.ordinal
  order by
    case t.criticality
      when 'critical'   then 1
      when 'high'       then 2
      when 'moderate'   then 3
      when 'low'        then 4
      when 'negligible' then 5
      else 6
    end,
    t.ordinal;
$$;

comment on function app.typology_coverage is
  'Preuves deposees par typologie, au regard de la criticite attendue pour le profil de l''organisation.';

create or replace function public.typology_coverage(p_organization_id uuid)
returns table (
  code text, name text, criticality app.evidence_criticality,
  evidence_total integer, evidence_valid integer
)
language sql stable security invoker
set search_path = app, public, pg_catalog
as $$ select * from app.typology_coverage(p_organization_id); $$;

revoke all on function public.typology_coverage(uuid) from public, anon;
grant execute on function public.typology_coverage(uuid) to authenticated;

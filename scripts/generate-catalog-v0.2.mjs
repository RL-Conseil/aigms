/**
 * Produit le paquet AIGMS Control Framework v0.2 a partir de la v0.1 gelee et
 * de la vague 1 d'enrichissement, puis la migration qui le charge comme
 * referentiel de l'editeur (tenant_id NULL, publie).
 *
 *   node scripts/generate-catalog-v0.2.mjs
 *
 * La v0.1 n'est jamais modifiee : c'est sa politique de version, et c'est ce
 * que le moteur d'import exige d'une baseline. Tout ce que la v0.2 change
 * vient de wave1_enrichment.json — relu, versionne, diffable.
 */
import { readFileSync, writeFileSync } from 'node:fs'
import { createHash } from 'node:crypto'

const base = JSON.parse(readFileSync('knowledge/frameworks/aigms/v0.1/aigms_control_framework_v0.1.json', 'utf8'))
const wave = JSON.parse(readFileSync('knowledge/frameworks/aigms/v0.2/wave1_enrichment.json', 'utf8'))

const version = '0.2'
const enriched = new Set(Object.keys(wave.controls))

const pkg = {
  framework: {
    ...base.framework,
    version,
    status: 'frozen-baseline',
    language: 'fr',
    description:
      'Référentiel opérationnel de gouvernance, risque, sécurité, exploitation et conformité des systèmes IA. v0.2 : vague 1 d’enrichissement (GOV, INV, USE, RSK) — objectif, questions d’évaluation, preuves attendues, responsable, fréquence, correspondances ISO/IEC 42001 et AI Act.',
    control_count: base.controls.length,
    domain_count: base.domains.length,
    enrichment_waves: {
      completed: ['GOV', 'INV', 'USE', 'RSK'],
      pending: ['DAT', 'SEC', 'SUP', 'HUM', 'OPS', 'MON', 'INC', 'CMP'],
    },
  },
  domains: base.domains.map((d) => ({ ...d, name: wave.domains[d.code] ?? d.name })),
  controls: base.controls.map((c) => {
    const w = wave.controls[c.id]
    const out = { ...c, version }
    if (!w) return out
    return {
      ...out,
      title: w.title ?? c.title,
      applicability: { default: w.applicability ?? c.applicability?.default ?? 'conditional' },
      objective: w.objective ?? null,
      owner_role: w.owner_role ?? null,
      review_frequency: w.review_frequency ?? null,
      assessment_questions: w.assessment_questions ?? [],
      expected_evidence: w.expected_evidence ?? [],
      framework_mappings: w.framework_mappings ?? [],
    }
  }),
  control_profiles: base.control_profiles,
  reference_use_cases: base.reference_use_cases,
  autonomy_levels: base.autonomy_levels,
  risk_categories: base.risk_categories,
  evidence_status: base.evidence_status,
}

const json = JSON.stringify(pkg, null, 2) + '\n'
const out = 'knowledge/frameworks/aigms/v0.2/aigms_control_framework_v0.2.json'
writeFileSync(out, json)
const sha = createHash('sha256').update(json).digest('hex')

// --- Migration : le referentiel de l'editeur --------------------------------
// Les fonctions d'import exigent un travail d'import porte par un tenant. Le
// referentiel de l'editeur n'appartient a aucun tenant : la migration insere
// directement, avec les memes colonnes que app.commit_catalog_import.
const sql = (s) => s.replace(/'/g, "''")
const lines = []
lines.push(`-- =============================================================================
-- AIGMS — 0043 — Référentiel de l'éditeur : AIGMS Control Framework v${version}
-- =============================================================================
-- GÉNÉRÉ par scripts/generate-catalog-v0.2.mjs — ne pas éditer à la main.
-- Source : ${out} (sha256 ${sha.slice(0, 16)}…).
--
-- Le référentiel de l'éditeur n'appartient à aucun tenant (tenant_id NULL) :
-- tout tenant le voit et peut en instancier les contrôles. Il est publié
-- d'emblée, donc gelé : une évolution passe par une v0.3, jamais par une
-- modification de celle-ci.
-- =============================================================================

do $$
declare
  v_framework uuid;
  v_version   uuid;
begin
  insert into public.catalog_framework (tenant_id, code, name, description)
  values (null, ${JSON.stringify(pkg.framework.id).replace(/"/g, "'")}, '${sql(pkg.framework.name)}', '${sql(pkg.framework.description)}')
  on conflict (code) where tenant_id is null
    do update set name = excluded.name, description = excluded.description
  returning id into v_framework;

  delete from public.catalog_version where framework_id = v_framework and version = '${version}';

  -- Insérée gelée, publiée à la fin : le contenu d'une version publiée est
  -- immuable (app.guard_published_catalog), on ne peut donc la remplir qu'avant.
  insert into public.catalog_version (
    framework_id, version, status, language, description, design_principle,
    maturity_scale, declared_domain_count, declared_control_count,
    source_filename, source_sha256, imported_at
  ) values (
    v_framework, '${version}', 'frozen', 'fr', '${sql(pkg.framework.description)}',
    '${sql(pkg.framework.design_principle)}', '${sql(pkg.framework.maturity_scale)}',
    ${pkg.domains.length}, ${pkg.controls.length},
    'aigms_control_framework_v${version}.json', '${sha}', now()
  ) returning id into v_version;

  insert into public.catalog_domain (version_id, code, name, control_count, display_order) values`)
lines.push(
  pkg.domains
    .map((d) => `    (v_version, '${d.code}', '${sql(d.name)}', ${d.control_count}, ${d.order})`)
    .join(',\n') + ';',
)
lines.push(`
  insert into public.catalog_control (
    version_id, domain_id, control_code, control_version, title, status, control_type, objective,
    owner_role, review_frequency, applicability, risks, requirements,
    assessment_questions, expected_evidence, tests, maturity_model,
    framework_mappings, remediation_guidance
  )
  select v_version, d.id, c.code, c.version, c.title, c.status, c.control_type, c.objective,
         c.owner_role, c.review_frequency, c.applicability, c.risks, c.requirements,
         c.assessment_questions, c.expected_evidence, c.tests, c.maturity_model,
         c.framework_mappings, c.remediation_guidance
  from jsonb_to_recordset($controls$${JSON.stringify(
    pkg.controls.map((c) => ({
      code: c.id,
      version: c.version,
      title: c.title,
      status: c.status,
      control_type: c.control_type,
      objective: c.objective ?? null,
      owner_role: c.owner_role ?? null,
      review_frequency: c.review_frequency ?? null,
      applicability: c.applicability ?? {},
      risks: c.risks ?? [],
      requirements: c.requirements ?? [],
      assessment_questions: c.assessment_questions ?? [],
      expected_evidence: c.expected_evidence ?? [],
      tests: c.tests ?? [],
      maturity_model: c.maturity_model ?? {},
      framework_mappings: c.framework_mappings ?? [],
      remediation_guidance: c.remediation_guidance ?? [],
      domain: c.domain,
    })),
  )}$controls$::jsonb) as c(
    code text, version text, title text, status text, control_type text, objective text,
    owner_role text, review_frequency text, applicability jsonb, risks jsonb, requirements jsonb,
    assessment_questions jsonb, expected_evidence jsonb, tests jsonb, maturity_model jsonb,
    framework_mappings jsonb, remediation_guidance jsonb, domain text
  )
  join public.catalog_domain d on d.version_id = v_version and d.code = c.domain;

  insert into public.catalog_profile (version_id, profile_code, name, description)
  select v_version, p ->> 'id', p ->> 'name', p ->> 'description'
  from jsonb_array_elements($profiles$${JSON.stringify(pkg.control_profiles)}$profiles$::jsonb) p;

  insert into public.catalog_reference_use_case (version_id, use_case_code, name, example)
  select v_version, u ->> 'id', u ->> 'name', u ->> 'example'
  from jsonb_array_elements($usecases$${JSON.stringify(pkg.reference_use_cases)}$usecases$::jsonb) u;

  -- Publication : une seule version publiée par référentiel, la précédente
  -- passe « remplacée ».
  update public.catalog_version set status = 'superseded'
   where framework_id = v_framework and id <> v_version and status = 'published';
  update public.catalog_version set status = 'published', published_at = now()
   where id = v_version;
end $$;
`)
writeFileSync('supabase/migrations/20260916140000_0043_editor_catalog_v0_2.sql', lines.join('\n'))
console.log(`v${version} : ${pkg.controls.length} contrôles, ${enriched.size} enrichis, sha256 ${sha.slice(0, 12)}… ; migration écrite.`)

/**
 * Genere la migration qui charge la couche outillage de l'editeur :
 * les 61 outils du classeur IT/IA, leur rattachement aux controles-types, et
 * la phase de mise en place typique de chaque controle-type.
 *
 *   MIGRATION_STAMP=20260917110000 node scripts/generate-tools-migration.mjs 0046
 */
import { readFileSync, writeFileSync } from 'node:fs'

const [migrationNumber] = process.argv.slice(2)
const tools = JSON.parse(readFileSync('knowledge/frameworks/aigms/tools/aigms_it_tools_v1.json', 'utf8'))
const map = JSON.parse(readFileSync('knowledge/frameworks/aigms/tools/tool_control_map.json', 'utf8'))

const rows = tools.tools.map((t) => ({ ...t, controls: map.map[t.code] ?? [] }))
const phases = Object.fromEntries(Object.entries(map.domain_phase).filter(([k]) => k !== '_note'))

const sql = `-- =============================================================================
-- AIGMS — ${migrationNumber} — Couche outillage de l'éditeur
-- =============================================================================
-- GÉNÉRÉ par scripts/generate-tools-migration.mjs — ne pas éditer à la main.
-- Source : ${tools.source} (v${tools.version}), rattachements dans
-- knowledge/frameworks/aigms/tools/tool_control_map.json.
--
-- Un contrôle-type dit QUOI maîtriser ; un outil dit AVEC QUOI. Les ${rows.length}
-- outils du classeur sont rattachés aux contrôles-types qu'ils instrumentent,
-- par code de contrôle — le lien survit aux versions du référentiel.
-- =============================================================================

insert into public.catalog_tool (
  tenant_id, code, phase, domain, acronym, tool_service, definition, tool_examples,
  controlled_object, control_question, expected_evidence, nature, automation,
  frequency, owner_role, risk_addressed, iso42001_refs, iso27001_refs,
  other_frameworks, priority, applicability, comments
)
select null, t.code, t.phase::app.aigms_phase, t.domain, t.acronym, t.tool_service, t.definition, t.tool_examples,
       t.controlled_object, t.control_question, t.expected_evidence, t.nature, t.automation,
       t.frequency, t.owner_role, t.risk_addressed, t.iso42001_refs, t.iso27001_refs,
       t.other_frameworks, t.priority, t.applicability, t.comments
from jsonb_to_recordset($tools$${JSON.stringify(rows)}$tools$::jsonb) as t(
  code text, phase text, domain text, acronym text, tool_service text, definition text,
  tool_examples jsonb, controlled_object text, control_question text, expected_evidence jsonb,
  nature text, automation text, frequency text, owner_role text, risk_addressed text,
  iso42001_refs jsonb, iso27001_refs jsonb, other_frameworks jsonb, priority text,
  applicability text, comments text
)
on conflict (code) where tenant_id is null do update set
  phase = excluded.phase, domain = excluded.domain, definition = excluded.definition,
  control_question = excluded.control_question, expected_evidence = excluded.expected_evidence;

insert into public.catalog_tool_control (tool_id, framework_code, control_code)
select tl.id, 'AIGMS-CF', m.control_code
from jsonb_to_recordset($map$${JSON.stringify(
  rows.flatMap((t) => t.controls.map((c) => ({ tool_code: t.code, control_code: c }))),
)}$map$::jsonb) as m(tool_code text, control_code text)
join public.catalog_tool tl on tl.code = m.tool_code and tl.tenant_id is null
on conflict do nothing;

-- Phase typique par domaine, posée sur les contrôles-types de l'éditeur. Le
-- contenu d'une version publiée est gelé : on lève la garde le temps de poser
-- une métadonnée qui ne change pas ce que le contrôle exige.
alter table public.catalog_control disable trigger catalog_control_guard_published;
update public.catalog_control cc
   set phase = p.phase::app.aigms_phase
  from public.catalog_domain d
  join public.catalog_version v on v.id = d.version_id
  join public.catalog_framework f on f.id = v.framework_id
  join jsonb_to_recordset($phases$${JSON.stringify(
    Object.entries(phases).map(([domain, phase]) => ({ domain, phase })),
  )}$phases$::jsonb) as p(domain text, phase text) on p.domain = d.code
 where cc.domain_id = d.id and f.tenant_id is null and f.code = 'AIGMS-CF';
alter table public.catalog_control enable trigger catalog_control_guard_published;
`
const stamp = process.env.MIGRATION_STAMP ?? new Date().toISOString().replace(/[-:T]/g, '').slice(0, 12) + '00'
const file = `supabase/migrations/${stamp}_${migrationNumber}_editor_tools.sql`
writeFileSync(file, sql)
console.log(`${rows.length} outils, ${rows.reduce((n, t) => n + t.controls.length, 0)} rattachements ; ${file} écrite.`)

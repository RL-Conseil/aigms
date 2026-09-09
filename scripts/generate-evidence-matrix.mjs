#!/usr/bin/env node
/**
 * Genere la migration 0029 depuis la matrice des preuves.
 *
 * La matrice est une donnee, pas du code : elle vit dans knowledge/ et la
 * migration en est derivee. Un test (tests/rls/evidence-matrix.test.ts) compare
 * la base au fichier source a chaque execution, de sorte que les deux ne
 * puissent pas diverger en silence.
 *
 *   node scripts/generate-evidence-matrix.mjs > supabase/migrations/<...>.sql
 */

import { readFileSync } from 'node:fs'

const SOURCE = 'knowledge/frameworks/aigms/evidence-matrix/v1/matrice-preuves.json'
const matrix = JSON.parse(readFileSync(SOURCE, 'utf8'))

const q = (value) => (value === null || value === undefined ? 'null' : `'${String(value).replace(/'/g, "''")}'`)
const arr = (values) => `array[${values.map(q).join(', ')}]::text[]`

const lines = []
const out = (line = '') => lines.push(line)

out(`-- =============================================================================`)
out(`-- AIGMS — 0029 — Matrice des preuves et profil d'activité`)
out(`-- =============================================================================`)
out(`-- FICHIER GÉNÉRÉ — ne pas modifier à la main.`)
out(`--   Source    : ${SOURCE}`)
out(`--   Générateur: scripts/generate-evidence-matrix.mjs`)
out(`--   Vérifié   : tests/rls/evidence-matrix.test.ts`)
out(`--`)
out(`-- Une organisation n'a pas les mêmes preuves à produire selon ce qu'elle fait`)
out(`-- de l'IA. Un hébergeur doit démontrer l'isolation de ses calculs et son`)
out(`-- empreinte énergétique ; il n'a rien à dire sur l'équité d'un modèle qu'il`)
out(`-- n'entraîne pas. Un utilisateur métier, à l'inverse, répond de la dérive du`)
out(`-- système qu'il exploite, pas de son alignement.`)
out(`--`)
out(`-- La matrice porte cette différence : 8 typologies de preuves × 4 profils`)
out(`-- d'activité, chaque case donnant un niveau de criticité. De ce niveau`)
out(`-- découle ce que la Déclaration d'Applicabilité exige — preuve technique,`)
out(`-- preuve organisationnelle, ou justification formelle d'exclusion.`)
out(`--`)
out(`-- ${matrix.matrix.note}`)
out(`-- =============================================================================`)
out()

out(`-- -----------------------------------------------------------------------------`)
out(`-- Profil d'activité de l'organisation`)
out(`-- -----------------------------------------------------------------------------`)
out(`create type app.ai_activity_profile as enum (`)
out(`  ${matrix.profiles.map((p) => q(p.code)).join(', ')});`)
out()
out(`comment on type app.ai_activity_profile is`)
out(`  ${q(matrix.profiles.map((p) => `${p.code} : ${p.description}`).join(' | '))};`)
out()
out(`alter table public.organization`)
out(`  add column ai_activity_profile app.ai_activity_profile;`)
out()
out(`comment on column public.organization.ai_activity_profile is`)
out(`  'Role de l''organisation vis-a-vis de l''IA, au sens d''ISO/IEC 42001. Determine les typologies de preuves attendues et leur criticite. Nul tant qu''il n''est pas renseigne : toutes les typologies sont alors proposees, et l''ecran le signale plutot que de supposer un profil.';`)
out()

out(`-- -----------------------------------------------------------------------------`)
out(`-- Criticité`)
out(`-- -----------------------------------------------------------------------------`)
out(`-- L'ordre de l'enum porte la hiérarchie : max() sur plusieurs typologies rend`)
out(`-- la plus exigeante, ce qui est la lecture prudente.`)
out(`create type app.evidence_criticality as enum (`)
out(`  ${matrix.criticality_levels.map(q).join(', ')});`)
out()

out(`-- -----------------------------------------------------------------------------`)
out(`-- Typologies de preuves`)
out(`-- -----------------------------------------------------------------------------`)
out(`create table public.evidence_typology (`)
out(`  id                    uuid primary key default gen_random_uuid(),`)
out(`  code                  text not null unique,`)
out(`  ordinal               integer not null,`)
out(`  name                  text not null check (btrim(name) <> ''),`)
out(`  technical_description text not null check (btrim(technical_description) <> ''),`)
out(`  deliverables          text[] not null check (cardinality(deliverables) > 0),`)
out(`  review_status         text not null default 'to_review'`)
out(`                          check (review_status in ('to_review', 'reviewed')),`)
out(`  created_at            timestamptz not null default now()`)
out(`);`)
out()
out(`comment on table public.evidence_typology is`)
out(`  'Typologie de preuve technique. Les resumes sont rediges en propre et portent review_status = to_review : une interpretation engage vis-a-vis d''un client ou d''un auditeur.';`)
out()
out(`create table public.evidence_typology_profile (`)
out(`  typology_id  uuid not null references public.evidence_typology (id) on delete cascade,`)
out(`  profile      app.ai_activity_profile not null,`)
out(`  criticality  app.evidence_criticality not null,`)
out(`  primary key (typology_id, profile)`)
out(`);`)
out()
out(`comment on table public.evidence_typology_profile is`)
out(`  'Criticite d''une typologie pour un profil d''activite. C''est la matrice elle-meme.';`)
out()
out(`create table public.evidence_typology_reference (`)
out(`  typology_id       uuid not null references public.evidence_typology (id) on delete cascade,`)
out(`  framework_code    text not null,`)
out(`  framework_version text not null,`)
out(`  reference         text not null,`)
out(`  primary key (typology_id, framework_code, framework_version, reference)`)
out(`);`)
out()
out(`comment on table public.evidence_typology_reference is`)
out(`  'Reference normative citee par la matrice. Conservee telle qu''enoncee : elle se resout par jointure sur requirement, et app.evidence_matrix_gaps() nomme celles qui ne se resolvent pas.';`)
out()

for (const table of ['evidence_typology', 'evidence_typology_profile', 'evidence_typology_reference']) {
  out(`alter table public.${table} enable row level security;`)
  out(`alter table public.${table} force  row level security;`)
  out(`create policy ${table}_select on public.${table}`)
  out(`  for select to authenticated using (true);`)
  out(`create policy ${table}_write on public.${table}`)
  out(`  for all to authenticated`)
  out(`  using (app.is_platform_admin()) with check (app.is_platform_admin());`)
  out(`grant select, insert, update, delete on public.${table} to authenticated;`)
  out(`revoke all on public.${table} from anon;`)
  out()
}

out(`-- -----------------------------------------------------------------------------`)
out(`-- Contenu de la matrice`)
out(`-- -----------------------------------------------------------------------------`)
out(`insert into public.evidence_typology (code, ordinal, name, technical_description, deliverables) values`)
out(
  matrix.typologies
    .map((t) => `  (${q(t.code)}, ${t.ordinal}, ${q(t.name)},\n   ${q(t.technical_description)},\n   ${arr(t.deliverables)})`)
    .join(',\n') + ';',
)
out()

out(`insert into public.evidence_typology_profile (typology_id, profile, criticality)`)
out(`select t.id, v.profile::app.ai_activity_profile, v.criticality::app.evidence_criticality`)
out(`from (values`)
const cells = []
for (const t of matrix.typologies) {
  for (const p of matrix.profiles) {
    cells.push(`  (${q(t.code)}, ${q(p.code)}, ${q(t.criticality[p.code])})`)
  }
}
out(cells.join(',\n'))
out(`) as v(code, profile, criticality)`)
out(`join public.evidence_typology t on t.code = v.code;`)
out()

out(`insert into public.evidence_typology_reference (typology_id, framework_code, framework_version, reference)`)
out(`select t.id, v.framework, v.version, v.reference`)
out(`from (values`)
const refs = []
for (const t of matrix.typologies) {
  for (const r of t.references) {
    refs.push(`  (${q(t.code)}, ${q(r.framework)}, ${q(r.version)}, ${q(r.reference)})`)
  }
}
out(refs.join(',\n'))
out(`) as v(code, framework, version, reference)`)
out(`join public.evidence_typology t on t.code = v.code;`)
out()

out(readFileSync('scripts/evidence-matrix-tail.sql', 'utf8').trimEnd())
out()

process.stdout.write(lines.join('\n'))

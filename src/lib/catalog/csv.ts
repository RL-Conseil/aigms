/**
 * Un referentiel de controles au format CSV.
 *
 * Le format canonique est le JSON du paquet : il porte tout — profils,
 * cas d'usage de reference, modele de maturite, correspondances. Mais un
 * cabinet qui constitue son propre referentiel le fait dans un tableur, une
 * ligne par controle. D'ou ce second chemin : le CSV est TRADUIT en JSON
 * canonique, puis suit exactement la meme validation en base. Il n'y a pas
 * deux moteurs d'import, il y a deux portes vers le meme.
 *
 * CE QUE LE CSV SAIT PORTER : l'ossature — domaines, controles, leur titre,
 * leur objectif, leur type, leur applicabilite par defaut, leur responsable,
 * leur frequence de revue. Ce qu'il ne porte pas — questions d'evaluation,
 * preuves attendues, tests, correspondances vers les normes — reste vide et
 * s'enrichit ensuite, comme le paquet AIGMS v0.1 lui-meme.
 */

export const CSV_COLUMNS = [
  'control_id',
  'domain',
  'domain_name',
  'title',
  'objective',
  'control_type',
  'default_applicability',
  'owner_role',
  'review_frequency',
  'status',
  'version',
] as const

type Column = (typeof CSV_COLUMNS)[number]

const REQUIRED: Column[] = ['control_id', 'domain', 'title']

export type CsvIssue = { line: number; message: string }

export type CsvFramework = { id: string; name: string; version: string; description?: string }

export type CsvTranslation =
  | { ok: true; payload: Record<string, unknown>; controls: number; domains: number }
  | { ok: false; issues: CsvIssue[] }

/** Detecte le separateur sur la ligne d'en-tete : point-virgule (Excel FR) ou virgule. */
function detectDelimiter(header: string): ';' | ',' {
  const semicolons = (header.match(/;/g) ?? []).length
  const commas = (header.match(/,/g) ?? []).length
  return semicolons >= commas ? ';' : ','
}

/** Decoupe une ligne en champs, en respectant les guillemets doubles. */
function splitLine(line: string, delimiter: string): string[] {
  const fields: string[] = []
  let current = ''
  let quoted = false
  for (let i = 0; i < line.length; i += 1) {
    const char = line[i]
    if (quoted) {
      if (char === '"') {
        if (line[i + 1] === '"') {
          current += '"'
          i += 1
        } else {
          quoted = false
        }
      } else {
        current += char
      }
    } else if (char === '"') {
      quoted = true
    } else if (char === delimiter) {
      fields.push(current)
      current = ''
    } else {
      current += char
    }
  }
  fields.push(current)
  return fields.map((f) => f.trim())
}

/**
 * Traduit le CSV en paquet canonique.
 *
 * Les domaines sont deduits des lignes, dans l'ordre de premiere apparition ;
 * `domain_name` est pris sur la premiere ligne qui le renseigne, le code sinon.
 */
export function translateCsv(raw: string, framework: CsvFramework): CsvTranslation {
  const text = raw.replace(/^﻿/, '')
  const lines = text.split(/\r?\n/).filter((l) => l.trim() !== '')
  const issues: CsvIssue[] = []

  const headerLine = lines[0]
  if (!headerLine) return { ok: false, issues: [{ line: 1, message: 'Le fichier est vide.' }] }

  const delimiter = detectDelimiter(headerLine)
  const header = splitLine(headerLine, delimiter).map((h) => h.toLowerCase())
  const index = new Map<string, number>()
  header.forEach((name, i) => index.set(name, i))

  for (const column of REQUIRED) {
    if (!index.has(column)) {
      issues.push({ line: 1, message: `Colonne obligatoire absente : « ${column} ».` })
    }
  }
  if (issues.length) return { ok: false, issues }

  const at = (fields: string[], column: Column): string => {
    const i = index.get(column)
    return i === undefined ? '' : (fields[i] ?? '')
  }

  const domains = new Map<string, { code: string; name: string; order: number; control_count: number }>()
  const controls: Record<string, unknown>[] = []
  const seen = new Set<string>()

  lines.slice(1).forEach((line, offset) => {
    const lineNumber = offset + 2
    const fields = splitLine(line, delimiter)
    const id = at(fields, 'control_id')
    const domain = at(fields, 'domain').toUpperCase()
    const title = at(fields, 'title')
    const version = at(fields, 'version') || framework.version

    if (!id) issues.push({ line: lineNumber, message: 'control_id vide.' })
    if (!domain) issues.push({ line: lineNumber, message: 'domain vide.' })
    if (!title) issues.push({ line: lineNumber, message: 'title vide.' })
    if (!id || !domain || !title) return

    const key = `${id}@${version}`
    if (seen.has(key)) {
      issues.push({ line: lineNumber, message: `Contrôle en double : ${id} (version ${version}).` })
      return
    }
    seen.add(key)

    const existing = domains.get(domain)
    const domainName = at(fields, 'domain_name')
    if (!existing) {
      domains.set(domain, {
        code: domain,
        name: domainName || domain,
        order: domains.size + 1,
        control_count: 1,
      })
    } else {
      existing.control_count += 1
      if (existing.name === existing.code && domainName) existing.name = domainName
    }

    const applicability = at(fields, 'default_applicability')
    controls.push({
      id,
      domain,
      title,
      version,
      status: at(fields, 'status') || 'draft',
      control_type: at(fields, 'control_type') || 'baseline',
      applicability: applicability ? { default: applicability } : {},
      objective: at(fields, 'objective') || null,
      owner_role: at(fields, 'owner_role') || null,
      review_frequency: at(fields, 'review_frequency') || null,
      risks: [],
      requirements: [],
      assessment_questions: [],
      expected_evidence: [],
      tests: [],
      maturity_model: {},
      framework_mappings: [],
      remediation_guidance: [],
    })
  })

  if (issues.length) return { ok: false, issues }
  if (!controls.length) {
    return { ok: false, issues: [{ line: 2, message: 'Aucun contrôle : le fichier ne porte que l’en-tête.' }] }
  }

  return {
    ok: true,
    controls: controls.length,
    domains: domains.size,
    payload: {
      framework: {
        id: framework.id,
        name: framework.name,
        version: framework.version,
        status: 'frozen-baseline',
        language: 'fr',
        description: framework.description ?? null,
        control_count: controls.length,
        domain_count: domains.size,
        source_format: 'csv',
      },
      domains: [...domains.values()],
      controls,
    },
  }
}

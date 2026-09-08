import { afterAll, beforeAll, describe, expect, it } from 'vitest'
import { readFileSync } from 'node:fs'
import type { Client } from 'pg'
import { asUser, connect, DEMO } from '../helpers/db'

/**
 * Referentiel ISO/IEC 42001 Annexe A et Declaration d'Applicabilite.
 *
 * La migration est generee depuis le fichier de donnees : ces tests verifient
 * que les deux n'ont pas diverge, et que la Declaration reste soumise a la RLS.
 */

const SOURCE = 'knowledge/frameworks/iso-42001/2023/annexe-a.json'
const source = JSON.parse(readFileSync(SOURCE, 'utf8')) as {
  framework: { control_count: number; control_objective_count: number }
  objectives: { code: string; title: string }[]
  requirements: { reference: string; objective: string; title: string; internal_summary: string }[]
}

let db: Client

beforeAll(async () => {
  db = await connect()
})

afterAll(async () => {
  await db.end()
})

describe('Annexe A d’ISO/IEC 42001', () => {
  it('les 38 exigences sont chargees, reparties sur 9 objectifs', async () => {
    const { rows } = await db.query<{ requirements: string; objectives: string }>(
      `select count(*)::text as requirements,
              count(distinct r.objective_code)::text as objectives
         from public.requirement r
         join public.framework f on f.id = r.framework_id
        where f.code = 'ISO_IEC_42001' and f.version = '2023'
          and r.objective_code is not null`,
    )

    expect(Number(rows[0]!.requirements)).toBe(source.framework.control_count)
    expect(Number(rows[0]!.objectives)).toBe(source.framework.control_objective_count)
  })

  it('la base et le fichier de donnees ne divergent pas', async () => {
    const { rows } = await db.query<{ reference: string; title: string; objective_code: string }>(
      `select r.requirement_reference as reference, r.title, r.objective_code
         from public.requirement r
         join public.framework f on f.id = r.framework_id
        where f.code = 'ISO_IEC_42001' and r.objective_code is not null
        order by r.display_order`,
    )

    const inDb = new Map(rows.map((r) => [r.reference, r]))

    for (const requirement of source.requirements) {
      const stored = inDb.get(requirement.reference)
      expect(stored, `${requirement.reference} absente de la base`).toBeDefined()
      expect(stored?.title).toBe(requirement.title)
      expect(stored?.objective_code).toBe(requirement.objective)
    }
  })

  it('chaque resume est marque a relire tant qu un humain ne l a pas valide', async () => {
    const { rows } = await db.query<{ n: string }>(
      `select count(*)::text as n
         from public.requirement r
         join public.framework f on f.id = r.framework_id
        where f.code = 'ISO_IEC_42001' and r.objective_code is not null
          and r.review_status <> 'to_review'`,
    )

    expect(Number(rows[0]!.n)).toBe(0)
  })

  it("aucun resume ne reproduit un libelle officiel anglais", async () => {
    // Garde-fou contre une derive : les resumes sont rediges en francais et
    // expriment ce qu'il faut demontrer, ils ne traduisent pas la norme.
    const { rows } = await db.query<{ reference: string; internal_summary: string }>(
      `select r.requirement_reference as reference, r.internal_summary
         from public.requirement r
         join public.framework f on f.id = r.framework_id
        where f.code = 'ISO_IEC_42001' and r.objective_code is not null`,
    )

    for (const row of rows) {
      expect(row.internal_summary.length).toBeGreaterThan(80)
      expect(row.internal_summary).not.toMatch(/\bthe organization shall\b/i)
    }
  })
})

describe('Declaration d’Applicabilite', () => {
  it('rend les 38 exigences avec leur etat de couverture', async () => {
    const rows = await asUser(db, DEMO.officerA, async (c) => {
      const { rows } = await c.query<{ coverage: string; control_count: number }>(
        'select coverage, control_count from app.statement_of_applicability($1)',
        [DEMO.orgA],
      )
      return rows
    })

    expect(rows).toHaveLength(38)
    expect(rows.some((r) => r.coverage === 'evidenced')).toBe(true)
    expect(rows.some((r) => r.coverage === 'uncovered')).toBe(true)
  })

  it('distingue un controle declare d un controle operant et prouve', async () => {
    const byRef = await asUser(db, DEMO.officerA, async (c) => {
      const { rows } = await c.query<{ requirement_reference: string; coverage: string }>(
        'select requirement_reference, coverage from app.statement_of_applicability($1)',
        [DEMO.orgA],
      )
      return new Map(rows.map((r) => [r.requirement_reference, r.coverage]))
    })

    // CTL-02 est operant et porte une preuve ; CTL-06 n'est que propose.
    expect(byRef.get('A.9.2')).toBe('evidenced')
    expect(byRef.get('A.6.2.4')).toBe('declared')
  })

  it("un tenant etranger n'obtient aucune couverture", async () => {
    const rows = await asUser(db, DEMO.officerB, async (c) => {
      const { rows } = await c.query<{ coverage: string }>(
        'select coverage from app.statement_of_applicability($1)',
        [DEMO.orgA],
      )
      return rows
    })

    // Les exigences restent visibles — le catalogue normatif est public — mais
    // aucun controle du tenant A n'y apparait.
    expect(rows).toHaveLength(38)
    expect(rows.every((r) => r.coverage === 'uncovered')).toBe(true)
  })

  it('la correspondance domaine vers objectif est proposee, pas imposee', async () => {
    const { rows } = await db.query<{ domain_code: string; objective_code: string; rationale: string }>(
      'select domain_code, objective_code, rationale from public.catalog_domain_objective_map',
    )

    expect(rows.length).toBeGreaterThan(10)
    for (const row of rows) {
      expect(row.rationale.length).toBeGreaterThan(20)
    }
  })
})

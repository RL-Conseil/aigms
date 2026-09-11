import { afterAll, beforeAll, describe, expect, it } from 'vitest'
import type { Client } from 'pg'
import { asUser, connect, DEMO } from '../helpers/db'

/**
 * Ce qui appelle une action.
 *
 * Ces compteurs pilotent la navigation : une pastille fausse est pire que pas
 * de pastille, parce qu'on apprend a ne plus la regarder. Deux proprietes se
 * verifient donc — le total est bien la somme de ses parties, et rien ne
 * traverse la frontiere du tenant.
 */

let db: Client

beforeAll(async () => {
  db = await connect()
})

afterAll(async () => {
  await db.end()
})

type Row = {
  organization_id: string
  organization_name: string
  overdue_actions: number
  reviews_due: number
  stale_evidence: number
  evidence_to_review: number
  open_incidents: number
  high_risks_open: number
  soa_undecided: number
  total: number
}

async function attention(user: string) {
  return asUser(db, user, async (c) => {
    const { rows } = await c.query<Row>('select * from app.attention_by_organization()')
    return rows
  })
}

describe('Compteurs d’attention', () => {
  it('le total est la somme exacte de ses parties', async () => {
    const rows = await attention(DEMO.officerA)
    expect(rows.length).toBeGreaterThan(0)

    for (const row of rows) {
      const sum =
        row.overdue_actions +
        row.reviews_due +
        row.stale_evidence +
        row.evidence_to_review +
        row.open_incidents +
        row.high_risks_open +
        row.soa_undecided
      expect(row.total).toBe(sum)
    }
  })

  it('ne rend que les organisations du périmètre', async () => {
    const own = await attention(DEMO.officerA)
    const other = await attention(DEMO.officerB)

    expect(own.some((r) => r.organization_id === DEMO.orgA)).toBe(true)
    expect(own.some((r) => r.organization_id === DEMO.orgB)).toBe(false)
    expect(other.some((r) => r.organization_id === DEMO.orgA)).toBe(false)
  })

  it('compte les exigences de l’Annexe A qu’aucune décision ne couvre', async () => {
    // La liste est ordonnee par ce qui appelle le plus d'action : la premiere
    // ligne n'est pas forcement celle qu'on cherche, d'autant que les parcours
    // E2E creent de vraies organisations.
    const rows = await attention(DEMO.officerA)
    const row = rows.find((r) => r.organization_id === DEMO.orgA)
    const { rows: annex } = await db.query<{ n: string }>(
      `select count(*)::text as n from public.requirement r
         join public.framework f on f.id = r.framework_id
        where f.code = 'ISO_IEC_42001' and r.objective_code is not null`,
    )
    const { rows: decided } = await db.query<{ n: string }>(
      'select count(*)::text as n from public.soa_decision where organization_id = $1',
      [DEMO.orgA],
    )

    expect(row!.soa_undecided).toBe(Number(annex[0]!.n) - Number(decided[0]!.n))
  })

  it('ne compte comme retard que ce qui est réellement échu', async () => {
    // Une action due demain n'est pas un retard. La confondre avec un vrai
    // retard viderait la pastille de son sens.
    const before = await attention(DEMO.officerA)
    const baseline = before.find((r) => r.organization_id === DEMO.orgA)!.overdue_actions

    const after = await asUser(db, DEMO.officerA, async (c) => {
      await c.query(
        `insert into public.action (tenant_id, organization_id, title, due_date, status)
         values ($1, $2, 'Action à venir', current_date + interval '7 days', 'open')`,
        [DEMO.tenantA, DEMO.orgA],
      )
      const { rows } = await c.query<Row>('select * from app.attention_by_organization()')
      return rows.find((r) => r.organization_id === DEMO.orgA)!.overdue_actions
    })

    expect(after).toBe(baseline)
  })

  it('classe en tête l’organisation qui appelle le plus d’action', async () => {
    const rows = await attention(DEMO.officerA)
    const totals = rows.map((r) => r.total)
    expect(totals).toEqual([...totals].sort((a, b) => b - a))
  })
})

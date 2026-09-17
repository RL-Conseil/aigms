import { afterAll, beforeAll, describe, expect, it } from 'vitest'
import type { Client } from 'pg'
import { asUser, connect, DEMO } from '../helpers/db'

/** Propositions d'actions : derivees des ecarts, dedoublonnees, avec un responsable pressenti. */

type Proposal = { key: string; source: string; source_id: string | null; suggested_owner_id: string | null; is_blocking: boolean; reason: string }
type Result = { available: boolean; proposals: Proposal[] }

let db: Client
beforeAll(async () => {
  db = await connect()
})
afterAll(async () => {
  await db.end()
})

async function suggest(c: Client, useCaseId: string): Promise<Result> {
  const { rows } = await c.query<{ r: Result }>('select app.suggest_actions($1) as r', [useCaseId])
  return rows[0]!.r
}

describe('Propositions d’actions', () => {
  it('dérive les écarts du gate PRODUCTION du cas d’usage pilote', async () => {
    const r = await asUser(db, DEMO.officerA, (c) => suggest(c, DEMO.useCasePilot))
    expect(r.available).toBe(true)
    const keys = r.proposals.map((p) => p.key)
    expect(keys).toContain('gate:impact')
    expect(keys).toContain('gate:oversight')
    expect(keys.some((k) => k.startsWith('vendor:'))).toBe(true)
    expect(keys.some((k) => k.startsWith('control:'))).toBe(true)
  })

  it('chaque proposition porte un motif, une source, et le plus souvent un responsable pressenti', async () => {
    const r = await asUser(db, DEMO.officerA, (c) => suggest(c, DEMO.useCasePilot))
    for (const p of r.proposals) {
      expect(p.reason.length, p.key).toBeGreaterThan(0)
      expect(p.source, p.key).toBeTruthy()
    }
    expect(r.proposals.filter((p) => p.suggested_owner_id).length).toBeGreaterThan(0)
  })

  it('ce qui retient le gate est marqué bloquant', async () => {
    const r = await asUser(db, DEMO.officerA, (c) => suggest(c, DEMO.useCasePilot))
    expect(r.proposals.find((p) => p.key === 'gate:impact')?.is_blocking).toBe(true)
  })

  it('une action déjà ouverte sur la même source n’est pas reproposée', async () => {
    const { before, after } = await asUser(db, DEMO.officerA, async (c) => {
      const before = await suggest(c, DEMO.useCasePilot)
      const target = before.proposals.find((p) => p.key === 'gate:impact')!
      await c.query(
        `insert into public.action (tenant_id, organization_id, use_case_id, title, source, source_id)
         values ($1, $2, $3, 'Conduire l''évaluation d''impact', $4, $5)`,
        [DEMO.tenantA, DEMO.orgA, DEMO.useCasePilot, target.source, target.source_id],
      )
      const after = await suggest(c, DEMO.useCasePilot)
      return { before, after }
    })
    expect(before.proposals.some((p) => p.key === 'gate:impact')).toBe(true)
    expect(after.proposals.some((p) => p.key === 'gate:impact')).toBe(false)
  })

  it('ne dit rien d’un cas d’usage hors du tenant', async () => {
    const r = await asUser(db, DEMO.officerB, (c) => suggest(c, DEMO.useCasePilot))
    expect(r.available).toBe(false)
  })
})

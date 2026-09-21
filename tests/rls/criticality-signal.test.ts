import { afterAll, beforeAll, describe, expect, it } from 'vitest'
import type { Client } from 'pg'
import { asUser, connect, DEMO } from '../helpers/db'

/**
 * 0075 : la criticite retenue se confronte aux faits. Elle ne change pas
 * d'elle-meme ; elle signale, et l'officer est alerte.
 */

let db: Client
beforeAll(async () => {
  db = await connect()
})
afterAll(async () => {
  await db.end()
})

describe('Criticité et faits', () => {
  it('le scoring de candidatures, retenu « élevé », est rattrapé par son risque critique ouvert', async () => {
    const r = await asUser(db, DEMO.officerA, async (c) => {
      const { rows } = await c.query<{ s: { retained: string; observed: string; exceeds: boolean; reasons: string[] } }>(
        'select public.criticality_signal($1) as s', [DEMO.useCasePilot],
      )
      return rows[0]!.s
    })
    expect(r.retained).toBe('high')
    expect(r.observed).toBe('critical')
    expect(r.exceeds).toBe(true)
    expect(r.reasons.some((x) => x.includes('RSK-2026-0005'))).toBe(true)
  })

  it('un cas modéré sans fait contraire ne signale rien', async () => {
    const r = await asUser(db, DEMO.officerA, async (c) => {
      const { rows } = await c.query<{ s: { exceeds: boolean; reasons: string[] } }>(
        'select public.criticality_signal($1) as s', [DEMO.useCaseProduction],
      )
      return rows[0]!.s
    })
    expect(r.exceeds).toBe(false)
    expect(r.reasons).toEqual([])
  })

  it('un risque élevé identifié sur un cas modéré alerte l’officer ; relever la criticité lève l’alerte', async () => {
    const r = await asUser(db, DEMO.officerA, async (c) => {
      await c.query(
        `insert into public.risk (tenant_id, organization_id, use_case_id, title, scenario, category, inherent_likelihood, inherent_impact, owner_user_id)
         values ($1, $2, $3, 'Réponse erronée engageant la responsabilité', 'L’assistant affirme un droit que le client n’a pas.', 'legal_compliance', 3, 4, $4)`,
        [DEMO.tenantA, DEMO.orgA, DEMO.useCaseProduction, DEMO.officerA],
      )
      const { rows: a1 } = await c.query<{ id: string }>(
        `select id from public.my_notifications(50) where kind = 'criticality_review' and entity_id = $1 and read_at is null`,
        [DEMO.useCaseProduction],
      )
      await c.query(`update public.ai_use_case set criticality = 'high' where id = $1`, [DEMO.useCaseProduction])
      const { rows: a2 } = await c.query<{ id: string }>(
        `select id from public.my_notifications(50) where kind = 'criticality_review' and entity_id = $1 and read_at is null`,
        [DEMO.useCaseProduction],
      )
      return { before: a1.length, after: a2.length }
    })
    expect(r.before).toBe(1)
    expect(r.after).toBe(0)
  })
})

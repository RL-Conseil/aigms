import { afterAll, beforeAll, describe, expect, it } from 'vitest'
import type { Client } from 'pg'
import { asUser, connect, DEMO } from '../helpers/db'

/**
 * Les pieces derriere les compteurs. `app.process_map` compte, `app.activity_stakes`
 * nomme : ils partagent leurs predicats, et ce test verifie qu'ils coincident
 * sur chaque activite du jeu de demonstration. S'ils divergent un jour, c'est
 * ici que ca se voit.
 */

type Stakes = {
  available: boolean
  risks: { open: boolean }[]
  controls_not_operating: unknown[]
  stale_evidence: unknown[]
  open_incidents: unknown[]
  overdue_actions: unknown[]
  reviews_due: unknown[]
}

type Counts = {
  activity_id: string
  open_high_risks: number
  controls_total: number
  controls_operating: number
  evidence_stale: number
  open_incidents: number
  overdue_actions: number
  reviews_due: number
}

let db: Client

beforeAll(async () => {
  db = await connect()
})

afterAll(async () => {
  await db.end()
})

describe('Ce qui se joue sur une activité', () => {
  it('nomme exactement ce que process_map compte, activité par activité', async () => {
    const pairs = await asUser(db, DEMO.officerA, async (c) => {
      const { rows: counts } = await c.query<Counts>(
        `select activity_id, open_high_risks, controls_total, controls_operating,
                evidence_stale, open_incidents, overdue_actions, reviews_due
           from app.process_map($1) where activity_id is not null`,
        [DEMO.orgA],
      )
      const out: { counts: Counts; stakes: Stakes }[] = []
      for (const row of counts) {
        const { rows } = await c.query<{ s: Stakes }>('select app.activity_stakes($1) as s', [
          row.activity_id,
        ])
        out.push({ counts: row, stakes: rows[0]!.s })
      }
      return out
    })

    expect(pairs.length).toBeGreaterThan(0)
    for (const { counts, stakes } of pairs) {
      expect(stakes.available, counts.activity_id).toBe(true)
      expect(stakes.risks.filter((r) => r.open).length, `${counts.activity_id} risques`).toBe(
        counts.open_high_risks,
      )
      expect(stakes.stale_evidence.length, `${counts.activity_id} preuves`).toBe(counts.evidence_stale)
      expect(stakes.open_incidents.length, `${counts.activity_id} incidents`).toBe(counts.open_incidents)
      expect(stakes.overdue_actions.length, `${counts.activity_id} actions`).toBe(counts.overdue_actions)
      expect(stakes.reviews_due.length, `${counts.activity_id} revues`).toBe(counts.reviews_due)
      // process_map compte les controles par cas d'usage ; les pieces sont
      // dedoublonnees par controle. L'ecart ne peut aller que dans un sens.
      expect(stakes.controls_not_operating.length).toBeLessThanOrEqual(
        counts.controls_total - counts.controls_operating,
      )
    }
  })

  it("ne dit rien d'une activité hors du tenant", async () => {
    const stakes = await asUser(db, DEMO.officerB, async (c) => {
      const { rows } = await c.query<{ s: Stakes }>('select app.activity_stakes($1) as s', [
        'c2000000-0000-4000-8000-000000000001',
      ])
      return rows[0]!.s
    })
    expect(stakes.available).toBe(false)
    expect(stakes.risks).toHaveLength(0)
    expect(stakes.stale_evidence).toHaveLength(0)
  })
})

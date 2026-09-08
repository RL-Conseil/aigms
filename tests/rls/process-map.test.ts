import { afterAll, beforeAll, describe, expect, it } from 'vitest'
import type { Client } from 'pg'
import { asUser, connect, DEMO } from '../helpers/db'

/**
 * Process & Risk Map et sante de la gouvernance.
 *
 * L'indice engage : il sera lu par un dirigeant. Ces tests verrouillent ce
 * qu'il mesure, ce qu'il refuse de produire, et le fait qu'il reste soumis a
 * l'habilitation comme n'importe quelle lecture.
 */

const ACTIVITY_SUPPORT = 'c2000000-0000-4000-8000-000000000001'
const ACTIVITY_EMPTY = 'c2000000-0000-4000-8000-000000000004'

type Health = {
  available: boolean
  reason?: string
  score?: number
  band?: string
  use_cases?: number
  causes?: { code: string; count: number; penalty: number; label: string }[]
  not_a_measure_of?: string
}

let db: Client

beforeAll(async () => {
  db = await connect()
})

afterAll(async () => {
  await db.end()
})

async function health(client: Client, activityId: string | null = null): Promise<Health> {
  const { rows } = await client.query<{ h: Health }>(
    'select app.governance_health($1, $2) as h',
    [DEMO.orgA, activityId],
  )
  return rows[0]!.h
}

describe('Carte des processus', () => {
  it('annote chaque activité de ce qui s’y joue', async () => {
    const rows = await asUser(db, DEMO.officerA, async (c) => {
      const { rows } = await c.query<{
        activity_name: string
        use_case_count: number
        max_risk_level: string | null
        controls_total: number
      }>('select * from app.process_map($1)', [DEMO.orgA])
      return rows
    })

    expect(rows.length).toBeGreaterThan(0)

    const support = rows.find((r) => r.activity_name === 'Traitement des demandes clients')
    expect(support?.use_case_count).toBe(1)
    expect(support?.controls_total).toBeGreaterThan(0)

    const rh = rows.find((r) => r.activity_name === 'Présélection des candidatures')
    expect(rh?.max_risk_level).toBe('critical')
  })

  it("un tenant étranger n'obtient aucune ligne", async () => {
    const rows = await asUser(db, DEMO.officerB, async (c) => {
      const { rows } = await c.query('select * from app.process_map($1)', [DEMO.orgA])
      return rows
    })

    expect(rows).toHaveLength(0)
  })
})

describe('Santé de la gouvernance', () => {
  it('produit un indice explicable par ses causes', async () => {
    const result = await asUser(db, DEMO.officerA, (c) => health(c))

    expect(result.available).toBe(true)
    expect(result.score).toBeGreaterThanOrEqual(0)
    expect(result.score).toBeLessThanOrEqual(100)
    expect(result.causes?.length).toBeGreaterThan(0)

    // L'indice doit se recalculer de tête : 100 moins la somme des pénalités,
    // borné à zéro.
    const penalties = result.causes!.reduce((sum, cause) => sum + cause.penalty, 0)
    expect(result.score).toBe(Math.max(100 - penalties, 0))
  })

  it('dit explicitement ce qu’il ne mesure pas', async () => {
    const result = await asUser(db, DEMO.officerA, (c) => health(c))
    expect(result.not_a_measure_of).toBe('conformité réglementaire')
  })

  it('chaque cause porte un libellé et une pénalité bornée', async () => {
    const result = await asUser(db, DEMO.officerA, (c) => health(c))

    for (const cause of result.causes ?? []) {
      expect(cause.label.length).toBeGreaterThan(10)
      expect(cause.penalty).toBeGreaterThan(0)
      expect(cause.penalty).toBeLessThanOrEqual(36)
    }
  })

  it('refuse de produire un indice sans usage déclaré', async () => {
    const result = await asUser(db, DEMO.officerA, (c) => health(c, ACTIVITY_EMPTY))

    expect(result.available).toBe(false)
    expect(result.reason).toMatch(/Aucun usage/)
    expect(result.score).toBeUndefined()
  })

  it('se restreint au périmètre d’une activité', async () => {
    const whole = await asUser(db, DEMO.officerA, (c) => health(c))
    const activity = await asUser(db, DEMO.officerA, (c) => health(c, ACTIVITY_SUPPORT))

    expect(activity.available).toBe(true)
    expect(activity.use_cases).toBe(1)
    expect(whole.use_cases).toBeGreaterThan(activity.use_cases!)
  })

  it("n'est pas calculable pour un tenant étranger", async () => {
    const result = await asUser(db, DEMO.officerB, (c) => health(c))
    expect(result.available).toBe(false)
  })
})

import { afterAll, beforeAll, describe, expect, it } from 'vitest'
import type { Client } from 'pg'
import { asUser, connect, DEMO } from '../helpers/db'

/**
 * Couverture des controles et repartition des risques.
 *
 * Deux lectures qui seront montrees a un auditeur : le taux de couverture doit
 * etre exigeant et reproductible, la repartition doit distinguer ce qui reste
 * ouvert de ce qui a ete decide.
 */

let db: Client

beforeAll(async () => {
  db = await connect()
})

afterAll(async () => {
  await db.end()
})

type Coverage = {
  activity_name: string
  use_case_count: number
  controls_total: number
  controls_operating: number
  controls_evidenced: number
  coverage_percent: number | null
  days_since_test: number | null
}

type Heat = {
  process_name: string
  risk_level: string
  risk_count: number
  open_count: number
  accepted_count: number
}

describe('Couverture des contrôles', () => {
  it('ne compte un contrôle que s’il est opérant et prouvé', async () => {
    const rows = await asUser(db, DEMO.officerA, async (c) => {
      const { rows } = await c.query<Coverage>('select * from app.control_coverage($1)', [DEMO.orgA])
      return rows
    })

    const support = rows.find((r) => r.activity_name === 'Traitement des demandes clients')!
    expect(support.controls_total).toBeGreaterThan(0)

    // Le taux se recalcule : prouvés sur applicables.
    expect(support.coverage_percent).toBe(
      Math.floor((support.controls_evidenced * 100) / support.controls_total),
    )

    // Un contrôle opérant sans preuve valide ne compte pas comme couvrant.
    expect(support.controls_evidenced).toBeLessThanOrEqual(support.controls_operating)
  })

  it('ne produit pas de taux là où aucun contrôle n’est affecté', async () => {
    const rows = await asUser(db, DEMO.officerA, async (c) => {
      const { rows } = await c.query<Coverage>('select * from app.control_coverage($1)', [DEMO.orgA])
      return rows
    })

    for (const row of rows.filter((r) => r.controls_total === 0)) {
      expect(row.coverage_percent).toBeNull()
    }
  })

  it('remonte l’ancienneté du dernier test', async () => {
    const rows = await asUser(db, DEMO.officerA, async (c) => {
      const { rows } = await c.query<Coverage>('select * from app.control_coverage($1)', [DEMO.orgA])
      return rows
    })

    const tested = rows.filter((r) => r.days_since_test !== null)
    expect(tested.length).toBeGreaterThan(0)
    for (const row of tested) {
      expect(row.days_since_test).toBeGreaterThanOrEqual(0)
    }
  })

  it("un tenant étranger n'obtient aucune ligne", async () => {
    const rows = await asUser(db, DEMO.officerB, async (c) => {
      const { rows } = await c.query('select * from app.control_coverage($1)', [DEMO.orgA])
      return rows
    })
    expect(rows).toHaveLength(0)
  })
})

describe('Répartition des risques', () => {
  it('couvre chaque processus et chaque niveau, même à zéro', async () => {
    const rows = await asUser(db, DEMO.officerA, async (c) => {
      const { rows } = await c.query<Heat>('select * from app.risk_heatmap($1)', [DEMO.orgA])
      return rows
    })

    const processes = new Set(rows.map((r) => r.process_name))
    const levels = new Set(rows.map((r) => r.risk_level))

    expect(levels.size).toBe(4)
    // Une grille complète : sans cela, une case vide serait indiscernable d'une
    // case manquante.
    expect(rows.length).toBe(processes.size * 4)
  })

  it('distingue ce qui reste ouvert de ce qui a été accepté', async () => {
    const rows = await asUser(db, DEMO.officerA, async (c) => {
      const { rows } = await c.query<Heat>('select * from app.risk_heatmap($1)', [DEMO.orgA])
      return rows
    })

    for (const row of rows) {
      expect(row.open_count + row.accepted_count).toBeLessThanOrEqual(row.risk_count)
    }

    // Le jeu de démonstration porte une acceptation nominative.
    expect(rows.some((r) => r.accepted_count > 0)).toBe(true)
  })

  it('place le risque critique du recrutement au bon endroit', async () => {
    const rows = await asUser(db, DEMO.officerA, async (c) => {
      const { rows } = await c.query<Heat>('select * from app.risk_heatmap($1)', [DEMO.orgA])
      return rows
    })

    const critical = rows.find(
      (r) => r.process_name === 'Gérer les ressources humaines' && r.risk_level === 'critical',
    )
    expect(critical?.open_count).toBeGreaterThan(0)
  })

  it("un tenant étranger n'obtient aucune ligne", async () => {
    const rows = await asUser(db, DEMO.officerB, async (c) => {
      const { rows } = await c.query('select * from app.risk_heatmap($1)', [DEMO.orgA])
      return rows
    })
    expect(rows).toHaveLength(0)
  })
})

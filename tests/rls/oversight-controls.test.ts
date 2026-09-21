import { afterAll, beforeAll, describe, expect, it } from 'vitest'
import type { Client } from 'pg'
import { asUser, connect, DEMO } from '../helpers/db'

/** 0072 : le plan de supervision designe ses controles ; ils deviennent applicables ; le gate les exige quand l'autonomie ou le risque l'exigent. */

let db: Client
beforeAll(async () => {
  db = await connect()
})
afterAll(async () => {
  await db.end()
})

describe('Plan de supervision et contrôles HUM', () => {
  it('les contrôles-types HUM se proposent, et un contrôle désigné devient applicable au cas d’usage', async () => {
    const r = await asUser(db, DEMO.officerA, async (c) => {
      const { rows: cat } = await c.query<{ r: { code: string; control_id: string | null }[] }>(
        'select public.oversight_catalog_controls($1) as r', [DEMO.orgA],
      )
      const { rows: ctl } = await c.query<{ id: string }>(
        `select id from public.control where organization_id = $1 and code = 'CTL-02'`, [DEMO.orgA],
      )
      // Le pilote n'a pas CTL-02 applicable ; le plan le designe pour la reprise.
      await c.query(`delete from public.control_applicability where use_case_id = $1 and control_id = $2`, [DEMO.useCasePilot, ctl[0]!.id])
      await c.query(
        `update public.human_oversight_plan set override_control_id = $2 where use_case_id = $1`,
        [DEMO.useCasePilot, ctl[0]!.id],
      )
      const { rows: ap } = await c.query<{ status: string; justification: string }>(
        `select status, justification from public.control_applicability where use_case_id = $1 and control_id = $2`,
        [DEMO.useCasePilot, ctl[0]!.id],
      )
      return { codes: cat[0]!.r.map((x) => x.code), applicability: ap[0] }
    })
    expect(r.codes).toEqual(expect.arrayContaining(['AIGMS-HUM-004', 'AIGMS-HUM-005']))
    expect(r.applicability?.status).toBe('applicable')
    expect(r.applicability?.justification).toMatch(/plan de supervision/)
  })

  it('au-delà de L2, le gate exige les contrôles de reprise et d’arrêt désignés, opérants et prouvés', async () => {
    const r = await asUser(db, DEMO.officerA, async (c) => {
      // L'assistant en production passe en L3 : la supervision devient exigeante.
      await c.query(`update public.ai_use_case set autonomy_level = 'L3' where id = $1`, [DEMO.useCaseProduction])
      const before = (await c.query<{ r: { checks: { code: string; satisfied: boolean; detail: string }[] } }>(
        `select public.evaluate_gate($1, 'PRODUCTION') as r`, [DEMO.useCaseProduction],
      )).rows[0]!.r.checks.find((x) => x.code === 'HUMAN_OVERSIGHT')!
      // CTL-02 (supervision humaine documentee) est operant et prouve : designe pour les deux rubriques.
      const { rows: ctl } = await c.query<{ id: string }>(`select id from public.control where organization_id = $1 and code = 'CTL-02'`, [DEMO.orgA])
      await c.query(
        `update public.human_oversight_plan set override_control_id = $2, stop_control_id = $2 where use_case_id = $1`,
        [DEMO.useCaseProduction, ctl[0]!.id],
      )
      const after = (await c.query<{ r: { checks: { code: string; satisfied: boolean; detail: string }[] } }>(
        `select public.evaluate_gate($1, 'PRODUCTION') as r`, [DEMO.useCaseProduction],
      )).rows[0]!.r.checks.find((x) => x.code === 'HUMAN_OVERSIGHT')!
      return { before, after }
    })
    expect(r.before.satisfied).toBe(false)
    expect(r.before.detail).toMatch(/aucun contrôle désigné/)
    expect(r.after.satisfied).toBe(true)
  })
})

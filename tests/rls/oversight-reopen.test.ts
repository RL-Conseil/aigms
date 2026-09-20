import { afterAll, beforeAll, describe, expect, it } from 'vitest'
import type { Client } from 'pg'
import { asUser, becomeUser, connect, DEMO } from '../helpers/db'

/** 0066 : une reevaluation dont le perimetre contient la supervision rouvre le plan. */

let db: Client
beforeAll(async () => {
  db = await connect()
})
afterAll(async () => {
  await db.end()
})

describe('Réévaluation et supervision humaine', () => {
  it('une autonomie qui monte rouvre le plan de supervision approuvé, et avertit son responsable', async () => {
    const r = await asUser(db, DEMO.officerA, async (c) => {
      const { rows: before } = await c.query<{ status: string }>(
        'select status from public.human_oversight_plan where use_case_id = $1', [DEMO.useCaseProduction],
      )
      const { rows } = await c.query<{ id: string }>(
        `insert into public.change_request (tenant_id, organization_id, use_case_id, title, description, change_types,
                                            increases_autonomy, new_autonomy_level, status, requested_by)
         values ($1, $2, $3, 'Passage en L3', 'L’assistant envoie sans validation humaine.', array['AUTONOMY']::app.change_type[],
                 true, 'L3', 'DRAFT', $4) returning id`,
        [DEMO.tenantA, DEMO.orgA, DEMO.useCaseProduction, DEMO.officerA],
      )
      await c.query('select app.screen_change_request($1)', [rows[0]!.id])
      const { rows: after } = await c.query<{ status: string; approved_by: string | null }>(
        'select status, approved_by from public.human_oversight_plan where use_case_id = $1', [DEMO.useCaseProduction],
      )
      // L'alerte est nominative : elle se lit par son destinataire, le
      // responsable du plan.
      await becomeUser(c, DEMO.systemOwnerA)
      const { rows: alert } = await c.query<{ kind: string }>(
        `select kind from public.my_notifications(50) where title like 'Plan de supervision à revoir%'`,
      )
      return { before: before[0]!.status, after: after[0]!, alerts: alert.length }
    })
    expect(r.before).toBe('approved')
    expect(r.after).toEqual({ status: 'draft', approved_by: null })
    expect(r.alerts).toBeGreaterThan(0)
  })
})

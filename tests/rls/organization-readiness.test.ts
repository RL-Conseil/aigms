import { afterAll, beforeAll, describe, expect, it } from 'vitest'
import type { Client } from 'pg'
import { asUser, becomeUser, connect, DEMO, expectFailure } from '../helpers/db'

/**
 * Une organisation n'est operationnelle qu'avec ses six roles tenus (0056) :
 * tant qu'il en manque un, on y lit, on n'y ecrit aucun objet de gouvernance.
 */

let db: Client
beforeAll(async () => {
  db = await connect()
})
afterAll(async () => {
  await db.end()
})

describe('Organisation opérationnelle', () => {
  it('la démo est complète : six rôles tenus, rien ne manque', async () => {
    const r = await asUser(db, DEMO.officerA, async (c) => {
      const { rows } = await c.query<{ r: { ready: boolean; missing: string[]; held: string[] } }>(
        'select public.organization_readiness($1) as r', [DEMO.orgA],
      )
      return rows[0]!.r
    })
    expect(r.ready).toBe(true)
    expect(r.missing).toEqual([])
    expect(r.held).toEqual(expect.arrayContaining(['system_owner', 'governance_officer', 'reviewer', 'risk_owner', 'executive_viewer', 'auditor']))
  })

  it('sans Comité de direction, aucune écriture de gouvernance ; l’administration reste ouverte', async () => {
    const r = await asUser(db, DEMO.platformAdmin, async (c) => {
      // L'administration retire le Comite de direction : c'est son acte, il passe.
      await c.query(
        `update public.role_assignment set valid_until = now() where user_id = $1 and organization_id = $2`,
        [DEMO.boardA, DEMO.orgA],
      )
      await c.query(`update public.membership set status = 'suspended' where user_id = $1`, [DEMO.boardA])
      const { rows } = await c.query<{ r: { ready: boolean; missing: string[] } }>(
        'select public.organization_readiness($1) as r', [DEMO.orgA],
      )
      // L'AI Governance Officer ne peut plus rien ecrire — et le message nomme le role.
      await becomeUser(c, DEMO.officerA)
      const refused = await expectFailure(
        c,
        `insert into public.risk (tenant_id, organization_id, use_case_id, title, scenario, category, inherent_likelihood, inherent_impact)
         values ($1, $2, $3, 'Bloqué', 'scénario', 'operational', 2, 2)`,
        [DEMO.tenantA, DEMO.orgA, DEMO.useCasePilot],
      )
      const { rows: readable } = await c.query('select id from public.ai_use_case where organization_id = $1', [DEMO.orgA])
      return { readiness: rows[0]!.r, refused, readable: readable.length }
    })
    expect(r.readiness.ready).toBe(false)
    expect(r.readiness.missing).toEqual(['executive_viewer'])
    expect(r.refused.message).toMatch(/non opérationnelle/)
    expect(r.refused.message).toMatch(/Comité de direction/)
    expect(r.readable).toBeGreaterThan(0)
  })
})

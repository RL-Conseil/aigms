import { afterAll, beforeAll, describe, expect, it } from 'vitest'
import type { Client } from 'pg'
import { asUser, connect, DEMO } from '../helpers/db'

/** 0077 : chaque entree du journal sait de quelle organisation et de quel cas d'usage elle parle. */

let db: Client
beforeAll(async () => {
  db = await connect()
})
afterAll(async () => {
  await db.end()
})

describe('Journal d’audit situé', () => {
  it('un risque identifié laisse une entrée située sur son cas d’usage et son organisation', async () => {
    const r = await asUser(db, DEMO.officerA, async (c) => {
      const { rows } = await c.query<{ id: string }>(
        `insert into public.risk (tenant_id, organization_id, use_case_id, title, scenario, category, inherent_likelihood, inherent_impact, owner_user_id)
         values ($1, $2, $3, 'Journal situé', 'Un scénario de test.', 'operational', 2, 2, $4) returning id`,
        [DEMO.tenantA, DEMO.orgA, DEMO.useCaseProduction, DEMO.officerA],
      )
      const { rows: log } = await c.query<{ organization_id: string | null; use_case_id: string | null }>(
        `select organization_id, use_case_id from public.audit_log where entity_type = 'risk' and entity_id = $1 and action = 'create'`,
        [rows[0]!.id],
      )
      return log[0]!
    })
    expect(r.organization_id).toBe(DEMO.orgA)
    expect(r.use_case_id).toBe(DEMO.useCaseProduction)
  })

  it('la lecture paginée se restreint à un cas d’usage', async () => {
    const r = await asUser(db, DEMO.officerA, async (c) => {
      const { rows } = await c.query<{ use_case_id: string | null; entity_type: string }>(
        `select use_case_id, entity_type from public.audit_log_page(p_organization_id => $1, p_use_case_id => $2, p_limit => 100)`,
        [DEMO.orgA, DEMO.useCasePilot],
      )
      return rows
    })
    expect(r.length).toBeGreaterThan(0)
    expect(r.every((x) => x.use_case_id === DEMO.useCasePilot)).toBe(true)
    // Les pièces du cas d'usage y sont — pas seulement le cas d'usage lui-même.
    expect(r.some((x) => x.entity_type !== 'ai_use_case')).toBe(true)
  })
})

import { afterAll, beforeAll, describe, expect, it } from 'vitest'
import type { Client } from 'pg'
import { asUser, connect, DEMO, expectFailure } from '../helpers/db'

/**
 * Le journal couvre aussi ce qui n'a pas de tenant_id : la marque du tenant,
 * les profils, les versions de referentiel. Et l'export laisse sa ligne.
 */

let db: Client
beforeAll(async () => {
  db = await connect()
})
afterAll(async () => {
  await db.end()
})

describe('Journal des tables de plateforme', () => {
  it('changer la marque du tenant laisse une ligne avec l’avant et l’après', async () => {
    const entry = await asUser(db, DEMO.platformAdmin, async (c) => {
      await c.query("update public.tenant set brand_label = 'Cabinet X' where id = $1", [DEMO.tenantA])
      const { rows } = await c.query<{ before_state: { brand_label: string }; after_state: { brand_label: string } }>(
        `select before_state, after_state from public.audit_log
          where entity_type = 'tenant' and entity_id = $1 order by id desc limit 1`,
        [DEMO.tenantA],
      )
      return rows[0]
    })
    expect(entry?.before_state.brand_label).toBe('AIGMS')
    expect(entry?.after_state.brand_label).toBe('Cabinet X')
  })

  it('modifier son profil laisse une ligne dans le journal de son tenant', async () => {
    const n = await asUser(db, DEMO.officerA, async (c) => {
      await c.query("update public.user_profile set job_title = 'AIGO senior' where id = $1", [DEMO.officerA])
      const { rows } = await c.query<{ n: string }>(
        `select count(*)::text as n from public.audit_log
          where entity_type = 'user_profile' and entity_id = $1 and tenant_id = $2`,
        [DEMO.officerA, DEMO.tenantA],
      )
      return Number(rows[0]!.n)
    })
    expect(n).toBeGreaterThan(0)
  })

  it('aucune table à journaliser n’est sans déclencheur', async () => {
    const { rows } = await db.query('select * from app.audit_coverage_gaps()')
    expect(rows).toEqual([])
  })

  it('l’export est réservé à l’administration et laisse sa ligne', async () => {
    const refused = await asUser(db, DEMO.officerA, (c) =>
      expectFailure(c, 'select public.log_audit_export($1, 12, $2::jsonb)', [DEMO.tenantA, '{"action":"delete"}']),
    )
    expect(refused.message).toMatch(/relève de l’administration|relève de l'administration/)

    const entry = await asUser(db, DEMO.platformAdmin, async (c) => {
      await c.query('select public.log_audit_export($1, 12, $2::jsonb)', [DEMO.tenantA, '{"action":"delete"}'])
      const { rows } = await c.query<{ action: string; metadata: { count: number } }>(
        `select action, metadata from public.audit_log where entity_type = 'audit_log' order by id desc limit 1`,
      )
      return rows[0]
    })
    expect(entry?.action).toBe('export')
    expect(entry?.metadata.count).toBe(12)
  })

  it('la lecture paginée respecte la RLS : un tenant ne voit pas le journal de l’autre', async () => {
    const foreign = await asUser(db, DEMO.officerB, async (c) => {
      const { rows } = await c.query<{ tenant_id: string }>(
        'select tenant_id from public.audit_log_page(null, null, null, null, null, null, 5000, 0)',
      )
      return rows.filter((r) => r.tenant_id === DEMO.tenantA).length
    })
    expect(foreign).toBe(0)
  })
})

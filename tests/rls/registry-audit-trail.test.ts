import { afterAll, beforeAll, describe, expect, it } from 'vitest'
import type { Client } from 'pg'
import { asUser, connect, DEMO } from '../helpers/db'

/**
 * Les fiches d'actif et de fournisseur, et la revue de tiers, laissent leur
 * trace au journal — situee sur l'organisation (0077), avec l'avant/apres.
 */

let db: Client
beforeAll(async () => {
  db = await connect()
})
afterAll(async () => {
  await db.end()
})

describe('Traçabilité des actifs et des fournisseurs', () => {
  it('corriger la fiche d’un actif laisse une entrée avec l’avant et l’après', async () => {
    const r = await asUser(db, DEMO.officerA, async (c) => {
      const { rows: asset } = await c.query<{ id: string; version: string | null }>(
        'select id, version from public.ai_asset where organization_id = $1 order by name limit 1', [DEMO.orgA],
      )
      await c.query(`update public.ai_asset set version = 'v9.9-test' where id = $1`, [asset[0]!.id])
      const { rows } = await c.query<{ organization_id: string; before: string | null; after: string | null; actor_email: string }>(
        `select organization_id, before_state ->> 'version' as before, after_state ->> 'version' as after, actor_email
           from public.audit_log where entity_type = 'ai_asset' and entity_id = $1 and action = 'update'
          order by id desc limit 1`,
        [asset[0]!.id],
      )
      return { previous: asset[0]!.version, log: rows[0]! }
    })
    expect(r.log.organization_id).toBe(DEMO.orgA)
    expect(r.log.before).toBe(r.previous)
    expect(r.log.after).toBe('v9.9-test')
    expect(r.log.actor_email).toContain('@')
  })

  it('la revue d’un tiers et la correction de sa fiche laissent chacune leur entrée', async () => {
    const r = await asUser(db, DEMO.officerA, async (c) => {
      const { rows: vendor } = await c.query<{ id: string }>(
        'select id from public.vendor where organization_id = $1 order by name limit 1', [DEMO.orgA],
      )
      await c.query(`update public.vendor set notes = 'Note de test' where id = $1`, [vendor[0]!.id])
      await c.query(
        `update public.vendor set review_status = 'approved_with_conditions', reviewed_at = now(), next_review_at = current_date + 180 where id = $1`,
        [vendor[0]!.id],
      )
      const { rows } = await c.query<{ organization_id: string; changed: string[] }>(
        `select organization_id,
                (select array_agg(k order by k) from jsonb_object_keys(after_state) k
                  where after_state -> k is distinct from before_state -> k and k <> 'updated_at') as changed
           from public.audit_log where entity_type = 'vendor' and entity_id = $1 and action = 'update'
          order by id desc limit 2`,
        [vendor[0]!.id],
      )
      return rows
    })
    expect(r).toHaveLength(2)
    expect(r.every((x) => x.organization_id === DEMO.orgA)).toBe(true)
    expect(r[0]!.changed).toEqual(expect.arrayContaining(['review_status', 'reviewed_at', 'next_review_at']))
    expect(r[1]!.changed).toEqual(['notes'])
  })
})

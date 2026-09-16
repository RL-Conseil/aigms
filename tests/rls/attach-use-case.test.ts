import { afterAll, beforeAll, describe, expect, it } from 'vitest'
import type { Client } from 'pg'
import { asUser, connect, DEMO } from '../helpers/db'

/** Rattacher un cas d'usage existant a une activite : qui le peut, et ce que ca laisse. */

let db: Client
beforeAll(async () => {
  db = await connect()
})
afterAll(async () => {
  await db.end()
})

const OTHER_ACTIVITY = 'c2000000-0000-4000-8000-000000000004'

describe('Rattachement d’un cas d’usage', () => {
  it('le porteur du système rattache ; l’auditeur ne touche aucune ligne', async () => {
    const moved = await asUser(db, DEMO.systemOwnerA, async (c) => {
      const { rowCount } = await c.query(
        'update public.ai_use_case set activity_id = $2 where id = $1',
        [DEMO.useCasePilot, OTHER_ACTIVITY],
      )
      return rowCount
    })
    expect(moved).toBe(1)

    const refused = await asUser(db, DEMO.auditorA, async (c) => {
      const { rowCount } = await c.query(
        'update public.ai_use_case set activity_id = $2 where id = $1',
        [DEMO.useCasePilot, OTHER_ACTIVITY],
      )
      return rowCount
    })
    expect(refused).toBe(0)
  })

  it('le rattachement est journalisé', async () => {
    const logged = await asUser(db, DEMO.officerA, async (c) => {
      await c.query('update public.ai_use_case set activity_id = $2 where id = $1', [
        DEMO.useCasePilot,
        OTHER_ACTIVITY,
      ])
      const { rows } = await c.query<{ n: string }>(
        `select count(*)::text as n from public.audit_log
          where entity_id = $1 and occurred_at > now() - interval '1 minute'`,
        [DEMO.useCasePilot],
      )
      return Number(rows[0]!.n)
    })
    expect(logged).toBeGreaterThan(0)
  })
})

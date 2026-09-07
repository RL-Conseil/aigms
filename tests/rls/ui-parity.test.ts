import { afterAll, beforeAll, describe, expect, it } from 'vitest'
import type { Client } from 'pg'
import { connect } from '../helpers/db'
import { UI_TRANSITIONS } from '../../src/lib/domain/transitions'
import { USE_CASE_STATUSES } from '../../src/lib/domain/governance'

/**
 * La table de transitions de l'interface ne fait pas autorite, mais si elle
 * diverge de la base, l'interface propose des actions vouees a l'echec ou en
 * cache de valides. Ce test verrouille la parite.
 */

let db: Client

beforeAll(async () => {
  db = await connect()
})

afterAll(async () => {
  await db.end()
})

describe('Parite interface / base', () => {
  it('les transitions proposees correspondent a celles autorisees par la base', async () => {
    for (const status of USE_CASE_STATUSES) {
      const { rows } = await db.query<{ allowed: string[] }>(
        // Cast en text[] : node-postgres ne sait pas decoder un tableau d'enum
        // defini par l'application.
        'select app.allowed_use_case_transitions($1::app.use_case_status)::text[] as allowed',
        [status],
      )

      expect([status, rows[0]!.allowed]).toEqual([status, UI_TRANSITIONS[status]])
    }
  })
})

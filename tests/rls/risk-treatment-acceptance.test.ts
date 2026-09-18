import { afterAll, beforeAll, describe, expect, it } from 'vitest'
import type { Client } from 'pg'
import { asUser, becomeUser, connect, DEMO, expectFailure } from '../helpers/db'

/**
 * 0058 : un traitement a un responsable, averti et rappele ; une acceptation
 * revient a la personne designee responsable du risque.
 */

let db: Client
beforeAll(async () => {
  db = await connect()
})
afterAll(async () => {
  await db.end()
})

describe('Traitement d’un risque', () => {
  it('exige un responsable, l’avertit, et le rappelle à l’échéance', async () => {
    const r = await asUser(db, DEMO.officerA, async (c) => {
      const noOwner = await expectFailure(
        c,
        `insert into public.risk_treatment (tenant_id, risk_id, strategy, description)
         values ($1, $2, 'reduce', 'Sans responsable')`,
        [DEMO.tenantA, DEMO.untreatedRisk],
      )
      const { rows } = await c.query<{ id: string }>(
        `insert into public.risk_treatment (tenant_id, risk_id, strategy, description, owner_user_id, due_date)
         values ($1, $2, 'reduce', 'Revue humaine des candidatures écartées', $3, current_date + 20) returning id`,
        [DEMO.tenantA, DEMO.untreatedRisk, DEMO.systemOwnerA],
      )
      await becomeUser(c, DEMO.systemOwnerA)
      const { rows: now } = await c.query<{ kind: string; href: string }>(
        `select kind, href from public.my_notifications(50) where entity_id = $1`, [rows[0]!.id],
      )
      const { rows: later } = await c.query<{ kind: string }>(
        `select kind from public.notification where entity_id = $1 and due_at > now()`, [rows[0]!.id],
      )
      return { noOwner, now, later }
    })
    expect(r.noOwner.message).toMatch(/désigne son responsable/)
    expect(r.now.map((n) => n.kind)).toEqual(['treatment_owner'])
    expect(r.now[0]!.href).toMatch(/onglet=risques/)
    expect(r.later.map((n) => n.kind)).toEqual(['treatment_due'])
  })
})

describe('Acceptation d’un risque', () => {
  it('revient à la personne désignée responsable, pas à l’AI Governance Officer', async () => {
    const r = await asUser(db, DEMO.officerA, async (c) => {
      // Le risque non traite a pour responsable le Comite des risques.
      const byOfficer = await expectFailure(
        c,
        `update public.risk set status = 'accepted', accepted_by = $2, accepted_at = now(),
                acceptance_rationale = 'Accepté par l’officer, à tort : ce n’est pas son risque.',
                acceptance_review_at = current_date + 90
          where id = $1`,
        [DEMO.untreatedRisk, DEMO.officerA],
      )
      await becomeUser(c, DEMO.riskOwnerA)
      const { rowCount } = await c.query(
        `update public.risk set status = 'accepted', accepted_by = $2, accepted_at = now(),
                acceptance_rationale = 'Accepté par son responsable, pour six mois, mode dégradé documenté.',
                acceptance_review_at = current_date + 180
          where id = $1`,
        [DEMO.untreatedRisk, DEMO.riskOwnerA],
      )
      return { byOfficer, rowCount }
    })
    expect(r.byOfficer.message).toMatch(/personne désignée responsable/)
    expect(r.rowCount).toBe(1)
  })
})

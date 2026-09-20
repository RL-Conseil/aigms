import { afterAll, beforeAll, describe, expect, it } from 'vitest'
import type { Client } from 'pg'
import { asUser, becomeUser, connect, DEMO, expectFailure } from '../helpers/db'

/**
 * 0063 : un changement qui appelle une reevaluation ouvre une decision, et ne
 * se met pas en oeuvre sans elle ; une decision approuvee fait avancer le
 * changement ; un changement deja porte par une decision n'en ouvre pas une
 * seconde.
 */

let db: Client
beforeAll(async () => {
  db = await connect()
})
afterAll(async () => {
  await db.end()
})

describe('Décisions et changements', () => {
  it('un changement qui appelle une réévaluation ouvre une décision, et attend son approbation', async () => {
    const r = await asUser(db, DEMO.officerA, async (c) => {
      const { rows } = await c.query<{ id: string }>(
        `insert into public.change_request (tenant_id, organization_id, use_case_id, title, description, change_types,
                                            changes_model, changes_personal_data, status, requested_by)
         values ($1, $2, $3, 'Nouveau modèle et nouvelles données', 'Le modèle change, et les données personnelles aussi.',
                 array['MODEL','DATASET']::app.change_type[], true, true, 'DRAFT', $4) returning id`,
        [DEMO.tenantA, DEMO.orgA, DEMO.useCaseProduction, DEMO.officerA],
      )
      const changeId = rows[0]!.id
      await c.query('select app.screen_change_request($1)', [changeId])
      const { rows: decision } = await c.query<{ id: string; status: string; decision_type: string; submitted_by: string }>(
        `select d.id, d.status, d.decision_type, d.submitted_by from public.decision_link l
           join public.governance_decision d on d.id = l.decision_id
          where l.target_type = 'change_request' and l.target_id = $1`, [changeId],
      )
      const blocked = await expectFailure(c, `update public.change_request set status = 'APPROVED' where id = $1`, [changeId])
      // Un relecteur approuve la decision : le changement passe approuve de lui-meme.
      await becomeUser(c, DEMO.reviewerA)
      await c.query(
        `update public.governance_decision set status = 'approved', approver_user_id = $2, approved_at = now(), effective_from = current_date
          where id = $1`, [decision[0]!.id, DEMO.reviewerA],
      )
      const { rows: after } = await c.query<{ status: string }>('select status from public.change_request where id = $1', [changeId])
      return { decision: decision[0], blocked, after: after[0]!.status }
    })
    expect(r.decision).toMatchObject({ status: 'submitted', decision_type: 'significant_change', submitted_by: DEMO.officerA })
    expect(r.blocked.message).toMatch(/appelle une décision/)
    expect(r.after).toBe('APPROVED')
  })

  it('un changement déjà porté par une décision n’en ouvre pas une seconde', async () => {
    const r = await asUser(db, DEMO.officerA, async (c) => {
      const { rows: d } = await c.query<{ id: string }>(
        `insert into public.governance_decision (tenant_id, organization_id, use_case_id, decision_type, subject, decision_statement, rationale, status, submitted_by, submitted_at)
         values ($1, $2, $3, 'suspension', 'Suspension du pilote', 'Le pilote est suspendu le temps de la revue.', 'Incident en cours.', 'submitted', $4, now()) returning id`,
        [DEMO.tenantA, DEMO.orgA, DEMO.useCasePilot, DEMO.officerA],
      )
      const { rows: ch } = await c.query<{ id: string }>(
        `insert into public.change_request (tenant_id, organization_id, use_case_id, title, description, change_types, security_relevant, status, requested_by)
         values ($1, $2, $3, 'Suspension du pilote', 'Arrêt du déploiement.', array['DEPLOYMENT']::app.change_type[], true, 'DRAFT', $4) returning id`,
        [DEMO.tenantA, DEMO.orgA, DEMO.useCasePilot, DEMO.officerA],
      )
      await c.query(
        `insert into public.decision_link (tenant_id, decision_id, target_type, target_id) values ($1, $2, 'change_request', $3)`,
        [DEMO.tenantA, d[0]!.id, ch[0]!.id],
      )
      await c.query('select app.screen_change_request($1)', [ch[0]!.id])
      const { rows: n } = await c.query<{ n: string }>(
        `select count(*)::text as n from public.decision_link where target_type = 'change_request' and target_id = $1`, [ch[0]!.id],
      )
      return Number(n[0]!.n)
    })
    expect(r).toBe(1)
  })
})

import { afterAll, beforeAll, describe, expect, it } from 'vitest'
import type { Client } from 'pg'
import { asUser, becomeUser, connect, DEMO, expectFailure } from '../helpers/db'

/**
 * 0064/0065 : une decision approuvee franchit le jalon qu'elle porte ; une
 * mise en production s'appuie sur une preuve validee ; Suspendu est un jalon.
 */

let db: Client
beforeAll(async () => {
  db = await connect()
})
afterAll(async () => {
  await db.end()
})

describe('Décision et jalon', () => {
  it('une suspension approuvée suspend le cas d’usage en production ; une reprise le remet en production', async () => {
    const r = await asUser(db, DEMO.officerA, async (c) => {
      const { rows } = await c.query<{ id: string }>(
        `insert into public.governance_decision (tenant_id, organization_id, use_case_id, decision_type, subject, context, decision_statement, rationale, status, submitted_by, submitted_at, effective_from)
         values ($1, $2, $3, 'suspension', 'Suspension de l’assistant', 'Incident S2 en cours d’analyse.', 'L’assistant est suspendu.', 'Le risque de réponse erronée n’est plus maîtrisé.', 'submitted', $4, now(), current_date) returning id`,
        [DEMO.tenantA, DEMO.orgA, DEMO.useCaseProduction, DEMO.officerA],
      )
      await becomeUser(c, DEMO.reviewerA)
      await c.query(
        `update public.governance_decision set status = 'approved', approver_user_id = $2, approved_at = now() where id = $1`,
        [rows[0]!.id, DEMO.reviewerA],
      )
      const { rows: uc } = await c.query<{ status: string }>('select status from public.ai_use_case where id = $1', [DEMO.useCaseProduction])
      const { rows: d } = await c.query<{ applied_at: string | null }>('select applied_at from public.governance_decision where id = $1', [rows[0]!.id])
      return { status: uc[0]!.status, applied: d[0]!.applied_at }
    })
    expect(r.status).toBe('SUSPENDED')
    expect(r.applied).not.toBeNull()
  })

  it('une décision à date d’effet future attend, puis s’applique quand la fiche le demande', async () => {
    const r = await asUser(db, DEMO.officerA, async (c) => {
      const { rows } = await c.query<{ id: string }>(
        `insert into public.governance_decision (tenant_id, organization_id, use_case_id, decision_type, subject, context, decision_statement, rationale, status, submitted_by, submitted_at, effective_from)
         values ($1, $2, $3, 'retirement', 'Retrait du pilote', 'Le pilote n’a pas convaincu.', 'Le cas d’usage est retiré.', 'Résultats insuffisants.', 'submitted', $4, now(), current_date + 30) returning id`,
        [DEMO.tenantA, DEMO.orgA, DEMO.useCasePilot, DEMO.officerA],
      )
      await becomeUser(c, DEMO.reviewerA)
      await c.query(
        `update public.governance_decision set status = 'approved', approver_user_id = $2, approved_at = now() where id = $1`,
        [rows[0]!.id, DEMO.reviewerA],
      )
      const { rows: before } = await c.query<{ status: string }>('select status from public.ai_use_case where id = $1', [DEMO.useCasePilot])
      // La date arrive : la fiche applique ce qui est du.
      await c.query(`update public.governance_decision set effective_from = current_date where id = $1`, [rows[0]!.id])
      await c.query('select public.apply_due_decisions($1)', [DEMO.useCasePilot])
      const { rows: after } = await c.query<{ status: string }>('select status from public.ai_use_case where id = $1', [DEMO.useCasePilot])
      return { before: before[0]!.status, after: after[0]!.status }
    })
    expect(r.before).toBe('PILOT')
    expect(r.after).toBe('RETIRED')
  })

  it('une mise en production ne s’approuve pas sans preuve validée rattachée', async () => {
    const r = await asUser(db, DEMO.officerA, async (c) => {
      const { rows } = await c.query<{ id: string }>(
        `insert into public.governance_decision (tenant_id, organization_id, use_case_id, decision_type, subject, context, decision_statement, rationale, status, submitted_by, submitted_at)
         values ($1, $2, $3, 'go_production', 'Production sans preuve', 'Contexte.', 'Mise en service.', 'Justification.', 'submitted', $4, now()) returning id`,
        [DEMO.tenantA, DEMO.orgA, DEMO.useCaseProduction, DEMO.officerA],
      )
      await becomeUser(c, DEMO.reviewerA)
      return expectFailure(
        c,
        `update public.governance_decision set status = 'approved', approver_user_id = $2, approved_at = now(), effective_from = current_date, review_due_at = current_date + 180 where id = $1`,
        [rows[0]!.id, DEMO.reviewerA],
      )
    })
    expect(r.message).toMatch(/au moins une preuve validée/)
  })
})

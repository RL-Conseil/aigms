import { afterAll, beforeAll, describe, expect, it } from 'vitest'
import type { Client } from 'pg'
import { asUser, becomeUser, connect, DEMO, expectFailure } from '../helpers/db'

/**
 * Les « A » du RACI, appliques par la base (0055) : la validite d'une preuve
 * se prononce par l'Expert metier ou le Comite des risques — pas par le
 * Porteur qui la depose ; l'arbitrage critique revient au Comite de direction.
 */

let db: Client
beforeAll(async () => {
  db = await connect()
})
afterAll(async () => {
  await db.end()
})

const REVIEWER_A = DEMO.reviewerA

describe('RACI — validation des preuves', () => {
  it('le Porteur de l’IA dépose ; il ne valide pas ; le Comité des risques valide, sans rien modifier d’autre', async () => {
    const r = await asUser(db, DEMO.systemOwnerA, async (c) => {
      const { rows } = await c.query<{ id: string }>(
        `insert into public.evidence (tenant_id, organization_id, title, evidence_type, source, owner_user_id, external_url)
         values ($1, $2, 'Pièce du porteur', 'document', 'Métier', $3, 'https://exemple.test/piece') returning id`,
        [DEMO.tenantA, DEMO.orgA, DEMO.systemOwnerA],
      )
      const id = rows[0]!.id
      const selfValidation = await expectFailure(
        c,
        `update public.evidence set validation_status = 'validated', validated_by = $2, validated_at = now() where id = $1`,
        [id, DEMO.systemOwnerA],
      )
      await becomeUser(c, DEMO.riskOwnerA)
      const rewrite = await expectFailure(c, `update public.evidence set title = 'Autre' where id = $1`, [id])
      const { rowCount } = await c.query(
        `update public.evidence set validation_status = 'validated', validated_by = $2, validated_at = now() where id = $1`,
        [id, DEMO.riskOwnerA],
      )
      const { rows: after } = await c.query<{ validation_status: string; validated_by: string }>(
        'select validation_status, validated_by from public.evidence where id = $1', [id],
      )
      return { selfValidation, rewrite, rowCount, after: after[0]! }
    })
    expect(r.selfValidation.message).toMatch(/pas par la personne qui la dépose/)
    expect(r.rewrite.message).toMatch(/ne la modifie pas/)
    expect(r.rowCount).toBe(1)
    expect(r.after).toEqual({ validation_status: 'validated', validated_by: DEMO.riskOwnerA })
  })
})

describe('RACI — arbitrage critique', () => {
  it('une mise en production d’un cas d’usage élevé ne s’approuve que par le Comité de direction', async () => {
    const r = await asUser(db, DEMO.officerA, async (c) => {
      const { rows } = await c.query<{ id: string }>(
        `insert into public.governance_decision
           (tenant_id, organization_id, use_case_id, decision_type, subject, decision_statement, rationale,
            status, submitted_by, submitted_at, expected_approver_user_id)
         values ($1, $2, $3, 'go_production', 'Mise en production du scoring', 'Mise en service.', 'Préconditions réunies.',
                 'submitted', $4, now(), $5) returning id`,
        [DEMO.tenantA, DEMO.orgA, DEMO.useCasePilot, DEMO.officerA, REVIEWER_A],
      )
      const id = rows[0]!.id
      // Une mise en production s'appuie sur une preuve validee (0065).
      await c.query(
        `insert into public.decision_link (tenant_id, decision_id, target_type, target_id)
         select $1, $2, 'evidence', e.id from public.evidence e where e.organization_id = $3 and e.validation_status = 'validated' limit 1`,
        [DEMO.tenantA, id, DEMO.orgA],
      )
      // L'Expert metier se prononce : refuse, ce n'est pas son arbitrage.
      await becomeUser(c, REVIEWER_A)
      const byExpert = await expectFailure(
        c,
        `update public.governance_decision
            set status = 'approved', approver_user_id = $2, approved_at = now(), effective_from = current_date, review_due_at = current_date + 180
          where id = $1`,
        [id, REVIEWER_A],
      )
      // Le Comite de direction : il se prononce, et rien d'autre.
      await becomeUser(c, DEMO.boardA)
      const submitByBoard = await expectFailure(
        c,
        `insert into public.governance_decision (tenant_id, organization_id, decision_type, subject, status)
         values ($1, $2, 'policy_exception', 'Exception', 'submitted')`,
        [DEMO.tenantA, DEMO.orgA],
      )
      const rewriteByBoard = await expectFailure(
        c, `update public.governance_decision set subject = 'Autre objet' where id = $1`, [id],
      )
      const { rowCount } = await c.query(
        `update public.governance_decision
            set status = 'approved', approver_user_id = $2, approved_at = now(), effective_from = current_date, review_due_at = current_date + 180
          where id = $1`,
        [id, DEMO.boardA],
      )
      const { rows: after } = await c.query<{ status: string }>(
        'select status from public.governance_decision where id = $1', [id],
      )
      return { byExpert, submitByBoard, rewriteByBoard, rowCount, status: after[0]!.status }
    })
    expect(r.byExpert.message).toMatch(/Comité de direction/)
    expect(r.submitByBoard.message).toMatch(/row-level security|permission denied/)
    expect(r.rewriteByBoard.message).toMatch(/ne la réécrit pas/)
    expect(r.rowCount).toBe(1)
    expect(r.status).toBe('approved')
  })

  it('une mise en production d’un cas d’usage modéré reste du ressort du relecteur', async () => {
    const r = await asUser(db, DEMO.officerA, async (c) => {
      const { rows } = await c.query<{ id: string }>(
        `insert into public.governance_decision
           (tenant_id, organization_id, use_case_id, decision_type, subject, decision_statement, rationale,
            status, submitted_by, submitted_at)
         values ($1, $2, $3, 'go_production', 'Mise en production de l’assistant', 'Mise en service.', 'Préconditions réunies.',
                 'submitted', $4, now()) returning id`,
        [DEMO.tenantA, DEMO.orgA, DEMO.useCaseProduction, DEMO.officerA],
      )
      await c.query(
        `insert into public.decision_link (tenant_id, decision_id, target_type, target_id)
         select $1, $2, 'evidence', e.id from public.evidence e where e.organization_id = $3 and e.validation_status = 'validated' limit 1`,
        [DEMO.tenantA, rows[0]!.id, DEMO.orgA],
      )
      await becomeUser(c, REVIEWER_A)
      const { rowCount } = await c.query(
        `update public.governance_decision
            set status = 'approved', approver_user_id = $2, approved_at = now(), effective_from = current_date, review_due_at = current_date + 180
          where id = $1`,
        [rows[0]!.id, REVIEWER_A],
      )
      return rowCount
    })
    expect(r).toBe(1)
  })
})

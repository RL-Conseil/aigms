import { afterAll, beforeAll, describe, expect, it } from 'vitest'
import type { Client } from 'pg'
import { asUser, connect, DEMO, expectFailure } from '../helpers/db'

/**
 * Regles de gouvernance executees cote serveur : transitions, gate production,
 * acceptation de risque, moteur de reevaluation et journal d'audit.
 */

type GateCheck = { code: string; label: string; satisfied: boolean; detail: string }
type GateResult = { satisfied: boolean; target_status: string; checks: GateCheck[] }
type TransitionResult = {
  transitioned: boolean
  from: string
  to: string
  reason: string
  message: string
  gate: GateResult | null
}

let db: Client

beforeAll(async () => {
  db = await connect()
})

afterAll(async () => {
  await db.end()
})

async function gate(client: Client, useCaseId: string, target: string): Promise<GateResult> {
  const { rows } = await client.query<{ r: GateResult }>(
    'select app.evaluate_gate($1, $2::app.use_case_status) as r',
    [useCaseId, target],
  )
  return rows[0]!.r
}

async function transition(
  client: Client,
  useCaseId: string,
  target: string,
  rationale: string,
): Promise<TransitionResult> {
  const { rows } = await client.query<{ r: TransitionResult }>(
    'select app.transition_use_case($1, $2::app.use_case_status, $3) as r',
    [useCaseId, target, rationale],
  )
  return rows[0]!.r
}

describe('Transitions de cycle de vie', () => {
  it('le statut ne peut pas etre modifie par un UPDATE direct', async () => {
    const failure = await asUser(db, DEMO.officerA, (c) =>
      expectFailure(c, "update public.ai_use_case set status = 'PRODUCTION' where id = $1", [
        DEMO.useCaseTriage,
      ]),
    )

    expect(failure.message).toMatch(/app\.transition_use_case/)
  })

  it('une transition non prevue par le workflow est refusee', async () => {
    const result = await asUser(db, DEMO.officerA, (c) =>
      transition(c, DEMO.useCaseTriage, 'PRODUCTION', 'saut de gates'),
    )

    expect(result.transitioned).toBe(false)
    expect(result.reason).toBe('TRANSITION_NOT_ALLOWED')
    expect(result.message).toMatch(/Transition interdite : TRIAGE -> PRODUCTION/)
  })

  it('un refus de transition est journalise et le statut reste inchange', async () => {
    // Le refus ne leve pas d'exception : la transaction reste ouverte et la
    // trace du refus survit.
    const { entry, status } = await asUser(db, DEMO.officerA, async (c) => {
      await transition(c, DEMO.useCaseTriage, 'PILOT', 'tentative')

      const { rows: audit } = await c.query<{ action: string; summary: string }>(
        `select action, summary from public.audit_log
         where entity_id = $1 and action = 'gate_blocked' order by id desc limit 1`,
        [DEMO.useCaseTriage],
      )
      const { rows: uc } = await c.query<{ status: string }>(
        'select status from public.ai_use_case where id = $1',
        [DEMO.useCaseTriage],
      )
      return { entry: audit[0], status: uc[0]?.status }
    })

    expect(entry?.action).toBe('gate_blocked')
    expect(entry?.summary).toMatch(/Transition interdite/)
    expect(status).toBe('TRIAGE')
  })

  it('un role non habilite ne peut pas faire evoluer un cas d usage', async () => {
    const failure = await asUser(db, DEMO.auditorA, (c) =>
      expectFailure(c, "select app.transition_use_case($1, 'ASSESSMENT', 'tentative auditeur')", [
        DEMO.useCaseTriage,
      ]),
    )

    expect(failure.message).toMatch(/Habilitation insuffisante/)
  })

  it('la transition reste refusee pour un utilisateur d un autre tenant', async () => {
    const failure = await asUser(db, DEMO.officerB, (c) =>
      expectFailure(c, "select app.transition_use_case($1, 'ASSESSMENT', 'tentative cross-tenant')", [
        DEMO.useCaseTriage,
      ]),
    )

    // La fonction est SECURITY DEFINER : sans ce controle explicite, elle
    // contournerait la RLS.
    expect(failure.message).toMatch(/Habilitation insuffisante/)
  })
})

describe('Gate PRODUCTION', () => {
  it('le cas d usage en production a satisfait les huit preconditions', async () => {
    const result = await asUser(db, DEMO.officerA, (c) =>
      gate(c, DEMO.useCaseProduction, 'PRODUCTION'),
    )

    expect(result.satisfied).toBe(true)
    expect(result.checks).toHaveLength(8)
    expect(result.checks.map((c) => c.code)).toEqual([
      'CLASSIFICATION_COMPLETE',
      'RISKS_TREATED',
      'IMPACT_ASSESSMENT',
      'VENDOR_REVIEW',
      'HUMAN_OVERSIGHT',
      'MANDATORY_CONTROLS',
      'PRODUCTION_DECISION',
      'BLOCKING_ACTIONS',
    ])
  })

  it('le gate refuse le cas d usage dont la revue fournisseur est ouverte', async () => {
    const result = await asUser(db, DEMO.officerA, (c) => gate(c, DEMO.useCasePilot, 'PRODUCTION'))

    expect(result.satisfied).toBe(false)

    const failed = result.checks.filter((c) => !c.satisfied).map((c) => c.code)
    expect(failed).toContain('VENDOR_REVIEW')
    expect(failed).toContain('IMPACT_ASSESSMENT')
    expect(failed).toContain('HUMAN_OVERSIGHT')
    expect(failed).toContain('BLOCKING_ACTIONS')
  })

  it('la transition vers PRODUCTION est refusee tant que le gate ne passe pas', async () => {
    const result = await asUser(db, DEMO.officerA, (c) =>
      transition(c, DEMO.useCasePilot, 'PRODUCTION', 'demande de generalisation'),
    )

    expect(result.transitioned).toBe(false)
    expect(result.reason).toBe('GATE_NOT_SATISFIED')
    expect(result.gate?.satisfied).toBe(false)

    const status = await asUser(db, DEMO.officerA, async (c) => {
      const { rows } = await c.query<{ status: string }>(
        'select status from public.ai_use_case where id = $1',
        [DEMO.useCasePilot],
      )
      return rows[0]?.status
    })

    expect(status).toBe('PILOT')
  })

  it('chaque precondition non satisfaite est expliquee', async () => {
    const result = await asUser(db, DEMO.officerA, (c) => gate(c, DEMO.useCasePilot, 'PRODUCTION'))

    for (const check of result.checks) {
      expect(check.detail.length).toBeGreaterThan(0)
      expect(check.label.length).toBeGreaterThan(0)
    }
  })
})

describe('Acceptation humaine du risque', () => {
  it('un risque ne peut pas etre accepte sans approbateur, justification et date de revue', async () => {
    const failure = await asUser(db, DEMO.riskOwnerA, (c) =>
      expectFailure(c, "update public.risk set status = 'accepted' where id = $1", [
        DEMO.untreatedRisk,
      ]),
    )

    expect(failure.message).toMatch(/risk_acceptance_requires_human/)
  })

  it('une acceptation complete est enregistree', async () => {
    const accepted = await asUser(db, DEMO.riskOwnerA, async (c) => {
      const result = await c.query(
        `update public.risk
            set status = 'accepted',
                accepted_by = $2,
                accepted_at = now(),
                acceptance_rationale = 'Risque accepte pour six mois, sous reserve de la signature du DPA.',
                acceptance_review_at = current_date + interval '6 months'
          where id = $1`,
        [DEMO.untreatedRisk, DEMO.riskOwnerA],
      )
      return result.rowCount
    })

    expect(accepted).toBe(1)
  })

  it("l'auditeur ne peut pas accepter un risque", async () => {
    const updated = await asUser(db, DEMO.auditorA, async (c) => {
      const result = await c.query(
        `update public.risk set status = 'accepted', accepted_by = $2, accepted_at = now(),
                acceptance_rationale = 'tentative', acceptance_review_at = current_date
          where id = $1`,
        [DEMO.untreatedRisk, DEMO.auditorA],
      )
      return result.rowCount
    })

    expect(updated).toBe(0)
  })
})

describe('Registre de decisions', () => {
  it("une decision ne peut pas etre approuvee sans approbateur humain", async () => {
    const failure = await asUser(db, DEMO.officerA, (c) =>
      expectFailure(
        c,
        `insert into public.governance_decision
           (tenant_id, organization_id, use_case_id, decision_type, subject,
            decision_statement, rationale, status, effective_from)
         values ($1, $2, $3, 'go_production', 'Approbation sans approbateur',
                 'Autorise', 'Justification', 'approved', current_date)`,
        [DEMO.tenantA, DEMO.orgA, DEMO.useCasePilot],
      ),
    )

    expect(failure.message).toMatch(/decision_approval_requires_human|approbateur humain/i)
  })

  it("l'auteur d'une decision engageante ne peut pas l'approuver lui-meme", async () => {
    const failure = await asUser(db, DEMO.officerA, (c) =>
      expectFailure(
        c,
        `insert into public.governance_decision
           (tenant_id, organization_id, use_case_id, decision_type, subject,
            decision_statement, rationale, status, submitted_by, approver_user_id,
            approved_at, effective_from, review_due_at)
         values ($1, $2, $3, 'go_production', 'Auto-approbation',
                 'Autorise', 'Justification', 'approved', $4, $4, now(),
                 current_date, current_date + interval '6 months')`,
        [DEMO.tenantA, DEMO.orgA, DEMO.useCasePilot, DEMO.officerA],
      ),
    )

    expect(failure.message).toMatch(/Séparation des rôles/)
  })

  it('une acceptation de risque approuvee exige une date de revue', async () => {
    const failure = await asUser(db, DEMO.officerA, (c) =>
      expectFailure(
        c,
        `insert into public.governance_decision
           (tenant_id, organization_id, use_case_id, decision_type, subject,
            decision_statement, rationale, status, submitted_by, approver_user_id,
            approved_at, effective_from)
         values ($1, $2, $3, 'risk_acceptance', 'Acceptation sans revue',
                 'Accepte', 'Justification', 'approved', $4, $5, now(), current_date)`,
        [DEMO.tenantA, DEMO.orgA, DEMO.useCasePilot, DEMO.officerA, DEMO.riskOwnerA],
      ),
    )

    expect(failure.message).toMatch(/decision_review_date_required/)
  })
})

describe('Moteur de reevaluation', () => {
  it('une montee d autonomie declenche une reevaluation complete', async () => {
    const result = await asUser(db, DEMO.officerA, async (c) => {
      const { rows } = await c.query<{ r: { verdict: string; scope: string[]; reasons: unknown[] } }>(
        'select app.evaluate_governance_impact($1) as r',
        [DEMO.changeRequest],
      )
      return rows[0]!.r
    })

    expect(result.verdict).toBe('FULL_REASSESSMENT')
    expect(result.scope).toContain('oversight')
    expect(result.reasons.length).toBeGreaterThan(0)
  })

  it('un changement sans declencheur ne demande pas de reevaluation', async () => {
    const verdict = await asUser(db, DEMO.officerA, async (c) => {
      const { rows: created } = await c.query<{ id: string }>(
        `insert into public.change_request
           (tenant_id, organization_id, use_case_id, title, description, change_types)
         values ($1, $2, $3, 'Correction de libelle',
                 'Reformulation d un message affiche, sans effet sur le traitement.',
                 array['DEPLOYMENT']::app.change_type[])
         returning id`,
        [DEMO.tenantA, DEMO.orgA, DEMO.useCaseProduction],
      )

      const { rows } = await c.query<{ r: { verdict: string } }>(
        'select app.evaluate_governance_impact($1) as r',
        [created[0]!.id],
      )
      return rows[0]!.r.verdict
    })

    expect(verdict).toBe('NO_REASSESSMENT')
  })

  it('ecarter la recommandation du moteur exige une justification humaine', async () => {
    const failure = await asUser(db, DEMO.officerA, (c) =>
      expectFailure(
        c,
        `update public.reassessment
            set status = 'overridden', final_verdict = 'NO_REASSESSMENT'
          where change_request_id = $1`,
        [DEMO.changeRequest],
      ),
    )

    expect(failure.message).toMatch(/reassessment_override_is_justified/)
  })

  it('la reevaluation complete a rouvert l evaluation d impact', async () => {
    const statuses = await asUser(db, DEMO.officerA, async (c) => {
      const { rows } = await c.query<{ status: string }>(
        'select status from public.impact_assessment where use_case_id = $1',
        [DEMO.useCaseProduction],
      )
      return rows.map((r) => r.status)
    })

    expect(statuses).toContain('reopened')
  })
})

describe('Journal d audit', () => {
  it('le journal ne peut pas etre modifie', async () => {
    const failure = await expectFailure(
      db,
      "update public.audit_log set summary = 'reecrit' where id = (select min(id) from public.audit_log)",
    )

    expect(failure.message).toMatch(/append-only/)
  })

  it('le journal ne peut pas etre efface', async () => {
    const failure = await expectFailure(
      db,
      'delete from public.audit_log where id = (select min(id) from public.audit_log)',
    )

    expect(failure.message).toMatch(/append-only/)
  })

  it('aucune ecriture directe dans le journal n est possible', async () => {
    const failure = await asUser(db, DEMO.officerA, (c) =>
      expectFailure(
        c,
        `insert into public.audit_log (tenant_id, action, entity_type)
         values ($1, 'login', 'faux')`,
        [DEMO.tenantA],
      ),
    )

    expect(failure.message).toMatch(/row-level security|permission/i)
  })

  it('le journal ne peut pas etre alimente hors de son tenant', async () => {
    const failure = await asUser(db, DEMO.officerB, (c) =>
      expectFailure(c, "select app.log_audit($1, 'export', 'ai_use_case')", [DEMO.tenantA]),
    )

    expect(failure.message).toMatch(/accès refusé au tenant/)
  })
})

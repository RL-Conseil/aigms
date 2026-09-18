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
  it('exige un responsable ; sur un risque modéré, l’avertit et le rappelle à l’échéance', async () => {
    const r = await asUser(db, DEMO.officerA, async (c) => {
      const noOwner = await expectFailure(
        c,
        `insert into public.risk_treatment (tenant_id, risk_id, strategy, description)
         values ($1, $2, 'transfer', 'Sans responsable')`,
        [DEMO.tenantA, DEMO.untreatedRisk],
      )
      // Un risque modere : le traitement vaut une alerte, pas une action.
      const { rows: risk } = await c.query<{ id: string }>(
        `insert into public.risk (tenant_id, organization_id, use_case_id, title, scenario, category,
                                  owner_user_id, inherent_likelihood, inherent_impact)
         values ($1, $2, $3, 'Risque modéré de test', 'scénario', 'operational', $4, 2, 3) returning id`,
        [DEMO.tenantA, DEMO.orgA, DEMO.useCasePilot, DEMO.riskOwnerA],
      )
      const { rows } = await c.query<{ id: string }>(
        `insert into public.risk_treatment (tenant_id, risk_id, strategy, description, owner_user_id, due_date)
         values ($1, $2, 'transfer', 'Clause contractuelle avec le fournisseur', $3, current_date + 20) returning id`,
        [DEMO.tenantA, risk[0]!.id, DEMO.systemOwnerA],
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

  it('réduire exige un contrôle, qui devient applicable au cas d’usage', async () => {
    const r = await asUser(db, DEMO.officerA, async (c) => {
      const noControl = await expectFailure(
        c,
        `insert into public.risk_treatment (tenant_id, risk_id, strategy, description, owner_user_id)
         values ($1, $2, 'reduce', 'Sans contrôle', $3)`,
        [DEMO.tenantA, DEMO.untreatedRisk, DEMO.riskOwnerA],
      )
      const asAccept = await expectFailure(
        c,
        `insert into public.risk_treatment (tenant_id, risk_id, strategy, description, owner_user_id)
         values ($1, $2, 'accept', 'Accepter comme traitement', $3)`,
        [DEMO.tenantA, DEMO.untreatedRisk, DEMO.riskOwnerA],
      )
      // CTL-08 n'est pas encore applicable au pilote : le traitement l'y rend.
      const { rows: ctl } = await c.query<{ id: string }>(
        `select id from public.control where organization_id = $1 and code = 'CTL-08'`, [DEMO.orgA],
      )
      const { rows: t } = await c.query<{ id: string }>(
        `insert into public.risk_treatment (tenant_id, risk_id, strategy, description, owner_user_id, control_id, due_date)
         values ($1, $2, 'reduce', 'Revue périodique des décisions de gouvernance', $3, $4, current_date + 30) returning id`,
        [DEMO.tenantA, DEMO.untreatedRisk, DEMO.riskOwnerA, ctl[0]!.id],
      )
      const { rows: applicability } = await c.query<{ status: string; justification: string }>(
        `select status, justification from public.control_applicability where use_case_id = $1 and control_id = $2`,
        [DEMO.useCasePilot, ctl[0]!.id],
      )
      // Risque critique : une action s'ouvre pour le responsable, bloquante.
      const { rows: action } = await c.query<{ title: string; owner_user_id: string; is_blocking: boolean }>(
        `select title, owner_user_id, is_blocking from public.action where source = 'risk' and source_id = $1`, [t[0]!.id],
      )
      return { noControl, asAccept, applicability: applicability[0], action: action[0] }
    })
    expect(r.noControl.message).toMatch(/désigner le contrôle/)
    expect(r.asAccept.message).toMatch(/n’est pas un traitement|n'est pas un traitement/)
    expect(r.applicability?.status).toBe('applicable')
    expect(r.applicability?.justification).toMatch(/Traite le risque RSK-/)
    expect(r.action?.owner_user_id).toBe(DEMO.riskOwnerA)
    expect(r.action?.is_blocking).toBe(true)
    expect(r.action?.title).toMatch(/Mettre en œuvre le traitement/)
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
      const { rows: decision } = await c.query<{ status: string; decision_type: string; submitted_by: string }>(
        `select d.status, d.decision_type, d.submitted_by from public.decision_link l
           join public.governance_decision d on d.id = l.decision_id
          where l.target_type = 'risk' and l.target_id = $1`,
        [DEMO.untreatedRisk],
      )
      const { rows: settled } = await c.query<{ s: boolean }>(
        `select app.risk_is_settled(r) as s from public.risk r where r.id = $1`, [DEMO.untreatedRisk],
      )
      return { byOfficer, rowCount, decision: decision[0], settled: settled[0]!.s }
    })
    expect(r.byOfficer.message).toMatch(/personne désignée responsable/)
    expect(r.rowCount).toBe(1)
    // Elevé ou critique : l'acceptation ouvre une decision, a approuver par
    // quelqu'un d'autre ; jusque-la, le risque n'est pas solde au gate.
    expect(r.decision).toEqual({ status: 'submitted', decision_type: 'risk_acceptance', submitted_by: DEMO.riskOwnerA })
    expect(r.settled).toBe(false)
  })
})

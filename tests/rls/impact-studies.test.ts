import { afterAll, beforeAll, describe, expect, it } from 'vitest'
import type { Client } from 'pg'
import { asUser, connect, DEMO } from '../helpers/db'

/** 0078 : l'etude d'impact se lit d'un trait, et un prejudice grave ouvre son action. */

let db: Client
beforeAll(async () => {
  db = await connect()
})
afterAll(async () => {
  await db.end()
})

describe('Études d’impact IA', () => {
  it('les études de l’organisation disent lesquelles sont exigées et où elles en sont', async () => {
    const rows = await asUser(db, DEMO.officerA, async (c) => {
      const { rows } = await c.query<{ s: { use_case_id: string; required: boolean; study: { status: string } | null }[] }>(
        'select public.impact_studies($1) as s', [DEMO.orgA],
      )
      return rows[0]!.s
    })
    const pilot = rows.find((r) => r.use_case_id === DEMO.useCasePilot)
    expect(pilot?.required).toBe(true)
    expect(pilot?.study?.status).toBe('in_progress')
    // Les exigees d'abord.
    expect(rows[0]!.required).toBe(true)
  })

  it('un préjudice grave avec mesure et responsable ouvre une action liée au constat', async () => {
    const r = await asUser(db, DEMO.officerA, async (c) => {
      const { rows: study } = await c.query<{ id: string; tenant_id: string }>(
        `select id, tenant_id from public.impact_assessment where use_case_id = $1 and status <> 'superseded' order by created_at desc limit 1`,
        [DEMO.useCasePilot],
      )
      const { rows } = await c.query<{ id: string; action_id: string | null }>(
        `insert into public.impact_finding (tenant_id, impact_assessment_id, domain, description, is_adverse, severity, likelihood, mitigation, owner_user_id, mitigation_due_date)
         values ($1, $2, 'equality_non_discrimination', 'Écart de taux de présélection entre groupes.', true, 'severe', 'likely',
                 'Audit trimestriel des écarts par groupe et seuil d''alerte.', $3, current_date + 45) returning id, action_id`,
        [study[0]!.tenant_id, study[0]!.id, DEMO.officerA],
      )
      const { rows: action } = await c.query<{ status: string; is_blocking: boolean; owner_user_id: string; source: string; source_id: string }>(
        'select status, is_blocking, owner_user_id, source, source_id from public.action where id = $1', [rows[0]!.action_id],
      )
      const { rows: full } = await c.query<{ s: { findings: { id: string; action: { id: string } | null }[] } }>(
        'select public.impact_study($1) as s', [study[0]!.id],
      )
      return { finding: rows[0]!, action: action[0]!, full: full[0]!.s }
    })
    expect(r.finding.action_id).not.toBeNull()
    expect(r.action.status).toBe('open')
    expect(r.action.is_blocking).toBe(true)
    expect(r.action.owner_user_id).toBe(DEMO.officerA)
    expect(r.action.source).toBe('impact_finding')
    expect(r.action.source_id).toBe(r.finding.id)
    expect(r.full.findings.find((f) => f.id === r.finding.id)?.action?.id).toBe(r.finding.action_id)
  })

  it('un bénéfice, ou un préjudice limité, n’ouvre rien', async () => {
    const r = await asUser(db, DEMO.officerA, async (c) => {
      const { rows: study } = await c.query<{ id: string; tenant_id: string }>(
        `select id, tenant_id from public.impact_assessment where use_case_id = $1 and status <> 'superseded' order by created_at desc limit 1`,
        [DEMO.useCasePilot],
      )
      const { rows } = await c.query<{ action_id: string | null }>(
        `insert into public.impact_finding (tenant_id, impact_assessment_id, domain, description, is_adverse, severity, likelihood)
         values ($1, $2, 'employment_working_conditions', 'Gain de temps pour les recruteurs.', false, 'limited', 'likely') returning action_id`,
        [study[0]!.tenant_id, study[0]!.id],
      )
      return rows[0]!
    })
    expect(r.action_id).toBeNull()
  })
})

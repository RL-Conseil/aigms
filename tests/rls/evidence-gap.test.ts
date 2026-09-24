import { afterAll, beforeAll, describe, expect, it } from 'vitest'
import type { Client } from 'pg'
import { asUser, connect, DEMO } from '../helpers/db'

/**
 * L'écart de preuve s'assume, il ne bloque pas (0097–0100).
 *
 * Ce qui est vérifié ici est la règle, pas l'écran : une vérification
 * d'avertissement ne doit JAMAIS faire échouer le gate, et une mise en
 * production qui laisse des contrôles sans preuve ne doit pas pouvoir se
 * soumettre en silence.
 */

type GateCheck = { code: string; label: string; satisfied: boolean; severity?: string; gap?: unknown[] }
type Gate = { satisfied: boolean; checks: GateCheck[] }

let db: Client
beforeAll(async () => {
  db = await connect()
})
afterAll(async () => {
  await db.end()
})

const gate = async (c: Client, useCaseId: string): Promise<Gate> =>
  (await c.query<{ r: Gate }>('select app.evaluate_production_gate($1) as r', [useCaseId])).rows[0]!.r

describe('Écart de preuve à la mise en production', () => {
  it('la vérification existe, et elle avertit sans retenir le jalon', async () => {
    const g = await asUser(db, DEMO.officerA, (c) => gate(c, DEMO.useCasePilot))
    const check = g.checks.find((c) => c.code === 'CONTROLS_EVIDENCED')
    expect(check).toBeDefined()
    expect(check!.severity).toBe('warning')
  })

  it('la synthèse ignore les avertissements', async () => {
    const g = await asUser(db, DEMO.officerA, (c) => gate(c, DEMO.useCasePilot))
    const bloquantes = g.checks.filter((c) => (c.severity ?? 'blocking') === 'blocking')
    // Le gate ne vaut que ce que disent ses vérifications bloquantes.
    expect(g.satisfied).toBe(bloquantes.every((c) => c.satisfied))
  })

  it('l’écart nomme les contrôles, il ne les compte pas', async () => {
    const rows = await asUser(db, DEMO.officerA, (c) =>
      c.query<{ r: { code: string; name: string }[] }>('select app.control_evidence_gap($1) as r', [
        DEMO.useCasePilot,
      ]),
    )
    for (const entry of rows.rows[0]!.r) {
      expect(entry.code).toBeTruthy()
      expect(entry.name).toBeTruthy()
    }
  })

  it('une mise en production sans preuve ne se soumet pas sans explication', async () => {
    const gap = await asUser(db, DEMO.officerA, (c) =>
      c.query<{ n: number }>('select jsonb_array_length(app.control_evidence_gap($1)) as n', [
        DEMO.useCasePilot,
      ]),
    )
    // Le jeu de démonstration doit porter un écart, sinon la règle n'est pas
    // éprouvée et ce test ne prouve rien.
    expect(gap.rows[0]!.n).toBeGreaterThan(0)

    await expect(
      asUser(db, DEMO.officerA, async (c) => {
        const org = await c.query<{ organization_id: string; tenant_id: string }>(
          'select organization_id, tenant_id from public.ai_use_case where id = $1',
          [DEMO.useCasePilot],
        )
        await c.query(
          `insert into public.governance_decision
             (tenant_id, organization_id, use_case_id, business_ref, decision_type, subject,
              decision_statement, rationale, status, submitted_at)
           values ($1, $2, $3, 'TEST-GAP-1', 'go_production', 'Essai',
                   'Mise en production', 'Motivation suffisante pour le test.', 'submitted', now())`,
          [org.rows[0]!.tenant_id, org.rows[0]!.organization_id, DEMO.useCasePilot],
        )
      }),
    ).rejects.toThrow(/sans preuve/)
  })
})

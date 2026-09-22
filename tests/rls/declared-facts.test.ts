import { afterAll, beforeAll, describe, expect, it } from 'vitest'
import type { Client } from 'pg'
import { asUser, becomeUser, connect, DEMO, expectFailure } from '../helpers/db'

/** 0082 : les faits déclarés — grille, qualification, fiche — atteignent les règles. */

let db: Client
beforeAll(async () => {
  db = await connect()
})
afterAll(async () => {
  await db.end()
})

describe('Faits déclarés et règles', () => {
  it('des données sensibles exigent l’AIIA, portent la criticité observée et proposent leurs contrôles', async () => {
    const r = await asUser(db, DEMO.officerA, async (c) => {
      const { rows: uc } = await c.query<{ id: string }>(
        `insert into public.ai_use_case (tenant_id, organization_id, name, purpose, owner_user_id, accountable_user_id, autonomy_level, criticality)
         values ($1, $2, 'Cas sensible', 'Test des faits déclarés.', $3, $3, 'L0', 'moderate') returning id`,
        [DEMO.tenantA, DEMO.orgA, DEMO.officerA],
      )
      const read = async () => {
        const { rows } = await c.query<{ req: boolean; reason: string | null; signal: { observed: string | null; exceeds: boolean }; facts: string[] }>(
          `select app.impact_assessment_required($1) as req,
                  app.impact_assessment_reason($1) as reason,
                  public.criticality_signal($1) as signal,
                  (select array(select jsonb_array_elements_text(public.suggest_controls($1) -> 'facts'))) as facts`,
          [uc[0]!.id],
        )
        return rows[0]!
      }
      const before = await read()
      await c.query('update public.ai_use_case set involves_sensitive_data = true where id = $1', [uc[0]!.id])
      const after = await read()
      const { rows: proposals } = await c.query<{ codes: string[] }>(
        `select array(select p ->> 'code' from jsonb_array_elements(public.suggest_controls($1) -> 'proposals') p) as codes`,
        [uc[0]!.id],
      )
      return { before, after, codes: proposals[0]!.codes, useCaseId: uc[0]!.id }
    })
    expect(r.before.req).toBe(false)
    expect(r.after.req).toBe(true)
    expect(r.after.reason).toContain('données sensibles')
    expect(r.after.signal.observed).toBe('high')
    expect(r.after.signal.exceeds).toBe(true)
    expect(r.after.facts).toEqual(expect.arrayContaining(['sensitive_data', 'personal_data']))
    expect(r.codes).toEqual(expect.arrayContaining(['AIGMS-DAT-005', 'AIGMS-DAT-006', 'AIGMS-DAT-009']))
  })

  it('une étude d’impact ne s’achève pas sans AIPD quand les données sont sensibles', async () => {
    await asUser(db, DEMO.officerA, async (c) => {
      const { rows: uc } = await c.query<{ id: string }>(
        `insert into public.ai_use_case (tenant_id, organization_id, name, purpose, owner_user_id, accountable_user_id, involves_sensitive_data)
         values ($1, $2, 'Cas AIPD', 'Test AIPD.', $3, $4, true) returning id`,
        [DEMO.tenantA, DEMO.orgA, DEMO.systemOwnerA, DEMO.officerA],
      )
      const { rows: ia } = await c.query<{ id: string }>(
        `insert into public.impact_assessment (tenant_id, organization_id, use_case_id, scope_description, status)
         values ($1, $2, $3, 'Périmètre de test de l’étude d’impact.', 'in_progress') returning id`,
        [DEMO.tenantA, DEMO.orgA, uc[0]!.id],
      )
      // Le visa de methode ne suffit pas : sans reference d'AIPD, l'achevement
      // est refuse — et il faut les deux signatures (0091).
      await c.query(
        `update public.impact_assessment set status = 'awaiting_signature', conclusion = 'Effets acceptables.', method_signed_at = now() where id = $1`,
        [ia[0]!.id],
      )
      // L'acceptation revient au Porteur : une meme personne ne signe pas deux fois.
      await becomeUser(c, DEMO.systemOwnerA)
      const refused = await expectFailure(
        c,
        `select public.accept_residual_risks($1, 'J''assume ce qui reste.')`,
        [ia[0]!.id],
      )
      expect(refused.message).toMatch(/données sensibles/)
      await becomeUser(c, DEMO.officerA)
      await c.query(
        `update public.impact_assessment set dpia_required = true, dpia_reference = 'AIPD-2026-01' where id = $1`,
        [ia[0]!.id],
      )
      await becomeUser(c, DEMO.systemOwnerA)
      await c.query(`select public.accept_residual_risks($1, 'J''assume ce qui reste, sous AIPD.')`, [ia[0]!.id])
      await becomeUser(c, DEMO.officerA)
      const { rows } = await c.query<{ status: string }>('select status from public.impact_assessment where id = $1', [ia[0]!.id])
      expect(rows[0]!.status).toBe('completed')
    })
  })

  it('« obligations de transparence » propose enfin l’information des personnes', async () => {
    const codes = await asUser(db, DEMO.officerA, async (c) => {
      const { rows } = await c.query<{ codes: string[] }>(
        `select array(select p ->> 'code' from jsonb_array_elements(public.suggest_controls($1) -> 'proposals') p) as codes`,
        [DEMO.useCaseProduction],
      )
      return rows[0]!.codes
    })
    expect(codes).toContain('AIGMS-HUM-006')
  })
})

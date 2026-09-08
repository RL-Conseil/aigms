import { afterAll, beforeAll, describe, expect, it } from 'vitest'
import type { Client } from 'pg'
import { asUser, connect, DEMO, expectFailure } from '../helpers/db'

/**
 * RBAC : un role en lecture seule ne doit jamais satisfaire une clause
 * WITH CHECK, et les privileges plateforme ne s'auto-attribuent pas.
 */

let db: Client

beforeAll(async () => {
  db = await connect()
})

afterAll(async () => {
  await db.end()
})

describe('RBAC', () => {
  it("l'auditeur lit l'ensemble de son perimetre", async () => {
    // Comparaison a ce que voit l'officer plutot qu'a un decompte fige : les
    // parcours de bout en bout ecrivent dans la meme base, et un nombre absolu
    // deviendrait faux au premier cas d'usage cree.
    const [auditor, officer] = await Promise.all([
      asUser(db, DEMO.auditorA, async (c) => {
        const { rows } = await c.query('select id from public.ai_use_case')
        return rows.length
      }),
      asUser(db, DEMO.officerA, async (c) => {
        const { rows } = await c.query('select id from public.ai_use_case')
        return rows.length
      }),
    ])

    expect(auditor).toBe(officer)
    expect(auditor).toBeGreaterThanOrEqual(3)
  })

  it("l'auditeur ne peut pas creer de cas d'usage", async () => {
    const failure = await asUser(db, DEMO.auditorA, (c) =>
      expectFailure(
        c,
        `insert into public.ai_use_case (tenant_id, organization_id, name, purpose, autonomy_level)
         values ($1, $2, 'Cree par un auditeur', 'Ne doit pas aboutir', 'L0')`,
        [DEMO.tenantA, DEMO.orgA],
      ),
    )

    expect(failure.message).toMatch(/row-level security/i)
  })

  it("l'auditeur ne peut pas modifier une decision", async () => {
    const updated = await asUser(db, DEMO.auditorA, async (c) => {
      const result = await c.query(
        "update public.governance_decision set rationale = 'modifie' where use_case_id = $1",
        [DEMO.useCaseProduction],
      )
      return result.rowCount
    })

    expect(updated).toBe(0)
  })

  it("le porteur du systeme ne peut pas creer de controle", async () => {
    // control est reserve aux roles de gouvernance : le porteur alimente le
    // dossier, il ne definit pas le referentiel de controle.
    const failure = await asUser(db, DEMO.systemOwnerA, (c) =>
      expectFailure(
        c,
        `insert into public.control (tenant_id, organization_id, code, name, objective)
         values ($1, $2, 'CTL-99', 'Controle improvise', 'Ne doit pas aboutir')`,
        [DEMO.tenantA, DEMO.orgA],
      ),
    )

    expect(failure.message).toMatch(/row-level security/i)
  })

  it("le porteur du systeme peut deposer une preuve", async () => {
    const inserted = await asUser(db, DEMO.systemOwnerA, async (c) => {
      const { rows } = await c.query<{ business_ref: string }>(
        `insert into public.evidence
           (tenant_id, organization_id, title, evidence_type, source, external_url, owner_user_id)
         values ($1, $2, 'Capture de la banniere', 'screenshot', 'Recette', 'https://demo.local/x.png', $3)
         returning business_ref`,
        [DEMO.tenantA, DEMO.orgA, DEMO.systemOwnerA],
      )
      return rows[0]?.business_ref
    })

    expect(inserted).toMatch(/^EVD-\d{4}-\d{4}$/)
  })

  it("un utilisateur ne peut pas s'octroyer le privilege plateforme", async () => {
    const failure = await asUser(db, DEMO.officerA, (c) =>
      expectFailure(c, 'update public.user_profile set is_platform_admin = true where id = $1', [
        DEMO.officerA,
      ]),
    )

    expect(failure.message).toMatch(/administrateur plateforme/i)
  })

  it("un officer ne peut pas creer de tenant", async () => {
    const failure = await asUser(db, DEMO.officerA, (c) =>
      expectFailure(
        c,
        "insert into public.tenant (slug, name) values ('cabinet-pirate', 'Cabinet pirate')",
      ),
    )

    expect(failure.message).toMatch(/row-level security/i)
  })

  it('le journal d audit est reserve aux roles de gouvernance et d audit', async () => {
    const asOwner = await asUser(db, DEMO.systemOwnerA, async (c) => {
      const { rows } = await c.query('select id from public.audit_log')
      return rows.length
    })

    const asAuditor = await asUser(db, DEMO.auditorA, async (c) => {
      const { rows } = await c.query('select id from public.audit_log')
      return rows.length
    })

    expect(asOwner).toBe(0)
    expect(asAuditor).toBeGreaterThan(0)
  })
})

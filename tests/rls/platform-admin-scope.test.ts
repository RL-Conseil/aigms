import { afterAll, beforeAll, describe, expect, it } from 'vitest'
import type { Client } from 'pg'
import { asUser, connect, DEMO, expectFailure } from '../helpers/db'

/**
 * Perimetre du role d'administration plateforme.
 *
 * Il ouvre l'acces : organisations, comptes, attributions de role. Il ne
 * gouverne pas : ni cas d'usage, ni risque, ni decision, ni transition. Ces
 * tests verrouillent la frontiere dans les deux sens.
 */

const ADMIN = '66666666-6666-4666-8666-666666666666'

let db: Client

beforeAll(async () => {
  db = await connect()
})

afterAll(async () => {
  await db.end()
})

describe("Ce que l'administration plateforme peut faire", () => {
  it('creer une organisation dans son portefeuille', async () => {
    const ref = await asUser(db, ADMIN, async (c) => {
      const { rows } = await c.query<{ business_ref: string }>(
        `insert into public.organization (tenant_id, name, sector, country_code, status)
         values ($1, 'Nouvelle Cliente', 'Industrie', 'FR', 'prospect')
         returning business_ref`,
        [DEMO.tenantA],
      )
      return rows[0]?.business_ref
    })

    expect(ref).toMatch(/^ORG-\d{4}-\d{4}$/)
  })

  it('declarer un compte sur le tenant et lui donner un role', async () => {
    const inserted = await asUser(db, ADMIN, async (c) => {
      const result = await c.query(
        `insert into public.membership (tenant_id, user_id, role, invited_by)
         values ($1, $2, 'reviewer', $3)
         on conflict (tenant_id, user_id) do update set role = 'reviewer'`,
        [DEMO.tenantA, DEMO.auditorA, ADMIN],
      )
      return result.rowCount
    })

    expect(inserted).toBe(1)
  })

  it('affecter un role sur une organisation donnee', async () => {
    const inserted = await asUser(db, ADMIN, async (c) => {
      const result = await c.query(
        `insert into public.role_assignment (tenant_id, organization_id, user_id, role, granted_by)
         values ($1, $2, $3, 'executive_viewer', $4)`,
        [DEMO.tenantA, DEMO.orgA, DEMO.systemOwnerA, ADMIN],
      )
      return result.rowCount
    })

    expect(inserted).toBe(1)
  })

  it('lire le portefeuille pour l administrer', async () => {
    const seen = await asUser(db, ADMIN, async (c) => {
      const { rows } = await c.query('select id from public.ai_use_case')
      return rows.length
    })

    expect(seen).toBeGreaterThan(0)
  })
})

describe("Ce que l'administration plateforme ne peut pas faire", () => {
  it('declarer un cas d usage', async () => {
    const failure = await asUser(db, ADMIN, (c) =>
      expectFailure(
        c,
        `insert into public.ai_use_case (tenant_id, organization_id, name, purpose, autonomy_level)
         values ($1, $2, 'Cree par l administration', 'Ne doit pas aboutir', 'L0')`,
        [DEMO.tenantA, DEMO.orgA],
      ),
    )

    expect(failure.message).toMatch(/row-level security/i)
  })

  it('faire evoluer un cas d usage', async () => {
    const failure = await asUser(db, ADMIN, (c) =>
      expectFailure(c, "select app.transition_use_case($1, 'ASSESSMENT', 'tentative')", [
        DEMO.useCaseTriage,
      ]),
    )

    expect(failure.message).toMatch(/Habilitation insuffisante/)
  })

  it('coter ou accepter un risque', async () => {
    const failure = await asUser(db, ADMIN, (c) =>
      expectFailure(
        c,
        `insert into public.risk (tenant_id, organization_id, use_case_id, title, scenario,
                                  category, inherent_likelihood, inherent_impact)
         values ($1, $2, $3, 'Risque administratif', 'Ne doit pas aboutir', 'operational', 2, 2)`,
        [DEMO.tenantA, DEMO.orgA, DEMO.useCaseProduction],
      ),
    )

    expect(failure.message).toMatch(/row-level security/i)
  })

  it('instruire ou approuver une decision', async () => {
    const failure = await asUser(db, ADMIN, (c) =>
      expectFailure(
        c,
        `insert into public.governance_decision
           (tenant_id, organization_id, use_case_id, decision_type, subject)
         values ($1, $2, $3, 'go_production', 'Decision administrative')`,
        [DEMO.tenantA, DEMO.orgA, DEMO.useCasePilot],
      ),
    )

    expect(failure.message).toMatch(/row-level security/i)
  })

  it('creer un controle', async () => {
    const failure = await asUser(db, ADMIN, (c) =>
      expectFailure(
        c,
        `insert into public.control (tenant_id, organization_id, code, name, objective)
         values ($1, $2, 'CTL-ADM', 'Controle administratif', 'Ne doit pas aboutir')`,
        [DEMO.tenantA, DEMO.orgA],
      ),
    )

    expect(failure.message).toMatch(/row-level security/i)
  })

  it('s attribuer le privilege plateforme a quelqu un d autre', async () => {
    const failure = await asUser(db, ADMIN, (c) =>
      expectFailure(
        c,
        `insert into public.membership (tenant_id, user_id, role)
         values ($1, $2, 'platform_admin')`,
        [DEMO.tenantA, DEMO.systemOwnerA],
      ),
    )

    expect(failure.message).toMatch(/ne peut pas être attribué depuis l/)
  })

  it('attribuer le role client_admin, qui porte des droits de gouvernance etendus', async () => {
    const failure = await asUser(db, ADMIN, (c) =>
      expectFailure(
        c,
        `insert into public.role_assignment (tenant_id, organization_id, user_id, role)
         values ($1, $2, $3, 'client_admin')`,
        [DEMO.tenantA, DEMO.orgA, DEMO.systemOwnerA],
      ),
    )

    expect(failure.message).toMatch(/ne peut pas être attribué depuis l/)
  })
})

describe('Ce que les roles de gouvernance ne peuvent plus faire', () => {
  it("l'officer ne cree plus d'organisation : c'est un acte d'administration", async () => {
    const failure = await asUser(db, DEMO.officerA, (c) =>
      expectFailure(
        c,
        `insert into public.organization (tenant_id, name, status)
         values ($1, 'Cree par un officer', 'prospect')`,
        [DEMO.tenantA],
      ),
    )

    expect(failure.message).toMatch(/row-level security/i)
  })

  it("l'officer ne declare plus de compte ni n'attribue de role", async () => {
    const membership = await asUser(db, DEMO.officerA, (c) =>
      expectFailure(
        c,
        `insert into public.membership (tenant_id, user_id, role) values ($1, $2, 'reviewer')`,
        [DEMO.tenantA, DEMO.officerB],
      ),
    )
    const assignment = await asUser(db, DEMO.officerA, (c) =>
      expectFailure(
        c,
        `insert into public.role_assignment (tenant_id, organization_id, user_id, role)
         values ($1, $2, $3, 'reviewer')`,
        [DEMO.tenantA, DEMO.orgA, DEMO.officerB],
      ),
    )

    expect(membership.message).toMatch(/row-level security/i)
    expect(assignment.message).toMatch(/row-level security/i)
  })

  it("l'officer conserve la gouvernance de ses cas d'usage", async () => {
    const result = await asUser(db, DEMO.officerA, async (c) => {
      const { rows } = await c.query<{ r: { transitioned: boolean } }>(
        "select app.transition_use_case($1, 'ASSESSMENT', 'triage acheve') as r",
        [DEMO.useCaseTriage],
      )
      return rows[0]!.r
    })

    expect(result.transitioned).toBe(true)
  })
})

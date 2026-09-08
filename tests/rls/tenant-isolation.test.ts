import { afterAll, beforeAll, describe, expect, it } from 'vitest'
import type { Client } from 'pg'
import { asUser, connect, countVisible, DEMO, expectFailure } from '../helpers/db'

/**
 * Exit gate du Sprint 0 : le tenant A ne peut ni lire ni ecrire le tenant B.
 */

let db: Client

beforeAll(async () => {
  db = await connect()
})

afterAll(async () => {
  await db.end()
})

describe('Isolation cross-tenant', () => {
  it("l'officer du tenant A ne voit que les organisations de son tenant", async () => {
    const rows = await asUser(db, DEMO.officerA, async (c) => {
      const { rows } = await c.query<{ id: string; tenant_id: string }>(
        'select id, tenant_id from public.organization',
      )
      return rows
    })

    expect(rows.length).toBeGreaterThan(0)
    expect(rows.every((r) => r.tenant_id === DEMO.tenantA)).toBe(true)
    expect(rows.some((r) => r.id === DEMO.orgB)).toBe(false)
  })

  it("l'officer du tenant B ne voit aucune donnee du tenant A", async () => {
    // Le tenant B porte ses propres lignes — ses traces d'administration, par
    // exemple. Ce qui doit valoir zero, c'est ce qui appartient au tenant A.
    const fromTenantA = await asUser(db, DEMO.officerB, async (c) => {
      const counts: Record<string, number> = {}
      for (const table of [
        'ai_use_case',
        'risk',
        'governance_decision',
        'evidence',
        'audit_log',
        'control',
      ]) {
        const { rows } = await c.query<{ n: string }>(
          `select count(*)::text as n from public.${table} where tenant_id = $1`,
          [DEMO.tenantA],
        )
        counts[table] = Number(rows[0]?.n ?? '0')
      }
      return counts
    })

    expect(Object.values(fromTenantA).every((n) => n === 0)).toBe(true)
  })

  it("l'officer du tenant B voit bien les traces de son propre tenant", async () => {
    const own = await asUser(db, DEMO.officerB, async (c) => {
      const { rows } = await c.query<{ n: string }>(
        'select count(*)::text as n from public.audit_log where tenant_id = $1',
        [DEMO.tenantB],
      )
      return Number(rows[0]?.n ?? '0')
    })

    expect(own).toBeGreaterThan(0)
  })

  it('un cas d usage du tenant A est invisible pour le tenant B, meme cible par son identifiant', async () => {
    const rows = await asUser(db, DEMO.officerB, async (c) => {
      const { rows } = await c.query('select id from public.ai_use_case where id = $1', [
        DEMO.useCaseProduction,
      ])
      return rows
    })

    expect(rows).toHaveLength(0)
  })

  it('le tenant B ne peut pas ecrire dans le tenant A', async () => {
    // La politique WITH CHECK refuse l'insertion : PostgREST la traduirait en 403.
    const failure = await asUser(db, DEMO.officerB, (c) =>
      expectFailure(
        c,
        `insert into public.ai_use_case (tenant_id, organization_id, name, purpose, autonomy_level)
         values ($1, $2, 'Injection', 'Tentative d insertion cross-tenant', 'L0')`,
        [DEMO.tenantA, DEMO.orgA],
      ),
    )

    expect(failure.message).toMatch(/row-level security|violates/i)
  })

  it('le tenant B ne peut pas modifier une ligne du tenant A', async () => {
    const updated = await asUser(db, DEMO.officerB, async (c) => {
      const result = await c.query(
        "update public.ai_use_case set name = 'Detourne' where id = $1",
        [DEMO.useCaseProduction],
      )
      return result.rowCount
    })

    // La ligne n'est pas visible : l'UPDATE ne touche rien plutot que d'echouer.
    expect(updated).toBe(0)
  })

  it('une ligne ne peut pas etre deplacee vers un autre tenant', async () => {
    const failure = await asUser(db, DEMO.officerA, (c) =>
      expectFailure(c, 'update public.organization set tenant_id = $1 where id = $2', [
        DEMO.tenantB,
        DEMO.orgA,
      ]),
    )

    expect(failure.message).toMatch(/row-level security|violates/i)
  })

  it('un utilisateur non authentifie ne voit rien', async () => {
    const seen = await asUser(db, null, async (c) => ({
      tenants: await countVisible(c, 'tenant'),
      useCases: await countVisible(c, 'ai_use_case'),
    }))

    expect(seen).toEqual({ tenants: 0, useCases: 0 })
  })

  it('la coherence de tenant est verifiee cote serveur, hors RLS', async () => {
    // Meme un acteur habilite ne peut rattacher une ligne a une organisation
    // d'un autre tenant : le trigger assert_tenant_consistency le refuse.
    const failure = await expectFailure(
      db,
      `insert into public.business_unit (tenant_id, organization_id, name)
       values ($1, $2, 'Entite incoherente')`,
      [DEMO.tenantB, DEMO.orgA],
    )

    expect(failure.message).toMatch(/incohérence de tenant/i)
  })
})

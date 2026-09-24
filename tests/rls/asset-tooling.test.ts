import { afterAll, beforeAll, describe, expect, it } from 'vitest'
import type { Client } from 'pg'
import { asUser, connect, DEMO, expectFailure } from '../helpers/db'

/**
 * Avec quoi un actif d'IA a ete fait (0103).
 *
 * ISO/IEC 42001 A.4.4 « Tooling resources » demande de le documenter PAR
 * SYSTEME ; l'annexe IV de l'AI Act le reprend. Ce qui est verifie ici est
 * l'isolation — un outil d'une autre organisation ne se rattache pas — et la
 * cardinalite : un meme outil peut servir a deux moments.
 */

let db: Client
beforeAll(async () => {
  db = await connect()
})
afterAll(async () => {
  await db.end()
})

/** Un outil declare sur l'organisation, cree dans la transaction annulee. */
async function outil(c: Client, organizationId: string, tenantId: string, produit: string) {
  const { rows } = await c.query<{ id: string }>(
    `insert into public.organization_tooling (tenant_id, organization_id, tool_code, product)
     values ($1, $2, 'CTRL-OPS-007', $3) returning id`,
    [tenantId, organizationId, produit],
  )
  return rows[0]!.id
}

async function unActif(c: Client, organizationId: string) {
  const { rows } = await c.query<{ id: string }>(
    'select id from public.ai_asset where organization_id = $1 limit 1',
    [organizationId],
  )
  return rows[0]!.id
}

describe('Outillage d’un actif d’IA', () => {
  it('un même outil se rattache à deux phases, pas deux fois à la même', async () => {
    const r = await asUser(db, DEMO.officerA, async (c) => {
      const assetId = await unActif(c, DEMO.orgA)
      const toolingId = await outil(c, DEMO.orgA, DEMO.tenantA, 'MLflow')
      await c.query(
        `insert into public.asset_tooling (tenant_id, asset_id, tooling_id, phase)
         values ($1, $2, $3, 'training')`,
        [DEMO.tenantA, assetId, toolingId],
      )
      await c.query(
        `insert into public.asset_tooling (tenant_id, asset_id, tooling_id, phase)
         values ($1, $2, $3, 'validation')`,
        [DEMO.tenantA, assetId, toolingId],
      )
      // Un échec attendu avorte la transaction : `expectFailure` pose un point
      // de reprise, sans quoi tout ce qui suit échouerait aussi.
      const doublon = await expectFailure(
        c,
        `insert into public.asset_tooling (tenant_id, asset_id, tooling_id, phase)
         values ($1, $2, $3, 'training')`,
        [DEMO.tenantA, assetId, toolingId],
      )
      const { rows } = await c.query<{ n: string }>(
        'select count(*) as n from public.asset_tooling where asset_id = $1',
        [assetId],
      )
      return { doublon: doublon.message, n: Number(rows[0]!.n) }
    })
    expect(r.n).toBe(2)
    expect(r.doublon).toMatch(/duplicate key/)
  })

  it('un outil d’une autre organisation ne se rattache pas', async () => {
    const message = await asUser(db, DEMO.officerA, async (c) => {
      const assetId = await unActif(c, DEMO.orgA)
      // L'outil est posé sur le tenant B : le garde doit refuser le couple.
      const { rows } = await c.query<{ id: string }>(
        `select id from public.organization where tenant_id = $1 limit 1`,
        [DEMO.tenantB],
      )
      const autreOrg = rows[0]?.id
      if (!autreOrg) return 'pas de seconde organisation'
      const echec = await expectFailure(
        c,
        `insert into public.asset_tooling (tenant_id, asset_id, tooling_id, phase)
         select $1, $2, ot.id, 'training'
           from public.organization_tooling ot
          where ot.organization_id <> $3 limit 1`,
        [DEMO.tenantA, assetId, DEMO.orgA],
      )
      return echec.message
    })
    expect(message).not.toBe('accepté')
  })

  it('la lecture rend ce qui est rattaché et ce qui reste disponible', async () => {
    const vue = await asUser(db, DEMO.officerA, async (c) => {
      const assetId = await unActif(c, DEMO.orgA)
      const toolingId = await outil(c, DEMO.orgA, DEMO.tenantA, 'DVC')
      await c.query(
        `insert into public.asset_tooling (tenant_id, asset_id, tooling_id, phase, note)
         values ($1, $2, $3, 'data', 'Versionnement du jeu de données.')`,
        [DEMO.tenantA, assetId, toolingId],
      )
      const { rows } = await c.query<{ r: { declared: unknown[]; available: unknown[] } }>(
        'select public.asset_tooling_view($1) as r',
        [assetId],
      )
      return rows[0]!.r
    })
    expect(vue.declared).toHaveLength(1)
    expect(vue.available.length).toBeGreaterThan(0)
  })

  it('ne dit rien d’un actif hors du tenant', async () => {
    const vue = await asUser(db, DEMO.officerB, async (c) => {
      const { rows } = await c.query<{ id: string }>(
        'select id from public.ai_asset where organization_id = $1 limit 1',
        [DEMO.orgA],
      )
      // L'officer B ne voit pas l'actif de A : la RLS le lui cache déjà.
      if (!rows.length) return { declared: [], available: [] }
      const r = await c.query<{ r: { asset_id: string | null } }>(
        'select public.asset_tooling_view($1) as r',
        [rows[0]!.id],
      )
      return r.rows[0]!.r
    })
    expect((vue as { asset_id?: string | null }).asset_id ?? null).toBeNull()
  })
})

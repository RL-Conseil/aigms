import { afterAll, beforeAll, describe, expect, it } from 'vitest'
import type { Client } from 'pg'
import { asUser, connect, DEMO, expectFailure } from '../helpers/db'

/**
 * Referentiels de l'editeur et des tenants ; instanciation d'un controle-type.
 */

let db: Client
beforeAll(async () => {
  db = await connect()
})
afterAll(async () => {
  await db.end()
})

async function catalogControl(c: Client, code: string): Promise<string> {
  const { rows } = await c.query<{ id: string }>(
    'select id from public.catalog_control where control_code = $1 limit 1',
    [code],
  )
  return rows[0]!.id
}

describe('Référentiel de l’éditeur', () => {
  it('est livré publié, 120 contrôles dont 42 enrichis, visible de tout tenant', async () => {
    for (const who of [DEMO.officerA, DEMO.officerB]) {
      const row = await asUser(db, who, async (c) => {
        const { rows } = await c.query<{ n: string; enriched: string; status: string }>(
          `select count(cc.*)::text as n, count(cc.objective)::text as enriched, min(v.status::text) as status
             from public.catalog_control cc
             join public.catalog_version v on v.id = cc.version_id
             join public.catalog_framework f on f.id = v.framework_id
            where f.code = 'AIGMS-CF' and f.tenant_id is null`,
        )
        return rows[0]!
      })
      expect(Number(row.n)).toBe(120)
      expect(Number(row.enriched)).toBe(42)
      expect(row.status).toBe('published')
    }
  })

  it('ne se modifie pas depuis l’application, même par l’administration', async () => {
    const touched = await asUser(db, DEMO.platformAdmin, async (c) => {
      const { rowCount } = await c.query(
        "update public.catalog_framework set name = 'Piraté' where code = 'AIGMS-CF' and tenant_id is null",
      )
      return rowCount
    })
    expect(touched).toBe(0)
  })
})

describe('Référentiel d’un tenant', () => {
  it('reste invisible de l’autre tenant', async () => {
    const seen = await asUser(db, DEMO.platformAdmin, async (c) => {
      // L'administration de A importe (directement, hors moteur : le test porte
      // sur la visibilite, pas sur la validation).
      const { rows } = await c.query<{ id: string }>(
        `insert into public.catalog_framework (tenant_id, code, name)
         values ($1, 'CAB-A', 'Référentiel du cabinet A') returning id`,
        [DEMO.tenantA],
      )
      await c.query("select set_config('request.jwt.claims', $1, true)", [
        JSON.stringify({ sub: DEMO.officerB, role: 'authenticated' }),
      ])
      const { rows: other } = await c.query('select id from public.catalog_framework where id = $1', [rows[0]!.id])
      await c.query("select set_config('request.jwt.claims', $1, true)", [
        JSON.stringify({ sub: DEMO.officerA, role: 'authenticated' }),
      ])
      const { rows: mine } = await c.query('select id from public.catalog_framework where id = $1', [rows[0]!.id])
      return { other: other.length, mine: mine.length }
    })
    expect(seen.other).toBe(0)
    expect(seen.mine).toBe(1)
  })
})

describe('Instanciation d’un contrôle-type', () => {
  it('crée le contrôle opérationnel, lien conservé, exigences ISO 42001 rattachées', async () => {
    const result = await asUser(db, DEMO.officerA, async (c) => {
      const id = await catalogControl(c, 'AIGMS-RSK-012')
      const { rows } = await c.query<{ r: { control_id: string; mapped_requirements: number; unmapped_references: string[] } }>(
        'select app.instantiate_catalog_control($1, $2) as r',
        [DEMO.orgA, id],
      )
      const { rows: ctl } = await c.query<{ code: string; status: string; is_mandatory: boolean; catalog_control_id: string }>(
        'select code, status, is_mandatory, catalog_control_id from public.control where id = $1',
        [rows[0]!.r.control_id],
      )
      const { rows: maps } = await c.query<{ n: string }>(
        'select count(*)::text as n from public.control_requirement_map where control_id = $1',
        [rows[0]!.r.control_id],
      )
      return { ...rows[0]!.r, control: ctl[0]!, maps: Number(maps[0]!.n), catalogId: id }
    })
    expect(result.control.code).toBe('AIGMS-RSK-012')
    expect(result.control.status).toBe('proposed')
    expect(result.control.is_mandatory).toBe(true)
    expect(result.control.catalog_control_id).toBe(result.catalogId)
    expect(result.mapped_requirements).toBe(3)
    expect(result.maps).toBe(3)
    expect(result.unmapped_references[0]).toMatch(/AI_ACT/)
  })

  it('refuse une seconde instance du même modèle chez la même organisation', async () => {
    const failure = await asUser(db, DEMO.officerA, async (c) => {
      const id = await catalogControl(c, 'AIGMS-GOV-001')
      await c.query('select app.instantiate_catalog_control($1, $2)', [DEMO.orgA, id])
      return expectFailure(c, 'select app.instantiate_catalog_control($1, $2)', [DEMO.orgA, id])
    })
    expect(failure.message).toMatch(/déjà instancié/)
  })

  it('relève des rôles de gouvernance : le porteur du système ne le fait pas', async () => {
    const failure = await asUser(db, DEMO.systemOwnerA, async (c) => {
      const id = await catalogControl(c, 'AIGMS-GOV-002')
      return expectFailure(c, 'select app.instantiate_catalog_control($1, $2)', [DEMO.orgA, id])
    })
    expect(failure.message).toMatch(/rôles de gouvernance/)
  })

  it('la liste proposée à une organisation signale ce qui est déjà présent', async () => {
    const row = await asUser(db, DEMO.officerA, async (c) => {
      const id = await catalogControl(c, 'AIGMS-USE-010')
      await c.query('select app.instantiate_catalog_control($1, $2)', [DEMO.orgA, id])
      const { rows } = await c.query<{ instantiated_control_id: string | null; is_editor: boolean }>(
        "select instantiated_control_id, is_editor from public.catalog_controls_for($1) where code = 'AIGMS-USE-010'",
        [DEMO.orgA],
      )
      return rows[0]!
    })
    expect(row.instantiated_control_id).not.toBeNull()
    expect(row.is_editor).toBe(true)
  })
})

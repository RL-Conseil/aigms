import { afterAll, beforeAll, describe, expect, it } from 'vitest'
import type { Client } from 'pg'
import { asUser, connect, DEMO, expectFailure } from '../helpers/db'

/**
 * 0060 : chaque controle a une nature ; une mesure technique se pose sur un
 * actif de la meme organisation, et se lit avec lui.
 */

let db: Client
beforeAll(async () => {
  db = await connect()
})
afterAll(async () => {
  await db.end()
})

describe('Natures de mesure', () => {
  it('chaque contrôle a une nature, déduite du domaine du contrôle-type', async () => {
    const r = await asUser(db, DEMO.officerA, async (c) => {
      const { rows: nulls } = await c.query<{ n: string }>('select count(*)::text as n from public.control where measure_kind is null')
      const { rows: sec } = await c.query<{ measure_kind: string }>(
        `select cc.measure_kind from public.catalog_control cc join public.catalog_domain d on d.id = cc.domain_id
          where d.code = 'SEC' limit 1`,
      )
      const { rows: sup } = await c.query<{ measure_kind: string }>(
        `select cc.measure_kind from public.catalog_control cc join public.catalog_domain d on d.id = cc.domain_id
          where d.code = 'SUP' limit 1`,
      )
      return { nulls: Number(nulls[0]!.n), sec: sec[0]?.measure_kind, sup: sup[0]?.measure_kind }
    })
    expect(r.nulls).toBe(0)
    expect(r.sec).toBe('technical')
    expect(r.sup).toBe('contractual')
  })

  it('une mesure se pose sur un actif de la même organisation, et se lit avec le cas d’usage', async () => {
    const r = await asUser(db, DEMO.officerA, async (c) => {
      const { rows: asset } = await c.query<{ id: string }>(
        `select a.id from public.ai_asset a join public.use_case_asset_link l on l.asset_id = a.id
          where l.use_case_id = $1 limit 1`, [DEMO.useCaseProduction],
      )
      const { rows: ctl } = await c.query<{ id: string; code: string }>(
        `select id, code from public.control where organization_id = $1 and code = 'CTL-05'`, [DEMO.orgA],
      )
      await c.query(
        `insert into public.asset_control (tenant_id, asset_id, control_id, status, note)
         values ($1, $2, $3, 'implemented', 'Journal centralisé activé')`,
        [DEMO.tenantA, asset[0]!.id, ctl[0]!.id],
      )
      const { rows: read } = await c.query<{ r: { asset_id: string; measures: { code: string; status: string }[] }[] }>(
        'select public.use_case_assets($1) as r', [DEMO.useCaseProduction],
      )
      const { rows: other } = await c.query<{ id: string }>(
        `select id from public.control where organization_id = $1 limit 1`, [DEMO.orgB],
      )
      const crossOrg = other.length
        ? await expectFailure(
            c,
            `insert into public.asset_control (tenant_id, asset_id, control_id) values ($1, $2, $3)`,
            [DEMO.tenantA, asset[0]!.id, other[0]!.id],
          )
        : { message: 'même organisation' }
      return { placed: read[0]!.r.find((a) => a.asset_id === asset[0]!.id)?.measures ?? [], crossOrg }
    })
    expect(r.placed).toEqual(expect.arrayContaining([expect.objectContaining({ code: 'CTL-05', status: 'implemented' })]))
    expect(r.crossOrg.message).toMatch(/même organisation|row-level security/)
  })
})

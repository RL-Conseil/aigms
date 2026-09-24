import { afterAll, beforeAll, describe, expect, it } from 'vitest'
import type { Client } from 'pg'
import { asUser, connect, DEMO, expectFailure } from '../helpers/db'

/** 0088 : avec quoi un contrôle se tient, chez nous — pas la typologie du référentiel. */

let db: Client
beforeAll(async () => {
  db = await connect()
})
afterAll(async () => {
  await db.end()
})

describe('Outillage des contrôles', () => {
  it('la carte porte les familles du référentiel, et le produit déclaré s’y accroche', async () => {
    const r = await asUser(db, DEMO.officerA, async (c) => {
      const { rows: before } = await c.query<{ n: number; declared: number }>(
        `select jsonb_array_length(m -> 'families') as n,
                (select count(*) from jsonb_array_elements(m -> 'families') f
                  where jsonb_array_length(f -> 'declared') > 0) as declared
           from public.organization_tooling_map($1) m`,
        [DEMO.orgA],
      )
      await c.query(
        `insert into public.organization_tooling (tenant_id, organization_id, tool_code, product)
         values ($1, $2, 'CTRL-OPS-007', 'Datadog')`,
        [DEMO.tenantA, DEMO.orgA],
      )
      const { rows: after } = await c.query<{ product: string; used_by: number }>(
        `select f -> 'declared' -> 0 ->> 'product' as product, (f -> 'declared' -> 0 ->> 'used_by')::int as used_by
           from public.organization_tooling_map($1) m, jsonb_array_elements(m -> 'families') f
          where f ->> 'code' = 'CTRL-OPS-007'`,
        [DEMO.orgA],
      )
      return { families: before[0]!.n, declaredBefore: Number(before[0]!.declared), after: after[0]! }
    })
    expect(r.families).toBeGreaterThan(50)
    expect(r.declaredBefore).toBe(0)
    expect(r.after.product).toBe('Datadog')
    expect(r.after.used_by).toBe(0)
  })

  it('un contrôle retient ce qui vaut pour lui, et le référentiel n’est pas modifié', async () => {
    const r = await asUser(db, DEMO.officerA, async (c) => {
      const { rows: tool } = await c.query<{ id: string }>(
        `insert into public.organization_tooling (tenant_id, organization_id, tool_code, product)
         values ($1, $2, 'CTRL-OPS-007', 'Datadog') returning id`,
        [DEMO.tenantA, DEMO.orgA],
      )
      const { rows: control } = await c.query<{ id: string; code: string }>(
        `select id, code from public.control where organization_id = $1 order by code limit 1`, [DEMO.orgA],
      )
      await c.query(
        `insert into public.control_tooling (tenant_id, control_id, tooling_id, rationale)
         values ($1, $2, $3, 'Les journaux de Datadog portent la preuve de ce contrôle.')`,
        [DEMO.tenantA, control[0]!.id, tool[0]!.id],
      )
      const { rows: view } = await c.query<{ v: { retained: { product: string; rationale: string }[]; available: unknown[] } }>(
        'select public.control_tooling_view($1) as v', [control[0]!.id],
      )
      const { rows: catalog } = await c.query<{ n: number }>(
        'select count(*)::int as n from public.catalog_tool_control',
      )
      const { rows: used } = await c.query<{ used_by: number }>(
        `select (f -> 'declared' -> 0 ->> 'used_by')::int as used_by
           from public.organization_tooling_map($1) m, jsonb_array_elements(m -> 'families') f
          where f ->> 'code' = 'CTRL-OPS-007'`,
        [DEMO.orgA],
      )
      return { view: view[0]!.v, catalog: catalog[0]!.n, used: used[0]!.used_by }
    })
    expect(r.view.retained).toHaveLength(1)
    expect(r.view.retained[0]!.product).toBe('Datadog')
    expect(r.view.retained[0]!.rationale).toMatch(/journaux/)
    expect(r.view.available.length).toBeGreaterThan(0)
    // La typologie de l'éditeur est intacte : 121 correspondances au départ.
    expect(r.catalog).toBe(121)
    expect(r.used).toBe(1)
  })

  it('l’outillage d’une organisation ne se lit pas depuis une autre', async () => {
    await asUser(db, DEMO.officerB, async (c) => {
      const { rows } = await c.query<{ n: number }>(
        `select jsonb_array_length((public.organization_tooling_map($1)) -> 'families') as n`, [DEMO.orgA],
      )
      expect(Number(rows[0]!.n)).toBe(0)
      const refused = await expectFailure(
        c,
        `insert into public.organization_tooling (tenant_id, organization_id, tool_code, product)
         values ($1, $2, 'CTRL-OPS-007', 'Intrus')`,
        [DEMO.tenantA, DEMO.orgA],
      )
      expect(refused.message).toMatch(/row-level security|policy|tenant/i)
    })
  })
})

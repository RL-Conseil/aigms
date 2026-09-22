import { afterAll, beforeAll, describe, expect, it } from 'vitest'
import type { Client } from 'pg'
import { asUser, connect, DEMO } from '../helpers/db'

/** 0080 : un cas d'usage herite des faits de ses actifs — et les perd quand on les detache. */

let db: Client
beforeAll(async () => {
  db = await connect()
})
afterAll(async () => {
  await db.end()
})

describe('Faits hérités des actifs', () => {
  it('un actif à données personnelles, fourni par un tiers non revu, rend l’AIIA exigée et le tiers impliqué ; le détacher défait tout', async () => {
    const r = await asUser(db, DEMO.officerA, async (c) => {
      // Un cas d'usage sans donnees personnelles ni fournisseur ni actif.
      const { rows: uc } = await c.query<{ id: string; tenant_id: string }>(
        `insert into public.ai_use_case (tenant_id, organization_id, name, purpose, owner_user_id, accountable_user_id, autonomy_level, criticality)
         values ($1, $2, 'Cas neutre', 'Test des faits hérités.', $3, $3, 'L0', 'low') returning id, tenant_id`,
        [DEMO.tenantA, DEMO.orgA, DEMO.officerA],
      )
      const { rows: vendor } = await c.query<{ id: string }>(
        `insert into public.vendor (tenant_id, organization_id, name, criticality, review_status) values ($1, $2, 'Tiers non revu', 'moderate', 'not_started') returning id`,
        [DEMO.tenantA, DEMO.orgA],
      )
      const { rows: asset } = await c.query<{ id: string }>(
        `insert into public.ai_asset (tenant_id, organization_id, kind, name, contains_personal_data, vendor_id)
         values ($1, $2, 'dataset', 'Jeu personnel', true, $3) returning id`,
        [DEMO.tenantA, DEMO.orgA, vendor[0]!.id],
      )
      const read = async () => {
        const { rows } = await c.query<{ pd: boolean; req: boolean; vendors: number; facts: string[]; vendor_check: boolean }>(
          `select app.use_case_personal_data($1) as pd,
                  app.impact_assessment_required($1) as req,
                  (select count(*)::int from app.use_case_vendor_all v where v.use_case_id = $1) as vendors,
                  (select array(select jsonb_array_elements_text(public.suggest_controls($1) -> 'facts'))) as facts,
                  (select (ch ->> 'satisfied')::boolean from jsonb_array_elements(public.evaluate_gate($1, 'PRODUCTION') -> 'checks') ch
                    where ch ->> 'code' = 'VENDOR_REVIEW') as vendor_check`,
          [uc[0]!.id],
        )
        return rows[0]!
      }
      const before = await read()
      await c.query('insert into public.use_case_asset_link (tenant_id, use_case_id, asset_id) values ($1, $2, $3)', [DEMO.tenantA, uc[0]!.id, asset[0]!.id])
      const linked = await read()
      const { rows: effects } = await c.query<{ e: { personal_data: boolean; vendor: { review_status: string } | null; impact_required_now: boolean } }>(
        'select public.asset_link_effects($1, $2) as e', [uc[0]!.id, asset[0]!.id],
      )
      await c.query('delete from public.use_case_asset_link where use_case_id = $1 and asset_id = $2', [uc[0]!.id, asset[0]!.id])
      const after = await read()
      return { before, linked, after, effects: effects[0]!.e }
    })
    expect(r.before.pd).toBe(false)
    expect(r.before.req).toBe(false)
    expect(r.before.vendors).toBe(0)
    expect(r.before.vendor_check).toBe(true)

    expect(r.linked.pd).toBe(true)
    expect(r.linked.req).toBe(true)
    expect(r.linked.vendors).toBe(1)
    expect(r.linked.facts).toEqual(expect.arrayContaining(['personal_data', 'external_vendor', 'asset_dataset']))
    expect(r.linked.vendor_check).toBe(false)
    expect(r.effects.personal_data).toBe(true)
    expect(r.effects.vendor?.review_status).toBe('not_started')
    expect(r.effects.impact_required_now).toBe(true)

    expect(r.after).toEqual(r.before)
  })
})

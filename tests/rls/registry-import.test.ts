import { afterAll, beforeAll, describe, expect, it } from 'vitest'
import type { Client } from 'pg'
import { asUser, connect, DEMO, expectFailure } from '../helpers/db'

/** 0061 : importer actifs et fournisseurs — rapprochement par nom, compte rendu par ligne. */

let db: Client
beforeAll(async () => {
  db = await connect()
})
afterAll(async () => {
  await db.end()
})

describe('Import des actifs et fournisseurs', () => {
  it('l’administration importe des actifs : crée, met à jour, refuse et dit pourquoi', async () => {
    const r = await asUser(db, DEMO.platformAdmin, async (c) => {
      const rows = [
        { name: 'Modèle de scoring v2', kind: 'modèle', vendor: 'TalentScreen Analytics', hosting_location: 'UE', contains_personal_data: 'oui' },
        { name: '', kind: 'x' },
        { name: 'Modèle de scoring v2', kind: 'ai_model', version: '2.1' },
        { name: 'Truc', kind: 'inconnu' },
      ]
      const { rows: out } = await c.query<{ r: { created: number; updated: number; issues: { line: number }[] } }>(
        'select public.import_ai_assets($1, $2::jsonb) as r', [DEMO.orgA, JSON.stringify(rows)],
      )
      const { rows: asset } = await c.query<{ version: string | null; contains_personal_data: boolean; vendor: string | null }>(
        `select a.version, a.contains_personal_data, v.name as vendor from public.ai_asset a
           left join public.vendor v on v.id = a.vendor_id
          where a.organization_id = $1 and a.name = 'Modèle de scoring v2'`, [DEMO.orgA],
      )
      return { out: out[0]!.r, asset: asset[0] }
    })
    expect(r.out.created).toBe(1)
    expect(r.out.updated).toBe(1)
    expect(r.out.issues.map((i) => i.line)).toEqual([2, 4])
    expect(r.asset).toEqual({ version: '2.1', contains_personal_data: true, vendor: 'TalentScreen Analytics' })
  })

  it('seule l’administration importe : l’AI Governance Officer est refusé', async () => {
    const refusedOfficer = await asUser(db, DEMO.officerA, (c) =>
      expectFailure(c, `select public.import_vendors($1, '[{"name":"X"}]'::jsonb)`, [DEMO.orgA]),
    )
    expect(refusedOfficer.message).toMatch(/administration de la plateforme/)
    const refusedAssets = await asUser(db, DEMO.officerA, (c) =>
      expectFailure(c, `select public.import_ai_assets($1, '[{"name":"X"}]'::jsonb)`, [DEMO.orgA]),
    )
    expect(refusedAssets.message).toMatch(/administration/)

    const r = await asUser(db, DEMO.platformAdmin, async (c) => {
      const { rows } = await c.query<{ r: { created: number; updated: number } }>(
        `select public.import_vendors($1, '[{"name":"OpenAI","is_model_provider":"oui","criticality":"élevée","country_code":"us"}]'::jsonb) as r`,
        [DEMO.orgA],
      )
      const { rows: v } = await c.query<{ criticality: string; country_code: string; is_model_provider: boolean }>(
        `select criticality, country_code, is_model_provider from public.vendor where organization_id = $1 and name = 'OpenAI'`, [DEMO.orgA],
      )
      return { out: rows[0]!.r, vendor: v[0] }
    })
    expect(r.out.created).toBe(1)
    expect(r.vendor).toEqual({ criticality: 'high', country_code: 'US', is_model_provider: true })
  })
})

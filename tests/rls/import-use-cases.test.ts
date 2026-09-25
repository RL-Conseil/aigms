import { afterAll, beforeAll, describe, expect, it } from 'vitest'
import type { Client } from 'pg'
import { asUser, connect, DEMO, expectFailure } from '../helpers/db'

/** 0092 : reprendre un inventaire d'usages d'IA sans le ressaisir. */

const ADMIN = '66666666-6666-4666-8666-666666666666'

type Result = {
  created: number
  updated: number
  linked: number
  issues: { line: number; message: string }[]
}

let db: Client
beforeAll(async () => {
  db = await connect()
})
afterAll(async () => {
  await db.end()
})

const importRows = (c: Client, rows: unknown[]) =>
  c
    .query<{ r: Result }>('select public.import_use_cases($1, $2::jsonb) as r', [DEMO.orgA, JSON.stringify(rows)])
    .then((x) => x.rows[0]!.r)

describe('Import des cas d’usage', () => {
  it('crée, rattache par nom, et rend compte de chaque ligne', async () => {
    const r = await asUser(db, ADMIN, async (c) => {
      const result = await importRows(c, [
        {
          name: 'Copilote rédactionnel',
          purpose: 'Aider les équipes à rédiger des réponses clients.',
          activity: 'Traitement des demandes clients',
          involves_personal_data: 'oui',
          autonomy_level: 'L1',
          owner_email: 'devsecops@aigms.eu',
          assets: 'Assistant support client, Inconnu au bataillon',
          vendors: 'Nordic LLM Cloud',
        },
        { name: 'Sans finalité' },
      ])
      const { rows } = await c.query<{
        status: string
        activity: string | null
        personal: boolean
        owner: string | null
        assets: number
        vendors: number
      }>(
        `select u.status::text, a.name as activity, u.involves_personal_data as personal,
                (select email from public.user_profile p where p.id = u.owner_user_id) as owner,
                (select count(*)::int from public.use_case_asset_link l where l.use_case_id = u.id) as assets,
                (select count(*)::int from public.use_case_vendor_link l where l.use_case_id = u.id) as vendors
           from public.ai_use_case u left join public.activity a on a.id = u.activity_id
          where u.organization_id = $1 and u.name = 'Copilote rédactionnel'`,
        [DEMO.orgA],
      )
      return { result, row: rows[0]! }
    })
    expect(r.result.created).toBe(1)
    expect(r.result.linked).toBe(2)
    // Le statut ne s'importe jamais : l'usage entre en brouillon.
    expect(r.row.status).toBe('DRAFT')
    expect(r.row.activity).toBe('Traitement des demandes clients')
    expect(r.row.personal).toBe(true)
    expect(r.row.owner).toBe('devsecops@aigms.eu')
    expect(r.row.assets).toBe(1)
    expect(r.row.vendors).toBe(1)
    // Deux signalements : l'actif inconnu, et la ligne sans finalité.
    expect(r.result.issues).toHaveLength(2)
    expect(r.result.issues[0]!.message).toMatch(/Inconnu au bataillon/)
    expect(r.result.issues[1]!.message).toMatch(/finalité manquante/)
  })

  it('une ligne connue met à jour sans rien effacer, et ne touche ni au statut ni à la qualification', async () => {
    const r = await asUser(db, ADMIN, async (c) => {
      const before = await c.query<{ status: string; purpose: string; criticality: string | null }>(
        `select status::text, purpose, criticality::text from public.ai_use_case where id = $1`,
        [DEMO.useCaseProduction],
      )
      const result = await importRows(c, [
        {
          name: before.rows[0] ? 'Assistant support client' : '',
          purpose: 'Finalité reprise depuis l’atelier.',
          expected_benefit: 'Bénéfice ajouté par l’import.',
        },
      ])
      const after = await c.query<{ status: string; purpose: string; benefit: string; criticality: string | null }>(
        `select status::text, purpose, expected_benefit as benefit, criticality::text from public.ai_use_case where id = $1`,
        [DEMO.useCaseProduction],
      )
      return { result, before: before.rows[0]!, after: after.rows[0]! }
    })
    expect(r.result.updated).toBe(1)
    expect(r.after.status).toBe(r.before.status)
    expect(r.after.criticality).toBe(r.before.criticality)
    expect(r.after.purpose).toBe('Finalité reprise depuis l’atelier.')
    expect(r.after.benefit).toBe('Bénéfice ajouté par l’import.')
  })

  it('une criticité sans justification n’est pas reprise', async () => {
    const r = await asUser(db, ADMIN, async (c) => {
      const result = await importRows(c, [
        { name: 'Tri documentaire', purpose: 'Classer les documents entrants.', criticality: 'critique' },
        {
          name: 'Analyse de contrats',
          purpose: 'Repérer les clauses sensibles.',
          criticality: 'élevée',
          criticality_rationale: 'Effets contractuels difficilement réversibles.',
        },
      ])
      const { rows } = await c.query<{ name: string; criticality: string | null }>(
        `select name, criticality::text from public.ai_use_case
          where organization_id = $1 and name in ('Tri documentaire', 'Analyse de contrats') order by name`,
        [DEMO.orgA],
      )
      return { result, rows }
    })
    expect(r.result.created).toBe(2)
    expect(r.rows.find((x) => x.name === 'Tri documentaire')!.criticality).toBeNull()
    expect(r.rows.find((x) => x.name === 'Analyse de contrats')!.criticality).toBe('high')
    expect(r.result.issues[0]!.message).toMatch(/sans justification/)
  })

  it('un rôle de gouvernance n’importe pas : c’est une reprise de données', async () => {
    await asUser(db, DEMO.officerA, async (c) => {
      const refused = await expectFailure(
        c,
        `select public.import_use_cases($1, '[{"name":"X","purpose":"Une finalité quelconque."}]'::jsonb)`,
        [DEMO.orgA],
      )
      expect(refused.message).toMatch(/administration de la plateforme/)
    })
  })
})

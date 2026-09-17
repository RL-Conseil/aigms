import { afterAll, beforeAll, describe, expect, it } from 'vitest'
import type { Client } from 'pg'
import { asUser, connect, DEMO } from '../helpers/db'

/**
 * Propositions de controles : deterministes, motivees, ordonnees par le role.
 * L'assistant propose ; rien ne s'ecrit ici — le test lit seulement.
 */

type Proposal = {
  code: string
  tier: string
  mandatory: boolean
  reasons: string[]
  state: string
  tools: { code: string }[]
}
type Result = { available: boolean; facts: string[]; proposals: Proposal[] }

let db: Client
beforeAll(async () => {
  db = await connect()
})
afterAll(async () => {
  await db.end()
})

async function suggest(userId: string, useCaseId: string): Promise<Result> {
  return asUser(db, userId, async (c) => {
    const { rows } = await c.query<{ r: Result }>('select app.suggest_controls($1) as r', [useCaseId])
    return rows[0]!.r
  })
}

describe('Propositions de contrôles', () => {
  it('lit les faits du cas d’usage et le rôle de l’organisation', async () => {
    const r = await suggest(DEMO.officerA, DEMO.useCasePilot)
    expect(r.available).toBe(true)
    expect(r.facts).toContain('role_host')
    expect(r.facts).toContain('personal_data')
  })

  it('chaque proposition porte au moins un motif lisible', async () => {
    const r = await suggest(DEMO.officerA, DEMO.useCasePilot)
    expect(r.proposals.length).toBeGreaterThan(0)
    for (const p of r.proposals) expect(p.reasons.length, p.code).toBeGreaterThan(0)
  })

  it('un conditionnel ne se propose que sur motif : DAT-004 vient des données personnelles', async () => {
    const r = await suggest(DEMO.officerA, DEMO.useCasePilot)
    const dat004 = r.proposals.find((p) => p.code === 'AIGMS-DAT-004')
    expect(dat004).toBeDefined()
    expect(dat004!.mandatory).toBe(false)
    expect(dat004!.reasons.join(' ')).toMatch(/données personnelles/)
  })

  it('pour un hébergeur, la sécurité et l’exploitation se lisent d’abord ; les cas d’usage et la supervision, seulement sur motif', async () => {
    const r = await suggest(DEMO.officerA, DEMO.useCasePilot)
    const tierOf = (code: string) => r.proposals.find((p) => p.code === code)?.tier
    expect(tierOf('AIGMS-SEC-002')).toBe('core')
    expect(tierOf('AIGMS-OPS-001')).toBe('core')
    // USE est secondaire pour un hebergeur : les obligatoires sans motif n'y apparaissent pas.
    expect(r.proposals.find((p) => p.code === 'AIGMS-USE-001')).toBeUndefined()
  })

  it('les propositions portent les outils qui les tiennent', async () => {
    const r = await suggest(DEMO.officerA, DEMO.useCasePilot)
    const sec006 = r.proposals.find((p) => p.code === 'AIGMS-SEC-006')
    expect(sec006?.tools.map((t) => t.code)).toContain('CTRL-OBS-001')
  })

  it('ne dit rien d’un cas d’usage hors du tenant', async () => {
    const r = await suggest(DEMO.officerB, DEMO.useCasePilot)
    expect(r.available).toBe(false)
  })
})

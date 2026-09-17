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

  it('un contrôle d’organisation ne se propose jamais sur un cas d’usage', async () => {
    const r = await suggest(DEMO.officerA, DEMO.useCasePilot)
    for (const code of ['AIGMS-GOV-001', 'AIGMS-CMP-006', 'AIGMS-SEC-002', 'AIGMS-INV-001']) {
      expect(r.proposals.find((p) => p.code === code), code).toBeUndefined()
    }
  })

  it('deux cas d’usage aux faits différents reçoivent des propositions différentes', async () => {
    const scoring = await suggest(DEMO.officerA, DEMO.useCasePilot)
    const agent = await suggest(DEMO.officerA, DEMO.useCaseTriage)
    const triggered = (r: Result) => new Set(r.proposals.filter((p) => p.tier === 'triggered').map((p) => p.code))
    const a = triggered(scoring)
    const b = triggered(agent)
    // Le scoring : haut risque, personnes vulnerables -> validation humaine, qualite des donnees.
    expect(a.has('AIGMS-HUM-002')).toBe(true)
    expect(a.has('AIGMS-DAT-008')).toBe(true)
    // L'agent : reprise de la main, escalade et arret, moindre privilege, prompts versionnes.
    expect(b.has('AIGMS-HUM-004')).toBe(true)
    expect(b.has('AIGMS-HUM-005')).toBe(true)
    expect(b.has('AIGMS-SEC-003')).toBe(true)
    expect(b.has('AIGMS-OPS-004')).toBe(true)
    expect(a.has('AIGMS-HUM-004')).toBe(false)
    expect(b.has('AIGMS-DAT-008')).toBe(false)
  })

  it('le socle commun est le même pour tous, et il est court', async () => {
    const scoring = await suggest(DEMO.officerA, DEMO.useCasePilot)
    const agent = await suggest(DEMO.officerA, DEMO.useCaseTriage)
    const baseline = (r: Result) => r.proposals.filter((p) => p.tier === 'baseline').map((p) => p.code).sort()
    expect(baseline(scoring)).toEqual(baseline(agent))
    expect(baseline(scoring).length).toBeLessThanOrEqual(24)
  })

  it('les contrôles d’organisation se proposent une fois, sur l’organisation', async () => {
    const r = await asUser(db, DEMO.officerA, async (c) => {
      const { rows } = await c.query<{ r: Result }>('select app.suggest_organization_controls($1) as r', [DEMO.orgA])
      return rows[0]!.r
    })
    const codes = new Set(r.proposals.map((p) => p.code))
    expect(codes.has('AIGMS-GOV-001')).toBe(true)
    expect(codes.has('AIGMS-CMP-006')).toBe(true)
    expect(codes.has('AIGMS-USE-001')).toBe(false)
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

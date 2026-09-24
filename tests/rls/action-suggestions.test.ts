import { afterAll, beforeAll, describe, expect, it } from 'vitest'
import type { Client } from 'pg'
import { asUser, connect, DEMO } from '../helpers/db'

/** Propositions d'actions : derivees des ecarts, dedoublonnees, avec un responsable pressenti. */

type Proposal = { key: string; source: string; source_id: string | null; suggested_owner_id: string | null; is_blocking: boolean; reason: string }
type Result = { available: boolean; proposals: Proposal[] }

let db: Client
beforeAll(async () => {
  db = await connect()
})
afterAll(async () => {
  await db.end()
})

async function suggest(c: Client, useCaseId: string): Promise<Result> {
  const { rows } = await c.query<{ r: Result }>('select app.suggest_actions($1) as r', [useCaseId])
  return rows[0]!.r
}

describe('Propositions d’actions', () => {
  it('dérive les écarts du gate PRODUCTION du cas d’usage pilote', async () => {
    const r = await asUser(db, DEMO.officerA, (c) => suggest(c, DEMO.useCasePilot))
    expect(r.available).toBe(true)
    const keys = r.proposals.map((p) => p.key)
    expect(keys).toContain('gate:impact')
    expect(keys).toContain('gate:oversight')
    expect(keys.some((k) => k.startsWith('vendor:'))).toBe(true)
    expect(keys.some((k) => k.startsWith('control:'))).toBe(true)
  })

  it('chaque proposition porte un motif, une source, et le plus souvent un responsable pressenti', async () => {
    const r = await asUser(db, DEMO.officerA, (c) => suggest(c, DEMO.useCasePilot))
    for (const p of r.proposals) {
      expect(p.reason.length, p.key).toBeGreaterThan(0)
      expect(p.source, p.key).toBeTruthy()
    }
    expect(r.proposals.filter((p) => p.suggested_owner_id).length).toBeGreaterThan(0)
  })

  it('ce qui retient le gate est marqué bloquant', async () => {
    const r = await asUser(db, DEMO.officerA, (c) => suggest(c, DEMO.useCasePilot))
    expect(r.proposals.find((p) => p.key === 'gate:impact')?.is_blocking).toBe(true)
  })

  it('une action déjà ouverte sur la même source n’est pas reproposée', async () => {
    const { before, after } = await asUser(db, DEMO.officerA, async (c) => {
      const before = await suggest(c, DEMO.useCasePilot)
      const target = before.proposals.find((p) => p.key === 'gate:impact')!
      await c.query(
        `insert into public.action (tenant_id, organization_id, use_case_id, title, source, source_id)
         values ($1, $2, $3, 'Conduire l''évaluation d''impact', $4, $5)`,
        [DEMO.tenantA, DEMO.orgA, DEMO.useCasePilot, target.source, target.source_id],
      )
      const after = await suggest(c, DEMO.useCasePilot)
      return { before, after }
    })
    expect(before.proposals.some((p) => p.key === 'gate:impact')).toBe(true)
    expect(after.proposals.some((p) => p.key === 'gate:impact')).toBe(false)
  })

  /**
   * Les deux familles ajoutees en 0102 : ce que l'officer decouvrait le plus
   * tard. L'une se groupe pour ne pas noyer la liste, l'autre se plafonne.
   */
  it('l’applicabilité indéterminée donne UNE action, pas une par contrôle', async () => {
    const r = await asUser(db, DEMO.officerA, async (c) => {
      // Deux contrôles laissés « à déterminer » : la proposition doit rester
      // unique, et les nommer par leur nombre.
      await c.query(
        `update public.control_applicability set status = 'to_determine'
          where use_case_id = $1
            and control_id in (select control_id from public.control_applicability
                                where use_case_id = $1 and status = 'applicable' limit 2)`,
        [DEMO.useCasePilot],
      )
      return suggest(c, DEMO.useCasePilot)
    })
    const groupees = r.proposals.filter((p) => p.key === 'applicability')
    expect(groupees).toHaveLength(1)
    expect(groupees[0]!.reason).toMatch(/[Aa]pplicabilité|obligatoires/)
  })

  it('elle est bloquante quand un contrôle obligatoire reste indéterminé', async () => {
    const { avec, sans } = await asUser(db, DEMO.officerA, async (c) => {
      await c.query(
        `update public.control_applicability ca set status = 'to_determine'
           from public.control c
          where c.id = ca.control_id and ca.use_case_id = $1 and c.is_mandatory`,
        [DEMO.useCasePilot],
      )
      const avec = await suggest(c, DEMO.useCasePilot)
      await c.query(
        `update public.control_applicability ca set status = 'applicable'
           from public.control c
          where c.id = ca.control_id and ca.use_case_id = $1 and c.is_mandatory`,
        [DEMO.useCasePilot],
      )
      await c.query(
        `update public.control_applicability ca set status = 'to_determine'
           from public.control c
          where c.id = ca.control_id and ca.use_case_id = $1 and not c.is_mandatory`,
        [DEMO.useCasePilot],
      )
      const sans = await suggest(c, DEMO.useCasePilot)
      return { avec, sans }
    })
    expect(avec.proposals.find((p) => p.key === 'applicability')?.is_blocking).toBe(true)
    // Sans obligatoire concerné, elle existe mais ne retient pas le jalon.
    expect(sans.proposals.find((p) => p.key === 'applicability')?.is_blocking).toBe(false)
  })

  it('un contrôle applicable sans aucune preuve se propose, et jamais plus de cinq', async () => {
    const r = await asUser(db, DEMO.officerA, (c) => suggest(c, DEMO.useCaseProduction))
    const sansPreuve = r.proposals.filter((p) => p.key.startsWith('unevidenced:'))
    expect(sansPreuve.length).toBeLessThanOrEqual(5)
    for (const p of sansPreuve) {
      expect(p.source).toBe('control')
      // Produire une preuve n'est pas bloquant : 0097 avertit, il ne bloque pas.
      expect(p.is_blocking).toBe(false)
    }
  })

  it('un contrôle déjà démontré ne se propose pas', async () => {
    const r = await asUser(db, DEMO.officerA, (c) => suggest(c, DEMO.useCasePilot))
    const proposes = new Set(
      r.proposals.filter((p) => p.key.startsWith('unevidenced:')).map((p) => p.source_id),
    )
    const { rows } = await asUser(db, DEMO.officerA, (c) =>
      c.query<{ control_id: string }>(
        `select ce.control_id from public.control_evidence ce
           join public.evidence e on e.id = ce.evidence_id
           join public.control_applicability ca on ca.control_id = ce.control_id
          where ca.use_case_id = $1 and ca.status = 'applicable'
            and e.validation_status = 'validated'
            and app.evidence_freshness(e.valid_until) <> 'expired'`,
        [DEMO.useCasePilot],
      ),
    )
    for (const row of rows) expect(proposes.has(row.control_id)).toBe(false)
  })

  it('ne dit rien d’un cas d’usage hors du tenant', async () => {
    const r = await asUser(db, DEMO.officerB, (c) => suggest(c, DEMO.useCasePilot))
    expect(r.available).toBe(false)
  })
})

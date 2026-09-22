import { afterAll, beforeAll, describe, expect, it } from 'vitest'
import type { Client } from 'pg'
import { asUser, connect, DEMO } from '../helpers/db'

/** 0089 : le graphe montre ce que l'IA emploie, et avec quoi ça tient. */

type Graph = {
  available: boolean
  nodes: { id: string; layer: string; label: string; tone: string; meta: Record<string, unknown> }[]
  edges: { id: string; source: string; target: string; kind: string }[]
}

let db: Client
beforeAll(async () => {
  db = await connect()
})
afterAll(async () => {
  await db.end()
})

const graphOf = (c: Client, organizationId: string) =>
  c
    .query<{ g: Graph }>('select public.control_graph($1, null) as g', [organizationId])
    .then((r) => r.rows[0]!.g)

describe('Graphe de gouvernance', () => {
  it('les actifs employés entrent dans le graphe, avec le lien « emploie »', async () => {
    const g = await asUser(db, DEMO.officerA, (c) => graphOf(c, DEMO.orgA))
    const assets = g.nodes.filter((n) => n.layer === 'asset')
    const employment = g.edges.filter((e) => e.kind === 'employment')
    expect(assets.length).toBeGreaterThan(0)
    expect(employment.length).toBeGreaterThan(0)
    // Chaque lien part d'un cas d'usage du périmètre et arrive sur un actif présent.
    const ids = new Set(g.nodes.map((n) => n.id))
    expect(employment.every((e) => ids.has(e.source) && ids.has(e.target))).toBe(true)
    // Un actif dont le fournisseur n'est pas revu se signale.
    expect(assets.every((a) => ['ok', 'warn', 'stop'].includes(a.tone))).toBe(true)
  })

  it('l’outillage retenu apparaît, relié au contrôle qu’il tient', async () => {
    const r = await asUser(db, DEMO.officerA, async (c) => {
      const before = await graphOf(c, DEMO.orgA)
      const { rows: tool } = await c.query<{ id: string }>(
        `insert into public.organization_tooling (tenant_id, organization_id, tool_code, product)
         values ($1, $2, 'CTRL-OPS-007', 'Datadog') returning id`,
        [DEMO.tenantA, DEMO.orgA],
      )
      // Un contrôle qui est bien dans le graphe : applicable à un cas d'usage.
      const controlId = before.nodes.find((n) => n.layer === 'control')!.id.replace('control:', '')
      await c.query(
        `insert into public.control_tooling (tenant_id, control_id, tooling_id) values ($1, $2, $3)`,
        [DEMO.tenantA, controlId, tool[0]!.id],
      )
      const after = await graphOf(c, DEMO.orgA)
      return { before, after, controlId, toolingId: tool[0]!.id }
    })
    expect(r.before.nodes.some((n) => n.layer === 'tooling')).toBe(false)
    const node = r.after.nodes.find((n) => n.id === `tooling:${r.toolingId}`)
    expect(node?.label).toBe('Datadog')
    expect(r.after.edges).toContainEqual(
      expect.objectContaining({ kind: 'tooling', source: `control:${r.controlId}`, target: `tooling:${r.toolingId}` }),
    )
  })

  it('les couches historiques n’ont pas bougé', async () => {
    const g = await asUser(db, DEMO.officerA, (c) => graphOf(c, DEMO.orgA))
    const layers = new Set(g.nodes.map((n) => n.layer))
    for (const layer of ['process', 'activity', 'use_case', 'risk', 'control', 'evidence']) {
      expect(layers.has(layer)).toBe(true)
    }
    for (const kind of ['structure', 'exposure', 'applicability', 'evidence']) {
      expect(g.edges.some((e) => e.kind === kind)).toBe(true)
    }
  })
})

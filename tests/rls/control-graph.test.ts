import { afterAll, beforeAll, describe, expect, it } from 'vitest'
import type { Client } from 'pg'
import { asUser, connect, DEMO, expectFailure } from '../helpers/db'

/**
 * AI Control Graph et chemin du risque.
 *
 * Deux exigences se testent ici, et elles ne sont pas cosmetiques :
 *
 *   1. un controle DESIGNE pour traiter un risque n'est pas la meme chose qu'un
 *      controle APPLICABLE a un cas d'usage. Confondre les deux reviendrait a
 *      faire croire a une chaine de maitrise qui n'a jamais ete etablie ;
 *
 *   2. le verdict d'un chemin nomme le maillon exact ou il rompt. « Incomplet »
 *      n'aide personne ; « le controle designe n'est pas operant » se corrige.
 */

let db: Client

beforeAll(async () => {
  db = await connect()
})

afterAll(async () => {
  await db.end()
})

type GraphNode = { id: string; layer: string; ref: string | null; label: string; tone: string }
type GraphEdge = { id: string; source: string; target: string; kind: string }
type Graph = { available: boolean; nodes?: GraphNode[]; edges?: GraphEdge[] }
type Path = {
  available: boolean
  chain_complete?: boolean
  break?: string | null
  message?: string
  counts?: { treatments: number; controls: number; operating: number; evidenced: number }
  controls?: { code: string; status: string; evidenced: boolean }[]
  highlight_nodes?: string[]
  highlight_edges?: string[]
}

async function graph(user: string, organization: string, activity: string | null = null) {
  return asUser(db, user, async (c) => {
    const { rows } = await c.query<{ g: Graph }>('select app.control_graph($1, $2) as g', [
      organization,
      activity,
    ])
    return rows[0]!.g
  })
}

async function path(user: string, risk: string) {
  return asUser(db, user, async (c) => {
    const { rows } = await c.query<{ p: Path }>('select app.risk_path($1) as p', [risk])
    return rows[0]!.p
  })
}

describe('Graphe de gouvernance', () => {
  it('relie les six couches, du processus jusqu’à la preuve', async () => {
    const g = await graph(DEMO.officerA, DEMO.orgA)

    expect(g.available).toBe(true)
    const layers = new Set((g.nodes ?? []).map((n) => n.layer))
    for (const layer of ['process', 'activity', 'use_case', 'risk', 'control', 'evidence']) {
      expect(layers).toContain(layer)
    }

    // Aucune arête ne pend dans le vide : toute extrémité désigne un nœud rendu.
    const ids = new Set((g.nodes ?? []).map((n) => n.id))
    for (const edge of g.edges ?? []) {
      expect(ids.has(edge.source)).toBe(true)
      expect(ids.has(edge.target)).toBe(true)
    }
  })

  it('distingue un contrôle applicable d’un contrôle désigné pour traiter un risque', async () => {
    const g = await graph(DEMO.officerA, DEMO.orgA)
    const kinds = new Set((g.edges ?? []).map((e) => e.kind))

    expect(kinds).toContain('applicability')
    expect(kinds).toContain('mitigation')

    // Une désignation part toujours d'un risque, jamais d'un cas d'usage :
    // c'est ce qui la rend opposable.
    for (const edge of (g.edges ?? []).filter((e) => e.kind === 'mitigation')) {
      expect(edge.source.startsWith('risk:')).toBe(true)
      expect(edge.target.startsWith('control:')).toBe(true)
    }
  })

  it('retient un contrôle désigné même sans décision d’applicabilité', async () => {
    // CTL-06 n'est applicable a aucun cas d'usage du jeu de demonstration ; il
    // est pourtant designe pour traiter le risque de discrimination. Le masquer
    // reviendrait a cacher la seule mesure engagee sur ce risque.
    const g = await graph(DEMO.officerA, DEMO.orgA)
    const codes = (g.nodes ?? []).filter((n) => n.layer === 'control').map((n) => n.ref)

    expect(codes).toContain('CTL-06')
    expect(
      (g.edges ?? []).some((e) => e.kind === 'mitigation' && e.id.includes(DEMO.notOperatingRisk)),
    ).toBe(true)
  })

  it('note un contrôle opérant sans preuve comme non tenu', async () => {
    const g = await graph(DEMO.officerA, DEMO.orgA)
    const nodes = g.nodes ?? []

    const evidenced = nodes.find((n) => n.ref === 'CTL-02')!
    const unevidenced = nodes.find((n) => n.ref === 'CTL-09')!

    expect(evidenced.tone).toBe('ok')
    expect(unevidenced.tone).toBe('warn')
  })

  it('restreint tout le graphe quand une activité est demandée', async () => {
    const full = await graph(DEMO.officerA, DEMO.orgA)
    const activityId = (full.nodes ?? []).find((n) => n.layer === 'activity')!.id.split(':')[1]!

    const focused = await graph(DEMO.officerA, DEMO.orgA, activityId)
    expect((focused.nodes ?? []).filter((n) => n.layer === 'activity')).toHaveLength(1)
    expect((focused.nodes ?? []).length).toBeLessThan((full.nodes ?? []).length)
  })

  it('ne rend rien à un tenant étranger', async () => {
    const g = await graph(DEMO.officerB, DEMO.orgA)
    expect(g.available).toBe(false)
  })
})

describe('Chemin du risque', () => {
  it('déclare la chaîne complète quand un contrôle opérant est prouvé', async () => {
    const p = await path(DEMO.officerA, DEMO.chainCompleteRisk)

    expect(p.available).toBe(true)
    expect(p.chain_complete).toBe(true)
    expect(p.break).toBeNull()
    expect(p.counts!.evidenced).toBeGreaterThan(0)
  })

  it('nomme la rupture à la preuve quand le contrôle opère sans rien démontrer', async () => {
    const p = await path(DEMO.officerA, DEMO.unevidencedRisk)

    expect(p.chain_complete).toBe(false)
    expect(p.break).toBe('no_evidence')
    expect(p.counts!.operating).toBeGreaterThan(0)
    expect(p.counts!.evidenced).toBe(0)
  })

  it('nomme la rupture au contrôle quand celui-ci n’est pas opérant', async () => {
    const p = await path(DEMO.officerA, DEMO.notOperatingRisk)

    expect(p.break).toBe('control_not_operating')
    expect(p.counts!.controls).toBeGreaterThan(0)
    expect(p.counts!.operating).toBe(0)
  })

  it('nomme la rupture au traitement quand aucune mesure ne le met en œuvre', async () => {
    const p = await path(DEMO.officerA, DEMO.untreatedRisk)

    expect(p.break).toBe('no_control')
    expect(p.counts!.treatments).toBeGreaterThan(0)
    expect(p.counts!.controls).toBe(0)
  })

  it('ne traite pas un risque accepté comme une chaîne rompue', async () => {
    // L'acceptation est une decision humaine, nominative et datee. Exiger en
    // plus une chaine de maitrise reviendrait a la denier.
    const p = await path(DEMO.officerA, DEMO.acceptedRisk)

    expect(p.chain_complete).toBe(true)
    expect(p.break).toBeNull()
    expect(p.message).toMatch(/accepté/)
  })

  it('met en évidence des nœuds qui existent tous dans le graphe', async () => {
    const g = await graph(DEMO.officerA, DEMO.orgA)
    const nodeIds = new Set((g.nodes ?? []).map((n) => n.id))
    const edgeIds = new Set((g.edges ?? []).map((e) => e.id))

    for (const risk of [DEMO.chainCompleteRisk, DEMO.unevidencedRisk, DEMO.notOperatingRisk]) {
      const p = await path(DEMO.officerA, risk)
      for (const id of p.highlight_nodes ?? []) expect(nodeIds.has(id)).toBe(true)
      for (const id of p.highlight_edges ?? []) expect(edgeIds.has(id)).toBe(true)
    }
  })

  it('reste soumis à l’habilitation', async () => {
    const p = await path(DEMO.officerB, DEMO.chainCompleteRisk)
    expect(p.available).toBe(false)
  })

  it('accorde la lecture à l’auditeur', async () => {
    const p = await path(DEMO.auditorA, DEMO.chainCompleteRisk)
    expect(p.available).toBe(true)
  })
})

describe('Désignation du contrôle qui traite un risque', () => {
  it('refuse un contrôle inexistant', async () => {
    await asUser(db, DEMO.officerA, async (c) => {
      const failure = await expectFailure(
        c,
        `update public.risk_treatment set control_id = '00000000-0000-4000-8000-000000000000'
         where risk_id = $1`,
        [DEMO.chainCompleteRisk],
      )
      expect(failure.message).toMatch(/introuvable/)
    })
  })

  it('refuse un contrôle relevant d’une autre organisation', async () => {
    // Fixture posee hors contexte utilisateur, puis rejouee sous le role : ce
    // qui est teste est le garde-fou, pas le droit d'ecriture.
    const { rows } = await db.query<{ id: string }>(
      `insert into public.control (tenant_id, organization_id, code, name, objective, status)
       values ($1, $2, 'CTL-X-TEST', 'Contrôle d''une autre organisation',
               'Vérifier que le rattachement inter-organisation est refusé.', 'operating')
       returning id`,
      [DEMO.tenantB, DEMO.orgB],
    )
    const foreignControl = rows[0]!.id

    try {
      await asUser(db, DEMO.officerA, async (c) => {
        const failure = await expectFailure(
          c,
          'update public.risk_treatment set control_id = $1 where risk_id = $2',
          [foreignControl, DEMO.chainCompleteRisk],
        )
        expect(failure.message).toMatch(/même organisation/)
      })
    } finally {
      await db.query('delete from public.control where id = $1', [foreignControl])
    }
  })
})

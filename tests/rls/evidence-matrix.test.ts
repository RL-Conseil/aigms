import { afterAll, beforeAll, describe, expect, it } from 'vitest'
import { readFileSync } from 'node:fs'
import type { Client } from 'pg'
import { asUser, connect, DEMO, expectFailure } from '../helpers/db'

/**
 * Matrice des preuves et Declaration d'Applicabilite ajustee.
 *
 * La migration est generee depuis le fichier de donnees : ces tests verifient
 * que les deux n'ont pas diverge, que la criticite attendue depend bien du
 * profil d'activite, et que la regle d'or — aucune case vide — se voit.
 */

const SOURCE = 'knowledge/frameworks/aigms/evidence-matrix/v1/matrice-preuves.json'
const source = JSON.parse(readFileSync(SOURCE, 'utf8')) as {
  matrix: { typology_count: number; profile_count: number }
  profiles: { code: string }[]
  typologies: {
    code: string
    ordinal: number
    name: string
    technical_description: string
    deliverables: string[]
    references: { framework: string; version: string; reference: string }[]
    criticality: Record<string, string>
  }[]
  unresolved_references: { typology: string; framework: string; reference: string }[]
}

let db: Client

beforeAll(async () => {
  db = await connect()
})

afterAll(async () => {
  await db.end()
})

describe('Matrice des preuves', () => {
  it('la base et le fichier de données ne divergent pas', async () => {
    const { rows } = await db.query<{
      code: string
      ordinal: number
      name: string
      technical_description: string
      deliverables: string[]
    }>(
      'select code, ordinal, name, technical_description, deliverables from public.evidence_typology order by ordinal',
    )

    expect(rows).toHaveLength(source.matrix.typology_count)
    for (const [index, typology] of source.typologies.entries()) {
      const row = rows[index]!
      expect(row.code).toBe(typology.code)
      expect(row.name).toBe(typology.name)
      expect(row.technical_description).toBe(typology.technical_description)
      expect(row.deliverables).toEqual(typology.deliverables)
    }
  })

  it('chaque case de la matrice est chargée', async () => {
    const { rows } = await db.query<{ code: string; profile: string; criticality: string }>(
      `select t.code, p.profile::text, p.criticality::text
         from public.evidence_typology_profile p
         join public.evidence_typology t on t.id = p.typology_id`,
    )

    expect(rows).toHaveLength(source.matrix.typology_count * source.matrix.profile_count)
    for (const typology of source.typologies) {
      for (const profile of source.profiles) {
        const cell = rows.find((r) => r.code === typology.code && r.profile === profile.code)
        expect(cell?.criticality).toBe(typology.criticality[profile.code])
      }
    }
  })

  it('les références qui ne se résolvent pas sont nommées, pas tues', async () => {
    // Une Declaration qui les tairait paraitrait complete en omettant ce
    // qu'elle ne sait pas rapprocher.
    const { rows } = await db.query<{
      typology_code: string
      framework_code: string
      reference: string
    }>('select typology_code, framework_code, reference from app.evidence_matrix_gaps()')

    const actual = rows
      .map((r) => `${r.typology_code}|${r.framework_code}|${r.reference}`)
      .sort()
    const declared = source.unresolved_references
      .map((r) => `${r.typology}|${r.framework}|${r.reference}`)
      .sort()

    expect(actual).toEqual(declared)
  })
})

describe('Typologies attendues d’une organisation', () => {
  it('classe les typologies par criticité pour le profil de l’organisation', async () => {
    const rows = await asUser(db, DEMO.officerA, async (c) => {
      const { rows } = await c.query<{ code: string; criticality: string; profile: string }>(
        'select code, criticality::text, profile::text from app.evidence_typologies($1)',
        [DEMO.orgA],
      )
      return rows
    })

    expect(rows).toHaveLength(source.matrix.typology_count)
    expect(rows[0]!.profile).toBe('integrator_consultant')

    // L'ordre est décroissant : la plus exigeante d'abord.
    const rank = ['critical', 'high', 'moderate', 'low', 'negligible']
    const positions = rows.map((r) => rank.indexOf(r.criticality))
    expect(positions).toEqual([...positions].sort((a, b) => a - b))
  })

  it('ne présume aucun profil quand il n’est pas renseigné', async () => {
    const rows = await asUser(db, DEMO.officerA, async (c) => {
      await c.query('update public.organization set ai_activity_profile = null where id = $1', [
        DEMO.orgA,
      ])
      const { rows } = await c.query<{ criticality: string | null; profile: string | null }>(
        'select criticality::text, profile::text from app.evidence_typologies($1)',
        [DEMO.orgA],
      )
      return rows
    })

    expect(rows).toHaveLength(source.matrix.typology_count)
    for (const row of rows) {
      expect(row.criticality).toBeNull()
      expect(row.profile).toBeNull()
    }
  })

  it('ne rend rien à un tenant étranger', async () => {
    const rows = await asUser(db, DEMO.officerB, async (c) => {
      const { rows } = await c.query('select * from app.evidence_typologies($1)', [DEMO.orgA])
      return rows
    })
    expect(rows).toHaveLength(0)
  })

  it('deux profils n’attendent pas les mêmes preuves', async () => {
    // C'est toute la raison d'etre de la matrice : un hebergeur repond de
    // l'isolation de ses calculs, un utilisateur metier de la derive du systeme
    // qu'il exploite.
    const { rows } = await db.query<{ code: string; host: string; user_profile: string }>(
      `select t.code,
              max(p.criticality::text) filter (where p.profile = 'infrastructure_host') as host,
              max(p.criticality::text) filter (where p.profile = 'business_user') as user_profile
         from public.evidence_typology t
         join public.evidence_typology_profile p on p.typology_id = t.id
        group by t.code`,
    )

    const isolation = rows.find((r) => r.code === 'ISOL')!
    const drift = rows.find((r) => r.code === 'DRIFT')!

    expect(isolation.host).toBe('critical')
    expect(isolation.user_profile).toBe('low')
    expect(drift.host).toBe('negligible')
    expect(drift.user_profile).toBe('critical')
  })
})

describe('Déclaration d’Applicabilité ajustée à la criticité', () => {
  type Row = {
    requirement_reference: string
    expected_criticality: string | null
    evidence_regime: string
    coverage: string
    soa_status: string | null
    gap: string | null
  }

  async function soa(user: string, organization: string) {
    return asUser(db, user, async (c) => {
      const { rows } = await c.query<Row>(
        `select requirement_reference, expected_criticality::text, evidence_regime,
                coverage, soa_status::text, gap
           from app.statement_of_applicability($1)`,
        [organization],
      )
      return rows
    })
  }

  it('déduit le régime de preuve de la criticité attendue', async () => {
    const rows = await soa(DEMO.officerA, DEMO.orgA)

    for (const row of rows) {
      if (row.expected_criticality === 'critical' || row.expected_criticality === 'high') {
        expect(row.evidence_regime).toBe('technical')
      } else if (row.expected_criticality === 'moderate' || row.expected_criticality === 'low') {
        expect(row.evidence_regime).toBe('organisational')
      } else if (row.expected_criticality === 'negligible') {
        expect(row.evidence_regime).toBe('exclusion')
      } else {
        expect(row.evidence_regime).toBe('unspecified')
      }
    }
  })

  it('le régime change avec le profil, sur la même exigence', async () => {
    const asIntegrator = await soa(DEMO.officerA, DEMO.orgA)
    const asHost = await asUser(db, DEMO.officerA, async (c) => {
      await c.query(
        "update public.organization set ai_activity_profile = 'infrastructure_host' where id = $1",
        [DEMO.orgA],
      )
      const { rows } = await c.query<Row>(
        `select requirement_reference, expected_criticality::text, evidence_regime,
                coverage, soa_status::text, gap
           from app.statement_of_applicability($1)`,
        [DEMO.orgA],
      )
      return rows
    })

    // A.10.2 releve de l'explicabilite : elevee pour un integrateur,
    // negligeable pour un hebergeur qui n'entraine ni ne concoit rien.
    const integrator = asIntegrator.find((r) => r.requirement_reference === 'A.10.2')!
    const host = asHost.find((r) => r.requirement_reference === 'A.10.2')!

    expect(integrator.evidence_regime).toBe('technical')
    expect(host.evidence_regime).toBe('exclusion')
  })

  it('signale toute exigence laissée sans décision', async () => {
    const rows = await soa(DEMO.officerA, DEMO.orgA)
    const undecided = rows.filter((r) => r.soa_status === null)

    expect(undecided.length).toBeGreaterThan(0)
    for (const row of undecided) expect(row.gap).toBe('undecided')
  })

  it('conteste une exclusion là où la matrice attend une preuve', async () => {
    const rows = await soa(DEMO.officerA, DEMO.orgA)
    const contested = rows.filter((r) => r.gap === 'exclusion_contested')

    expect(contested.length).toBeGreaterThan(0)
    for (const row of contested) {
      expect(row.soa_status).toBe('excluded')
      expect(['technical', 'organisational']).toContain(row.evidence_regime)
    }
  })

  it('ne conteste pas une exclusion que la matrice ne contredit pas', async () => {
    const rows = await soa(DEMO.officerA, DEMO.orgA)
    const accepted = rows.filter(
      (r) => r.soa_status === 'excluded' && r.evidence_regime === 'unspecified',
    )

    expect(accepted.length).toBeGreaterThan(0)
    for (const row of accepted) expect(row.gap).toBeNull()
  })

  it('rend un état d’avancement cohérent', async () => {
    const readiness = await asUser(db, DEMO.officerA, async (c) => {
      const { rows } = await c.query<{ r: Record<string, unknown> }>(
        'select app.soa_readiness($1) as r',
        [DEMO.orgA],
      )
      return rows[0]!.r as {
        available: boolean
        requirements: number
        decided: number
        selected: number
        excluded: number
        undecided: number
      }
    })

    expect(readiness.available).toBe(true)
    expect(readiness.decided).toBe(readiness.selected + readiness.excluded)
    expect(readiness.undecided).toBe(readiness.requirements - readiness.decided)
  })

  it('reste soumise à l’habilitation', async () => {
    const rows = await soa(DEMO.officerB, DEMO.orgA)
    expect(rows).toHaveLength(0)
  })
})

describe('Décision d’applicabilité', () => {
  async function requirementId(reference: string): Promise<string> {
    const { rows } = await db.query<{ id: string }>(
      `select r.id from public.requirement r
         join public.framework f on f.id = r.framework_id
        where f.code = 'ISO_IEC_42001' and r.requirement_reference = $1`,
      [reference],
    )
    return rows[0]!.id
  }

  const insert = (requirement: string, status: string, justification: string) => ({
    sql: `insert into public.soa_decision
            (tenant_id, organization_id, requirement_id, status, justification, decided_by)
          values ($1, $2, $3, $4, $5, $6)`,
    params: [DEMO.tenantA, DEMO.orgA, requirement, status, justification, DEMO.officerA],
  })

  it('refuse une décision sans justification', async () => {
    // La regle d'or ne tient pas dans un ecran : elle tient dans la contrainte.
    const requirement = await requirementId('A.3.2')
    await asUser(db, DEMO.officerA, async (c) => {
      const query = insert(requirement, 'excluded', '   ')
      const failure = await expectFailure(c, query.sql, query.params)
      expect(failure.code).toBe('23514')
    })
  })

  it('n’autorise pas à décider au nom d’un autre', async () => {
    const requirement = await requirementId('A.3.3')
    await asUser(db, DEMO.officerA, async (c) => {
      const query = insert(requirement, 'selected', 'Justification suffisamment développée pour être lue.')
      query.params[5] = DEMO.riskOwnerA
      const failure = await expectFailure(c, query.sql, query.params)
      expect(failure.message).toMatch(/en son propre nom/)
    })
  })

  it('journalise la décision', async () => {
    const requirement = await requirementId('A.4.3')
    await asUser(db, DEMO.officerA, async (c) => {
      const query = insert(
        requirement,
        'selected',
        'Les ressources en données sont inventoriées et rattachées à un responsable identifié.',
      )
      await c.query(query.sql, query.params)

      const { rows } = await c.query<{ n: string }>(
        `select count(*)::text as n from public.audit_log
          where entity_type = 'soa_decision' and entity_ref = 'A.4.3'`,
      )
      expect(Number(rows[0]!.n)).toBe(1)
    })
  })

  it('n’expose aucune décision à un tenant étranger', async () => {
    const visible = await asUser(db, DEMO.officerB, async (c) => {
      const { rows } = await c.query<{ n: string }>(
        'select count(*)::text as n from public.soa_decision',
      )
      return Number(rows[0]!.n)
    })
    expect(visible).toBe(0)
  })
})

import { afterAll, beforeAll, describe, expect, it } from 'vitest'
import { createHash } from 'node:crypto'
import { readFileSync } from 'node:fs'
import type { Client } from 'pg'
import { asUser, connect, DEMO, expectFailure } from '../helpers/db'
import { translateCsv } from '@/lib/catalog/csv'

/**
 * Import d'un referentiel de controles, selon IMPORT_SPEC.md.
 *
 * Les tests rejouent le flux reel sur le paquet AIGMS Control Framework v0.1 :
 * 12 domaines, 120 controles.
 */

const ADMIN = '66666666-6666-4666-8666-666666666666'
const SOURCE = 'knowledge/frameworks/aigms/v0.1/aigms_control_framework_v0.1.json'

const raw = readFileSync(SOURCE, 'utf8')
const sha256 = createHash('sha256').update(raw).digest('hex')
// Le code AIGMS-CF appartient au referentiel de l'editeur (migration 0043) :
// un tenant ne peut pas le reprendre. Le test importe le meme paquet sous un
// code de cabinet — c'est le cas reel d'un cabinet qui importe le sien.
const payload = (() => {
  const p = JSON.parse(raw) as { framework: Record<string, unknown> } & Record<string, unknown>
  p.framework = { ...p.framework, id: 'CAB-TEST', name: 'Référentiel de test du cabinet' }
  return p as Record<string, unknown>
})()

let db: Client

beforeAll(async () => {
  db = await connect()
})

afterAll(async () => {
  await db.end()
})

/** Depose un import et retourne son identifiant. */
async function upload(
  client: Client,
  body: unknown = payload,
  filename = 'aigms_control_framework_v0.1.json',
): Promise<string> {
  const { rows } = await client.query<{ id: string }>(
    `insert into public.catalog_import_job
       (tenant_id, source_filename, source_sha256, payload, uploaded_by)
     values ($1, $2, $3, $4::jsonb, $5)
     returning id`,
    [DEMO.tenantA, filename, sha256, JSON.stringify(body), ADMIN],
  )
  return rows[0]!.id
}

describe('Import du referentiel de controles', () => {
  it('valide puis importe les 120 controles en une transaction', async () => {
    const result = await asUser(db, ADMIN, async (c) => {
      const jobId = await upload(c)

      const { rows: validation } = await c.query<{ r: { status: string; controls: number } }>(
        'select app.validate_catalog_import($1) as r',
        [jobId],
      )
      const { rows: commit } = await c.query<{ r: { status: string; controls: number } }>(
        'select app.commit_catalog_import($1) as r',
        [jobId],
      )

      const { rows: counted } = await c.query<{ n: string }>(
        `select count(*)::text as n from public.catalog_control
          where version_id = (select version_id from public.catalog_import_job where id = $1)`,
        [jobId],
      )

      return { validation: validation[0]!.r, commit: commit[0]!.r, stored: Number(counted[0]!.n) }
    })

    expect(result.validation.status).toBe('VALIDATED')
    expect(result.validation.controls).toBe(120)
    expect(result.commit.status).toBe('IMPORTED')
    expect(result.stored).toBe(120)
  })

  it('un CSV au format du modele passe la meme validation et le meme import', async () => {
    // Le CSV n'a pas son propre moteur : il est traduit en paquet canonique et
    // suit exactement le chemin du JSON. Ce test le prouve de bout en bout.
    const translated = translateCsv(readFileSync('public/modeles/referentiel-controles.csv', 'utf8'), {
      id: 'CAB-CF',
      name: 'Référentiel du cabinet',
      version: '1.0',
    })
    expect(translated.ok).toBe(true)
    if (!translated.ok) return

    const result = await asUser(db, ADMIN, async (c) => {
      const jobId = await upload(c, translated.payload, 'referentiel-controles.csv')
      const { rows: validation } = await c.query<{ r: { status: string; controls: number; domains: number } }>(
        'select app.validate_catalog_import($1) as r',
        [jobId],
      )
      const { rows: commit } = await c.query<{ r: { status: string } }>(
        'select app.commit_catalog_import($1) as r',
        [jobId],
      )
      const { rows: domains } = await c.query<{ code: string; name: string; control_count: number }>(
        `select code, name, control_count from public.catalog_domain
          where version_id = (select version_id from public.catalog_import_job where id = $1)
          order by display_order`,
        [jobId],
      )
      return { validation: validation[0]!.r, commit: commit[0]!.r, domains }
    })

    expect(result.validation.status).toBe('VALIDATED')
    expect(result.validation.controls).toBe(4)
    expect(result.validation.domains).toBe(3)
    expect(result.commit.status).toBe('IMPORTED')
    expect(result.domains[0]).toMatchObject({ code: 'GOV', name: 'Gouvernance', control_count: 2 })
  })

  it('rejette un controle rattache a un domaine absent du document', async () => {
    const errors = await asUser(db, ADMIN, async (c) => {
      const broken = structuredClone(payload) as { controls: { domain: string }[] }
      broken.controls[0]!.domain = 'ZZZ'

      const jobId = await upload(c, broken, 'domaine-inconnu.json')
      await c.query('select app.validate_catalog_import($1)', [jobId])

      const { rows } = await c.query<{ code: string; message: string }>(
        'select code, message from public.catalog_import_error where job_id = $1',
        [jobId],
      )
      return rows
    })

    expect(errors.some((e) => e.code === 'UNKNOWN_DOMAIN')).toBe(true)
  })

  it('rejette un document dont le compte declare ne correspond pas', async () => {
    const errors = await asUser(db, ADMIN, async (c) => {
      const broken = structuredClone(payload) as {
        controls: unknown[]
        framework: { control_count: number }
      }
      broken.controls = broken.controls.slice(0, 10)

      const jobId = await upload(c, broken, 'compte-faux.json')
      await c.query('select app.validate_catalog_import($1)', [jobId])

      const { rows } = await c.query<{ code: string; message: string }>(
        'select code, message from public.catalog_import_error where job_id = $1',
        [jobId],
      )
      return rows
    })

    const mismatch = errors.find((e) => e.code === 'CONTROL_COUNT_MISMATCH')
    expect(mismatch).toBeDefined()
    expect(mismatch?.message).toMatch(/120 contrôles et en porte 10/)
  })

  it('rejette deux controles partageant la meme cle naturelle', async () => {
    const errors = await asUser(db, ADMIN, async (c) => {
      const broken = structuredClone(payload) as {
        controls: { id: string; version: string }[]
        framework: { control_count: number }
      }
      broken.controls[1] = { ...broken.controls[1]!, id: broken.controls[0]!.id }
      broken.framework.control_count = broken.controls.length

      const jobId = await upload(c, broken, 'doublon.json')
      await c.query('select app.validate_catalog_import($1)', [jobId])

      const { rows } = await c.query<{ code: string }>(
        'select code from public.catalog_import_error where job_id = $1',
        [jobId],
      )
      return rows
    })

    expect(errors.some((e) => e.code === 'DUPLICATE_CONTROL')).toBe(true)
  })

  it('un import rejete ne laisse aucune trace dans le catalogue', async () => {
    // On compare avant et apres plutot que de supposer un catalogue vide :
    // le test doit tenir quel que soit l'etat de la base.
    const { status, before, after } = await asUser(db, ADMIN, async (c) => {
      const count = async () => {
        const { rows } = await c.query<{ n: string }>(
          'select count(*)::text as n from public.catalog_version',
        )
        return Number(rows[0]!.n)
      }

      const before = await count()
      const jobId = await upload(c, { framework: {} }, 'vide.json')
      await c.query('select app.validate_catalog_import($1)', [jobId])

      const { rows: job } = await c.query<{ status: string }>(
        'select status from public.catalog_import_job where id = $1',
        [jobId],
      )
      return { status: job[0]!.status, before, after: await count() }
    })

    expect(status).toBe('REJECTED')
    expect(after).toBe(before)
  })

  it("une baseline publiee est immuable et ne se reimporte pas", async () => {
    const result = await asUser(db, ADMIN, async (c) => {
      const jobId = await upload(c)
      await c.query('select app.validate_catalog_import($1)', [jobId])
      await c.query('select app.commit_catalog_import($1)', [jobId])

      const { rows: version } = await c.query<{ version_id: string }>(
        'select version_id from public.catalog_import_job where id = $1',
        [jobId],
      )
      await c.query('select app.publish_catalog_version($1)', [version[0]!.version_id])

      const frozen = await expectFailure(
        c,
        "update public.catalog_control set title = 'Modifie' where version_id = $1",
        [version[0]!.version_id],
      )

      const second = await upload(c, payload, 'copie.json')
      await c.query('select app.validate_catalog_import($1)', [second])
      const { rows: errors } = await c.query<{ code: string }>(
        'select code from public.catalog_import_error where job_id = $1',
        [second],
      )

      return { frozen: frozen.message, errors: errors.map((e) => e.code) }
    })

    expect(result.frozen).toMatch(/baseline publiée est immuable/)
    expect(result.errors).toContain('PUBLISHED_BASELINE')
  })

  it("l'import releve de l'administration, pas de la gouvernance", async () => {
    const failure = await asUser(db, DEMO.officerA, (c) =>
      expectFailure(
        c,
        `insert into public.catalog_import_job
           (tenant_id, source_filename, source_sha256, payload)
         values ($1, 'tentative.json', $2, '{}'::jsonb)`,
        [DEMO.tenantA, sha256],
      ),
    )

    expect(failure.message).toMatch(/row-level security/i)
  })

  it('le catalogue est lisible par les roles de gouvernance, jamais par anon', async () => {
    // Le catalogue ne porte aucune donnee client : tout compte authentifie le
    // lit, ce qui permet a un officer d'instancier un controle-type.
    const asOfficer = await asUser(db, ADMIN, async (c) => {
      const jobId = await upload(c)
      await c.query('select app.validate_catalog_import($1)', [jobId])
      await c.query('select app.commit_catalog_import($1)', [jobId])

      await c.query("select set_config('request.jwt.claims', $1, true)", [
        JSON.stringify({ sub: DEMO.officerA, role: 'authenticated' }),
      ])
      // Le referentiel de l'editeur (120) plus celui du cabinet (120) : l'officier
      // du tenant voit les deux.
      const { rows } = await c.query('select id from public.catalog_control')
      return rows.length
    })

    expect(asOfficer).toBe(240)
  })

  it("le catalogue n'est pas lisible sans session", async () => {
    await db.query('begin')
    try {
      await db.query("select set_config('role', 'anon', true)")
      await db.query("select set_config('request.jwt.claims', '', true)")
      const failure = await expectFailure(db, 'select id from public.catalog_control')
      expect(failure.message).toMatch(/permission denied|row-level security/i)
    } finally {
      await db.query('rollback')
    }
  })
})

import { afterAll, beforeAll, describe, expect, it } from 'vitest'
import type { Client } from 'pg'
import { asUser, connect, DEMO, expectFailure } from '../helpers/db'

/**
 * Depot de preuves.
 *
 * Un fichier de preuve est le contenu le plus sensible de la plateforme : il
 * porte des extraits de journaux, des rapports de test, parfois des donnees
 * personnelles. Trois choses se verifient donc ici — le confinement au client,
 * l'immuabilite apres validation, et le caractere nominatif de la validation.
 */

let db: Client

beforeAll(async () => {
  db = await connect()
})

afterAll(async () => {
  await db.end()
})

const OBJECT_PREFIX = `${DEMO.tenantA}/${DEMO.orgA}`

/** Change d'utilisateur SANS quitter la transaction en cours. */
async function becomes(client: Client, userId: string) {
  await client.query("select set_config('request.jwt.claims', $1, true)", [
    JSON.stringify({ sub: userId, role: 'authenticated' }),
  ])
}

async function insertObject(client: Client, name: string) {
  await client.query(
    `insert into storage.objects (bucket_id, name, owner_id, metadata)
     values ('evidence', $1, $2, '{"size": 12}'::jsonb)`,
    [name, DEMO.officerA],
  )
}

describe('Isolation du compartiment de preuves', () => {
  it('accepte le dépôt d’un contributeur dans son propre tenant', async () => {
    await asUser(db, DEMO.officerA, async (c) => {
      await insertObject(c, `${OBJECT_PREFIX}/${crypto.randomUUID()}/rapport.pdf`)
      const { rows } = await c.query(
        "select count(*)::int as n from storage.objects where bucket_id = 'evidence'",
      )
      expect(rows[0].n).toBeGreaterThan(0)
    })
  })

  it('refuse un dépôt sous le préfixe d’un autre tenant', async () => {
    await asUser(db, DEMO.officerA, async (c) => {
      const failure = await expectFailure(
        c,
        `insert into storage.objects (bucket_id, name, owner_id, metadata)
         values ('evidence', $1, $2, '{}'::jsonb)`,
        [`${DEMO.tenantB}/${DEMO.orgB}/x/fuite.pdf`, DEMO.officerA],
      )
      expect(failure.message).toMatch(/row-level security/)
    })
  })

  it('refuse un dépôt sous un chemin qui ne nomme aucun tenant', async () => {
    // Le cast echoue, la fonction rend null, et null n'ouvre aucune politique.
    await asUser(db, DEMO.officerA, async (c) => {
      const failure = await expectFailure(
        c,
        `insert into storage.objects (bucket_id, name, owner_id, metadata)
         values ('evidence', 'public/tout-le-monde.pdf', $1, '{}'::jsonb)`,
        [DEMO.officerA],
      )
      expect(failure.message).toMatch(/row-level security/)
    })
  })

  it('n’expose aucun objet à un tenant étranger', async () => {
    // Le depot et la relecture tiennent dans la meme transaction : Supabase
    // interdit la suppression directe dans storage.objects, et une transaction
    // annulee est le seul nettoyage disponible.
    const name = `${OBJECT_PREFIX}/${crypto.randomUUID()}/confidentiel.pdf`

    await asUser(db, DEMO.officerA, async (c) => {
      await insertObject(c, name)
      await becomes(c, DEMO.officerB)

      const { rows } = await c.query(
        'select count(*)::int as n from storage.objects where name = $1',
        [name],
      )
      expect(rows[0].n).toBe(0)
    })
  })

  it('laisse lire l’auditeur, sans lui laisser déposer', async () => {
    const name = `${OBJECT_PREFIX}/${crypto.randomUUID()}/piece.pdf`

    await asUser(db, DEMO.officerA, async (c) => {
      await insertObject(c, name)
      await becomes(c, DEMO.auditorA)

      const { rows } = await c.query(
        'select count(*)::int as n from storage.objects where name = $1',
        [name],
      )
      expect(rows[0].n).toBe(1)

      const failure = await expectFailure(
        c,
        `insert into storage.objects (bucket_id, name, owner_id, metadata)
         values ('evidence', $1, $2, '{}'::jsonb)`,
        [`${OBJECT_PREFIX}/${crypto.randomUUID()}/ajout.pdf`, DEMO.auditorA],
      )
      expect(failure.message).toMatch(/row-level security/)
    })
  })

  it('n’ouvre aucun remplacement sur place', async () => {
    // Aucune politique UPDATE : c'est le pendant, cote stockage, de
    // l'immuabilite d'une preuve validee.
    const { rows } = await db.query<{ cmd: string }>(
      `select cmd::text from pg_policies
       where schemaname = 'storage' and tablename = 'objects'
         and policyname like 'evidence_object%'`,
    )
    expect(rows.map((r) => r.cmd).sort()).toEqual(['DELETE', 'INSERT', 'SELECT'])
  })
})

describe('Garde-fous de la ligne de preuve', () => {
  const insertEvidence = (path: string | null, hash: string | null) => `
    insert into public.evidence (tenant_id, organization_id, title, evidence_type, source,
                                 storage_bucket, storage_path, content_hash, owner_user_id)
    values ('${DEMO.tenantA}', '${DEMO.orgA}', 'Pièce de test', 'document', 'Test',
            ${path ? "'evidence'" : 'null'}, ${path ? `'${path}'` : 'null'},
            ${hash ? `'${hash}'` : 'null'}, '${DEMO.officerA}')
    returning id`

  it('refuse un chemin qui sort du périmètre du client', async () => {
    await asUser(db, DEMO.officerA, async (c) => {
      const failure = await expectFailure(
        c,
        insertEvidence(`${DEMO.tenantB}/${DEMO.orgB}/x/f.pdf`, 'sha256:abc'),
      )
      expect(failure.message).toMatch(/doit commencer par/)
    })
  })

  it('refuse un fichier sans empreinte', async () => {
    await asUser(db, DEMO.officerA, async (c) => {
      const failure = await expectFailure(c, insertEvidence(`${OBJECT_PREFIX}/x/f.pdf`, null))
      expect(failure.code).toBe('23514')
    })
  })

  it('fige le fichier d’une preuve validée', async () => {
    await asUser(db, DEMO.officerA, async (c) => {
      const { rows } = await c.query<{ id: string }>(
        insertEvidence(`${OBJECT_PREFIX}/x/f.pdf`, 'sha256:aaa'),
      )
      const id = rows[0]!.id

      await c.query(
        `update public.evidence
            set validation_status = 'validated', validated_by = $1, validated_at = now()
          where id = $2`,
        [DEMO.officerA, id],
      )

      const failure = await expectFailure(
        c,
        "update public.evidence set content_hash = 'sha256:bbb' where id = $1",
        [id],
      )
      expect(failure.message).toMatch(/ne se remplace pas/)
    })
  })

  it('n’autorise pas à valider au nom d’un autre', async () => {
    await asUser(db, DEMO.officerA, async (c) => {
      const { rows } = await c.query<{ id: string }>(
        insertEvidence(`${OBJECT_PREFIX}/y/f.pdf`, 'sha256:ccc'),
      )
      const failure = await expectFailure(
        c,
        `update public.evidence
            set validation_status = 'validated', validated_by = $1, validated_at = now()
          where id = $2`,
        [DEMO.riskOwnerA, rows[0]!.id],
      )
      expect(failure.message).toMatch(/en son propre nom/)
    })
  })

  it('journalise la validation', async () => {
    await asUser(db, DEMO.officerA, async (c) => {
      const { rows } = await c.query<{ id: string }>(
        insertEvidence(`${OBJECT_PREFIX}/z/f.pdf`, 'sha256:ddd'),
      )
      await c.query(
        `update public.evidence
            set validation_status = 'validated', validated_by = $1, validated_at = now()
          where id = $2`,
        [DEMO.officerA, rows[0]!.id],
      )

      const { rows: audit } = await c.query<{ n: string }>(
        `select count(*)::text as n from public.audit_log
          where entity_type = 'evidence' and entity_id = $1 and action = 'evidence_validated'`,
        [rows[0]!.id],
      )
      expect(Number(audit[0]!.n)).toBe(1)
    })
  })
})

describe('Registre des preuves', () => {
  it('rend la fraîcheur, le validateur et les contrôles adossés', async () => {
    const rows = await asUser(db, DEMO.officerA, async (c) => {
      const { rows } = await c.query('select * from app.evidence_register($1)', [DEMO.orgA])
      return rows as {
        business_ref: string
        freshness: string
        validation_status: string
        control_codes: string[]
        validated_by_name: string | null
      }[]
    })

    expect(rows.length).toBeGreaterThan(0)
    expect(rows.some((r) => r.control_codes.length > 0)).toBe(true)
    expect(rows.some((r) => r.freshness === 'expired')).toBe(true)
    for (const row of rows.filter((r) => r.validation_status === 'validated')) {
      expect(row.validated_by_name).not.toBeNull()
    }
  })

  it('ne rend rien à un tenant étranger', async () => {
    const rows = await asUser(db, DEMO.officerB, async (c) => {
      const { rows } = await c.query('select * from app.evidence_register($1)', [DEMO.orgA])
      return rows
    })
    expect(rows).toHaveLength(0)
  })

  it('met en tête les contrôles opérants que rien ne démontre', async () => {
    const rows = await asUser(db, DEMO.officerA, async (c) => {
      const { rows } = await c.query('select * from app.controls_awaiting_evidence($1)', [
        DEMO.orgA,
      ])
      return rows as { code: string; status: string; is_evidenced: boolean }[]
    })

    const first = rows[0]!
    expect(first.status).toBe('operating')
    expect(first.is_evidenced).toBe(false)
  })
})

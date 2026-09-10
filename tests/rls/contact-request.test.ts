import { afterAll, beforeAll, describe, expect, it } from 'vitest'
import type { Client } from 'pg'
import { asUser, connect, DEMO, expectFailure } from '../helpers/db'

/**
 * `contact_request` etait la seule table acceptant une ecriture anonyme. Le
 * formulaire public ayant ete repris par le site commercial, l'exception n'a
 * plus d'objet : elle est fermee (migration 0030), et anon retrouve la regle
 * generale — aucun droit.
 *
 * Ces tests verrouillent les deux faces : la porte est close, l'archive reste
 * lisible par l'administration.
 */

const PLATFORM_ADMIN = '66666666-6666-4666-8666-666666666666'

let db: Client

/** Endosse le role `anon`, celui de PostgREST sans session. */
async function asAnon<T>(client: Client, run: (client: Client) => Promise<T>): Promise<T> {
  await client.query('begin')
  try {
    await client.query("select set_config('role', 'anon', true)")
    await client.query("select set_config('request.jwt.claims', '', true)")
    return await run(client)
  } finally {
    await client.query('rollback')
  }
}

beforeAll(async () => {
  db = await connect()
})

afterAll(async () => {
  await db.end()
})

describe('Surface anonyme', () => {
  it('un visiteur anonyme ne peut plus déposer de demande', async () => {
    // Une ecriture anonyme sans formulaire pour l'emettre serait une surface
    // d'attaque sans usage.
    const failure = await asAnon(db, (c) =>
      expectFailure(
        c,
        `insert into public.contact_request (full_name, email, organization, profile, message)
         values ('Camille Test', 'camille@exemple-test.fr', 'Exemple SAS', 'direction', 'Deux usages en test.')`,
      ),
    )

    expect(failure.message).toMatch(/permission denied|row-level security/i)
  })

  it('un visiteur anonyme ne peut pas relire les demandes', async () => {
    const failure = await asAnon(db, (c) =>
      expectFailure(c, 'select * from public.contact_request'),
    )

    expect(failure.message).toMatch(/permission denied|row-level security/i)
  })

  it('un visiteur anonyme ne peut ni modifier ni supprimer', async () => {
    const update = await asAnon(db, (c) =>
      expectFailure(c, "update public.contact_request set status = 'archived'"),
    )
    const remove = await asAnon(db, (c) => expectFailure(c, 'delete from public.contact_request'))

    expect(update.message).toMatch(/permission denied|row-level security/i)
    expect(remove.message).toMatch(/permission denied|row-level security/i)
  })

  it('un visiteur anonyme ne touche à aucune table', async () => {
    const failure = await asAnon(db, (c) => expectFailure(c, 'select id from public.ai_use_case'))
    expect(failure.message).toMatch(/permission denied|row-level security/i)
  })

  it('plus aucune table n’accorde de droit au rôle anonyme', async () => {
    // La regle generale posee en 0005 redevient sans exception. Ce test la
    // verifie sur l'ensemble du schema plutot que table par table.
    const { rows } = await db.query<{ table_name: string; privilege_type: string }>(
      `select table_name, privilege_type
         from information_schema.role_table_grants
        where grantee = 'anon' and table_schema = 'public'`,
    )

    expect(rows).toHaveLength(0)
  })
})

describe('Archive des demandes reçues', () => {
  it("un officer sans privilège plateforme ne lit pas les demandes", async () => {
    const visible = await asUser(db, DEMO.officerA, async (c) => {
      const { rows } = await c.query('select id from public.contact_request')
      return rows.length
    })

    expect(visible).toBe(0)
  })

  it("l'administration plateforme lit et qualifie les demandes reçues", async () => {
    // Fermer l'entree n'efface pas ce qui est deja arrive : ce sont des pistes
    // commerciales reelles.
    const { visible, updated } = await asUser(db, PLATFORM_ADMIN, async (c) => {
      const { rows } = await c.query('select id from public.contact_request')
      const result = await c.query(
        `update public.contact_request set status = 'contacted', handled_by = $1, handled_at = now()
          where id = $2`,
        [PLATFORM_ADMIN, rows[0]?.id],
      )
      return { visible: rows.length, updated: result.rowCount }
    })

    expect(visible).toBeGreaterThan(0)
    expect(updated).toBe(1)
  })

  it('les garde-fous de la table restent en place', async () => {
    // Adresse valide, une demande par adresse et par jour : ces regles servent
    // encore si l'entree devait etre rouverte, par API ou par reprise.
    await asUser(db, PLATFORM_ADMIN, async (c) => {
      const malformed = await expectFailure(
        c,
        `insert into public.contact_request (full_name, email, organization, profile)
         values ('Sans arobase', 'pas-une-adresse', 'Exemple SAS', 'autre')`,
      )
      expect(malformed.message).toMatch(/contact_request_email_check|violates check constraint/i)

      await c.query(
        `insert into public.contact_request (full_name, email, organization, profile)
         values ('Doublon', 'doublon@exemple-test.fr', 'Exemple SAS', 'autre')`,
      )
      const duplicate = await expectFailure(
        c,
        `insert into public.contact_request (full_name, email, organization, profile)
         values ('Doublon', 'DOUBLON@exemple-test.fr', 'Exemple SAS', 'autre')`,
      )
      expect(duplicate.code).toBe('23505')
    })
  })
})

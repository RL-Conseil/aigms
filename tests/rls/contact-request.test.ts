import { afterAll, beforeAll, describe, expect, it } from 'vitest'
import type { Client } from 'pg'
import { asUser, connect, DEMO, expectFailure } from '../helpers/db'

/**
 * `contact_request` est la seule table acceptant une ecriture anonyme. Ces
 * tests verrouillent la portee exacte de cette exception : anon insere, et rien
 * de plus.
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

describe('Demandes de contact', () => {
  it('un visiteur anonyme peut deposer une demande', async () => {
    const inserted = await asAnon(db, async (c) => {
      const result = await c.query(
        `insert into public.contact_request (full_name, email, organization, profile, message)
         values ('Camille Test', 'camille@exemple-test.fr', 'Exemple SAS', 'direction', 'Deux usages en test.')`,
      )
      return result.rowCount
    })

    expect(inserted).toBe(1)
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

  it("un visiteur anonyme ne peut pas se declarer deja traite", async () => {
    // La clause WITH CHECK impose status = 'new' : sans elle, un automate
    // pourrait deposer des demandes deja marquees archivees, invisibles au suivi.
    const failure = await asAnon(db, (c) =>
      expectFailure(
        c,
        `insert into public.contact_request (full_name, email, organization, profile, status)
         values ('Automate', 'bot@exemple-test.fr', 'Bot SAS', 'autre', 'archived')`,
      ),
    )

    expect(failure.message).toMatch(/row-level security/i)
  })

  it('un visiteur anonyme ne touche a aucune autre table', async () => {
    const failure = await asAnon(db, (c) =>
      expectFailure(c, 'select id from public.ai_use_case'),
    )

    expect(failure.message).toMatch(/permission denied|row-level security/i)
  })

  it("un officer sans privilege plateforme ne lit pas les demandes", async () => {
    const visible = await asUser(db, DEMO.officerA, async (c) => {
      const { rows } = await c.query('select id from public.contact_request')
      return rows.length
    })

    expect(visible).toBe(0)
  })

  it("l'administration plateforme lit et qualifie les demandes", async () => {
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

  it('une meme adresse ne depose qu une demande par jour', async () => {
    const failure = await asAnon(db, async (c) => {
      await c.query(
        `insert into public.contact_request (full_name, email, organization, profile)
         values ('Doublon', 'doublon@exemple-test.fr', 'Exemple SAS', 'autre')`,
      )
      return expectFailure(
        c,
        `insert into public.contact_request (full_name, email, organization, profile)
         values ('Doublon', 'DOUBLON@exemple-test.fr', 'Exemple SAS', 'autre')`,
      )
    })

    expect(failure.code).toBe('23505')
  })

  it('une adresse mal formee est refusee par la base', async () => {
    const failure = await asAnon(db, (c) =>
      expectFailure(
        c,
        `insert into public.contact_request (full_name, email, organization, profile)
         values ('Sans arobase', 'pas-une-adresse', 'Exemple SAS', 'autre')`,
      ),
    )

    expect(failure.message).toMatch(/contact_request_email_check|violates check constraint/i)
  })
})

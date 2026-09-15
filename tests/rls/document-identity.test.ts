import { afterAll, beforeAll, describe, expect, it } from 'vitest'
import type { Client } from 'pg'
import { asUser, connect, DEMO, expectFailure } from '../helpers/db'

/**
 * Identite documentaire : ce que porte un document sorti de l'outil.
 *
 * Deux garanties comptent ici. La premiere : l'en-tete se lit par une seule
 * fonction, afin que le registre et la declaration d'applicabilite ne
 * divergent jamais sur l'identite qu'ils portent. La seconde : le logo d'un
 * client ne se depose pas sous le prefixe d'un autre.
 */

let db: Client

beforeAll(async () => {
  db = await connect()
})

afterAll(async () => {
  await db.end()
})

type Identity = Record<string, string | null>

async function identity(client: Client, organizationId: string): Promise<Identity | null> {
  const { rows } = await client.query<{ r: Identity | null }>(
    'select app.document_identity($1) as r',
    [organizationId],
  )
  return rows[0]?.r ?? null
}

describe('En-tete des documents', () => {
  it("porte l'identite postale et legale de l'organisation", async () => {
    const result = await asUser(db, DEMO.officerA, (c) => identity(c, DEMO.orgA))

    expect(result).not.toBeNull()
    expect(result!.legal_name).toBe('IzarLink SAS')
    expect(result!.city).toBe('Bayonne')
    expect(result!.registration_number).toMatch(/812 345 678/)
    expect(result!.confidentiality_label).toBe('Confidentiel')
    expect(result!.tenant_name).toBeTruthy()
  })

  it("ne dit rien d'une organisation d'un autre tenant", async () => {
    // La fonction est SECURITY INVOKER : elle ne voit que ce que la RLS laisse
    // voir. Une organisation hors tenant n'existe pas pour elle.
    const result = await asUser(db, DEMO.officerA, (c) => identity(c, DEMO.orgB))
    expect(result).toBeNull()
  })

  it('retombe sur le nom d’usage quand la raison sociale manque', async () => {
    const result = await asUser(db, DEMO.officerB, (c) => identity(c, DEMO.orgB))
    expect(result).not.toBeNull()
    expect(result!.legal_name).toBeTruthy()
  })
})

describe('Administration', () => {
  it("un rôle de gouvernance ne renomme pas son client : l'écriture ne touche aucune ligne", async () => {
    const touched = await asUser(db, DEMO.officerA, async (c) => {
      const result = await c.query("update public.organization set name = 'Renommée' where id = $1", [
        DEMO.orgA,
      ])
      return result.rowCount
    })
    expect(touched).toBe(0)
  })

  it("l'administration renomme, et le nom d'usage change partout", async () => {
    const name = await asUser(db, DEMO.platformAdmin, async (c) => {
      await c.query("update public.organization set name = 'IzarLink Demo' where id = $1", [DEMO.orgA])
      const { rows } = await c.query<{ name: string }>(
        'select name from public.organization where id = $1',
        [DEMO.orgA],
      )
      return rows[0]?.name
    })
    expect(name).toBe('IzarLink Demo')
  })

  it("une organisation ne se supprime pas, même par l'administration", async () => {
    // Aucune policy DELETE n'existe : sous RLS forcee, la suppression ne
    // touche aucune ligne. C'est la premiere ligne de defense.
    const touched = await asUser(db, DEMO.platformAdmin, async (c) => {
      const result = await c.query('delete from public.organization where id = $1', [DEMO.orgA])
      return result.rowCount
    })
    expect(touched).toBe(0)
  })

  it("… ni par un accès direct à la base : le trigger refuse, quel que soit le rôle", async () => {
    // Connexion de service, hors RLS et hors GRANT : seule la regle en base
    // reste. C'est elle qui protege contre un script ou une cle service_role.
    await db.query('begin')
    try {
      await db.query('delete from public.organization where id = $1', [DEMO.orgA])
      throw new Error('la suppression aurait dû être refusée')
    } catch (error) {
      expect((error as Error).message).toMatch(/ne se supprime pas/)
    } finally {
      await db.query('rollback')
    }
  })
})

describe('Logo', () => {
  it('ne peut pas etre depose sous le prefixe d’une autre organisation', async () => {
    const failure = await asUser(db, DEMO.platformAdmin, (c) =>
      expectFailure(
        c,
        'update public.organization set logo_path = $2 where id = $1',
        [DEMO.orgA, `${DEMO.tenantB}/${DEMO.orgB}/logo.png`],
      ),
    )

    expect(failure.message).toMatch(/Le logo doit être déposé sous/)
  })

  it('date son depot, et oublie cette date quand il est retire', async () => {
    const { posed, cleared } = await asUser(db, DEMO.platformAdmin, async (c) => {
      const { rows: a } = await c.query<{ logo_updated_at: string | null }>(
        `update public.organization set logo_path = $2 where id = $1
         returning logo_updated_at`,
        [DEMO.orgA, `${DEMO.tenantA}/${DEMO.orgA}/logo.png`],
      )
      const { rows: b } = await c.query<{ logo_updated_at: string | null }>(
        `update public.organization set logo_path = null where id = $1
         returning logo_updated_at`,
        [DEMO.orgA],
      )
      return { posed: a[0]?.logo_updated_at ?? null, cleared: b[0]?.logo_updated_at ?? null }
    })

    expect(posed).not.toBeNull()
    expect(cleared).toBeNull()
  })
})

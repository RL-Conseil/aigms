import { afterAll, beforeAll, describe, expect, it } from 'vitest'
import type { Client } from 'pg'
import { asUser, connect, DEMO, expectFailure } from '../helpers/db'

/**
 * Marque du tenant : revente en marque blanche.
 *
 * Deux garanties. La premiere : la marque se lit par une seule fonction, donc
 * aucun ecran ne peut la calculer autrement. La seconde : un tenant ne depose
 * pas son logo sous le prefixe d'un autre.
 */

let db: Client

beforeAll(async () => {
  db = await connect()
})

afterAll(async () => {
  await db.end()
})

type Branding = Record<string, string | null>

async function branding(client: Client): Promise<Branding | null> {
  const { rows } = await client.query<{ r: Branding | null }>('select app.tenant_branding() as r')
  return rows[0]?.r ?? null
}

describe('Marque de la plateforme', () => {
  it('porte la marque de l’éditeur tant que le tenant n’a pas posé la sienne', async () => {
    const result = await asUser(db, DEMO.officerA, branding)

    expect(result).not.toBeNull()
    expect(result!.label).toBe('AIGMS')
    expect(result!.tagline).toBe('by Caritis')
    expect(result!.logo_path).toBeNull()
  })

  it('ne rend que la marque du tenant de l’utilisateur', async () => {
    const a = await asUser(db, DEMO.officerA, branding)
    const b = await asUser(db, DEMO.officerB, branding)

    expect(a!.tenant_id).toBe(DEMO.tenantA)
    expect(b!.tenant_id).toBe(DEMO.tenantB)
  })

  it('la mention de l’éditeur se retire : c’est le principe de la marque blanche', async () => {
    const result = await asUser(db, DEMO.platformAdmin, async (c) => {
      const { rows } = await c.query<{ brand_label: string; brand_tagline: string | null }>(
        `update public.tenant
            set brand_label = 'Izarralde Gouvernance', brand_tagline = null
          where id = $1
        returning brand_label, brand_tagline`,
        [DEMO.tenantA],
      )
      return rows[0] ?? null
    })

    expect(result?.brand_label).toBe('Izarralde Gouvernance')
    expect(result?.brand_tagline).toBeNull()
  })

  it('un logo ne se dépose pas sous le préfixe d’un autre tenant', async () => {
    const failure = await asUser(db, DEMO.platformAdmin, (c) =>
      expectFailure(c, 'update public.tenant set logo_path = $2 where id = $1', [
        DEMO.tenantA,
        `${DEMO.tenantB}/plateforme/logo.png`,
      ]),
    )

    expect(failure.message).toMatch(/Le logo de la plateforme doit être déposé sous/)
  })
})

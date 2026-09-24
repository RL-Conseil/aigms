import { afterAll, beforeAll, describe, expect, it } from 'vitest'
import type { Client } from 'pg'
import { asUser, becomeUser, connect, DEMO } from '../helpers/db'

/**
 * La fin de la voie douce (0105).
 *
 * L'ecart de preuve avertit (0097) ; a partir d'une date posee sur
 * l'organisation, il RETIENT. Ce qui est verifie ici est le scenario entier :
 * poser la date avertit et relance, la deplacer rejoue tout, la retirer efface.
 */

type GateCheck = { code: string; satisfied: boolean; severity?: string }
type Gate = { satisfied: boolean; checks: GateCheck[] }

let db: Client
beforeAll(async () => {
  db = await connect()
})
afterAll(async () => {
  await db.end()
})

const gate = async (c: Client, useCaseId: string): Promise<Gate> =>
  (await c.query<{ r: Gate }>('select app.evaluate_production_gate($1) as r', [useCaseId])).rows[0]!.r

/**
 * L'echeance se pose par l'administration de la plateforme : c'est un
 * engagement de service, pas un acte de gouvernance. On prend donc son
 * identite le temps de l'ecriture, puis on rend la main.
 */
async function poser(c: Client, quand: string | null, revenirA: string = DEMO.officerA) {
  await becomeUser(c, DEMO.platformAdmin)
  const { rowCount } = await c.query(
    'update public.organization set evidence_gate_enforced_from = $2 where id = $1',
    [DEMO.orgA, quand],
  )
  await becomeUser(c, revenirA)
  // Une écriture silencieusement refusée rendrait tous ces tests verts à tort.
  if (!rowCount) throw new Error('L’échéance n’a pas pu être posée : écriture refusée.')
}

const alertes = async (c: Client) =>
  (
    await c.query<{ n: string }>(
      "select count(*) as n from public.notification where organization_id = $1 and kind = 'evidence_deadline'",
      [DEMO.orgA],
    )
  ).rows[0]!.n

describe('Échéance des preuves à la mise en production', () => {
  it('sans échéance, la vérification avertit et ne retient rien', async () => {
    const g = await asUser(db, DEMO.officerA, (c) => gate(c, DEMO.useCasePilot))
    const check = g.checks.find((c) => c.code === 'CONTROLS_EVIDENCED')!
    expect(check.severity).toBe('warning')
  })

  it('une échéance à venir laisse l’avertissement, et le dit', async () => {
    const g = await asUser(db, DEMO.officerA, async (c) => {
      await poser(c, '2099-01-01')
      return gate(c, DEMO.useCasePilot)
    })
    const check = g.checks.find((c) => c.code === 'CONTROLS_EVIDENCED')!
    expect(check.severity).toBe('warning')
  })

  it('une échéance passée rend la vérification bloquante', async () => {
    const g = await asUser(db, DEMO.officerA, async (c) => {
      await poser(c, '2020-01-01')
      return gate(c, DEMO.useCasePilot)
    })
    const check = g.checks.find((c) => c.code === 'CONTROLS_EVIDENCED')!
    expect(check.severity).toBe('blocking')
    // Et elle retient alors le jalon, puisque l'écart existe sur ce cas d'usage.
    expect(check.satisfied).toBe(false)
    expect(g.satisfied).toBe(false)
  })

  it('poser l’échéance avertit et relance ce qui porte un écart', async () => {
    const { avant, apres } = await asUser(db, DEMO.officerA, async (c) => {
      const avant = await alertes(c)
      await poser(c, '2099-06-30')
      return { avant, apres: await alertes(c) }
    })
    expect(Number(avant)).toBe(0)
    // L'officer, l'administrateur client, les cas d'usage en écart, et deux rappels.
    expect(Number(apres)).toBeGreaterThan(2)
  })

  it('la relance nomme le cas d’usage et ses contrôles', async () => {
    // Les alertes sont nominatives : la relance est adressée au PORTEUR du cas
    // d'usage, pas à l'officer. La lire exige de prendre son identité — sans
    // quoi la RLS la cache, et le test croirait qu'elle n'existe pas.
    const relance = await asUser(db, DEMO.officerA, async (c) => {
      await poser(c, '2099-06-30', DEMO.systemOwnerA)
      const { rows } = await c.query<{ title: string; body: string; href: string }>(
        `select title, body, href from public.notification
          where organization_id = $1 and kind = 'evidence_deadline' and entity_type = 'ai_use_case'
          limit 1`,
        [DEMO.orgA],
      )
      return rows[0]
    })
    expect(relance).toBeDefined()
    expect(relance!.title).toMatch(/ne passera plus en production/)
    expect(relance!.body).toMatch(/CTL-/)
    expect(relance!.href).toMatch(/preuve=sans/)
  })

  it('retirer l’échéance efface ce qu’elle annonçait', async () => {
    const apres = await asUser(db, DEMO.officerA, async (c) => {
      await poser(c, '2099-06-30')
      await poser(c, null)
      return alertes(c)
    })
    expect(Number(apres)).toBe(0)
  })

  it('les deux rappels sont posés d’avance, et ne se lisent qu’à leur date', async () => {
    const r = await asUser(db, DEMO.officerA, async (c) => {
      await poser(c, '2099-06-30')
      const { rows } = await c.query<{ n: string }>(
        `select count(*) as n from public.notification
          where organization_id = $1 and kind = 'evidence_deadline' and due_at > now()`,
        [DEMO.orgA],
      )
      return Number(rows[0]!.n)
    })
    // J-30 et J-7 sur une échéance lointaine : deux alertes encore muettes.
    expect(r).toBe(2)
  })
})

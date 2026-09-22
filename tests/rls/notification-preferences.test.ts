import { afterAll, beforeAll, describe, expect, it } from 'vitest'
import type { Client } from 'pg'
import { asUser, connect, DEMO, expectFailure } from '../helpers/db'

/** 0086 : comment chacun est prévenu, et ce qui part par courriel. */

let db: Client
beforeAll(async () => {
  db = await connect()
})
afterAll(async () => {
  await db.end()
})

describe('Préférences de notification', () => {
  it('sans ligne, la règle par défaut s’applique : courriel activé, synthèse quotidienne', async () => {
    const r = await asUser(db, DEMO.systemOwnerA, async (c) => {
      const { rows } = await c.query<{ p: { email_enabled: boolean; digest: string; immediate_enabled: boolean } }>(
        'select to_jsonb(public.my_notification_preference()) as p',
      )
      return rows[0]!.p
    })
    expect(r.email_enabled).toBe(true)
    expect(r.digest).toBe('daily')
    expect(r.immediate_enabled).toBe(true)
  })

  it('chacun règle la sienne, et personne ne règle celle d’un autre sans être administrateur', async () => {
    await asUser(db, DEMO.systemOwnerA, async (c) => {
      await c.query(
        `insert into public.notification_preference (user_id, email_enabled, digest)
         values ($1, false, 'weekly') on conflict (user_id) do update set email_enabled = false, digest = 'weekly'`,
        [DEMO.systemOwnerA],
      )
      const { rows } = await c.query<{ p: { email_enabled: boolean; digest: string } }>(
        'select to_jsonb(public.my_notification_preference()) as p',
      )
      expect(rows[0]!.p.email_enabled).toBe(false)
      expect(rows[0]!.p.digest).toBe('weekly')

      // Celle d'un autre : refusée (le Porteur n'administre pas).
      const refused = await expectFailure(
        c,
        `insert into public.notification_preference (user_id, email_enabled) values ($1, false)`,
        [DEMO.reviewerA],
      )
      expect(refused.message).toMatch(/row-level security|policy/i)
    })
  })

  it('le courriel désactivé écarte la personne de la synthèse et des envois immédiats', async () => {
    // La préférence se pose hors transaction : les lectures de la tâche
    // planifiée s'exercent hors session, comme la clé de service les appelle.
    const before = await db.query<{ n: number }>(
      `select count(*)::int as n from app.digest_recipients() where user_id = $1`, [DEMO.systemOwnerA],
    )
    await db.query(
      `insert into public.notification_preference (user_id, email_enabled, immediate_enabled, digest)
       values ($1, false, false, 'none')
       on conflict (user_id) do update set email_enabled = false, immediate_enabled = false, digest = 'none'`,
      [DEMO.systemOwnerA],
    )
    const after = await db.query<{ n: number }>(
      `select count(*)::int as n from app.digest_recipients() where user_id = $1`, [DEMO.systemOwnerA],
    )
    const urgent = await db.query<{ n: number }>(
      `select count(*)::int as n from app.notifications_to_email() where user_id = $1`, [DEMO.systemOwnerA],
    )
    await db.query('delete from public.notification_preference where user_id = $1', [DEMO.systemOwnerA])
    expect(before.rows[0]!.n).toBe(1)
    expect(after.rows[0]!.n).toBe(0)
    expect(urgent.rows[0]!.n).toBe(0)
  })

  it('les lectures d’envoi sont refusées à un rôle authentifié', async () => {
    await asUser(db, DEMO.officerA, async (c) => {
      const refused = await expectFailure(c, 'select * from public.digest_recipients()')
      expect(refused.message).toMatch(/permission denied|droit/i)
    })
  })

  it('la synthèse porte les actions, les incidents et les liens du suivi', async () => {
    const digest = await asUser(db, DEMO.officerA, async (c) => {
      const { rows } = await c.query<{ d: { organizations: { name: string; actions: { href: string }[]; follow_up_href: string }[] } }>(
        'select app.notification_digest($1) as d', [DEMO.systemOwnerA],
      )
      return rows[0]!.d
    })
    expect(digest.organizations.length).toBeGreaterThan(0)
    const org = digest.organizations[0]!
    expect(org.follow_up_href).toMatch(/\/suivi$/)
    if (org.actions.length) expect(org.actions[0]!.href).toMatch(/\?vue=actions&action=/)
  })

  it('une alerte envoyée ne repart pas', async () => {
    const { rows: created } = await db.query<{ id: string }>(
      `insert into public.notification (tenant_id, organization_id, recipient_user_id, kind, title, href)
       values ($1, $2, $3, 'incident_stop', 'Arrêt recommandé — test d’envoi', '/admin') returning id`,
      [DEMO.tenantA, DEMO.orgA, DEMO.officerA],
    )
    const id = created[0]!.id
    const listed = async () => {
      const { rows } = await db.query<{ n: number }>(
        'select count(*)::int as n from app.notifications_to_email() where notification_id = $1', [id],
      )
      return rows[0]!.n
    }
    const before = await listed()
    await db.query('select app.mark_notifications_emailed($1)', [[id]])
    const after = await listed()
    await db.query('delete from public.notification where id = $1', [id])
    expect(before).toBe(1)
    expect(after).toBe(0)
  })
})

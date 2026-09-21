import { afterAll, beforeAll, describe, expect, it } from 'vitest'
import type { Client } from 'pg'
import { asUser, becomeUser, connect, DEMO, expectFailure } from '../helpers/db'

/** 0067 : la cadence attendue par profil, et la revue de gouvernance qui depose sa preuve. */

let db: Client
beforeAll(async () => {
  db = await connect()
})
afterAll(async () => {
  await db.end()
})

describe('Cadence et revue de gouvernance', () => {
  it('une revue ne s’annule pas sans motif ; annulée, elle garde son motif, son auteur et sa trace', async () => {
    const r = await asUser(db, DEMO.officerA, async (c) => {
      const { rows } = await c.query<{ id: string }>(
        `insert into public.governance_review (tenant_id, organization_id, kind, scheduled_on, expected_attendees)
         values ($1, $2, 'committee', current_date + 7, array['Camille', 'Élodie']) returning id`,
        [DEMO.tenantA, DEMO.orgA],
      )
      const noReason = await expectFailure(c, `update public.governance_review set status = 'cancelled' where id = $1`, [rows[0]!.id])
      await c.query(`update public.governance_review set status = 'cancelled', cancellation_reason = 'Quorum non atteint.' where id = $1`, [rows[0]!.id])
      const { rows: after } = await c.query<{ cancelled_by: string; cancelled_at: string | null; expected_attendees: string[] }>(
        'select cancelled_by, cancelled_at, expected_attendees from public.governance_review where id = $1', [rows[0]!.id],
      )
      const { rows: audit } = await c.query<{ n: string }>(
        `select count(*)::text as n from public.audit_log where entity_type = 'governance_review' and entity_id = $1`, [rows[0]!.id],
      )
      return { noReason, after: after[0]!, audit: Number(audit[0]!.n) }
    })
    expect(r.noReason.message).toMatch(/pour une raison/)
    expect(r.after.cancelled_by).toBe(DEMO.officerA)
    expect(r.after.cancelled_at).not.toBeNull()
    expect(r.after.expected_attendees).toEqual(['Camille', 'Élodie'])
    expect(r.audit).toBeGreaterThanOrEqual(2)
  })

  it('la démo est en classe 1 : haut risque, comité trimestriel, direction annuelle', async () => {
    const r = await asUser(db, DEMO.officerA, async (c) => {
      const { rows } = await c.query<{ r: { class: number; committee: string; direction: string; incidents: string } }>(
        'select public.review_cadence($1) as r', [DEMO.orgA],
      )
      return rows[0]!.r
    })
    expect(r.class).toBe(1)
    expect(r.committee).toBe('quarterly')
    expect(r.direction).toBe('annual')
    expect(r.incidents).toBe('monthly')
  })

  it('planifiée, la revue porte son ordre du jour ; tenue, elle dépose sa preuve et propose la suivante', async () => {
    const r = await asUser(db, DEMO.officerA, async (c) => {
      const { rows } = await c.query<{ id: string; agenda: { decisions: unknown[]; high_open_risks: unknown[] }; period_from: string }>(
        `insert into public.governance_review (tenant_id, organization_id, kind, scheduled_on, chaired_by)
         values ($1, $2, 'committee', current_date, $3) returning id, agenda, period_from`,
        [DEMO.tenantA, DEMO.orgA, DEMO.officerA],
      )
      const noMinutes = await expectFailure(c, `update public.governance_review set status = 'held' where id = $1`, [rows[0]!.id])
      await c.query(
        `update public.governance_review set status = 'held', attendees = array['Camille Rousset', 'Sacha Belarbi'],
                minutes = 'Revue des décisions du trimestre, des CAPA en cours et des risques élevés. Le scoring reste en revue.'
          where id = $1`,
        [rows[0]!.id],
      )
      const { rows: held } = await c.query<{ next_review_on: string | null; evidence_id: string | null; status: string }>(
        'select next_review_on, evidence_id, status from public.governance_review where id = $1', [rows[0]!.id],
      )
      const { rows: ev } = await c.query<{ title: string; validation_status: string }>(
        'select title, validation_status from public.evidence where id = $1', [held[0]!.evidence_id],
      )
      // Le Comite de direction a ete averti de la planification.
      await becomeUser(c, DEMO.boardA)
      const { rows: alerts } = await c.query<{ title: string }>(
        `select title from public.my_notifications(50) where entity_id = $1`, [rows[0]!.id],
      )
      return { agenda: rows[0]!.agenda, noMinutes, held: held[0]!, evidence: ev[0], alerts: alerts.length }
    })
    expect(Array.isArray(r.agenda.decisions)).toBe(true)
    expect(r.agenda.high_open_risks.length).toBeGreaterThan(0)
    expect(r.noMinutes.message).toMatch(/check|minutes|held_at/i)
    expect(r.held.status).toBe('held')
    expect(r.held.next_review_on).not.toBeNull()
    expect(r.evidence?.title).toMatch(/^Compte rendu — comité/)
    expect(r.evidence?.validation_status).toBe('pending')
    expect(r.alerts).toBeGreaterThan(0)
  })
})

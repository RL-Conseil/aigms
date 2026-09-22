import { afterAll, beforeAll, describe, expect, it } from 'vitest'
import type { Client } from 'pg'
import { asUser, becomeUser, connect, DEMO } from '../helpers/db'

/** 0084 : ce qui expire prévient avant d'expirer, sans tâche planifiée. */

let db: Client
beforeAll(async () => {
  db = await connect()
})
afterAll(async () => {
  await db.end()
})

describe('Rappels d’échéance', () => {
  it('une preuve déposée attend sa validation, et le valideur l’apprend', async () => {
    const r = await asUser(db, DEMO.officerA, async (c) => {
      const { rows } = await c.query<{ id: string }>(
        `insert into public.evidence (tenant_id, organization_id, title, evidence_type, source, owner_user_id, validation_status)
         values ($1, $2, 'Procédure à valider', 'declarative', 'Test', $3, 'pending') returning id`,
        [DEMO.tenantA, DEMO.orgA, DEMO.systemOwnerA],
      )
      const pending = await c.query<{ n: number }>(
        `select count(*)::int as n from public.notification
          where kind = 'evidence_to_validate' and entity_id = $1 and recipient_user_id = $2`,
        [rows[0]!.id, DEMO.officerA],
      )
      // Validée : le rappel de validation tombe, ceux d'échéance se posent.
      await c.query(
        `update public.evidence set validation_status = 'validated', validated_by = $2, validated_at = now(), valid_until = current_date + 120 where id = $1`,
        [rows[0]!.id, DEMO.officerA],
      )
      // Les alertes sont nominatives : celles du propriétaire se lisent chez lui.
      await becomeUser(c, DEMO.systemOwnerA)
      const after = await c.query<{ kind: string; due: string }>(
        `select kind::text, due_at::date::text as due from public.notification where entity_id = $1 order by due_at`,
        [rows[0]!.id],
      )
      await becomeUser(c, DEMO.officerA)
      return { pending: pending.rows[0]!.n, after: after.rows }
    })
    expect(r.pending).toBe(1)
    expect(r.after.map((x) => x.kind)).toEqual(expect.arrayContaining(['evidence_expiring', 'evidence_expired']))
    expect(r.after.some((x) => x.kind === 'evidence_to_validate')).toBe(false)
    // Le rappel « bientôt échue » se pose trente jours avant l'échéance.
    const expiring = r.after.find((x) => x.kind === 'evidence_expiring')!
    const expired = r.after.find((x) => x.kind === 'evidence_expired')!
    expect(new Date(expired.due).getTime() - new Date(expiring.due).getTime()).toBe(30 * 24 * 3600 * 1000)
  })

  it('la revue d’un cas d’usage, d’un fournisseur et d’une étude d’impact se rappellent à leur date', async () => {
    const r = await asUser(db, DEMO.officerA, async (c) => {
      await c.query(`update public.ai_use_case set next_review_at = current_date + 10 where id = $1`, [DEMO.useCaseProduction])
      await c.query(`update public.vendor set next_review_at = current_date + 20 where organization_id = $1`, [DEMO.orgA])
      await c.query(`update public.impact_assessment set next_review_at = current_date + 30 where use_case_id = $1`, [DEMO.useCaseProduction])
      // Chaque rappel va à qui en répond : le Porteur pour son cas d'usage,
      // l'officer pour le tiers et l'étude.
      await becomeUser(c, DEMO.systemOwnerA)
      const { rows: owner } = await c.query<{ kind: string }>(
        `select distinct kind::text from public.notification where due_at > now()`,
      )
      await becomeUser(c, DEMO.officerA)
      const { rows: officer } = await c.query<{ kind: string }>(
        `select distinct kind::text from public.notification where due_at > now()`,
      )
      return [...owner, ...officer]
    })
    const kinds = r.map((x) => x.kind)
    expect(kinds).toEqual(expect.arrayContaining(['use_case_review_due', 'vendor_review_due', 'impact_review_due']))
  })

  it('un rappel daté ne se lit pas avant son jour, et se retire quand l’échéance disparaît', async () => {
    const r = await asUser(db, DEMO.officerA, async (c) => {
      await c.query(`update public.ai_use_case set next_review_at = current_date + 45 where id = $1`, [DEMO.useCaseProduction])
      await becomeUser(c, DEMO.systemOwnerA)
      const { rows: hidden } = await c.query<{ n: number }>(
        `select count(*)::int as n from public.my_notifications(200) where kind = 'use_case_review_due'`,
      )
      await becomeUser(c, DEMO.officerA)
      await c.query(`update public.ai_use_case set next_review_at = null where id = $1`, [DEMO.useCaseProduction])
      const { rows: gone } = await c.query<{ n: number }>(
        `select count(*)::int as n from public.notification where kind = 'use_case_review_due' and entity_id = $1 and read_at is null`,
        [DEMO.useCaseProduction],
      )
      return { hidden: hidden[0]!.n, gone: gone[0]!.n }
    })
    expect(r.hidden).toBe(0)
    expect(r.gone).toBe(0)
  })
})

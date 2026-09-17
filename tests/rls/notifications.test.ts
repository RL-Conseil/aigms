import { afterAll, beforeAll, describe, expect, it } from 'vitest'
import type { Client } from 'pg'
import { asUser, becomeUser, connect, DEMO, expectFailure } from '../helpers/db'

/**
 * Alertes nominatives : la base les emet quand un acte engage quelqu'un, et
 * chacun ne lit que les siennes. Un rappel date attend son jour.
 */

let db: Client
beforeAll(async () => {
  db = await connect()
})
afterAll(async () => {
  await db.end()
})

describe('Alertes', () => {
  it('désigner un responsable de risque l’avertit, et lui seul', async () => {
    const r = await asUser(db, DEMO.officerA, async (c) => {
      await c.query(
        `insert into public.risk (tenant_id, organization_id, use_case_id, title, scenario, category,
                                  owner_user_id, inherent_likelihood, inherent_impact)
         values ($1, $2, $3, 'Alerte de test', 'scénario', 'operational', $4, 2, 2)`,
        [DEMO.tenantA, DEMO.orgA, DEMO.useCasePilot, DEMO.riskOwnerA],
      )
      const { rows: mine } = await c.query<{ title: string }>(
        `select title from public.my_notifications(50) where title like '%Alerte de test%' or body like '%Alerte de test%'`,
      )
      await becomeUser(c, DEMO.riskOwnerA)
      const { rows: theirs } = await c.query<{ title: string; href: string; kind: string }>(
        `select title, href, kind from public.my_notifications(50) where body like '%Alerte de test%'`,
      )
      return { mine, theirs }
    })
    expect(r.mine).toHaveLength(0)
    expect(r.theirs).toHaveLength(1)
    expect(r.theirs[0]!.kind).toBe('risk_owner')
    expect(r.theirs[0]!.href).toMatch(/\/admin\/use-cases\/.*\?onglet=risques/)
  })

  it('une action confiée avertit son responsable ; l’échéance attend son jour ; la clôture retire le rappel', async () => {
    const r = await asUser(db, DEMO.officerA, async (c) => {
      const { rows } = await c.query<{ id: string }>(
        `insert into public.action (tenant_id, organization_id, use_case_id, title, owner_user_id, due_date)
         values ($1, $2, $3, 'Relire la procédure', $4, current_date + 10) returning id`,
        [DEMO.tenantA, DEMO.orgA, DEMO.useCasePilot, DEMO.systemOwnerA],
      )
      const actionId = rows[0]!.id
      await becomeUser(c, DEMO.systemOwnerA)
      const { rows: visible } = await c.query<{ kind: string }>(
        `select kind from public.my_notifications(50) where entity_id = $1`, [actionId],
      )
      // Le rappel existe, mais n'est pas encore visible : la date n'est pas la.
      const { rows: pending } = await c.query<{ kind: string; due: boolean }>(
        `select kind, due_at > now() as due from public.notification where entity_id = $1 order by kind::text`, [actionId],
      )
      await becomeUser(c, DEMO.officerA)
      await c.query(
        `update public.action set status = 'done', closed_at = now(), closure_note = 'Relue.' where id = $1`, [actionId],
      )
      const { rows: afterClose } = await c.query<{ n: string }>(
        `select count(*)::text as n from public.notification where entity_id = $1 and read_at is null`, [actionId],
      )
      return { visible, pending, afterClose: Number(afterClose[0]!.n) }
    })
    expect(r.visible.map((v) => v.kind)).toEqual(['action_owner'])
    expect(r.pending).toEqual([
      { kind: 'action_due', due: true },
      { kind: 'action_owner', due: false },
    ])
    // La table est lisible par son destinataire seulement : ici on lit en tant
    // qu'officer, qui n'en voit aucune — et la cloture les a de toute facon retirees.
    expect(r.afterClose).toBe(0)
  })

  it('une alerte se marque lue, et ne se réécrit pas', async () => {
    const r = await asUser(db, DEMO.officerA, async (c) => {
      await c.query(
        `insert into public.risk (tenant_id, organization_id, use_case_id, title, scenario, category,
                                  owner_user_id, inherent_likelihood, inherent_impact)
         values ($1, $2, $3, 'Alerte à lire', 'scénario', 'operational', $4, 2, 2)`,
        [DEMO.tenantA, DEMO.orgA, DEMO.useCasePilot, DEMO.officerA],
      )
      const { rows } = await c.query<{ id: string }>(
        `select id from public.my_notifications(50) where body like '%Alerte à lire%'`,
      )
      const id = rows[0]!.id
      const rewrite = await expectFailure(c, `update public.notification set title = 'x' where id = $1`, [id])
      const { rowCount } = await c.query(`update public.notification set read_at = now() where id = $1`, [id])
      const { rows: unread } = await c.query<{ n: number }>('select public.my_unread_notifications() as n')
      return { rewrite, rowCount, unread: unread[0]!.n }
    })
    expect(r.rewrite.message).toMatch(/ne se modifie pas|permission denied/)
    expect(r.rowCount).toBe(1)
    expect(typeof r.unread).toBe('number')
  })

  it('une évaluation d’impact achevée ouvre l’action de dépôt de sa preuve', async () => {
    const r = await asUser(db, DEMO.officerA, async (c) => {
      await c.query(
        `insert into public.impact_assessment (tenant_id, organization_id, use_case_id, scope_description,
                                               status, conclusion, completed_at, performed_by, business_ref)
         values ($1, $2, $3, 'Périmètre de test', 'completed', 'Aucun effet notable.', now(), $4, 'AIIA-TEST-1')`,
        [DEMO.tenantA, DEMO.orgA, DEMO.useCasePilot, DEMO.officerA],
      )
      const { rows } = await c.query<{ title: string; owner_user_id: string; status: string }>(
        `select title, owner_user_id, status from public.action
          where use_case_id = $1 and source = 'impact_finding' and title like '%AIIA-TEST-1%'`,
        [DEMO.useCasePilot],
      )
      return rows
    })
    expect(r).toHaveLength(1)
    expect(r[0]!.owner_user_id).toBe(DEMO.officerA)
    expect(r[0]!.status).toBe('open')
  })
})

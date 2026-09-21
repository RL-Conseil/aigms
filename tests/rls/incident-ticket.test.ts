import { afterAll, beforeAll, describe, expect, it } from 'vitest'
import type { Client } from 'pg'
import { asUser, becomeUser, connect, DEMO, expectFailure } from '../helpers/db'

/** 0069 : le ticket d'incident du kit — qualification 24 h, arret d'urgence trace, double signature. */

let db: Client
beforeAll(async () => {
  db = await connect()
})
afterAll(async () => {
  await db.end()
})

describe('Ticket d’incident', () => {
  it('l’officer en charge est posé, rappelé à 24 h ; la qualification est nominative', async () => {
    const r = await asUser(db, DEMO.systemOwnerA, async (c) => {
      const { rows } = await c.query<{ id: string; officer_user_id: string }>(
        `insert into public.incident (tenant_id, organization_id, use_case_id, title, description, kind, severity, detected_at, trigger_source, fundamental_rights_impacted)
         values ($1, $2, $3, 'Dérive du scoring', 'Le taux de sélection des candidates chute de 30 %.', 'incident', 'S2', now() - interval '2 hours', 'monitoring_alert', true)
         returning id, officer_user_id`,
        [DEMO.tenantA, DEMO.orgA, DEMO.useCasePilot],
      )
      await becomeUser(c, DEMO.officerA)
      const { rows: reminders } = await c.query<{ kind: string; due: boolean }>(
        `select kind, due_at > now() as due from public.notification where entity_id = $1 and kind in ('incident_new', 'incident_qualify') order by due_at`, [rows[0]!.id],
      )
      await c.query(`update public.incident set qualified_at = now(), severity = 'S1' where id = $1`, [rows[0]!.id])
      const { rows: q } = await c.query<{ qualified_by: string; n: string }>(
        `select i.qualified_by, (select count(*)::text from public.notification where entity_id = i.id and kind in ('incident_new', 'incident_qualify') and read_at is null) as n
           from public.incident i where i.id = $1`, [rows[0]!.id],
      )
      return { officer: rows[0]!.officer_user_id, reminders, qualifiedBy: q[0]!.qualified_by, pending: Number(q[0]!.n) }
    })
    expect(r.officer).toBe(DEMO.officerA)
    expect(r.reminders.map((x) => x.due)).toEqual([false, true])
    expect(r.qualifiedBy).toBe(DEMO.officerA)
    expect(r.pending).toBe(0)
  })

  it('l’arrêt s’enchaîne — recommandé, validé, exécuté — et l’arrêt validé ouvre une suspension', async () => {
    const r = await asUser(db, DEMO.officerA, async (c) => {
      const { rows } = await c.query<{ id: string }>(
        `insert into public.incident (tenant_id, organization_id, use_case_id, title, description, kind, severity, detected_at, owner_user_id)
         values ($1, $2, $3, 'Réponses erronées en masse', 'Hallucinations sur les tarifs.', 'incident', 'S1', now(), $4) returning id`,
        [DEMO.tenantA, DEMO.orgA, DEMO.useCaseProduction, DEMO.systemOwnerA],
      )
      const id = rows[0]!.id
      const tooEarly = await expectFailure(c, `update public.incident set stop_validated_at = now() where id = $1`, [id])
      await c.query(`update public.incident set stop_recommended_at = now(), stop_note = 'Seuil d’erreur dépassé.' where id = $1`, [id])
      await becomeUser(c, DEMO.systemOwnerA)
      await c.query(`update public.incident set stop_validated_at = now() where id = $1`, [id])
      const { rows: d } = await c.query<{ status: string; decision_type: string; submitted_by: string }>(
        `select status, decision_type, submitted_by from public.governance_decision where use_case_id = $1 and decision_type = 'suspension' order by created_at desc limit 1`,
        [DEMO.useCaseProduction],
      )
      await c.query(`update public.incident set stop_executed_at = now() where id = $1`, [id])
      const { rows: i } = await c.query<{ stop_recommended_by: string; stop_validated_by: string; stop_executed_by: string }>(
        'select stop_recommended_by, stop_validated_by, stop_executed_by from public.incident where id = $1', [id],
      )
      return { tooEarly, decision: d[0], incident: i[0]! }
    })
    expect(r.tooEarly.message).toMatch(/après avoir été recommandé/)
    expect(r.decision).toMatchObject({ status: 'submitted', decision_type: 'suspension', submitted_by: DEMO.systemOwnerA })
    expect(r.incident).toEqual({ stop_recommended_by: DEMO.officerA, stop_validated_by: DEMO.systemOwnerA, stop_executed_by: DEMO.systemOwnerA })
  })

  it('la clôture exige deux signatures, de deux personnes', async () => {
    const r = await asUser(db, DEMO.officerA, async (c) => {
      const { rows } = await c.query<{ id: string }>(
        `insert into public.incident (tenant_id, organization_id, use_case_id, title, description, kind, severity, detected_at, owner_user_id)
         values ($1, $2, $3, 'Observation mineure', 'Une réponse hors périmètre, sans effet.', 'observation', 'S4', now(), $4) returning id`,
        [DEMO.tenantA, DEMO.orgA, DEMO.useCasePilot, DEMO.systemOwnerA],
      )
      const id = rows[0]!.id
      const unsigned = await expectFailure(
        c, `update public.incident set status = 'CLOSED', closed_at = now(), contained_at = now(), root_cause = 'Cause documentée et suffisamment longue.' where id = $1`, [id],
      )
      await c.query(`update public.incident set closure_officer_at = now() where id = $1`, [id])
      const same = await expectFailure(c, `update public.incident set closure_owner_at = now() where id = $1`, [id])
      await becomeUser(c, DEMO.systemOwnerA)
      await c.query(`update public.incident set closure_owner_at = now() where id = $1`, [id])
      const { rowCount } = await c.query(
        `update public.incident set status = 'CLOSED', closed_at = now(), contained_at = now(), root_cause = 'Cause documentée et suffisamment longue.' where id = $1`, [id],
      )
      const { rows: t } = await c.query<{ t: { closure: { officer_validated_by: string; owner_approved_by: string } } }>('select public.incident_ticket($1) as t', [id])
      return { unsigned, same, rowCount, closure: t[0]!.t.closure }
    })
    expect(r.unsigned.message).toMatch(/attend la validation/)
    expect(r.same.message).toMatch(/deux personnes/)
    expect(r.rowCount).toBe(1)
    expect(r.closure.officer_validated_by).toBeTruthy()
    expect(r.closure.owner_approved_by).toBeTruthy()
  })
})

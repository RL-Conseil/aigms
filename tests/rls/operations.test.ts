import { afterAll, beforeAll, describe, expect, it } from 'vitest'
import type { Client } from 'pg'
import { asUser, connect, DEMO, expectFailure } from '../helpers/db'

/**
 * Suivi operationnel : actions, incidents, CAPA, demandes de changement.
 *
 * Les regles vivent en base depuis les migrations 0010, 0012 et 0013 ; ces
 * tests les rejouent par le chemin que l'application emprunte, pour que les
 * ecrans qui viennent d'etre construits ne contournent rien.
 */

let db: Client

beforeAll(async () => {
  db = await connect()
})

afterAll(async () => {
  await db.end()
})

async function declareIncident(c: Client, severity: string): Promise<string> {
  const { rows } = await c.query<{ id: string }>(
    `insert into public.incident
       (tenant_id, organization_id, use_case_id, title, description, severity, reported_by)
     values ($1, $2, $3, 'Test', 'Description factuelle de ce qui s''est passé.', $4, $5)
     returning id`,
    [DEMO.tenantA, DEMO.orgA, DEMO.useCasePilot, severity, DEMO.officerA],
  )
  return rows[0]!.id
}

describe('Actions', () => {
  it('le porteur du système ouvre une action ; l’auditeur ne le peut pas', async () => {
    const opened = await asUser(db, DEMO.systemOwnerA, async (c) => {
      const { rowCount } = await c.query(
        `insert into public.action (tenant_id, organization_id, use_case_id, title)
         values ($1, $2, $3, 'Mettre à jour la procédure')`,
        [DEMO.tenantA, DEMO.orgA, DEMO.useCasePilot],
      )
      return rowCount
    })
    expect(opened).toBe(1)

    const refused = await asUser(db, DEMO.auditorA, (c) =>
      expectFailure(
        c,
        `insert into public.action (tenant_id, organization_id, use_case_id, title)
         values ($1, $2, $3, 'Tentative')`,
        [DEMO.tenantA, DEMO.orgA, DEMO.useCasePilot],
      ),
    )
    expect(refused.message).toMatch(/row-level security/)
  })

  it('une action close porte sa date de clôture', async () => {
    const failure = await asUser(db, DEMO.officerA, async (c) => {
      const { rows } = await c.query<{ id: string }>(
        `insert into public.action (tenant_id, organization_id, use_case_id, title)
         values ($1, $2, $3, 'À clore') returning id`,
        [DEMO.tenantA, DEMO.orgA, DEMO.useCasePilot],
      )
      return expectFailure(c, "update public.action set status = 'done' where id = $1", [rows[0]!.id])
    })
    expect(failure.message).toMatch(/check constraint|viole/i)
  })
})

describe('Incidents et CAPA', () => {
  it('un incident S2 ne se clôt pas sans CAPA close, même avec une cause racine', async () => {
    const failure = await asUser(db, DEMO.officerA, async (c) => {
      const id = await declareIncident(c, 'S2')
      return expectFailure(
        c,
        `update public.incident
            set status = 'CLOSED', closed_at = now(), contained_at = now(),
                root_cause = 'Une cause racine documentée et suffisamment longue.'
          where id = $1`,
        [id],
      )
    })
    expect(failure.message).toMatch(/CAPA close est requise/)
  })

  it('une CAPA ne se clôt pas sans test d’efficacité vérifié nominativement', async () => {
    const failure = await asUser(db, DEMO.officerA, async (c) => {
      const incidentId = await declareIncident(c, 'S2')
      const { rows } = await c.query<{ id: string }>(
        `insert into public.capa (tenant_id, incident_id, correction, cause_analysis, corrective_action)
         values ($1, $2, 'Correction immédiate', 'Analyse de cause suffisamment détaillée.', 'Action corrective')
         returning id`,
        [DEMO.tenantA, incidentId],
      )
      return expectFailure(c, "update public.capa set status = 'closed', closed_at = now() where id = $1", [
        rows[0]!.id,
      ])
    })
    expect(failure.message).toMatch(/capa_closure_requires_effectiveness/)
  })

  it('CAPA close avec efficacité vérifiée, puis incident clos : le chemin complet passe', async () => {
    const status = await asUser(db, DEMO.officerA, async (c) => {
      const incidentId = await declareIncident(c, 'S2')
      const { rows } = await c.query<{ id: string }>(
        `insert into public.capa (tenant_id, incident_id, correction, cause_analysis, corrective_action)
         values ($1, $2, 'Correction immédiate', 'Analyse de cause suffisamment détaillée.', 'Action corrective')
         returning id`,
        [DEMO.tenantA, incidentId],
      )
      await c.query(
        `update public.capa
            set status = 'closed', closed_at = now(),
                effectiveness_test = 'Rejeu du scénario sur dix cas',
                effectiveness_result = 'Aucune récidive',
                effectiveness_tested_at = now(),
                effectiveness_verified_by = $2
          where id = $1`,
        [rows[0]!.id, DEMO.officerA],
      )
      const { rows: closed } = await c.query<{ status: string }>(
        `update public.incident
            set status = 'CLOSED', closed_at = now(), contained_at = now(),
                root_cause = 'Une cause racine documentée et suffisamment longue.'
          where id = $1 returning status`,
        [incidentId],
      )
      return closed[0]?.status
    })
    expect(status).toBe('CLOSED')
  })

  it('un incident S4 isolé se clôt sur sa seule cause racine', async () => {
    const status = await asUser(db, DEMO.officerA, async (c) => {
      const id = await declareIncident(c, 'S4')
      const { rows } = await c.query<{ status: string }>(
        `update public.incident
            set status = 'CLOSED', closed_at = now(), contained_at = now(),
                root_cause = 'Une cause racine documentée et suffisamment longue.'
          where id = $1 returning status`,
        [id],
      )
      return rows[0]?.status
    })
    expect(status).toBe('CLOSED')
  })

  it('la CAPA relève de la gouvernance : le porteur du système ne l’ouvre pas', async () => {
    const refused = await asUser(db, DEMO.systemOwnerA, async (c) => {
      const incidentId = await declareIncident(c, 'S3')
      return expectFailure(
        c,
        `insert into public.capa (tenant_id, incident_id, correction, cause_analysis, corrective_action)
         values ($1, $2, 'c', 'analyse', 'action')`,
        [DEMO.tenantA, incidentId],
      )
    })
    expect(refused.message).toMatch(/row-level security/)
  })
})

describe('Demandes de changement', () => {
  it('une demande se qualifie par le moteur, qui nomme ce qu’il faut réévaluer', async () => {
    const result = await asUser(db, DEMO.officerA, async (c) => {
      const { rows } = await c.query<{ id: string }>(
        `insert into public.change_request
           (tenant_id, organization_id, use_case_id, title, description, change_types,
            increases_autonomy, new_autonomy_level, requested_by)
         values ($1, $2, $3, 'Passage en autonomie L3', 'Le système décide seul sur les cas simples.',
                 array['AUTONOMY']::app.change_type[], true, 'L3', $4)
         returning id`,
        [DEMO.tenantA, DEMO.orgA, DEMO.useCasePilot, DEMO.officerA],
      )
      const { rows: screened } = await c.query<{ r: { verdict: string; scope: string[] } }>(
        'select app.screen_change_request($1) as r',
        [rows[0]!.id],
      )
      const { rows: status } = await c.query<{ status: string }>(
        'select status from public.change_request where id = $1',
        [rows[0]!.id],
      )
      return { ...screened[0]!.r, status: status[0]?.status }
    })
    expect(result.verdict).toBe('FULL_REASSESSMENT')
    expect(result.scope).toContain('oversight')
    expect(result.status).toBe('IMPACT_SCREENING')
  })

  it('le porteur du système soumet, mais ne qualifie pas', async () => {
    const failure = await asUser(db, DEMO.systemOwnerA, async (c) => {
      const { rows } = await c.query<{ id: string }>(
        `insert into public.change_request
           (tenant_id, organization_id, use_case_id, title, description, change_types, requested_by)
         values ($1, $2, $3, 'Changement de modèle', 'Nouvelle version du modèle fournisseur.',
                 array['MODEL']::app.change_type[], $4)
         returning id`,
        [DEMO.tenantA, DEMO.orgA, DEMO.useCasePilot, DEMO.systemOwnerA],
      )
      return expectFailure(c, 'select app.screen_change_request($1)', [rows[0]!.id])
    })
    expect(failure.message).toMatch(/Habilitation insuffisante/)
  })
})

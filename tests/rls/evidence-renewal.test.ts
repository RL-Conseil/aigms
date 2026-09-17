import { afterAll, beforeAll, describe, expect, it } from 'vitest'
import type { Client } from 'pg'
import { asUser, connect, DEMO, expectFailure } from '../helpers/db'

/**
 * Renouveler une preuve : le depot ne remplace rien ; la validation de la
 * nouvelle marque l'ancienne remplacee et clot l'action de renouvellement.
 */

let db: Client
beforeAll(async () => {
  db = await connect()
})
afterAll(async () => {
  await db.end()
})

const STALE = 'a4000000-0000-4000-8000-000000000005' // attestation de formation, echue

describe('Renouvellement d’une preuve', () => {
  it('le dépôt en remplacement ne touche pas l’ancienne ; la validation la remplace et clôt l’action', async () => {
    const r = await asUser(db, DEMO.officerA, async (c) => {
      // Une action de renouvellement ouverte sur la piece echue.
      await c.query(
        `insert into public.action (tenant_id, organization_id, use_case_id, title, source, source_id)
         values ($1, $2, $3, 'Renouveler la preuve EVD-2026-0005', 'control', $4)`,
        [DEMO.tenantA, DEMO.orgA, DEMO.useCaseProduction, STALE],
      )
      // Depot de la nouvelle piece, en remplacement.
      const { rows } = await c.query<{ id: string }>(
        `insert into public.evidence
           (tenant_id, organization_id, title, evidence_type, source, collected_at, valid_until,
            owner_user_id, validation_status, replaces_evidence_id, external_url)
         values ($1, $2, 'Attestation de formation 2026', 'attestation', 'RH', now(), current_date + 365,
                 $3, 'pending', $4, 'https://rh.example/attestation-2026')
         returning id`,
        [DEMO.tenantA, DEMO.orgA, DEMO.officerA, STALE],
      )
      const newId = rows[0]!.id
      const { rows: before } = await c.query<{ superseded_by: string | null; validation_status: string }>(
        'select superseded_by, validation_status from public.evidence where id = $1', [STALE],
      )
      const { rows: actionBefore } = await c.query<{ status: string }>(
        'select status from public.action where source_id = $1', [STALE],
      )
      // Validation nominative de la nouvelle piece.
      await c.query(
        `update public.evidence set validation_status = 'validated', validated_by = $2, validated_at = now() where id = $1`,
        [newId, DEMO.officerA],
      )
      const { rows: after } = await c.query<{ superseded_by: string | null; validation_status: string }>(
        'select superseded_by, validation_status from public.evidence where id = $1', [STALE],
      )
      const { rows: actionAfter } = await c.query<{ status: string; closure_note: string | null }>(
        'select status, closure_note from public.action where source_id = $1', [STALE],
      )
      return { newId, before: before[0]!, actionBefore: actionBefore[0]!, after: after[0]!, actionAfter: actionAfter[0]! }
    })

    expect(r.before.superseded_by).toBeNull()
    expect(r.actionBefore.status).toBe('open')
    expect(r.after.superseded_by).toBe(r.newId)
    expect(r.after.validation_status).toBe('superseded')
    expect(r.actionAfter.status).toBe('done')
    expect(r.actionAfter.closure_note).toMatch(/Clôturée automatiquement/)
  })

  it('une preuve ne remplace pas une preuve d’une autre organisation', async () => {
    const failure = await asUser(db, DEMO.officerA, (c) =>
      expectFailure(
        c,
        `insert into public.evidence
           (tenant_id, organization_id, title, evidence_type, source, collected_at, owner_user_id, validation_status, replaces_evidence_id)
         values ($1, $2, 'Hors périmètre', 'declarative', 'x', now(), $3, 'pending', $4)`,
        [DEMO.tenantA, DEMO.orgA, DEMO.officerA, '00000000-0000-4000-8000-000000000000'],
      ),
    )
    expect(failure.message).toMatch(/même organisation|foreign key/i)
  })
})

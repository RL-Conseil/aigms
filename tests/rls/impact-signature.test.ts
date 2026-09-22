import { afterAll, beforeAll, describe, expect, it } from 'vitest'
import type { Client } from 'pg'
import { asUser, becomeUser, connect, DEMO, expectFailure } from '../helpers/db'

/** 0091 : une étude d'impact se signe à deux — la méthode, puis ce qui reste. */

let db: Client
beforeAll(async () => {
  db = await connect()
})
afterAll(async () => {
  await db.end()
})

async function freshStudy(c: Client): Promise<string> {
  const { rows } = await c.query<{ id: string }>(
    `insert into public.impact_assessment (tenant_id, organization_id, use_case_id, scope_description, status, performed_by)
     values ($1, $2, $3, 'Périmètre de test des signatures.', 'in_progress', $4) returning id`,
    [DEMO.tenantA, DEMO.orgA, DEMO.useCaseProduction, DEMO.officerA],
  )
  return rows[0]!.id
}

describe('Double signature de l’étude d’impact', () => {
  it('l’officer vise, le Porteur accepte : l’étude n’est achevée qu’à deux', async () => {
    const r = await asUser(db, DEMO.officerA, async (c) => {
      const id = await freshStudy(c)
      // Achever d'un trait est refusé : il manque les signatures.
      const refused = await expectFailure(
        c,
        `update public.impact_assessment set status = 'completed', completed_at = now(), conclusion = 'Effets acceptables.' where id = $1`,
        [id],
      )
      await c.query(
        `update public.impact_assessment set status = 'awaiting_signature', conclusion = 'Effets acceptables.', method_signed_at = now() where id = $1`,
        [id],
      )
      const { rows: visa } = await c.query<{ by: string; status: string }>(
        'select method_signed_by as by, status::text from public.impact_assessment where id = $1', [id],
      )
      // L'officer ne peut pas accepter à la place du Porteur.
      const refusedAccept = await expectFailure(
        c,
        `select public.accept_residual_risks($1, 'J''assume ce qui reste.')`,
        [id],
      )
      // Le Porteur accepte, en son nom.
      await becomeUser(c, DEMO.systemOwnerA)
      await c.query(
        `select public.accept_residual_risks($1, 'J''assume l''écart résiduel, sous audit trimestriel.')`,
        [id],
      )
      const { rows: done } = await c.query<{ by: string; status: string }>(
        'select residual_accepted_by as by, status::text from public.impact_assessment where id = $1', [id],
      )
      await becomeUser(c, DEMO.officerA)
      return { refused: refused.message, visa: visa[0]!, refusedAccept: refusedAccept.message, done: done[0]!, id }
    })
    expect(r.refused).toMatch(/deux signatures/)
    expect(r.visa.by).toBe(DEMO.officerA)
    expect(r.visa.status).toBe('awaiting_signature')
    expect(r.refusedAccept).toMatch(/revient au Porteur/)
    expect(r.done.by).toBe(DEMO.systemOwnerA)
    expect(r.done.status).toBe('completed')
  })

  it('le visa appelle le Porteur, et pose les relances à sept puis quatorze jours', async () => {
    const r = await asUser(db, DEMO.officerA, async (c) => {
      const id = await freshStudy(c)
      await c.query(
        `update public.impact_assessment set status = 'awaiting_signature', conclusion = 'Effets acceptables.', method_signed_at = now() where id = $1`,
        [id],
      )
      // Les alertes sont nominatives : celles du Porteur se lisent chez lui.
      const read = async () => {
        const { rows } = await c.query<{ kind: string; recipient: string; days: number }>(
          `select kind::text, recipient_user_id as recipient,
                  round(extract(epoch from (due_at - now())) / 86400)::int as days
             from public.notification where entity_id = $1 order by due_at`,
          [id],
        )
        return rows
      }
      const officer = await read()
      await becomeUser(c, DEMO.systemOwnerA)
      const owner = await read()
      await becomeUser(c, DEMO.officerA)
      return { rows: [...owner, ...officer], id }
    })
    const kinds = r.rows.map((x) => `${x.kind}@${x.days}`)
    expect(kinds).toContain('impact_signature@0')
    expect(kinds).toContain('impact_signature_late@7')
    expect(kinds).toContain('impact_signature_late@14')
    // Le rappel de la deuxième semaine va à l'officer, pas au Porteur.
    expect(r.rows.find((x) => x.days === 7)!.recipient).toBe(DEMO.systemOwnerA)
    expect(r.rows.find((x) => x.days === 14)!.recipient).toBe(DEMO.officerA)
  })

  it('le renvoi motivé fait tomber le visa, avertit l’officer et lève les relances', async () => {
    const r = await asUser(db, DEMO.officerA, async (c) => {
      const id = await freshStudy(c)
      await c.query(
        `update public.impact_assessment set status = 'awaiting_signature', conclusion = 'Effets acceptables.', method_signed_at = now() where id = $1`,
        [id],
      )
      await becomeUser(c, DEMO.systemOwnerA)
      await c.query(`select public.return_impact_study($1, 'La consultation des candidats manque.')`, [id])
      await becomeUser(c, DEMO.officerA)
      const { rows: study } = await c.query<{ status: string; signed: string | null; reason: string }>(
        'select status::text, method_signed_at::text as signed, returned_reason as reason from public.impact_assessment where id = $1', [id],
      )
      const { rows: alerts } = await c.query<{ kind: string; n: number }>(
        `select kind::text, count(*)::int as n from public.notification where entity_id = $1 and read_at is null group by 1`,
        [id],
      )
      return { study: study[0]!, alerts }
    })
    expect(r.study.status).toBe('in_progress')
    expect(r.study.signed).toBeNull()
    expect(r.study.reason).toMatch(/consultation/)
    const kinds = Object.fromEntries(r.alerts.map((a) => [a.kind, a.n]))
    expect(kinds.impact_returned).toBe(1)
    expect(kinds.impact_signature ?? 0).toBe(0)
    expect(kinds.impact_signature_late ?? 0).toBe(0)
  })

  it('le jalon Production exige les deux signatures, et dit laquelle manque', async () => {
    const detail = await asUser(db, DEMO.officerA, async (c) => {
      const id = await freshStudy(c)
      await c.query(
        `update public.impact_assessment set status = 'awaiting_signature', conclusion = 'Effets acceptables.', method_signed_at = now() where id = $1`,
        [id],
      )
      await c.query(`update public.ai_use_case set involves_sensitive_data = true where id = $1`, [DEMO.useCaseProduction])
      const { rows } = await c.query<{ d: string; ok: boolean }>(
        `select ch ->> 'detail' as d, (ch ->> 'satisfied')::boolean as ok
           from jsonb_array_elements(public.evaluate_gate($1, 'PRODUCTION') -> 'checks') ch
          where ch ->> 'code' = 'IMPACT_ASSESSMENT'`,
        [DEMO.useCaseProduction],
      )
      return rows[0]!
    })
    expect(detail.ok).toBe(false)
    expect(detail.d).toMatch(/en attente de l['’]acceptation des risques résiduels/)
  })
})

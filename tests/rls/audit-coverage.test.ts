import { afterAll, beforeAll, describe, expect, it } from 'vitest'
import type { Client } from 'pg'
import { asUser, connect, DEMO, expectFailure } from '../helpers/db'

/**
 * Couverture du journal d'audit.
 *
 * Un dossier de gouvernance vaut ce que vaut sa trace. Trois proprietes se
 * verifient ici : aucune table metier n'echappe au journal, la suppression y
 * figure avec l'etat supprime, et le journal reste inalterable.
 */

let db: Client

beforeAll(async () => {
  db = await connect()
})

afterAll(async () => {
  await db.end()
})

describe('Couverture', () => {
  it('aucune table métier n’échappe au journal', async () => {
    // Une liste declarative se perime des qu'une table apparait sans y etre
    // ajoutee : ce test est ce qui le fait savoir.
    const { rows } = await db.query<{ table_name: string }>(
      'select table_name from app.audit_coverage_gaps()',
    )
    expect(rows.map((r) => r.table_name)).toEqual([])
  })
})

describe('Ce que le journal retient', () => {
  it('journalise une création avec son intitulé', async () => {
    await asUser(db, DEMO.officerA, async (c) => {
      const { rows } = await c.query<{ id: string }>(
        `insert into public.control (tenant_id, organization_id, code, name, objective, status)
         values ($1, $2, 'CTL-AUDIT-1', 'Contrôle de test', 'Vérifier la journalisation.', 'proposed')
         returning id`,
        [DEMO.tenantA, DEMO.orgA],
      )

      const { rows: log } = await c.query<{ action: string; summary: string }>(
        `select action::text, summary from public.audit_log
          where entity_type = 'control' and entity_id = $1`,
        [rows[0]!.id],
      )

      expect(log).toHaveLength(1)
      expect(log[0]!.action).toBe('create')
      expect(log[0]!.summary).toContain('Contrôle de test')
    })
  })

  it('journalise une suppression, et conserve ce qui a été supprimé', async () => {
    // C'est le cas qui compte : apres coup, la ligne n'existe plus. Si le
    // journal ne portait que son identifiant, le dossier serait perdu.
    await asUser(db, DEMO.officerA, async (c) => {
      const { rows } = await c.query<{ id: string }>(
        `insert into public.control (tenant_id, organization_id, code, name, objective, status)
         values ($1, $2, 'CTL-AUDIT-2', 'Contrôle éphémère', 'Sera supprimé.', 'proposed')
         returning id`,
        [DEMO.tenantA, DEMO.orgA],
      )
      const id = rows[0]!.id

      await c.query('delete from public.control where id = $1', [id])

      const { rows: log } = await c.query<{
        action: string
        summary: string
        before_state: { name: string; objective: string } | null
      }>(
        `select action::text, summary, before_state from public.audit_log
          where entity_type = 'control' and entity_id = $1 and action = 'delete'`,
        [id],
      )

      expect(log).toHaveLength(1)
      expect(log[0]!.summary).toContain('Contrôle éphémère')
      expect(log[0]!.before_state?.name).toBe('Contrôle éphémère')
      expect(log[0]!.before_state?.objective).toBe('Sera supprimé.')
    })
  })

  it('journalise une modification avec l’avant et l’après', async () => {
    await asUser(db, DEMO.officerA, async (c) => {
      const { rows } = await c.query<{ id: string }>(
        `insert into public.control (tenant_id, organization_id, code, name, objective, status)
         values ($1, $2, 'CTL-AUDIT-3', 'Contrôle à faire évoluer', 'Vérifier l''avant et l''après.', 'proposed')
         returning id`,
        [DEMO.tenantA, DEMO.orgA],
      )
      await c.query("update public.control set status = 'operating' where id = $1", [rows[0]!.id])

      const { rows: log } = await c.query<{
        before_state: { status: string } | null
        after_state: { status: string } | null
      }>(
        `select before_state, after_state from public.audit_log
          where entity_type = 'control' and entity_id = $1 and action = 'update'`,
        [rows[0]!.id],
      )

      expect(log[0]!.before_state?.status).toBe('proposed')
      expect(log[0]!.after_state?.status).toBe('operating')
    })
  })

  it('journalise l’acte d’administration', async () => {
    // Creer une organisation, attribuer un role : ce sont des actes de
    // gouvernance au meme titre que les autres.
    const { rows } = await db.query<{ n: string }>(
      `select count(*)::text as n from public.audit_log
        where entity_type in ('organization', 'role_assignment', 'membership')`,
    )
    expect(Number(rows[0]!.n)).toBeGreaterThan(0)
  })

  it('reste inaltérable, même sans la RLS pour l’en empêcher', async () => {
    // Sous un role d'utilisateur, la RLS suffit : aucune ligne n'est visible en
    // ecriture, l'ordre ne touche rien. Le test porte donc sur le cas ou la RLS
    // ne protege plus — une connexion privilegiee, une tache systeme — car
    // c'est la que l'immuabilite doit tenir seule.
    //
    // Chaque refus est encadre d'un point de reprise : une erreur Postgres
    // avorte la transaction, et sans cela la seconde tentative ne dirait rien.
    await db.query('begin')
    try {
      const update = await expectFailure(db, "update public.audit_log set summary = 'réécrit'")
      expect(update.message).toMatch(/append-only/i)

      const remove = await expectFailure(db, 'delete from public.audit_log')
      expect(remove.message).toMatch(/append-only/i)
    } finally {
      await db.query('rollback')
    }
  })
})

import { afterAll, beforeAll, describe, expect, it } from 'vitest'
import type { Client } from 'pg'
import { asUser, connect, DEMO } from '../helpers/db'

/**
 * La matrice roles × capacites est calculee depuis les ensembles de roles que
 * les policies utilisent. Ces tests verifient qu'elle dit vrai — c'est-a-dire
 * qu'elle coincide avec ce que la RLS fait reellement pour quelques cellules
 * choisies parce qu'elles sont les plus sensibles.
 */

type Capability = { key: string; group: string; label: string; roles: string[] }

let db: Client

beforeAll(async () => {
  db = await connect()
})

afterAll(async () => {
  await db.end()
})

async function matrix(): Promise<Capability[]> {
  return asUser(db, DEMO.officerA, async (c) => {
    const { rows } = await c.query<{ r: Capability[] }>('select app.role_capabilities() as r')
    return rows[0]!.r
  })
}

describe('Matrice des rôles', () => {
  it('est lisible par tout rôle authentifié, et couvre les huit rôles', async () => {
    const rows = await matrix()
    const read = rows.find((r) => r.key === 'read')
    expect(read?.roles).toHaveLength(8)
  })

  it("l'administration n'a aucune capacité de gouvernance : elle administre, elle ne décide pas", async () => {
    const rows = await matrix()
    const governance = rows.filter((r) => !['Administration', 'Lecture'].includes(r.group))
    for (const row of governance) {
      expect(row.roles, row.key).not.toContain('platform_admin')
    }
    for (const row of rows.filter((r) => r.group === 'Administration')) {
      expect(row.roles, row.key).toEqual(['platform_admin'])
    }
  })

  it('le porteur du système dépose des preuves mais ne se prononce pas sur les décisions', async () => {
    const rows = await matrix()
    expect(rows.find((r) => r.key === 'evidence')?.roles).toContain('system_owner')
    expect(rows.find((r) => r.key === 'decisions')?.roles).not.toContain('system_owner')
    expect(rows.find((r) => r.key === 'risks')?.roles).not.toContain('system_owner')
  })

  it("l'auditeur lit le journal d'audit ; la direction ne le lit pas", async () => {
    const rows = await matrix()
    const auditLog = rows.find((r) => r.key === 'audit_log')
    expect(auditLog?.roles).toContain('auditor')
    expect(auditLog?.roles).not.toContain('executive_viewer')
  })

  it('la cellule « auditeur → preuve » dit inactif, et la base refuse bien l’écriture', async () => {
    // La matrice ne vaut que si elle coincide avec la RLS. On le verifie sur la
    // cellule la plus simple a contredire : un auditeur qui tenterait d'ecrire.
    const rows = await matrix()
    expect(rows.find((r) => r.key === 'evidence')?.roles).not.toContain('auditor')

    const touched = await asUser(db, DEMO.auditorA, async (c) => {
      const result = await c.query(
        "update public.evidence set title = 'Modifiée par un auditeur' where organization_id = $1",
        [DEMO.orgA],
      )
      return result.rowCount
    })
    expect(touched).toBe(0)
  })
})

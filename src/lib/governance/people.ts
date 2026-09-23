import { cache } from 'react'
import { createClient } from '@/lib/supabase/server'
import { ROLE_LABELS as DOMAIN_ROLE_LABELS } from '@/lib/domain/roles'

/**
 * Les personnes declarees sur une organisation.
 *
 * Une decision n'est pas adressee a un role, elle est adressee a quelqu'un.
 * Tant que le registre ne disait pas QUI etait appele a se prononcer, une
 * organisation qui compte trois personnes habilitees n'en designait aucune.
 *
 * Ce que cette liste ne fait pas : conferer un droit. Elle nomme un
 * destinataire. L'approbation reste enregistree au nom de celui qui la
 * prononce, et `app.guard_decision_approval` refuse toujours que l'auteur
 * approuve sa propre mise en production. Laisser choisir « qui a approuve »
 * dans une liste reviendrait a laisser quiconque consigner l'accord d'un
 * autre : le registre n'aurait plus de valeur.
 */

export type Person = {
  userId: string
  name: string
  email: string
  jobTitle: string | null
  roles: string[]
}

/**
 * Roles qui peuvent se prononcer sur une decision : app.roles_review, et le
 * Comite de direction (app.roles_arbitrate), qui arbitre sans soumettre.
 */
const REVIEW_ROLES = ['governance_officer', 'client_admin', 'reviewer', 'executive_viewer']

/** Les denominations sont celles du domaine : une seule source. */
export const ROLE_LABELS: Record<string, string> = DOMAIN_ROLE_LABELS

/**
 * Personnes rattachees a l'organisation, affectation en cours de validite.
 * `onlyReviewers` restreint a celles qui peuvent effectivement se prononcer.
 */
export const organizationPeople = cache(
  async (organizationId: string, onlyReviewers = false): Promise<Person[]> => {
    const supabase = await createClient()
    const { data } = await supabase
      .from('role_assignment')
      .select('user_id, role, valid_until, user_profile:user_id (full_name, email, job_title)')
      .eq('organization_id', organizationId)

    const now = Date.now()
    const byUser = new Map<string, Person>()

    for (const row of data ?? []) {
      if (row.valid_until && new Date(row.valid_until).getTime() <= now) continue
      if (onlyReviewers && !REVIEW_ROLES.includes(row.role)) continue

      const profile = row.user_profile as unknown as {
        full_name: string | null
        email: string
        job_title: string | null
      } | null
      if (!profile) continue

      const existing = byUser.get(row.user_id)
      if (existing) {
        if (!existing.roles.includes(row.role)) existing.roles.push(row.role)
        continue
      }
      byUser.set(row.user_id, {
        userId: row.user_id,
        name: profile.full_name?.trim() || profile.email,
        email: profile.email,
        jobTitle: profile.job_title,
        roles: [row.role],
      })
    }

    return [...byUser.values()].sort((a, b) => a.name.localeCompare(b.name, 'fr'))
  },
)

/**
 * Les personnes de PLUSIEURS organisations, en une requete.
 *
 * Meme lecture, meme regroupement — mais `in` plutot qu'une requete par
 * organisation. La vue Actifs et fournisseurs en ouvre autant qu'elle affiche
 * d'organisations.
 */
export const peopleByOrganization = cache(
  async (organizationIds: string[]): Promise<Map<string, Person[]>> => {
    const byOrganization = new Map<string, Person[]>()
    if (!organizationIds.length) return byOrganization

    const supabase = await createClient()
    const { data } = await supabase
      .from('role_assignment')
      .select('organization_id, user_id, role, valid_until, user_profile:user_id (full_name, email, job_title)')
      .in('organization_id', organizationIds)

    const now = Date.now()
    const index = new Map<string, Map<string, Person>>()

    for (const row of data ?? []) {
      if (row.valid_until && new Date(row.valid_until).getTime() <= now) continue
      const profile = row.user_profile as unknown as {
        full_name: string | null
        email: string
        job_title: string | null
      } | null
      if (!profile) continue

      const byUser = index.get(row.organization_id) ?? new Map<string, Person>()
      index.set(row.organization_id, byUser)

      const existing = byUser.get(row.user_id)
      if (existing) {
        if (!existing.roles.includes(row.role)) existing.roles.push(row.role)
        continue
      }
      byUser.set(row.user_id, {
        userId: row.user_id,
        name: profile.full_name?.trim() || profile.email,
        email: profile.email,
        jobTitle: profile.job_title,
        roles: [row.role],
      })
    }

    for (const [organizationId, byUser] of index) {
      byOrganization.set(
        organizationId,
        [...byUser.values()].sort((a, b) => a.name.localeCompare(b.name, 'fr')),
      )
    }
    return byOrganization
  },
)

/** « Claire Ferrand — AI Governance Officer » */
export function describePerson(person: Person): string {
  const qualifier = person.jobTitle?.trim() || person.roles.map((r) => ROLE_LABELS[r] ?? r).join(', ')
  return qualifier ? `${person.name} — ${qualifier}` : person.name
}

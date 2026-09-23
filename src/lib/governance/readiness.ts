import 'server-only'

import { cache } from 'react'
import { createClient } from '@/lib/supabase/server'
import { ROLE_LABELS, type AppRole } from '@/lib/domain/roles'

/**
 * Une organisation n'est operationnelle qu'avec ses six roles tenus (0056).
 * Tant qu'il en manque un, on y lit, on n'y ecrit rien : la base le refuse,
 * et l'ecran doit le dire AVANT que quelqu'un ne le decouvre sur un
 * formulaire.
 */
export type Readiness = {
  ready: boolean
  required: AppRole[]
  held: AppRole[]
  missing: AppRole[]
  people: number
}

export const organizationReadiness = cache(async (organizationId: string): Promise<Readiness | null> => {
  const supabase = await createClient()
  const { data } = await supabase.rpc('organization_readiness', { p_organization_id: organizationId })
  return (data ?? null) as Readiness | null
})

/**
 * La disponibilite de TOUTES les organisations accessibles, en un appel (0093).
 *
 * La page Comptes et roles appelait la fonction singuliere une fois par
 * organisation : sept allers-retours pour sept clients, cinquante pour
 * cinquante. Le portefeuille vise par l'offre rend cela intenable.
 */
export const allOrganizationsReadiness = cache(async (): Promise<Map<string, Readiness>> => {
  const supabase = await createClient()
  const { data } = await supabase.rpc('organizations_readiness')
  const rows = (data ?? []) as { organization_id: string; readiness: Readiness }[]
  return new Map(rows.map((r) => [r.organization_id, r.readiness]))
})

export function missingRoleLabels(readiness: Readiness): string[] {
  return readiness.missing.map((role) => ROLE_LABELS[role])
}

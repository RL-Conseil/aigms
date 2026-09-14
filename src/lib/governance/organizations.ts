import 'server-only'

import { cache } from 'react'
import { createClient } from '@/lib/supabase/server'
import type { AppRole } from '@/lib/domain/roles'

/**
 * Organisations gerees.
 *
 * A distinguer de ce que la RLS laisse voir : une personne peut lire une
 * organisation de son tenant sans y detenir de role. « Gerer » veut dire qu'une
 * attribution de role a ete portee par l'administration — c'est un fait de
 * gouvernance, pas une preference d'affichage.
 */

export type ManagedOrganization = {
  id: string
  business_ref: string
  name: string
  legal_name: string | null
  sector: string | null
  country_code: string | null
  headcount: number | null
  status: string
  ai_activity_profile: string | null
  created_at: string
  role: AppRole | null
}

export const managedOrganizations = cache(async (): Promise<ManagedOrganization[]> => {
  const supabase = await createClient()
  const { data } = await supabase.rpc('managed_organizations')
  return (data ?? []) as ManagedOrganization[]
})

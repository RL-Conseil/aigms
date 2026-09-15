import { cache } from 'react'
import { createClient } from '@/lib/supabase/server'
import type { Capability } from '@/components/admin/role-matrix'

/** La matrice roles × capacites, telle que la base la calcule. */
export const roleCapabilities = cache(async (): Promise<Capability[]> => {
  const supabase = await createClient()
  const { data } = await supabase.rpc('role_capabilities')
  return (data ?? []) as Capability[]
})

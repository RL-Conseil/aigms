import 'server-only'

import { createClient as createSupabaseClient } from '@supabase/supabase-js'
import { publicEnv, serverEnv } from '@/lib/env'

/**
 * Client service_role — CONTOURNE LA RLS.
 *
 * Usage strictement limite aux seeds et aux tests d'isolation. Toute utilisation
 * dans un parcours applicatif est un defaut de securite : la regle ESLint
 * `no-restricted-imports` en interdit l'import depuis src/app.
 */
export function createAdminClient() {
  const { NEXT_PUBLIC_SUPABASE_URL } = publicEnv()
  const { SUPABASE_SERVICE_ROLE_KEY } = serverEnv()

  return createSupabaseClient(NEXT_PUBLIC_SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY, {
    auth: { persistSession: false, autoRefreshToken: false },
  })
}

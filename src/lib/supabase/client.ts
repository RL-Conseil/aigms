'use client'

import { createBrowserClient } from '@supabase/ssr'
import { publicEnv } from '@/lib/env'

/** Client navigateur : cle publiable uniquement, lectures soumises a la RLS. */
export function createClient() {
  const env = publicEnv()
  return createBrowserClient(env.NEXT_PUBLIC_SUPABASE_URL, env.NEXT_PUBLIC_SUPABASE_ANON_KEY)
}

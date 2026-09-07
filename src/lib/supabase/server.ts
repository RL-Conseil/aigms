import { cookies } from 'next/headers'
import { createServerClient } from '@supabase/ssr'
import { publicEnv } from '@/lib/env'

/**
 * Client Supabase pour Server Components, Server Actions et Route Handlers.
 *
 * Il porte le JWT de l'utilisateur : toutes ses requetes restent soumises a la
 * RLS. C'est le seul client autorise dans le code applicatif.
 */
export async function createClient() {
  const cookieStore = await cookies()
  const env = publicEnv()

  return createServerClient(env.NEXT_PUBLIC_SUPABASE_URL, env.NEXT_PUBLIC_SUPABASE_ANON_KEY, {
    cookies: {
      getAll() {
        return cookieStore.getAll()
      },
      setAll(cookiesToSet) {
        try {
          for (const { name, value, options } of cookiesToSet) {
            cookieStore.set(name, value, options)
          }
        } catch {
          // Appel depuis un Server Component : le rafraichissement de session
          // est assure par le proxy. Rien a faire ici.
        }
      },
    },
  })
}

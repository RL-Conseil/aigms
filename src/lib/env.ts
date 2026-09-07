import { z } from 'zod'

/**
 * Validation des variables d'environnement au demarrage.
 *
 * Le schema serveur n'est jamais evalue cote navigateur : `serverEnv()` echoue
 * volontairement si elle est appelee depuis un bundle client, ce qui empeche
 * une cle service_role d'etre embarquee par inadvertance.
 */

const publicSchema = z.object({
  NEXT_PUBLIC_SUPABASE_URL: z.string().url(),
  NEXT_PUBLIC_SUPABASE_ANON_KEY: z.string().min(1),
  NEXT_PUBLIC_SITE_URL: z.string().url().default('http://localhost:3000'),
})

const serverSchema = z.object({
  SUPABASE_SERVICE_ROLE_KEY: z.string().min(1),
})

export type PublicEnv = z.infer<typeof publicSchema>

export function publicEnv(): PublicEnv {
  const parsed = publicSchema.safeParse({
    NEXT_PUBLIC_SUPABASE_URL: process.env.NEXT_PUBLIC_SUPABASE_URL,
    NEXT_PUBLIC_SUPABASE_ANON_KEY: process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY,
    NEXT_PUBLIC_SITE_URL: process.env.NEXT_PUBLIC_SITE_URL,
  })

  if (!parsed.success) {
    throw new Error(
      `Configuration Supabase incomplete : ${parsed.error.issues.map((i) => i.path.join('.')).join(', ')}. ` +
        'Renseigner .env.local a partir de .env.example.',
    )
  }

  return parsed.data
}

export function serverEnv(): z.infer<typeof serverSchema> {
  if (typeof window !== 'undefined') {
    throw new Error("serverEnv() a ete appelee cote client : aucun secret serveur ne doit atteindre le navigateur.")
  }

  const parsed = serverSchema.safeParse({
    SUPABASE_SERVICE_ROLE_KEY: process.env.SUPABASE_SERVICE_ROLE_KEY,
  })

  if (!parsed.success) {
    throw new Error('SUPABASE_SERVICE_ROLE_KEY manquante.')
  }

  return parsed.data
}

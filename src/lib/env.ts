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
  /**
   * Cle publique du captcha Cloudflare Turnstile.
   *
   * Facultative, et c'est deliberé : absente, la mire fonctionne sans captcha —
   * en developpement, en Preview et dans les tests de bout en bout. Presente,
   * elle affiche le defi ET Supabase doit etre configure pour exiger le jeton
   * (Authentication > Attack protection). Sans ce second reglage, le jeton
   * serait envoye mais jamais verifie : un captcha decoratif vaut moins que pas
   * de captcha, parce qu'il fait croire a une protection.
   */
  NEXT_PUBLIC_TURNSTILE_SITE_KEY: z.string().optional(),
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
    NEXT_PUBLIC_TURNSTILE_SITE_KEY: process.env.NEXT_PUBLIC_TURNSTILE_SITE_KEY || undefined,
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

import { cache } from 'react'
import { createClient } from '@/lib/supabase/server'

/**
 * La marque portee par l'en-tete.
 *
 * AIGMS se revend : un cabinet qui pilote un portefeuille veut que ses clients
 * voient SA marque, pas celle de l'editeur. Le reglage vit sur le tenant —
 * c'est le cabinet qui revend, pas son client.
 *
 * A ne pas confondre avec l'identite documentaire d'une ORGANISATION
 * (`@/lib/governance/document-identity`), qui sert ses documents remis. Les
 * deux logos coexistent et ne repondent pas a la meme question : l'un dit quel
 * outil on utilise, l'autre de qui est la piece qu'on remet.
 */

export type Branding = {
  label: string
  tagline: string | null
  logoUrl: string | null
}

/** La marque de l'editeur, servie tant qu'aucun tenant n'a pose la sienne. */
export const DEFAULT_BRANDING: Branding = {
  label: 'AIGMS',
  tagline: 'Designed by Caritis',
  logoUrl: null,
}

const LOGO_URL_TTL_SECONDS = 3600

export const tenantBranding = cache(async (): Promise<Branding> => {
  const supabase = await createClient()
  const { data } = await supabase.rpc('tenant_branding')
  if (!data) return DEFAULT_BRANDING

  const raw = data as Record<string, string | null | undefined>
  let logoUrl: string | null = null
  if (raw.logo_path) {
    const { data: signed } = await supabase.storage
      .from('branding')
      .createSignedUrl(raw.logo_path, LOGO_URL_TTL_SECONDS)
    logoUrl = signed?.signedUrl ?? null
  }

  return {
    label: raw.label?.trim() || DEFAULT_BRANDING.label,
    // Une chaine vide et NULL disent la meme chose : pas de mention.
    tagline: raw.tagline?.trim() || null,
    logoUrl,
  }
})

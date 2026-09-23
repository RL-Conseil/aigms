import 'server-only'

import { cache } from 'react'
import { createClient } from '@/lib/supabase/server'
import type { Attention } from '@/lib/governance/attention'

/**
 * Ce qui appelle une action, lu dans la base.
 *
 * Separe des intitules et des destinations (`attention.ts`) parce que la barre
 * de navigation est desormais un composant client : elle a besoin des seconds,
 * jamais des premieres.
 *
 * `cache` memoise l'appel pour la duree du rendu : la mise en page, le
 * sous-menu et la page lisent le meme etat sans multiplier les requetes.
 */

export const attentionByOrganization = cache(async (): Promise<Attention[]> => {
  const supabase = await createClient()
  const { data } = await supabase.rpc('attention_by_organization')
  return (data ?? []) as Attention[]
})

export const attentionFor = cache(async (organizationId: string): Promise<Attention | null> => {
  const rows = await attentionByOrganization()
  return rows.find((row) => row.organization_id === organizationId) ?? null
})

/** Somme de tout ce qui appelle une action sur le perimetre accessible. */
export async function attentionTotal(): Promise<number> {
  const rows = await attentionByOrganization()
  return rows.reduce((sum, row) => sum + row.total, 0)
}

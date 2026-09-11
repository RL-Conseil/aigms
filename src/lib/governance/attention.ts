import 'server-only'

import { cache } from 'react'
import { createClient } from '@/lib/supabase/server'

/**
 * Ce qui appelle une action.
 *
 * Un menu qui ne porte que des noms de pages oblige a ouvrir chaque ecran pour
 * savoir s'il s'y passe quelque chose. Ces compteurs permettent a la navigation
 * de dire ou aller avant qu'on ait a chercher.
 *
 * `cache` memoise l'appel pour la duree du rendu : la coquille, le sous-menu et
 * la page lisent le meme etat sans multiplier les requetes.
 */

export type Attention = {
  organization_id: string
  organization_name: string
  organization_ref: string
  overdue_actions: number
  reviews_due: number
  stale_evidence: number
  evidence_to_review: number
  open_incidents: number
  high_risks_open: number
  soa_undecided: number
  total: number
}

export type AttentionKind = Exclude<
  keyof Attention,
  'organization_id' | 'organization_name' | 'organization_ref' | 'total'
>

/**
 * Chaque intitule nomme un ACTE a poser, pas un etat a contempler — « preuve a
 * valider » plutot que « preuves en attente ».
 *
 * Le pluriel est ecrit, jamais derive : « revue en retard » donne « revues en
 * retard », pas « revues en retards ». Une regle automatique se trompe des
 * qu'un complement suit le nom, ce qui est le cas de presque tous.
 */
export const ATTENTION_LABELS: Record<AttentionKind, readonly [string, string]> = {
  overdue_actions: ['action échue', 'actions échues'],
  reviews_due: ['revue en retard', 'revues en retard'],
  stale_evidence: ['preuve à renouveler', 'preuves à renouveler'],
  evidence_to_review: ['preuve à valider', 'preuves à valider'],
  open_incidents: ['incident ouvert', 'incidents ouverts'],
  high_risks_open: ['risque élevé ouvert', 'risques élevés ouverts'],
  soa_undecided: ['exigence sans décision', 'exigences sans décision'],
}

export const ATTENTION_ORDER: AttentionKind[] = [
  'overdue_actions',
  'open_incidents',
  'high_risks_open',
  'reviews_due',
  'stale_evidence',
  'evidence_to_review',
  'soa_undecided',
]

/**
 * Un retard est passe, une attente ne l'est pas encore. La distinction commande
 * la couleur : rouge pour ce qui aurait deja du etre fait, ambre pour ce qui
 * attend une main.
 */
const LATE: AttentionKind[] = ['overdue_actions', 'open_incidents', 'high_risks_open', 'reviews_due']

export function isLate(kind: AttentionKind): boolean {
  return LATE.includes(kind)
}

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

/** Rend la liste lisible : « 2 preuves à renouveler, 1 incident ouvert ». */
export function describeAttention(attention: Attention, kinds = ATTENTION_ORDER): string[] {
  return kinds
    .filter((kind) => attention[kind] > 0)
    .map((kind) => {
      const count = attention[kind]
      const [singular, plural] = ATTENTION_LABELS[kind]
      return `${count} ${count > 1 ? plural : singular}`
    })
}

/** Intitule d'un compteur, accorde. */
export function attentionLabel(kind: AttentionKind, count: number): string {
  const [singular, plural] = ATTENTION_LABELS[kind]
  return count > 1 ? plural : singular
}

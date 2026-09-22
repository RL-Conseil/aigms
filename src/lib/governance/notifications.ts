import 'server-only'

import { cache } from 'react'
import { createClient } from '@/lib/supabase/server'

/**
 * Alertes nominatives.
 *
 * Un acte pose sur une fiche engage quelqu'un a une date : un responsable de
 * risque, une revue de surveillance, une decision soumise, un changement
 * prevu. La base emet l'alerte (0053) ; ici on la lit. Une alerte porte une
 * date de visibilite : un rappel date n'apparait que son jour venu — c'est la
 * fonction `my_notifications` qui filtre, pas l'ecran.
 */
export type Notification = {
  id: string
  organization_id: string | null
  kind: string
  title: string
  body: string | null
  href: string | null
  entity_type: string | null
  entity_id: string | null
  due_at: string
  created_at: string
  read_at: string | null
}

export const unreadNotifications = cache(async (): Promise<number> => {
  const supabase = await createClient()
  const { data } = await supabase.rpc('my_unread_notifications')
  return typeof data === 'number' ? data : 0
})

export async function listNotifications(limit = 50): Promise<Notification[]> {
  const supabase = await createClient()
  const { data } = await supabase.rpc('my_notifications', { p_limit: limit })
  return (data ?? []) as Notification[]
}

/** Le mot de la nature de l'alerte, pour la lire d'un coup d'oeil. */
export const NOTIFICATION_KIND_LABELS: Record<string, string> = {
  risk_owner: 'Risque',
  action_owner: 'Action',
  action_due: 'Échéance',
  oversight_review: 'Supervision',
  oversight_review_due: 'Revue due',
  decision_submitted: 'Décision',
  decision_to_approve: 'À statuer',
  decision_effective: 'Date d’effet',
  change_planned: 'Changement',
  change_due: 'Changement prévu',
  impact_completed: 'Évaluation',
  treatment_owner: 'Traitement',
  treatment_due: 'Échéance',
  decision_blocked: 'Jalon en attente',
  incident_new: 'Incident',
  incident_qualify: 'À qualifier',
  incident_stop: 'Arrêt d’urgence',
  incident_closure: 'Clôture',
  criticality_review: 'Criticité',
  evidence_to_validate: 'Preuve à valider',
  evidence_expiring: 'Preuve bientôt échue',
  evidence_expired: 'Preuve échue',
  use_case_review_due: 'Revue du cas d’usage',
  vendor_review_due: 'Revue fournisseur',
  impact_review_due: 'Étude d’impact',
  impact_signature: 'Signature attendue',
  impact_signature_late: 'Signature en retard',
  impact_returned: 'Étude renvoyée',
}

/** Ce qui est un rappel date — a distinguer d'une simple information. */
export const REMINDER_KINDS = new Set([
  'action_due',
  'oversight_review_due',
  'decision_effective',
  'change_due',
  'treatment_due',
  'incident_qualify',
  'evidence_expiring',
  'evidence_expired',
  'use_case_review_due',
  'vendor_review_due',
  'impact_review_due',
  'impact_signature_late',
])

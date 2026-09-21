/** Vocabulaire des revues de gouvernance et des cadences attendues. */
export const FREQUENCY_LABELS: Record<string, string> = {
  continuous: 'Continue',
  monthly: 'Mensuelle',
  quarterly: 'Trimestrielle',
  semiannual: 'Semestrielle',
  annual: 'Annuelle',
}

export const FREQUENCY_MONTHS: Record<string, number> = {
  continuous: 1,
  monthly: 1,
  quarterly: 3,
  semiannual: 6,
  annual: 12,
}

export const REVIEW_KIND_LABELS: Record<string, string> = {
  committee: 'Comité de gouvernance de l’IA',
  direction: 'Revue de direction',
}

export const REVIEW_STATUS_LABELS: Record<string, string> = {
  planned: 'Planifiée',
  held: 'Tenue',
  cancelled: 'Annulée',
}

export type Cadence = {
  class: 1 | 2 | 3
  class_label: string
  size: string
  profile: string | null
  max_criticality: string | null
  high_risk: boolean
  reasons: string[]
  register: string
  incidents: string
  committee: string
  direction: string
}

export type ReviewCalendar = {
  cadence: Cadence | null
  last_committee: string | null
  last_direction: string | null
  next_committee: string | null
  next_direction: string | null
  held_count: number
}

/** Une revue est en retard quand la derniere tenue date de plus que sa cadence, et qu'aucune n'est planifiee. */
export function reviewOverdue(last: string | null, next: string | null, frequency: string): boolean {
  if (next) return new Date(next) < new Date(new Date().toDateString())
  if (!last) return true
  const months = FREQUENCY_MONTHS[frequency] ?? 12
  const due = new Date(last)
  due.setMonth(due.getMonth() + months)
  return due < new Date()
}

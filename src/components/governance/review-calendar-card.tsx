import Link from 'next/link'
import { Card } from '@/components/ui'
import { formatDate } from '@/lib/domain/governance'
import { ACTIVITY_PROFILE_LABELS, type ActivityProfile } from '@/lib/domain/activity-profile'
import { FREQUENCY_LABELS, reviewOverdue, type ReviewCalendar } from '@/lib/domain/reviews'

/**
 * Le calendrier de gouvernance : ce que l'auditeur attend au regard du
 * profil de risque — criticite, role, taille — et ce qui est tenu.
 */
function Row({ label, freq, last, next, late }: { label: string; freq: string; last: string | null; next: string | null; late: boolean }) {
  return (
    <li className="flex flex-wrap items-baseline justify-between gap-2 py-2">
      <span className="text-sm text-ink-900">
        {label}
        <span className="ml-2 text-xs text-ink-400">attendue : {FREQUENCY_LABELS[freq]?.toLowerCase() ?? freq}</span>
      </span>
      <span className={`text-xs ${late ? 'font-medium text-stop-600' : 'text-ink-500'}`}>
        {last ? `dernière le ${formatDate(last)}` : 'jamais tenue'}
        {next ? ` · prochaine le ${formatDate(next)}` : late ? ' · en retard, aucune planifiée' : ''}
      </span>
    </li>
  )
}

export function ReviewCalendarCard({
  organizationId,
  calendar,
  compact = false,
}: {
  organizationId: string
  calendar: ReviewCalendar
  compact?: boolean
}) {
  const c = calendar.cadence
  if (!c) return null
  const committeeLate = reviewOverdue(calendar.last_committee, calendar.next_committee, c.committee)
  const directionLate = reviewOverdue(calendar.last_direction, calendar.next_direction, c.direction)

  return (
    <Card
      title="Calendrier de gouvernance"
      subtitle={`Classe ${c.class} — ${c.class_label} · ${c.size}${c.profile ? ` · ${ACTIVITY_PROFILE_LABELS[c.profile as ActivityProfile] ?? c.profile}` : ''}`}
      tone={committeeLate || directionLate ? 'warn' : 'neutral'}
      action={
        <Link href={`/admin/organizations/${organizationId}/revues`} className="text-xs font-medium text-brand-600 hover:underline">
          Revues
        </Link>
      }
    >
      <p className="text-xs leading-relaxed text-ink-500">
        L’auditeur évalue le calendrier au regard du profil de risque : ici, {c.reasons.join(' ; ')}. Il attend un
        traitement du registre <strong className="font-medium text-ink-700">{FREQUENCY_LABELS[c.register]?.toLowerCase()}</strong>, un suivi
        des incidents <strong className="font-medium text-ink-700">{FREQUENCY_LABELS[c.incidents]?.toLowerCase()}</strong>.
      </p>
      <ul className="mt-2 divide-y divide-ink-100">
        <Row label="Comité de gouvernance de l’IA" freq={c.committee} last={calendar.last_committee} next={calendar.next_committee} late={committeeLate} />
        <Row label="Revue de direction (§ 9.3)" freq={c.direction} last={calendar.last_direction} next={calendar.next_direction} late={directionLate} />
      </ul>
      {!compact ? (
        <p className="mt-2 text-xs text-ink-400">
          La cadence se déduit de la criticité la plus haute des usages, des qualifications à haut risque, du rôle de l’organisation et de sa taille. Elle ne se règle pas : elle se constate.
        </p>
      ) : null}
    </Card>
  )
}

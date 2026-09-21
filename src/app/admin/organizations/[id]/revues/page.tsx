import Link from 'next/link'
import { notFound } from 'next/navigation'
import { createClient } from '@/lib/supabase/server'
import { Shell } from '@/components/shell'
import { Badge, Card, Empty } from '@/components/ui'
import { PlanReviewForm } from '@/components/governance/review-forms'
import { ReviewCalendarCard } from '@/components/governance/review-calendar-card'
import { cancelReview } from '@/lib/actions/reviews'
import { formatDate, formatDateTime } from '@/lib/domain/governance'
import { FREQUENCY_MONTHS, REVIEW_KIND_LABELS, REVIEW_STATUS_LABELS, type ReviewCalendar } from '@/lib/domain/reviews'

/**
 * Les revues de gouvernance : le calendrier attendu face au calendrier tenu,
 * les revues planifiees et tenues, et la planification de la prochaine.
 */
export default async function ReviewsPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params
  const supabase = await createClient()
  const [{ data: organization }, { data: calendarData }, { data: reviews }, { data: memberships }] = await Promise.all([
    supabase.from('organization').select('id, name').eq('id', id).maybeSingle(),
    supabase.rpc('review_calendar', { p_organization_id: id }),
    supabase
      .from('governance_review')
      .select('id, business_ref, kind, scheduled_on, held_at, status, attendees, next_review_on, evidence_id, chair:chaired_by (full_name, email)')
      .eq('organization_id', id)
      .order('scheduled_on', { ascending: false }),
    supabase.from('membership').select('user:user_id (id, full_name, email, job_title)').eq('status', 'active'),
  ])
  if (!organization) notFound()
  const calendar = calendarData as ReviewCalendar | null
  const people = (memberships ?? [])
    .map((m) => m.user as unknown as { id: string; full_name: string | null; email: string; job_title: string | null } | null)
    .filter((u): u is NonNullable<typeof u> => Boolean(u))
    .map((u) => ({ id: u.id, label: u.full_name ? `${u.full_name}${u.job_title ? ` — ${u.job_title}` : ''}` : u.email }))

  // Les dates que la cadence propose : derniere tenue + cadence, sinon aujourd'hui.
  const propose = (last: string | null, freq: string | undefined) => {
    const d = last ? new Date(last) : new Date()
    if (last) d.setMonth(d.getMonth() + (FREQUENCY_MONTHS[freq ?? 'quarterly'] ?? 3))
    return d.toISOString().slice(0, 10)
  }
  const suggested = {
    committee: calendar?.cadence ? propose(calendar.last_committee, calendar.cadence.committee) : null,
    direction: calendar?.cadence ? propose(calendar.last_direction, calendar.cadence.direction) : null,
  }

  const planned = (reviews ?? []).filter((r) => r.status === 'planned')
  const held = (reviews ?? []).filter((r) => r.status !== 'planned')

  return (
    <Shell
      breadcrumb={[
        { href: '/admin/organizations', label: 'Organisations' },
        { href: `/admin/organizations/${id}`, label: organization.name },
        { label: 'Revues de gouvernance' },
      ]}
      organization={{ id, section: 'revues' }}
      title="Revues de gouvernance"
      subtitle="Le comité de gouvernance de l’IA et la revue de direction : planifiées à la cadence attendue, tenues avec compte rendu — qui devient la preuve."
      actions={<PlanReviewForm organizationId={id} people={people} suggested={suggested} />}
    >
      <div className="grid gap-5 lg:grid-cols-3">
        <div className="space-y-5 lg:col-span-2">
          <Card title="Planifiées" subtitle={planned.length ? `${planned.length} revue(s) à tenir` : 'Aucune revue planifiée'} tone={planned.length ? 'neutral' : 'warn'}>
            {planned.length ? (
              <ul className="divide-y divide-ink-100">
                {planned.map((r) => {
                  const chair = r.chair as unknown as { full_name: string | null; email: string } | null
                  const late = r.scheduled_on < new Date().toISOString().slice(0, 10)
                  return (
                    <li key={r.id} className="flex flex-wrap items-start justify-between gap-3 py-3">
                      <div>
                        <Link href={`/admin/organizations/${id}/revues/${r.id}`} className="text-sm font-medium text-ink-900 hover:underline">
                          {REVIEW_KIND_LABELS[r.kind]} — {formatDate(r.scheduled_on)}
                        </Link>
                        <p className="text-xs text-ink-400">
                          {r.business_ref}
                          {chair ? ` · présidée par ${chair.full_name ?? chair.email}` : ''}
                          {r.attendees?.length ? ` · ${r.attendees.length} participant(s) attendu(s)` : ''}
                        </p>
                      </div>
                      <span className="flex items-center gap-2">
                        {late ? <Badge tone="stop">Date dépassée</Badge> : <Badge tone="info">Planifiée</Badge>}
                        <form action={cancelReview}>
                          <input type="hidden" name="organizationId" value={id} />
                          <input type="hidden" name="reviewId" value={r.id} />
                          <button type="submit" className="text-xs text-ink-400 hover:text-stop-600 hover:underline">Annuler</button>
                        </form>
                      </span>
                    </li>
                  )
                })}
              </ul>
            ) : (
              <Empty>Planifier la prochaine revue : la cadence attendue propose la date, l’ordre du jour se génère.</Empty>
            )}
          </Card>

          <Card title="Tenues" subtitle={`${held.filter((r) => r.status === 'held').length} revue(s) tenue(s)`}>
            {held.length ? (
              <ul className="divide-y divide-ink-100">
                {held.map((r) => {
                  const chair = r.chair as unknown as { full_name: string | null; email: string } | null
                  return (
                    <li key={r.id} className="flex flex-wrap items-start justify-between gap-3 py-3">
                      <div>
                        <Link href={`/admin/organizations/${id}/revues/${r.id}`} className="text-sm font-medium text-ink-900 hover:underline">
                          {REVIEW_KIND_LABELS[r.kind]} — {r.held_at ? formatDateTime(r.held_at) : formatDate(r.scheduled_on)}
                        </Link>
                        <p className="text-xs text-ink-400">
                          {r.business_ref}
                          {chair ? ` · présidée par ${chair.full_name ?? chair.email}` : ''}
                          {r.attendees?.length ? ` · ${r.attendees.length} présent(s)` : ''}
                          {r.next_review_on ? ` · prochaine le ${formatDate(r.next_review_on)}` : ''}
                          {r.evidence_id ? ' · compte rendu déposé' : ''}
                        </p>
                      </div>
                      <Badge tone={r.status === 'held' ? 'ok' : 'neutral'}>{REVIEW_STATUS_LABELS[r.status]}</Badge>
                    </li>
                  )
                })}
              </ul>
            ) : (
              <Empty>Aucune revue tenue. Un auditeur demandera la première.</Empty>
            )}
          </Card>
        </div>

        <div className="space-y-5">
          {calendar ? <ReviewCalendarCard organizationId={id} calendar={calendar} /> : null}
        </div>
      </div>
    </Shell>
  )
}

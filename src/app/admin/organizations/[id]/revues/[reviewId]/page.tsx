import Link from 'next/link'
import { notFound } from 'next/navigation'
import { createClient } from '@/lib/supabase/server'
import { Shell } from '@/components/shell'
import { Badge, Card, Empty, Field } from '@/components/ui'
import { HoldReviewForm } from '@/components/governance/review-forms'
import { ReviewAgenda, type Agenda } from '@/components/governance/review-agenda'
import { formatDate, formatDateTime } from '@/lib/domain/governance'
import { FREQUENCY_MONTHS, REVIEW_KIND_LABELS, REVIEW_STATUS_LABELS, type Cadence } from '@/lib/domain/reviews'

/** Une revue : son ordre du jour, puis — tenue — ses presents, son compte rendu, ses decisions. */
export default async function ReviewPage({ params }: { params: Promise<{ id: string; reviewId: string }> }) {
  const { id, reviewId } = await params
  const supabase = await createClient()
  const [{ data: organization }, { data: review }] = await Promise.all([
    supabase.from('organization').select('id, name').eq('id', id).maybeSingle(),
    supabase
      .from('governance_review')
      .select('id, business_ref, kind, scheduled_on, held_at, status, attendees, period_from, agenda, minutes, decisions_taken, next_review_on, evidence_id, chair:chaired_by (full_name, email)')
      .eq('id', reviewId)
      .eq('organization_id', id)
      .maybeSingle(),
  ])
  if (!organization || !review) notFound()

  // Planifiee : l'ordre du jour se relit a jour ; tenue : il est fige.
  const { data: liveAgenda } =
    review.status === 'planned' && review.period_from
      ? await supabase.rpc('review_agenda', { p_organization_id: id, p_since: review.period_from })
      : { data: null }
  const agenda = ((liveAgenda ?? review.agenda) as Agenda & { cadence?: Cadence }) ?? null
  const chair = review.chair as unknown as { full_name: string | null; email: string } | null
  const cadence = agenda?.cadence
  const suggestedNext = (() => {
    const d = new Date()
    d.setMonth(d.getMonth() + (FREQUENCY_MONTHS[cadence?.[review.kind === 'direction' ? 'direction' : 'committee'] ?? 'quarterly'] ?? 3))
    return d.toISOString().slice(0, 10)
  })()

  return (
    <Shell
      breadcrumb={[
        { href: '/admin/organizations', label: 'Organisations' },
        { href: `/admin/organizations/${id}`, label: organization.name },
        { href: `/admin/organizations/${id}/revues`, label: 'Revues de gouvernance' },
        { label: review.business_ref },
      ]}
      organization={{ id, section: 'revues' }}
      title={`${REVIEW_KIND_LABELS[review.kind]} — ${review.held_at ? formatDate(review.held_at) : formatDate(review.scheduled_on)}`}
      subtitle={`${review.business_ref}${chair ? ` · présidée par ${chair.full_name ?? chair.email}` : ''} · ${REVIEW_STATUS_LABELS[review.status]}`}
      actions={
        <div className="flex flex-wrap items-center gap-2">
          {review.status === 'planned' ? (
            <HoldReviewForm organizationId={id} reviewId={reviewId} attendees={review.attendees ?? []} suggestedNext={suggestedNext} />
          ) : null}
          <Link
            href={`/admin/organizations/${id}/impression/revue/${reviewId}`}
            className="rounded-md border border-ink-200 px-3.5 py-2 text-sm text-ink-700 hover:bg-ink-100"
          >
            Imprimer
          </Link>
        </div>
      }
    >
      <div className="grid gap-5 lg:grid-cols-3">
        <div className="space-y-5 lg:col-span-2">
          <Card
            title="Ordre du jour"
            subtitle={review.status === 'planned' ? 'Généré à la planification, à jour à chaque lecture — figé à la tenue.' : 'Tel qu’examiné à la tenue.'}
          >
            {agenda ? <ReviewAgenda agenda={agenda} /> : <Empty>Ordre du jour non disponible.</Empty>}
          </Card>
        </div>
        <div className="space-y-5">
          {review.status === 'held' ? (
            <>
              <Card title="Compte rendu" subtitle={`Tenue le ${formatDateTime(review.held_at!)}`} tone="neutral">
                <dl className="space-y-3">
                  <Field label="Présents">{review.attendees?.length ? review.attendees.join(', ') : '—'}</Field>
                  <Field label="Compte rendu">
                    <span className="whitespace-pre-line">{review.minutes}</span>
                  </Field>
                  {review.decisions_taken ? (
                    <Field label="Décisions prises">
                      <span className="whitespace-pre-line">{review.decisions_taken}</span>
                    </Field>
                  ) : null}
                  <Field label="Prochaine revue">{review.next_review_on ? formatDate(review.next_review_on) : '—'}</Field>
                </dl>
                {review.evidence_id ? (
                  <p className="mt-3 text-xs text-ink-500">
                    <Badge tone="ok">Preuve déposée</Badge>{' '}
                    <Link href={`/admin/organizations/${id}/preuves?preuve=${review.evidence_id}`} className="text-brand-600 hover:underline">
                      Le compte rendu au registre des preuves — à valider.
                    </Link>
                  </p>
                ) : null}
              </Card>
            </>
          ) : (
            <Card title="Participants attendus">
              {review.attendees?.length ? (
                <ul className="text-sm text-ink-700">{(review.attendees as string[]).map((a) => <li key={a}>{a}</li>)}</ul>
              ) : (
                <Empty>À préciser à la tenue.</Empty>
              )}
            </Card>
          )}
        </div>
      </div>
    </Shell>
  )
}

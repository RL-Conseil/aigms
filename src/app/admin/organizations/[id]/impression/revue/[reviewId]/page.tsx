import { notFound } from 'next/navigation'
import type { Metadata } from 'next'
import { createClient } from '@/lib/supabase/server'
import { PrintDocument } from '@/components/print/document'
import { documentIdentity } from '@/lib/governance/document-identity'
import { ReviewAgenda, type Agenda } from '@/components/governance/review-agenda'
import { formatDate, formatDateTime } from '@/lib/domain/governance'
import { REVIEW_KIND_LABELS } from '@/lib/domain/reviews'

export const metadata: Metadata = { title: 'Revue de gouvernance' }

/** Le compte rendu imprimable : ce qu'un auditeur demande, avec l'ordre du jour examine. */
export default async function PrintableReviewPage({ params }: { params: Promise<{ id: string; reviewId: string }> }) {
  const { id, reviewId } = await params
  const supabase = await createClient()
  const [{ data: review }, identity] = await Promise.all([
    supabase
      .from('governance_review')
      .select('business_ref, kind, scheduled_on, held_at, status, attendees, period_from, agenda, minutes, decisions_taken, next_review_on, chair:chaired_by (full_name, email)')
      .eq('id', reviewId)
      .eq('organization_id', id)
      .maybeSingle(),
    documentIdentity(id),
  ])
  if (!review || !identity) notFound()
  const chair = review.chair as unknown as { full_name: string | null; email: string } | null

  return (
    <PrintDocument
      identity={identity}
      title={`${REVIEW_KIND_LABELS[review.kind]} — ${review.held_at ? formatDate(review.held_at) : formatDate(review.scheduled_on)}`}
      subtitle={`${review.business_ref}${chair ? ` · présidée par ${chair.full_name ?? chair.email}` : ''}${review.held_at ? ` · tenue le ${formatDateTime(review.held_at)}` : ' · planifiée'}`}
      backHref={`/admin/organizations/${id}/revues/${reviewId}`}
      backLabel="Retour à la revue"
    >
      {review.status === 'held' ? (
        <section className="doc-keep mb-7">
          <h2 className="mb-2 border-b border-ink-200 pb-1.5 font-serif text-base font-semibold text-ink-900">Compte rendu</h2>
          <p className="mb-2 text-[12px] text-ink-600"><strong className="font-medium">Présents :</strong> {review.attendees?.join(', ') ?? '—'}</p>
          <p className="whitespace-pre-line text-[12px] leading-relaxed text-ink-800">{review.minutes}</p>
          {review.decisions_taken ? (
            <>
              <h3 className="mb-1 mt-4 text-sm font-semibold text-ink-900">Décisions prises</h3>
              <p className="whitespace-pre-line text-[12px] leading-relaxed text-ink-800">{review.decisions_taken}</p>
            </>
          ) : null}
          <p className="mt-3 text-[12px] text-ink-600"><strong className="font-medium">Prochaine revue :</strong> {review.next_review_on ? formatDate(review.next_review_on) : '—'}</p>
        </section>
      ) : null}
      <section className="mb-7">
        <h2 className="mb-3 border-b border-ink-200 pb-1.5 font-serif text-base font-semibold text-ink-900">Ordre du jour</h2>
        <ReviewAgenda agenda={review.agenda as Agenda} />
      </section>
    </PrintDocument>
  )
}

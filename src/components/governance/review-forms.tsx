'use client'

import { useActionState } from 'react'
import { cancelReview, holdReview, planReview, type FormState } from '@/lib/actions/reviews'
import { Field, FIELD, FormFeedback, Submit } from '@/components/forms'
import { Modal } from '@/components/modal'
import { REVIEW_KIND_LABELS } from '@/lib/domain/reviews'

/** Planifier une revue : sa nature, sa date, qui la preside. L'ordre du jour se genere. */
export function PlanReviewForm({
  organizationId,
  people,
  suggested,
}: {
  organizationId: string
  people: { id: string; label: string }[]
  /** Les dates proposees par la cadence, par nature. */
  suggested: { committee: string | null; direction: string | null }
}) {
  const [state, formAction, pending] = useActionState<FormState | null, FormData>(planReview, null)
  const errors = state && !state.ok ? (state.fieldErrors ?? {}) : {}
  return (
    <Modal
      trigger="Planifier une revue"
      triggerClassName="rounded-md bg-night-900 px-3.5 py-2 text-sm font-medium text-white hover:bg-night-800"
      title="Planifier une revue de gouvernance"
      description="L’ordre du jour se génère à la planification : décisions de la période, CAPA ouvertes, risques élevés, changements, revues échues."
    >
      {() => (
        <form action={formAction} className="flex flex-col gap-4">
          <input type="hidden" name="organizationId" value={organizationId} />
          <div className="grid gap-4 sm:grid-cols-2">
            <Field label="Nature" htmlFor="rev-kind">
              <select id="rev-kind" name="kind" defaultValue="committee" className={FIELD}>
                {Object.entries(REVIEW_KIND_LABELS).map(([value, label]) => (
                  <option key={value} value={value}>{label}</option>
                ))}
              </select>
            </Field>
            <Field
              label="Date"
              htmlFor="rev-date"
              error={errors.scheduledOn}
              hint={suggested.committee ? `Cadence attendue : comité le ${suggested.committee}${suggested.direction ? `, direction le ${suggested.direction}` : ''}.` : undefined}
            >
              <input id="rev-date" name="scheduledOn" type="date" required defaultValue={suggested.committee ?? ''} className={FIELD} />
            </Field>
          </div>
          <Field label="Présidée par" htmlFor="rev-chair" optional>
            <select id="rev-chair" name="chairedBy" defaultValue="" className={FIELD}>
              <option value="">— À désigner</option>
              {people.map((p) => (
                <option key={p.id} value={p.id}>{p.label}</option>
              ))}
            </select>
          </Field>
          <Field label="Participants attendus" htmlFor="rev-attendees" optional hint="Un par ligne.">
            <textarea id="rev-attendees" name="attendees" rows={3} className={FIELD} />
          </Field>
          <FormFeedback state={state} />
          <Submit pending={pending} idle="Planifier" />
        </form>
      )}
    </Modal>
  )
}

/** Tenir la revue : presents, compte rendu, decisions prises, prochaine date. Le compte rendu devient la preuve. */
export function HoldReviewForm({
  organizationId,
  reviewId,
  attendees,
  suggestedNext,
}: {
  organizationId: string
  reviewId: string
  attendees: string[]
  suggestedNext: string | null
}) {
  const [state, formAction, pending] = useActionState<FormState | null, FormData>(holdReview, null)
  const errors = state && !state.ok ? (state.fieldErrors ?? {}) : {}
  return (
    <Modal
      trigger="Tenir la revue"
      triggerClassName="rounded-md bg-night-900 px-3.5 py-2 text-sm font-medium text-white hover:bg-night-800"
      title="Tenir la revue"
      description="Le compte rendu est la preuve : il est déposé au registre, daté, nominatif, à valider."
    >
      {() => (
        <form action={formAction} className="flex flex-col gap-4">
          <input type="hidden" name="organizationId" value={organizationId} />
          <input type="hidden" name="reviewId" value={reviewId} />
          <div className="grid gap-4 sm:grid-cols-2">
            <Field label="Tenue le" htmlFor="hold-at" optional hint="Vide : maintenant.">
              <input id="hold-at" name="heldAt" type="datetime-local" className={FIELD} />
            </Field>
            <Field label="Prochaine revue" htmlFor="hold-next" optional hint="Vide : proposée à la cadence attendue.">
              <input id="hold-next" name="nextReviewOn" type="date" defaultValue={suggestedNext ?? ''} className={FIELD} />
            </Field>
          </div>
          <Field label="Présents" htmlFor="hold-attendees" error={errors.attendees} hint="Un par ligne.">
            <textarea id="hold-attendees" name="attendees" rows={3} required defaultValue={attendees.join('\n')} className={FIELD} />
          </Field>
          <Field label="Compte rendu" htmlFor="hold-minutes" error={errors.minutes} hint="Ce qui a été examiné, point par point de l’ordre du jour ; ce qui a été dit.">
            <textarea id="hold-minutes" name="minutes" rows={8} required className={FIELD} />
          </Field>
          <Field label="Décisions prises" htmlFor="hold-decisions" optional hint="Les décisions engageantes se soumettent ensuite sur les fiches ; ici, le relevé.">
            <textarea id="hold-decisions" name="decisionsTaken" rows={3} className={FIELD} />
          </Field>
          <Field label="Pièce jointe" htmlFor="hold-file" optional hint="Le compte rendu signé, la présentation, l’enregistrement des votes — rattaché à la preuve (25 Mo max).">
            <input id="hold-file" name="file" type="file" className="text-sm text-ink-700 file:mr-3 file:rounded-md file:border file:border-ink-200 file:bg-white file:px-3 file:py-1.5 file:text-sm file:text-ink-700 hover:file:bg-ink-100" />
          </Field>
          <FormFeedback state={state} />
          <Submit pending={pending} idle="Enregistrer la revue tenue" />
        </form>
      )}
    </Modal>
  )
}

/** Annuler une revue : pour une raison, qui se lit sur la fiche et s'imprime. */
export function CancelReviewForm({ organizationId, reviewId }: { organizationId: string; reviewId: string }) {
  const [state, formAction, pending] = useActionState<FormState | null, FormData>(cancelReview, null)
  const errors = state && !state.ok ? (state.fieldErrors ?? {}) : {}
  return (
    <Modal
      trigger="Annuler"
      triggerClassName="text-xs text-ink-400 hover:text-stop-600 hover:underline"
      title="Annuler la revue"
      description="Une revue s’annule pour une raison. Elle reste au registre, avec son motif."
    >
      {() => (
        <form action={formAction} className="flex flex-col gap-4">
          <input type="hidden" name="organizationId" value={organizationId} />
          <input type="hidden" name="reviewId" value={reviewId} />
          <Field label="Motif" htmlFor={`cancel-${reviewId}`} error={errors.reason}>
            <textarea id={`cancel-${reviewId}`} name="reason" rows={3} required className={FIELD} />
          </Field>
          <FormFeedback state={state} />
          <Submit pending={pending} idle="Annuler la revue" />
        </form>
      )}
    </Modal>
  )
}

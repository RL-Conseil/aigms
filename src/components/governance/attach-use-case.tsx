'use client'

import Link from 'next/link'
import { useActionState } from 'react'
import { attachUseCaseToActivity, type FormState } from '@/lib/actions/governance'
import { Field, FIELD, FormFeedback, Submit } from '@/components/forms'
import { Modal } from '@/components/modal'

/**
 * Le « + » d'une activite : rattacher un cas d'usage existant.
 *
 * Un cas d'usage declare depuis la vue d'ensemble flotte, sans activite. Le
 * geste attendu ici est de le poser au bon endroit ; declarer un nouveau cas
 * d'usage est l'autre geste, propose en second, et il se fait depuis la vue
 * d'ensemble avec l'activite pre-remplie.
 */
export function AttachUseCaseButton({
  organizationId,
  activityId,
  activityName,
  candidates,
}: {
  organizationId: string
  activityId: string
  activityName: string
  /** Cas d'usage de l'organisation rattaches ailleurs ou nulle part. */
  candidates: { id: string; name: string; business_ref: string; activity_name: string | null }[]
}) {
  const [state, formAction, pending] = useActionState<FormState | null, FormData>(
    attachUseCaseToActivity,
    null,
  )
  const errors = state && !state.ok ? (state.fieldErrors ?? {}) : {}
  const floating = candidates.filter((c) => !c.activity_name)
  const elsewhere = candidates.filter((c) => c.activity_name)

  return (
    <Modal
      trigger="+"
      triggerLabel={`Rattacher un cas d’usage à ${activityName}`}
      triggerClassName="inline-flex size-6 items-center justify-center rounded-full border border-dashed border-ink-300 text-sm leading-none text-ink-500 hover:border-brand-500 hover:text-brand-700"
      title={`Rattacher un cas d’usage à « ${activityName} »`}
      description="Un cas d’usage déjà déclaré, à poser ici. Pour en déclarer un nouveau, passer par la vue d’ensemble."
    >
      {() => (
        <form action={formAction} className="flex flex-col gap-4">
          <input type="hidden" name="organizationId" value={organizationId} />
          <input type="hidden" name="activityId" value={activityId} />

          {candidates.length ? (
            <Field
              label="Cas d’usage"
              htmlFor={`attach-${activityId}`}
              error={errors.useCaseId}
              hint={
                elsewhere.length
                  ? 'Ceux déjà rattachés ailleurs changent d’activité : leur cartographie suit.'
                  : undefined
              }
            >
              <select id={`attach-${activityId}`} name="useCaseId" defaultValue="" required className={FIELD}>
                <option value="" disabled>
                  — Choisir
                </option>
                {floating.length ? (
                  <optgroup label="Sans activité">
                    {floating.map((c) => (
                      <option key={c.id} value={c.id}>
                        {c.business_ref} — {c.name}
                      </option>
                    ))}
                  </optgroup>
                ) : null}
                {elsewhere.length ? (
                  <optgroup label="Rattachés à une autre activité">
                    {elsewhere.map((c) => (
                      <option key={c.id} value={c.id}>
                        {c.business_ref} — {c.name} ({c.activity_name})
                      </option>
                    ))}
                  </optgroup>
                ) : null}
              </select>
            </Field>
          ) : (
            <p className="rounded-md border border-ink-200 bg-ink-50 px-3.5 py-3 text-sm text-ink-600">
              Aucun cas d’usage à rattacher : tous ceux de l’organisation sont déjà sur cette activité,
              ou aucun n’est déclaré.
            </p>
          )}

          <FormFeedback state={state} />

          <div className="flex flex-wrap items-center gap-3">
            {candidates.length ? <Submit pending={pending} idle="Rattacher" /> : null}
            <Link
              href={`/admin/organizations/${organizationId}/cas-d-usage/nouveau?activite=${activityId}`}
              className="text-sm text-brand-600 hover:underline"
            >
              Déclarer un nouveau cas d’usage sur cette activité
            </Link>
          </div>
        </form>
      )}
    </Modal>
  )
}

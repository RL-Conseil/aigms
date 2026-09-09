'use client'

import { useActionState, useState } from 'react'
import { decideApplicability, type FormState } from '@/lib/actions/soa'
import { FIELD, FormFeedback } from '@/components/forms'

/**
 * Decision d'applicabilite, exigence par exigence.
 *
 * Le formulaire est replie tant qu'une decision existe, et ouvert quand il n'y
 * en a pas : ce qui reste a faire se voit sans avoir a chercher.
 */

export function SoaDecisionForm({
  organizationId,
  requirementId,
  reference,
  currentStatus,
  currentJustification,
  expectation,
}: {
  organizationId: string
  requirementId: string
  reference: string
  currentStatus: 'selected' | 'excluded' | null
  currentJustification: string | null
  /** Ce que la criticite attendue exige, rappele au moment d'ecrire. */
  expectation: string
}) {
  const [state, formAction, pending] = useActionState<FormState | null, FormData>(
    decideApplicability,
    null,
  )

  // Le volet s'ouvre de lui-meme sur une exigence sans decision, puis suit
  // l'utilisateur. Il reste ouvert des qu'une reponse est revenue : sans cela,
  // la revalidation le refermerait en emportant la confirmation — ou le refus —
  // au moment precis ou elle informe.
  const [open, setOpen] = useState(currentStatus === null)

  return (
    <details
      className="mt-3"
      open={open || state !== null}
      onToggle={(event) => setOpen(event.currentTarget.open)}
    >
      <summary className="cursor-pointer list-none text-xs font-medium text-brand-600 hover:underline">
        {currentStatus === null ? 'Décider — sélectionner ou exclure' : 'Modifier la décision'}
      </summary>

      <form action={formAction} className="mt-2.5 flex flex-col gap-2.5">
        <input type="hidden" name="organizationId" value={organizationId} />
        <input type="hidden" name="requirementId" value={requirementId} />

        <p className="text-xs leading-relaxed text-ink-500">{expectation}</p>

        <div className="flex flex-wrap gap-4">
          <label className="flex items-center gap-1.5 text-sm">
            <input
              type="radio"
              name="status"
              value="selected"
              defaultChecked={currentStatus !== 'excluded'}
              className="accent-[oklch(0.45_0.11_245)]"
            />
            Sélectionnée
          </label>
          <label className="flex items-center gap-1.5 text-sm">
            <input
              type="radio"
              name="status"
              value="excluded"
              defaultChecked={currentStatus === 'excluded'}
              className="accent-[oklch(0.45_0.11_245)]"
            />
            Exclue
          </label>
        </div>

        <label className="sr-only" htmlFor={`justification-${requirementId}`}>
          Justification pour {reference}
        </label>
        <textarea
          id={`justification-${requirementId}`}
          name="justification"
          rows={3}
          required
          defaultValue={currentJustification ?? ''}
          placeholder="Pourquoi cette exigence s’applique — ou pourquoi le profil d’activité ne la rencontre pas."
          className={`${FIELD} text-sm`}
        />

        <button
          type="submit"
          disabled={pending}
          className="self-start rounded-md bg-night-900 px-4 py-1.5 text-xs font-medium text-white hover:bg-night-800 disabled:opacity-60"
        >
          {pending ? 'Enregistrement…' : 'Porter la décision'}
        </button>

        <FormFeedback state={state} />
      </form>
    </details>
  )
}

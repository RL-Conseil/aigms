'use client'

import { useActionState } from 'react'
import { transitionUseCase, type ActionState } from '@/lib/actions/use-case'
import {
  USE_CASE_STATUS_LABELS,
  type UseCaseStatus,
} from '@/lib/domain/governance'
import { GateChecklist } from '@/components/gate-checklist'

/**
 * Demande de transition.
 *
 * Le formulaire n'anticipe aucune regle : il propose les transitions et laisse
 * le serveur repondre. Un refus est affiche avec le detail des preconditions
 * manquantes, ce qui indique quoi corriger.
 */
export function TransitionPanel({
  useCaseId,
  targets,
}: {
  useCaseId: string
  targets: UseCaseStatus[]
}) {
  const [state, formAction, pending] = useActionState<ActionState | null, FormData>(
    transitionUseCase,
    null,
  )

  if (targets.length === 0) {
    return <p className="text-sm text-ink-400">Aucune transition disponible depuis ce statut.</p>
  }

  return (
    <div className="space-y-4">
      <form action={formAction} className="space-y-3">
        <input type="hidden" name="useCaseId" value={useCaseId} />

        <div>
          <label htmlFor="target" className="block text-xs font-medium text-ink-600">
            Transition demandée
          </label>
          <select
            id="target"
            name="target"
            className="mt-1 w-full rounded-md border border-ink-200 px-3 py-2 text-sm"
            defaultValue={targets[0]}
          >
            {targets.map((t) => (
              <option key={t} value={t}>
                {USE_CASE_STATUS_LABELS[t]}
              </option>
            ))}
          </select>
        </div>

        <div>
          <label htmlFor="rationale" className="block text-xs font-medium text-ink-600">
            Justification
          </label>
          <textarea
            id="rationale"
            name="rationale"
            rows={2}
            className="mt-1 w-full rounded-md border border-ink-200 px-3 py-2 text-sm"
            placeholder="Motif consigné dans le journal d'audit."
          />
        </div>

        <button
          type="submit"
          disabled={pending}
          className="rounded-md bg-brand-600 px-3 py-2 text-sm font-medium text-white disabled:opacity-60"
        >
          {pending ? 'Évaluation…' : 'Demander la transition'}
        </button>
      </form>

      {state ? (
        <div
          role="status"
          className={`rounded-md border p-3 ${
            state.ok && state.result.transitioned
              ? 'border-emerald-200 bg-emerald-50'
              : 'border-rose-200 bg-rose-50'
          }`}
        >
          <p className="text-sm font-medium text-ink-900">
            {state.ok ? state.result.message : state.message}
          </p>

          {state.ok && state.result.gate && !state.result.gate.satisfied ? (
            <div className="mt-3">
              <GateChecklist gate={state.result.gate} />
            </div>
          ) : null}
        </div>
      ) : null}
    </div>
  )
}

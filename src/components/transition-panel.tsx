'use client'

import { useActionState, useState } from 'react'
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
 *
 * UNE SEULE EXCEPTION, et elle avertit sans empecher : les risques non soldes
 * avant une mise en service. Le gate PRODUCTION ne refuse que sur les risques
 * ELEVES ou CRITIQUES ; un risque modere jamais traite passe. Et SURVEILLANCE
 * n'a aucune precondition — c'est une transition de suivi. Dans les deux cas,
 * le systeme fonctionne sous des risques que personne n'a soldes, et la
 * personne doit le savoir AVANT de demander la transition, pas le decouvrir
 * dans le journal d'audit.
 */
const SERVICE_TARGETS: UseCaseStatus[] = ['PRODUCTION', 'MONITORING']

export function TransitionPanel({
  useCaseId,
  targets,
  unsettledRisks = 0,
  unassessedRisks = 0,
}: {
  useCaseId: string
  targets: UseCaseStatus[]
  /** Risques ni traites, ni acceptes, ni clos. */
  unsettledRisks?: number
  /** Parmi eux, ceux qui n'ont jamais ete recotes : le risque reste brut. */
  unassessedRisks?: number
}) {
  const [target, setTarget] = useState<UseCaseStatus | undefined>(targets[0])
  const warn = unsettledRisks > 0 && target !== undefined && SERVICE_TARGETS.includes(target)
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
            value={target}
            onChange={(event) => setTarget(event.target.value as UseCaseStatus)}
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
            Motif de la transition
          </label>
          <textarea
            id="rationale"
            name="rationale"
            rows={2}
            required
            minLength={10}
            className="mt-1 w-full rounded-md border border-ink-200 px-3 py-2 text-sm"
            placeholder="Pourquoi ce changement d’état, maintenant."
          />
          <p className="mt-1 text-xs leading-relaxed text-ink-500">
            Consigné au journal avec la transition — refus compris. C’est la seule phrase qui dira,
            dans six mois, pourquoi ce cas d’usage a changé d’état.
          </p>
        </div>

        {warn ? (
          <p
            role="alert"
            className="rounded-md border border-stop-600/30 bg-stop-600/5 px-3.5 py-3 text-xs leading-relaxed text-ink-700"
          >
            <strong className="font-semibold text-stop-600">
              {unsettledRisks} risque{unsettledRisks > 1 ? 's' : ''} ni traité
              {unsettledRisks > 1 ? 's' : ''} ni accepté{unsettledRisks > 1 ? 's' : ''}
            </strong>
            {unassessedRisks > 0
              ? `, dont ${unassessedRisks} jamais recoté${unassessedRisks > 1 ? 's' : ''} après traitement — le risque reste brut.`
              : '.'}{' '}
            {target === 'PRODUCTION'
              ? 'Le passage en production sera refusé si l’un d’eux est élevé ou critique ; les autres passeront sans être vus.'
              : 'La mise sous surveillance n’a aucune précondition : rien ne s’y opposera.'}{' '}
            Traiter ou accepter un risque est un acte nominatif, daté et justifié — le faire après
            coup ne rétablit pas la trace.
          </p>
        ) : null}

        <button
          type="submit"
          disabled={pending}
          className="rounded-md bg-brand-600 px-3 py-2 text-sm font-medium text-white disabled:opacity-60"
        >
          {pending ? 'Évaluation…' : warn ? 'Demander la transition malgré tout' : 'Demander la transition'}
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

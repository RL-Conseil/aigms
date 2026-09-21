import type { ReactNode } from 'react'
import { InfoTip } from '@/components/info-tip'
import {
  GATED_STEPS,
  LIFECYCLE_STEPS,
  USE_CASE_STATUS_LABELS,
  type UseCaseStatus,
} from '@/lib/domain/governance'

/**
 * Avancement du cas d'usage : la barre des jalons.
 *
 * La frise disait ou l'on en est ; elle ne disait pas ou l'on sera arrete. Deux
 * etapes portent un point de passage substantiel — REVUE et PRODUCTION — et le
 * serveur y refuse la transition tant que les preconditions manquent. Les
 * marquer evite de decouvrir le refus au moment de le subir.
 *
 * Les statuts hors parcours nominal (rejete, retire, approbation sous
 * conditions) sont annonces a part plutot que glisses dans la frise : les y
 * mettre laisserait croire a une progression, alors que ce sont des sorties.
 */
export function Lifecycle({
  status,
  gates = {},
}: {
  status: UseCaseStatus
  /**
   * Pour chaque jalon, ce qu'on montre en infobulle : la liste de ses
   * preconditions, evaluees en continu. Le jalon dit ainsi lui-meme ce qui
   * lui manque — sans carte a part.
   */
  gates?: Partial<Record<UseCaseStatus, { summary: string; satisfied: boolean | null; content: ReactNode }>>
}) {
  const currentIndex = LIFECYCLE_STEPS.indexOf(status)
  const offPath = currentIndex === -1

  return (
    <div>
      <p className="mb-2 text-xs font-semibold uppercase tracking-wide text-ink-500">
        Avancement du cas d’usage
      </p>

      <ol className="flex flex-wrap items-center gap-1.5">
        {LIFECYCLE_STEPS.map((step, index) => {
          const reached = !offPath && index <= currentIndex
          const current = !offPath && index === currentIndex
          const gated = GATED_STEPS.includes(step)

          const gate = gates[step]
          return (
            <li key={step} className="flex items-center gap-1">
              <span
                aria-current={current ? 'step' : undefined}
                title={gated ? 'Jalon obligatoire : passage évalué côté serveur' : undefined}
                className={`inline-flex items-center gap-1.5 rounded px-2 py-1 text-xs font-medium ${
                  current
                    ? 'bg-brand-600 text-white'
                    : reached
                      ? 'bg-brand-500/15 text-brand-600'
                      : 'bg-ink-100 text-ink-400'
                } ${gated ? 'ring-1 ring-inset ring-night-900/40' : ''}`}
              >
                {gated ? (
                  <span aria-hidden className={current ? 'text-white' : 'text-night-900'}>
                    ◆
                  </span>
                ) : null}
                {USE_CASE_STATUS_LABELS[step]}
                {gated ? <span className="sr-only"> — jalon obligatoire</span> : null}
              </span>
              {gate ? (
                <InfoTip
                  label={`Préconditions du jalon ${USE_CASE_STATUS_LABELS[step]}`}
                  title={`Jalon ${USE_CASE_STATUS_LABELS[step]} — ${gate.summary}`}
                  tone={gate.satisfied === null ? 'neutral' : gate.satisfied ? 'ok' : 'todo'}
                  align="left"
                >
                  {gate.content}
                </InfoTip>
              ) : null}
            </li>
          )
        })}
      </ol>

      <p className="mt-2 text-xs text-ink-500">
        <span aria-hidden className="mr-1 text-night-900">
          ◆
        </span>
        Jalon obligatoire — le passage est refusé côté serveur tant que les préconditions ne sont
        pas réunies. Le « i » du jalon les liste, évaluées en continu.
      </p>

      {offPath ? (
        <p className="mt-2 text-xs text-ink-600">
          Statut courant hors parcours nominal : {USE_CASE_STATUS_LABELS[status]}.
        </p>
      ) : null}
    </div>
  )
}

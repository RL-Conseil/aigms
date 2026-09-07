import {
  LIFECYCLE_STEPS,
  USE_CASE_STATUS_LABELS,
  type UseCaseStatus,
} from '@/lib/domain/governance'

/** Fil de vie du cas d'usage. Les statuts hors parcours nominal sont annonces a part. */
export function Lifecycle({ status }: { status: UseCaseStatus }) {
  const currentIndex = LIFECYCLE_STEPS.indexOf(status)
  const offPath = currentIndex === -1

  return (
    <div>
      <ol className="flex flex-wrap items-center gap-1.5">
        {LIFECYCLE_STEPS.map((step, index) => {
          const reached = !offPath && index <= currentIndex
          const current = !offPath && index === currentIndex
          return (
            <li key={step}>
              <span
                aria-current={current ? 'step' : undefined}
                className={`inline-flex rounded px-2 py-1 text-xs font-medium ${
                  current
                    ? 'bg-brand-600 text-white'
                    : reached
                      ? 'bg-brand-500/15 text-brand-600'
                      : 'bg-ink-100 text-ink-400'
                }`}
              >
                {USE_CASE_STATUS_LABELS[step]}
              </span>
            </li>
          )
        })}
      </ol>
      {offPath ? (
        <p className="mt-2 text-xs text-ink-600">
          Statut courant hors parcours nominal : {USE_CASE_STATUS_LABELS[status]}.
        </p>
      ) : null}
    </div>
  )
}

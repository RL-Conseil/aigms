import Link from 'next/link'

/**
 * Rubriques de la fiche d'un cas d'usage.
 *
 * La fiche empilait treize cartes : on faisait defiler pour trouver, et l'on
 * perdait de vue les chiffres du bandeau. Elle se lit maintenant par rubrique,
 * une a la fois, le bandeau et le fil conducteur restant en place. C'est un
 * poste de travail : on y pilote TOUT ce qui concerne ce cas d'usage, sans
 * changer de page.
 *
 * La rubrique ouverte passe par l'URL : elle se partage, un lien y conduit
 * directement (une alerte, un tableau de bord), et un enregistrement — qui
 * revalide la page — ne la referme pas.
 */
export const USE_CASE_TABS = [
  { key: 'fil', label: 'Fil conducteur' },
  { key: 'actions', label: 'Actions' },
  { key: 'controles', label: 'Contrôles affectés' },
  { key: 'risques', label: 'Risques' },
  { key: 'impact', label: 'Évaluation d’impact' },
  { key: 'supervision', label: 'Supervision humaine' },
  { key: 'decisions', label: 'Décisions' },
  { key: 'changements', label: 'Changements' },
  { key: 'incidents', label: 'Incidents' },
  { key: 'journal', label: 'Journal' },
] as const

export type UseCaseTab = (typeof USE_CASE_TABS)[number]['key']

export function resolveTab(value: string | undefined): UseCaseTab {
  return USE_CASE_TABS.some((t) => t.key === value) ? (value as UseCaseTab) : 'fil'
}

export type TabSignal = {
  /** Un chiffre a montrer : ce qui est ouvert, en attente, a faire. */
  count?: number
  /** Ce que le chiffre — ou son absence — veut dire. */
  tone?: 'todo' | 'late' | 'done' | 'neutral'
}

export function UseCaseTabs({
  useCaseId,
  active,
  signals,
}: {
  useCaseId: string
  active: UseCaseTab
  signals: Partial<Record<UseCaseTab, TabSignal>>
}) {
  return (
    <nav
      aria-label="Rubriques du cas d’usage"
      className="mb-5 -mx-1 flex gap-1 overflow-x-auto border-b border-ink-200 px-1"
    >
      {USE_CASE_TABS.map((tab) => {
        const current = tab.key === active
        const signal = signals[tab.key]
        const dot =
          signal?.tone === 'late'
            ? 'bg-stop-600'
            : signal?.tone === 'todo'
              ? 'bg-warn-600'
              : signal?.tone === 'done'
                ? 'bg-ok-600'
                : null
        return (
          <Link
            key={tab.key}
            href={`/admin/use-cases/${useCaseId}?onglet=${tab.key}`}
            scroll={false}
            aria-current={current ? 'page' : undefined}
            className={`-mb-px inline-flex shrink-0 items-center gap-1.5 whitespace-nowrap border-b-2 px-3 py-2.5 text-sm transition-colors ${
              current
                ? 'border-night-900 font-medium text-ink-900'
                : 'border-transparent text-ink-500 hover:border-ink-300 hover:text-ink-900'
            }`}
          >
            {dot ? <span aria-hidden className={`size-1.5 rounded-full ${dot}`} /> : null}
            {tab.label}
            {signal?.count ? (
              <span
                className={`inline-flex min-w-[1.25rem] items-center justify-center rounded-full px-1.5 py-0.5 text-[11px] font-semibold tabular-nums ${
                  signal.tone === 'late'
                    ? 'bg-stop-600/10 text-stop-600'
                    : signal.tone === 'todo'
                      ? 'bg-warn-600/10 text-warn-600'
                      : 'bg-ink-100 text-ink-600'
                }`}
              >
                {signal.count}
              </span>
            ) : null}
          </Link>
        )
      })}
    </nav>
  )
}

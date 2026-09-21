import Link from 'next/link'

/**
 * Rubriques de la fiche d'un cas d'usage.
 *
 * La fiche empilait treize cartes : on faisait defiler pour trouver, et l'on
 * perdait de vue les chiffres du bandeau. Elle se lit maintenant par rubrique,
 * une a la fois, le bandeau et l'avancement restant en place. C'est un
 * poste de travail : on y pilote TOUT ce qui concerne ce cas d'usage, sans
 * changer de page.
 *
 * La rubrique ouverte passe par l'URL : elle se partage, un lien y conduit
 * directement (une alerte, un tableau de bord), et un enregistrement — qui
 * revalide la page — ne la referme pas.
 */
export const USE_CASE_TABS = [
  { key: 'avancement', label: 'Avancement' },
  { key: 'controles', label: 'Contrôles affectés' },
  { key: 'risques', label: 'Risques' },
  { key: 'suivi', label: 'Actions et incidents' },
  { key: 'supervision', label: 'Supervision humaine' },
  { key: 'decisions', label: 'Décisions et changements' },
  { key: 'impact', label: 'Évaluation d’impact' },
] as const

export type UseCaseTab = (typeof USE_CASE_TABS)[number]['key']

/** Sous-vues de « Actions et incidents ». */
export type SuiviView = 'actions' | 'incidents'

/**
 * Les anciennes adresses restent valides : les alertes en base et les liens
 * partages pointent encore sur `?onglet=actions`, `incidents`, `fil` ou
 * `changements`. Chacune trouve sa rubrique — et sa sous-vue.
 */
const TAB_ALIASES: Record<string, { tab: UseCaseTab; vue?: SuiviView }> = {
  fil: { tab: 'avancement' },
  actions: { tab: 'suivi', vue: 'actions' },
  incidents: { tab: 'suivi', vue: 'incidents' },
  changements: { tab: 'decisions' },
  journal: { tab: 'avancement' },
}

export function resolveTab(value: string | undefined, vue?: string): { tab: UseCaseTab; vue: SuiviView } {
  const alias = value ? TAB_ALIASES[value] : undefined
  if (alias) return { tab: alias.tab, vue: alias.vue ?? 'actions' }
  const tab = USE_CASE_TABS.some((t) => t.key === value) ? (value as UseCaseTab) : 'avancement'
  return { tab, vue: vue === 'incidents' ? 'incidents' : 'actions' }
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

/**
 * Le sélecteur de « Actions et incidents » : ce qui reste à faire, ce qui
 * s'est passé. Deux listes sous une même rubrique, parce qu'elles se lisent
 * ensemble — une action naît souvent d'un incident.
 */
export function SuiviSwitch({
  useCaseId,
  active,
  actions,
  incidents,
}: {
  useCaseId: string
  active: SuiviView
  actions: number
  incidents: number
}) {
  const options: { key: SuiviView; label: string; count: number }[] = [
    { key: 'actions', label: 'Actions', count: actions },
    { key: 'incidents', label: 'Incidents', count: incidents },
  ]
  return (
    <nav aria-label="Actions ou incidents" className="mb-4 inline-flex rounded-md border border-ink-200 bg-white p-0.5">
      {options.map((o) => (
        <Link
          key={o.key}
          href={`/admin/use-cases/${useCaseId}?onglet=suivi&vue=${o.key}`}
          scroll={false}
          aria-current={active === o.key ? 'page' : undefined}
          className={`inline-flex items-center gap-1.5 rounded px-3 py-1.5 text-sm ${
            active === o.key ? 'bg-night-900 font-medium text-white' : 'text-ink-600 hover:bg-ink-100'
          }`}
        >
          {o.label}
          {o.count ? (
            <span className={`tabular-nums ${active === o.key ? 'text-white/70' : 'text-ink-400'}`}>{o.count}</span>
          ) : null}
        </Link>
      ))}
    </nav>
  )
}

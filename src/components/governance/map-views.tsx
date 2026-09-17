import Link from 'next/link'
import { Badge, Card, Empty, ScrollTable } from '@/components/ui'
import { RISK_LEVEL_LABELS, formatDate, type RiskLevel } from '@/lib/domain/governance'

/**
 * Lectures alternatives du meme modele.
 *
 * SPEC_PROCESS le formule ainsi : « le meme modele de donnees fournit
 * differentes lectures ». L'arbre montre ce que fait l'organisation ; la
 * couverture montre ce qui tient ; la carte thermique montre ou se concentre
 * l'exposition. Un seul jeu de donnees, trois questions.
 */

export type CoverageRow = {
  process_id: string
  process_name: string
  activity_id: string
  activity_name: string
  use_case_count: number
  max_risk_level: RiskLevel | null
  controls_total: number
  controls_operating: number
  controls_evidenced: number
  coverage_percent: number | null
  mandatory_total: number
  mandatory_settled: number
  last_tested_at: string | null
  days_since_test: number | null
}

/** Activites porteuses de risques eleves ouverts, pour descendre sous le niveau. */
export type RiskyActivity = {
  process_id: string
  activity_id: string
  activity_name: string
  open_high_risks: number
}

export type HeatmapRow = {
  process_id: string
  process_name: string
  process_order: number
  risk_level: RiskLevel
  risk_count: number
  open_count: number
  accepted_count: number
}

function coverageTone(percent: number | null) {
  if (percent === null) return 'text-ink-400'
  if (percent >= 90) return 'text-emerald-700'
  if (percent >= 60) return 'text-amber-700'
  return 'text-rose-700'
}

function stalenessTone(days: number | null) {
  if (days === null) return 'text-ink-400'
  if (days > 180) return 'text-rose-700'
  if (days > 90) return 'text-amber-700'
  return 'text-ink-600'
}

// -----------------------------------------------------------------------------
// Couverture des contrôles
// -----------------------------------------------------------------------------
export function CoverageTable({
  rows,
  organizationId,
}: {
  rows: CoverageRow[]
  organizationId: string
}) {
  const withControls = rows.filter((r) => r.controls_total > 0)
  return withControls.length ? (
          <ScrollTable>
            <table className="w-full min-w-[720px] text-sm">
              <thead>
                <tr className="border-b border-ink-200 text-left text-xs uppercase tracking-wide text-ink-400">
                  <th scope="col" className="pb-2 pr-4 font-medium">Activité</th>
                  <th scope="col" className="pb-2 pr-4 font-medium">Usages</th>
                  <th scope="col" className="pb-2 pr-4 font-medium">Risque</th>
                  <th scope="col" className="pb-2 pr-4 font-medium">Contrôles</th>
                  <th scope="col" className="pb-2 pr-4 font-medium">Opérants</th>
                  <th scope="col" className="pb-2 pr-4 font-medium">Prouvés</th>
                  <th scope="col" className="pb-2 pr-4 font-medium">Couverture</th>
                  <th scope="col" className="pb-2 font-medium">Dernier test</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-ink-100">
                {withControls.map((row) => (
                  <tr key={row.activity_id}>
                    <td className="py-3 pr-4">
                      <Link
                        href={`/admin/organizations/${organizationId}/processus?activite=${row.activity_id}`}
                        className="text-brand-600 hover:underline"
                      >
                        {row.activity_name}
                      </Link>
                      <span className="block text-xs text-ink-400">{row.process_name}</span>
                    </td>
                    <td className="py-3 pr-4 tabular-nums">{row.use_case_count}</td>
                    <td className="py-3 pr-4">
                      {row.max_risk_level ? (
                        <Badge
                          tone={
                            row.max_risk_level === 'critical' || row.max_risk_level === 'high'
                              ? 'stop'
                              : row.max_risk_level === 'moderate'
                                ? 'warn'
                                : 'neutral'
                          }
                        >
                          {RISK_LEVEL_LABELS[row.max_risk_level]}
                        </Badge>
                      ) : (
                        <span className="text-ink-400">—</span>
                      )}
                    </td>
                    <td className="py-3 pr-4 tabular-nums">{row.controls_total}</td>
                    <td className="py-3 pr-4 tabular-nums">{row.controls_operating}</td>
                    <td className="py-3 pr-4 tabular-nums">{row.controls_evidenced}</td>
                    <td className={`py-3 pr-4 font-medium tabular-nums ${coverageTone(row.coverage_percent)}`}>
                      {row.coverage_percent === null ? '—' : `${row.coverage_percent} %`}
                    </td>
                    <td className={`py-3 tabular-nums ${stalenessTone(row.days_since_test)}`}>
                      {row.days_since_test === null
                        ? 'jamais'
                        : `${row.days_since_test} j`}
                      {row.last_tested_at ? (
                        <span className="block text-xs text-ink-400">
                          {formatDate(row.last_tested_at)}
                        </span>
                      ) : null}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </ScrollTable>
        ) : (
          <Empty>
            Aucun contrôle affecté à une activité. Les contrôles se rattachent aux cas d’usage par
            leur applicabilité.
          </Empty>
        )
}

/** Activites ou l'IA intervient sans qu'aucun controle ne les encadre. */
export function UncoveredActivities({
  rows,
  organizationId,
}: {
  rows: CoverageRow[]
  organizationId: string
}) {
  const without = rows.filter((r) => r.controls_total === 0 && r.use_case_count > 0)
  return without.length ? (
        <Card
          title="Activités sans contrôle affecté"
          subtitle="Des usages d’IA y sont déclarés, mais aucun contrôle ne les encadre."
        >
          <ul className="flex flex-col gap-2">
            {without.map((row) => (
              <li key={row.activity_id} className="flex items-center justify-between gap-3">
                <Link
                  href={`/admin/organizations/${organizationId}/processus?activite=${row.activity_id}`}
                  className="text-sm text-brand-600 hover:underline"
                >
                  {row.activity_name}
                </Link>
                <span className="text-xs text-ink-400">
                  {row.use_case_count} usage{row.use_case_count > 1 ? 's' : ''}
                </span>
              </li>
            ))}
          </ul>
        </Card>
      ) : null
}

// -----------------------------------------------------------------------------
// Carte thermique des risques
// -----------------------------------------------------------------------------
export function SevereRisksCard({
  rows,
  activities = [],
  organizationId,
}: {
  rows: HeatmapRow[]
  activities?: RiskyActivity[]
  organizationId: string
}) {
  // Regroupe par niveau, le critique d'abord : c'est l'ordre dans lequel on
  // traite, pas l'ordre alphabetique.
  const severe = (['critical', 'high'] as RiskLevel[])
    .map(
      (level) =>
        [level, rows.filter((r) => r.risk_level === level && r.open_count > 0)] as const,
    )
    .filter(([, processRows]) => processRows.length)

  /*
    La barre dit COMBIEN et OU, par niveau. Elle ne dit pas ou aller : un
    processus n'est pas une destination, une activite l'est. On descend donc
    d'un cran — niveau, puis processus, puis activites cliquables.
  */
  return (
      <Card title="Risques ouverts les plus élevés" tone={severe.length ? 'stop' : 'neutral'}>
        {severe.length ? (
          <div className="flex flex-col gap-5">
            {severe.map(([level, processRows]) => (
              <div key={level}>
                <p className="mb-2 text-xs font-semibold uppercase tracking-wide text-stop-600">
                  {RISK_LEVEL_LABELS[level as RiskLevel]}
                </p>
                <ul className="flex flex-col gap-3">
                  {processRows.map((row) => {
                    const carriers = activities.filter(
                      (a) => a.process_id === row.process_id && a.open_high_risks > 0,
                    )
                    return (
                      <li key={`${row.process_id}-${level}`}>
                        <div className="flex items-baseline justify-between gap-3">
                          <span className="text-sm font-medium text-ink-900">
                            {row.process_name}
                          </span>
                          <Badge tone="stop">
                            {row.open_count} ouvert{row.open_count > 1 ? 's' : ''}
                          </Badge>
                        </div>
                        {carriers.length ? (
                          <ul className="mt-1 flex flex-wrap gap-2">
                            {carriers.map((activity) => (
                              <li key={activity.activity_id}>
                                <Link
                                  href={`/admin/organizations/${organizationId}/processus?activite=${activity.activity_id}`}
                                  className="inline-flex items-baseline gap-1.5 rounded-md border border-ink-200 px-2.5 py-1 text-xs text-brand-600 hover:bg-ink-50"
                                >
                                  {activity.activity_name}
                                  <span className="tabular-nums text-ink-400">
                                    {activity.open_high_risks}
                                  </span>
                                </Link>
                              </li>
                            ))}
                          </ul>
                        ) : (
                          <p className="mt-1 text-xs text-ink-400">
                            Aucune activité porteuse identifiée : le cas d’usage n’est pas rattaché.
                          </p>
                        )}
                      </li>
                    )
                  })}
                </ul>
              </div>
            ))}
          </div>
        ) : (
          <p className="text-sm text-ok-600">Aucun risque élevé ou critique ouvert.</p>
        )}
      </Card>
  )
}

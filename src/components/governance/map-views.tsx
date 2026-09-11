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

export type HeatmapRow = {
  process_id: string
  process_name: string
  process_order: number
  risk_level: RiskLevel
  risk_count: number
  open_count: number
  accepted_count: number
}

const LEVELS: RiskLevel[] = ['low', 'moderate', 'high', 'critical']

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
export function CoverageView({
  rows,
  organizationId,
}: {
  rows: CoverageRow[]
  organizationId: string
}) {
  const withControls = rows.filter((r) => r.controls_total > 0)
  const without = rows.filter((r) => r.controls_total === 0 && r.use_case_count > 0)

  return (
    <div className="flex flex-col gap-5">
      <Card
        title="Couverture des contrôles"
        subtitle="Un contrôle ne compte que s’il est opérant et prouvé par une preuve validée non échue."
      >
        {withControls.length ? (
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
        )}
      </Card>

      {without.length ? (
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
      ) : null}
    </div>
  )
}

// -----------------------------------------------------------------------------
// Carte thermique des risques
// -----------------------------------------------------------------------------
export function HeatmapView({
  rows,
  organizationId,
}: {
  rows: HeatmapRow[]
  organizationId: string
}) {
  const processes = [...new Map(rows.map((r) => [r.process_id, r])).values()].sort(
    (a, b) => a.process_order - b.process_order,
  )

  const cell = (processId: string, level: RiskLevel) =>
    rows.find((r) => r.process_id === processId && r.risk_level === level)

  const total = rows.reduce((sum, r) => sum + r.risk_count, 0)

  if (!total) {
    return (
      <Card title="Répartition des risques">
        <Empty>
          Aucun risque rattaché à un processus. Un risque rejoint la carte dès que son cas d’usage
          est rattaché à une activité.
        </Empty>
      </Card>
    )
  }

  return (
    <div className="flex flex-col gap-5">
      <Card
        title="Répartition des risques"
        subtitle="Par processus et par niveau. Le chiffre en gras compte les risques encore ouverts."
      >
        <ScrollTable>
          <table className="w-full min-w-[560px] text-sm">
            <thead>
              <tr className="text-left text-xs uppercase tracking-wide text-ink-400">
                <th scope="col" className="pb-2 pr-4 font-medium">Processus</th>
                {LEVELS.map((level) => (
                  <th key={level} scope="col" className="pb-2 pr-3 text-center font-medium">
                    {RISK_LEVEL_LABELS[level]}
                  </th>
                ))}
              </tr>
            </thead>
            <tbody className="divide-y divide-ink-100">
              {processes.map((process) => (
                <tr key={process.process_id}>
                  <th scope="row" className="py-2.5 pr-4 text-left font-medium text-ink-900">
                    {process.process_name}
                  </th>
                  {LEVELS.map((level) => {
                    const data = cell(process.process_id, level)
                    const count = data?.risk_count ?? 0
                    const open = data?.open_count ?? 0

                    // L'intensité suit le nombre de risques OUVERTS : un risque
                    // accepté est une décision, pas une alerte.
                    const shade =
                      open === 0
                        ? count === 0
                          ? 'bg-ink-50 text-ink-300'
                          : 'bg-ink-100 text-ink-500'
                        : level === 'critical'
                          ? 'bg-rose-100 text-rose-900 ring-1 ring-inset ring-rose-300'
                          : level === 'high'
                            ? 'bg-rose-50 text-rose-800'
                            : level === 'moderate'
                              ? 'bg-amber-50 text-amber-800'
                              : 'bg-emerald-50 text-emerald-800'

                    return (
                      <td key={level} className="py-2.5 pr-3">
                        <div className={`rounded-md px-3 py-2 text-center ${shade}`}>
                          <span className="block text-base font-semibold tabular-nums">
                            {open || (count ? '·' : '—')}
                          </span>
                          {count > open ? (
                            <span className="block text-[11px]">
                              {count - open} traité{count - open > 1 ? 's' : ''}
                            </span>
                          ) : null}
                        </div>
                      </td>
                    )
                  })}
                </tr>
              ))}
            </tbody>
          </table>
        </ScrollTable>

        <p className="mt-4 text-xs leading-relaxed text-ink-500">
          Un risque accepté, traité ou clos n’est plus compté comme ouvert : l’acceptation est une
          décision assumée, avec un responsable et une date de revue, pas une alerte à laisser
          clignoter.
        </p>
      </Card>

      <Card title="Risques ouverts les plus élevés">
        <ul className="flex flex-col gap-2">
          {rows
            .filter((r) => r.open_count > 0 && (r.risk_level === 'high' || r.risk_level === 'critical'))
            // Le critique passe avant l'élevé, puis le nombre décroissant.
            .sort(
              (a, b) =>
                LEVELS.indexOf(b.risk_level) - LEVELS.indexOf(a.risk_level) ||
                b.open_count - a.open_count,
            )
            .map((row) => (
              <li
                key={`${row.process_id}-${row.risk_level}`}
                className="flex items-center justify-between gap-3"
              >
                <Link
                  href={`/admin/organizations/${organizationId}/processus`}
                  className="text-sm text-brand-600 hover:underline"
                >
                  {row.process_name}
                </Link>
                <Badge tone="stop">
                  {row.open_count} {RISK_LEVEL_LABELS[row.risk_level].toLowerCase()}
                </Badge>
              </li>
            ))}
          {!rows.some((r) => r.open_count > 0 && (r.risk_level === 'high' || r.risk_level === 'critical')) ? (
            <li className="text-sm text-emerald-800">
              Aucun risque élevé ou critique ouvert.
            </li>
          ) : null}
        </ul>
      </Card>
    </div>
  )
}

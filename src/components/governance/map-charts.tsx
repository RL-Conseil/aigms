import Link from 'next/link'
import { Card, Empty } from '@/components/ui'
import { RISK_LEVEL_LABELS, type RiskLevel } from '@/lib/domain/governance'
import type { CoverageRow, HeatmapRow } from '@/components/governance/map-views'

/**
 * Couverture et risques, en barres.
 *
 * Les deux lectures se posent la meme question a deux grains : par ACTIVITE,
 * la ou l'on agit ; par PROCESSUS, la ou l'on rend compte. Le meme jeu de
 * donnees sert les deux — le processus est la somme de ses activites — et
 * c'est un lien, pas un etat, qui choisit le grain : la vue se partage.
 *
 * Pas de bibliotheque : des barres en HTML se lisent au clavier, s'impriment,
 * et ne coutent rien. L'echelle est relative au plus grand total de la vue.
 */
export type Grain = 'activite' | 'processus'

export const GRAINS: { key: Grain; label: string }[] = [
  { key: 'activite', label: 'Par activité' },
  { key: 'processus', label: 'Par processus' },
]

export function GrainSwitch({ href, grain }: { href: (grain: Grain) => string; grain: Grain }) {
  return (
    <nav aria-label="Grain de lecture" className="flex rounded-md border border-ink-200 bg-white p-0.5">
      {GRAINS.map((option) => (
        <Link
          key={option.key}
          href={href(option.key)}
          scroll={false}
          aria-current={grain === option.key ? 'page' : undefined}
          className={`rounded px-2.5 py-1 text-xs ${
            grain === option.key ? 'bg-ink-900 font-medium text-white' : 'text-ink-600 hover:bg-ink-100'
          }`}
        >
          {option.label}
        </Link>
      ))}
    </nav>
  )
}

function Legend({ items }: { items: { swatch: string; label: string }[] }) {
  return (
    <ul className="mt-4 flex flex-wrap gap-x-4 gap-y-1.5 text-xs text-ink-500">
      {items.map((item) => (
        <li key={item.label} className="flex items-center gap-1.5">
          <span aria-hidden className={`inline-block size-2.5 rounded-sm ${item.swatch}`} />
          {item.label}
        </li>
      ))}
    </ul>
  )
}

// -----------------------------------------------------------------------------
// Couverture des contrôles
// -----------------------------------------------------------------------------
type CoverageBar = {
  key: string
  label: string
  sublabel?: string
  href?: string
  use_cases: number
  total: number
  operating: number
  evidenced: number
}

function coverageBars(rows: CoverageRow[], grain: Grain, organizationId: string): CoverageBar[] {
  if (grain === 'activite') {
    return rows.map((row) => ({
      key: row.activity_id,
      label: row.activity_name,
      sublabel: row.process_name,
      href: `/admin/organizations/${organizationId}/processus?activite=${row.activity_id}`,
      use_cases: row.use_case_count,
      total: row.controls_total,
      operating: row.controls_operating,
      evidenced: row.controls_evidenced,
    }))
  }
  // Un controle sert souvent plusieurs activites : au processus, on le compte
  // autant de fois qu'il y est attendu — c'est la charge de preuve reelle.
  const byProcess = new Map<string, CoverageBar>()
  for (const row of rows) {
    const bar = byProcess.get(row.process_id) ?? {
      key: row.process_id,
      label: row.process_name,
      use_cases: 0,
      total: 0,
      operating: 0,
      evidenced: 0,
    }
    bar.use_cases += row.use_case_count
    bar.total += row.controls_total
    bar.operating += row.controls_operating
    bar.evidenced += row.controls_evidenced
    byProcess.set(row.process_id, bar)
  }
  return [...byProcess.values()]
}

function percentTone(percent: number | null) {
  if (percent === null) return 'text-ink-400'
  if (percent >= 90) return 'text-emerald-700'
  if (percent >= 60) return 'text-amber-700'
  return 'text-rose-700'
}

export function CoverageChart({
  rows,
  grain,
  organizationId,
}: {
  rows: CoverageRow[]
  grain: Grain
  organizationId: string
}) {
  const bars = coverageBars(rows, grain, organizationId).filter((b) => b.total > 0 || b.use_cases > 0)
  if (!bars.length) {
    return (
      <Empty>
        Aucun contrôle affecté. Les contrôles se rattachent aux cas d’usage par leur applicabilité.
      </Empty>
    )
  }
  const max = Math.max(1, ...bars.map((b) => b.total))

  return (
    <div>
      <ol className="flex flex-col gap-3">
        {bars.map((bar) => {
          const percent = bar.total ? Math.round((bar.evidenced * 100) / bar.total) : null
          const width = (n: number) => `${(n * 100) / max}%`
          return (
            <li key={bar.key} className="grid gap-1 sm:grid-cols-[minmax(0,14rem)_1fr_auto] sm:items-center sm:gap-4">
              <div className="min-w-0">
                {bar.href ? (
                  <Link href={bar.href} scroll={false} className="block truncate text-sm text-brand-600 hover:underline">
                    {bar.label}
                  </Link>
                ) : (
                  <span className="block truncate text-sm text-ink-900">{bar.label}</span>
                )}
                <span className="block truncate text-xs text-ink-400">
                  {bar.sublabel ? `${bar.sublabel} · ` : ''}
                  {bar.use_cases} usage{bar.use_cases > 1 ? 's' : ''}
                </span>
              </div>
              <div
                role="img"
                aria-label={`${bar.evidenced} contrôle(s) prouvé(s), ${bar.operating - bar.evidenced} opérant(s) sans preuve, ${bar.total - bar.operating} déclaré(s) non opérant(s), sur ${bar.total}`}
                className="flex h-4 overflow-hidden rounded bg-ink-50"
              >
                {bar.total ? (
                  <>
                    <span className="h-full bg-emerald-500" style={{ width: width(bar.evidenced) }} />
                    <span className="h-full bg-amber-400" style={{ width: width(bar.operating - bar.evidenced) }} />
                    <span className="h-full bg-ink-200" style={{ width: width(bar.total - bar.operating) }} />
                  </>
                ) : null}
              </div>
              <span className="text-right text-xs tabular-nums text-ink-500">
                <span className={`text-sm font-semibold ${percentTone(percent)}`}>
                  {percent === null ? '—' : `${percent} %`}
                </span>
                <span className="block">
                  {bar.evidenced}/{bar.total} prouvé{bar.evidenced > 1 ? 's' : ''}
                </span>
              </span>
            </li>
          )
        })}
      </ol>
      <Legend
        items={[
          { swatch: 'bg-emerald-500', label: 'Opérant et prouvé (preuve validée, non échue)' },
          { swatch: 'bg-amber-400', label: 'Opérant, sans preuve valide' },
          { swatch: 'bg-ink-200', label: 'Applicable, pas encore opérant' },
        ]}
      />
    </div>
  )
}

// -----------------------------------------------------------------------------
// Répartition des risques
// -----------------------------------------------------------------------------
export type ActivityHeatmapRow = HeatmapRow & {
  activity_id: string
  activity_name: string
  activity_order: number
}

const LEVELS: RiskLevel[] = ['critical', 'high', 'moderate', 'low']
const LEVEL_SWATCH: Record<RiskLevel, string> = {
  critical: 'bg-rose-700',
  high: 'bg-rose-400',
  moderate: 'bg-amber-400',
  low: 'bg-emerald-400',
}

type RiskBar = {
  key: string
  label: string
  sublabel?: string
  href?: string
  open: Record<RiskLevel, number>
  settled: number
  total: number
}

export function RiskChart({
  rows,
  grain,
  organizationId,
}: {
  rows: HeatmapRow[] | ActivityHeatmapRow[]
  grain: Grain
  organizationId: string
}) {
  const bars = new Map<string, RiskBar>()
  for (const row of rows) {
    const activity = 'activity_id' in row ? (row as ActivityHeatmapRow) : null
    const key = grain === 'activite' && activity ? activity.activity_id : row.process_id
    const bar = bars.get(key) ?? {
      key,
      label: grain === 'activite' && activity ? activity.activity_name : row.process_name,
      sublabel: grain === 'activite' && activity ? row.process_name : undefined,
      href:
        grain === 'activite' && activity
          ? `/admin/organizations/${organizationId}/processus?activite=${activity.activity_id}`
          : undefined,
      open: { critical: 0, high: 0, moderate: 0, low: 0 },
      settled: 0,
      total: 0,
    }
    bar.open[row.risk_level] += row.open_count
    bar.settled += row.risk_count - row.open_count
    bar.total += row.risk_count
    bars.set(key, bar)
  }
  const list = [...bars.values()].filter((b) => b.total > 0)
  if (!list.length) {
    return (
      <Empty>
        Aucun risque rattaché. Un risque rejoint la carte dès que son cas d’usage est rattaché à
        une activité.
      </Empty>
    )
  }
  const max = Math.max(1, ...list.map((b) => b.total))

  return (
    <div>
      <ol className="flex flex-col gap-3">
        {list.map((bar) => {
          const open = LEVELS.reduce((n, level) => n + bar.open[level], 0)
          const width = (n: number) => `${(n * 100) / max}%`
          return (
            <li key={bar.key} className="grid gap-1 sm:grid-cols-[minmax(0,14rem)_1fr_auto] sm:items-center sm:gap-4">
              <div className="min-w-0">
                {bar.href ? (
                  <Link href={bar.href} scroll={false} className="block truncate text-sm text-brand-600 hover:underline">
                    {bar.label}
                  </Link>
                ) : (
                  <span className="block truncate text-sm text-ink-900">{bar.label}</span>
                )}
                {bar.sublabel ? (
                  <span className="block truncate text-xs text-ink-400">{bar.sublabel}</span>
                ) : null}
              </div>
              <div
                role="img"
                aria-label={`${open} risque(s) ouvert(s) — ${LEVELS.filter((l) => bar.open[l]).map((l) => `${bar.open[l]} ${RISK_LEVEL_LABELS[l].toLowerCase()}`).join(', ') || 'aucun'} — et ${bar.settled} traité(s) ou accepté(s)`}
                className="flex h-4 overflow-hidden rounded bg-ink-50"
              >
                {LEVELS.map((level) => (
                  <span key={level} className={`h-full ${LEVEL_SWATCH[level]}`} style={{ width: width(bar.open[level]) }} />
                ))}
                <span className="h-full bg-ink-200" style={{ width: width(bar.settled) }} />
              </div>
              <span className="text-right text-xs tabular-nums text-ink-500">
                <span className={`text-sm font-semibold ${bar.open.critical + bar.open.high ? 'text-rose-700' : open ? 'text-amber-700' : 'text-ink-400'}`}>
                  {open} ouvert{open > 1 ? 's' : ''}
                </span>
                <span className="block">{bar.settled} traité{bar.settled > 1 ? 's' : ''} ou accepté{bar.settled > 1 ? 's' : ''}</span>
              </span>
            </li>
          )
        })}
      </ol>
      <Legend
        items={[
          ...LEVELS.map((level) => ({ swatch: LEVEL_SWATCH[level], label: `${RISK_LEVEL_LABELS[level]} — ouvert` })),
          { swatch: 'bg-ink-200', label: 'Traité, accepté ou clos' },
        ]}
      />
    </div>
  )
}

export function ChartCard({
  title,
  subtitle,
  grain,
  href,
  children,
}: {
  title: string
  subtitle: string
  grain: Grain
  href: (grain: Grain) => string
  children: React.ReactNode
}) {
  return (
    <Card title={title} subtitle={subtitle} action={<GrainSwitch href={href} grain={grain} />}>
      {children}
    </Card>
  )
}

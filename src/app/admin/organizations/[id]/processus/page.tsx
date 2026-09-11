import Link from 'next/link'
import { notFound } from 'next/navigation'
import { createClient } from '@/lib/supabase/server'
import { Shell } from '@/components/shell'
import { Badge, Card, Empty } from '@/components/ui'
import { ActivityForm, ProcessForm } from '@/components/governance/process-forms'
import {
  GovernanceHealth,
  Metric,
  type Health,
} from '@/components/governance/governance-health'
import {
  CoverageView,
  HeatmapView,
  type CoverageRow,
  type HeatmapRow,
} from '@/components/governance/map-views'
import { ControlGraph, type Graph } from '@/components/governance/control-graph'
import {
  RiskPathPanel,
  RiskPicker,
  type RiskChoice,
  type RiskPath,
} from '@/components/governance/risk-path'
import {
  RISK_LEVEL_LABELS,
  USE_CASE_STATUS_LABELS,
  type RiskLevel,
  type UseCaseStatus,
} from '@/lib/domain/governance'

/**
 * Process & Risk Map.
 *
 * L'arbre annote a gauche, le detail a droite. La selection passe par l'URL :
 * le panneau est rendu cote serveur, il n'y a pas d'etat client a synchroniser,
 * et un lien vers une activite precise se partage.
 *
 * L'arbre reste volontairement en HTML et CSS : une hierarchie se lit aussi
 * bien ainsi, reste accessible au clavier et s'imprime. Le canevas n'arrive que
 * pour ce qu'un arbre ne sait pas faire — un controle qui traverse plusieurs
 * processus, une preuve mutualisee — et il vit dans la vue « Graphe ».
 */

const CATEGORY_LABELS: Record<string, string> = {
  management: 'Pilotage',
  core: 'Réalisation',
  support: 'Support',
}

type MapRow = {
  process_id: string
  process_code: string | null
  process_name: string
  process_category: string
  activity_id: string | null
  activity_ref: string | null
  activity_name: string | null
  use_case_count: number
  in_service_count: number
  max_risk_level: RiskLevel | null
  open_high_risks: number
  controls_total: number
  controls_operating: number
  evidence_total: number
  evidence_stale: number
  open_incidents: number
  overdue_actions: number
  reviews_due: number
}

function riskTone(level: RiskLevel | null) {
  if (level === 'critical' || level === 'high') return 'stop' as const
  if (level === 'moderate') return 'warn' as const
  return 'neutral' as const
}

const VIEWS = [
  { key: 'arbre', label: 'Processus' },
  { key: 'couverture', label: 'Couverture' },
  { key: 'risques', label: 'Risques' },
  { key: 'graphe', label: 'Graphe' },
] as const

type ViewKey = (typeof VIEWS)[number]['key']

export default async function ProcessMapPage({
  params,
  searchParams,
}: {
  params: Promise<{ id: string }>
  searchParams: Promise<{ activite?: string; vue?: string; risque?: string }>
}) {
  const { id } = await params
  const { activite, vue, risque } = await searchParams
  const view: ViewKey = VIEWS.some((v) => v.key === vue) ? (vue as ViewKey) : 'arbre'
  const supabase = await createClient()

  const [{ data: organization }, { data: mapRows }, { data: healthData }, { data: processes }] =
    await Promise.all([
      supabase.from('organization').select('id, name, business_ref').eq('id', id).maybeSingle(),
      supabase.rpc('process_map', { p_organization_id: id }),
      supabase.rpc('governance_health', { p_organization_id: id, p_activity_id: null }),
      supabase
        .from('process')
        .select('id, name')
        .eq('organization_id', id)
        .order('display_order'),
    ])

  if (!organization) notFound()

  const rows = (mapRows ?? []) as MapRow[]
  const health = (healthData ?? { available: false }) as Health

  const [{ data: coverageData }, { data: heatmapData }, { data: graphData }, { data: riskList }, { data: pathData }] =
    await Promise.all([
      view === 'couverture'
        ? supabase.rpc('control_coverage', { p_organization_id: id })
        : Promise.resolve({ data: null }),
      view === 'risques'
        ? supabase.rpc('risk_heatmap', { p_organization_id: id })
        : Promise.resolve({ data: null }),
      view === 'graphe'
        ? supabase.rpc('control_graph', { p_organization_id: id, p_activity_id: null })
        : Promise.resolve({ data: null }),
      view === 'graphe'
        ? supabase
            .from('risk')
            .select('id, business_ref, title, inherent_level, residual_level, status')
            .eq('organization_id', id)
            .order('business_ref')
        : Promise.resolve({ data: null }),
      view === 'graphe' && risque
        ? supabase.rpc('risk_path', { p_risk_id: risque })
        : Promise.resolve({ data: null }),
    ])

  const graph = (graphData ?? { available: false }) as Graph
  const riskPath = pathData as RiskPath | null
  const riskChoices: RiskChoice[] = (riskList ?? []).map((r) => ({
    id: r.id,
    business_ref: r.business_ref,
    title: r.title,
    level: (r.residual_level ?? r.inherent_level) as RiskLevel,
    status: r.status,
  }))

  const selected = activite ? rows.find((r) => r.activity_id === activite) : undefined

  const [{ data: useCases }, { data: activityHealthData }] = await Promise.all([
    selected
      ? supabase
          .from('ai_use_case')
          .select('id, business_ref, name, status, criticality, autonomy_level, next_review_at')
          .eq('activity_id', selected.activity_id!)
          .order('business_ref')
      : Promise.resolve({ data: null }),
    selected
      ? supabase.rpc('governance_health', {
          p_organization_id: id,
          p_activity_id: selected.activity_id,
        })
      : Promise.resolve({ data: null }),
  ])

  const activityHealth = (activityHealthData ?? { available: false }) as Health

  // Regroupement par processus, en conservant l'ordre de la fonction.
  const byProcess = new Map<string, MapRow[]>()
  for (const row of rows) {
    const list = byProcess.get(row.process_id) ?? []
    list.push(row)
    byProcess.set(row.process_id, list)
  }

  return (
    <Shell
      breadcrumb={[
        { href: '/admin', label: 'Organisations' },
        { href: `/admin/organizations/${id}`, label: organization.name },
      ]}
      organization={{ id, section: 'processus' }}
      title="Processus et risques"
      subtitle="Ce que fait l’organisation, et ce que la gouvernance de l’IA y produit."
      actions={
        <div className="flex flex-wrap items-center gap-3">
          <nav aria-label="Lecture de la carte" className="flex rounded-md border border-ink-200 bg-white p-0.5">
            {VIEWS.map((option) => (
              <Link
                key={option.key}
                href={`/admin/organizations/${id}/processus?vue=${option.key}`}
                scroll={false}
                aria-current={view === option.key ? 'page' : undefined}
                className={`rounded px-3 py-1.5 text-sm ${
                  view === option.key
                    ? 'bg-night-900 font-medium text-white'
                    : 'text-ink-600 hover:bg-ink-100'
                }`}
              >
                {option.label}
              </Link>
            ))}
          </nav>
          <Link
            href={`/admin/organizations/${id}/cas-d-usage/nouveau`}
            className="rounded-md bg-night-900 px-4 py-2.5 text-sm font-medium text-white hover:bg-night-800"
          >
            Déclarer un cas d’usage
          </Link>
        </div>
      }
    >
      {view === 'couverture' ? (
        <CoverageView rows={(coverageData ?? []) as CoverageRow[]} organizationId={id} />
      ) : view === 'risques' ? (
        <HeatmapView rows={(heatmapData ?? []) as HeatmapRow[]} organizationId={id} />
      ) : view === 'graphe' ? (
        <div className="grid gap-5 lg:grid-cols-5">
          <div className="lg:col-span-3">
            <Card
              title="Graphe de gouvernance"
              subtitle="Ce que l’arbre ne montre pas : un contrôle partagé, une preuve mutualisée, un risque dont rien ne redescend vers une preuve."
            >
              <ControlGraph
                graph={graph}
                highlightNodes={riskPath?.highlight_nodes}
                highlightEdges={riskPath?.highlight_edges}
              />
            </Card>
          </div>
          <div className="flex flex-col gap-5 lg:col-span-2">
            {riskPath ? <RiskPathPanel path={riskPath} organizationId={id} /> : null}
            <RiskPicker risks={riskChoices} organizationId={id} selectedId={risque} />
          </div>
        </div>
      ) : (
      <div className="grid gap-5 lg:grid-cols-5">
        {/* ---------- Arbre ---------- */}
        <div className="flex flex-col gap-4 lg:col-span-3">
          {rows.length ? (
            [...byProcess.values()].map((activities) => {
              const process = activities[0]!
              return (
                <section
                  key={process.process_id}
                  className="rounded-lg border border-ink-200 bg-white"
                >
                  <header className="flex items-center justify-between gap-3 border-b border-ink-100 px-5 py-3">
                    <h2 className="text-sm font-semibold text-ink-900">
                      {process.process_code ? (
                        <span className="mr-2 font-mono text-xs text-ink-400">
                          {process.process_code}
                        </span>
                      ) : null}
                      {process.process_name}
                    </h2>
                    <Badge>{CATEGORY_LABELS[process.process_category] ?? process.process_category}</Badge>
                  </header>

                  <ul className="divide-y divide-ink-100">
                    {activities
                      .filter((a) => a.activity_id)
                      .map((activity) => {
                        const isSelected = activity.activity_id === activite
                        return (
                          <li key={activity.activity_id}>
                            <Link
                              href={`/admin/organizations/${id}/processus?activite=${activity.activity_id}`}
                              scroll={false}
                              aria-current={isSelected ? 'true' : undefined}
                              className={`block px-5 py-3.5 hover:bg-ink-50 ${
                                isSelected ? 'bg-brand-500/5 ring-1 ring-inset ring-brand-500/30' : ''
                              }`}
                            >
                              <div className="flex flex-wrap items-start justify-between gap-2">
                                <span className="text-sm font-medium text-ink-900">
                                  {activity.activity_name}
                                </span>
                                {activity.max_risk_level ? (
                                  <Badge tone={riskTone(activity.max_risk_level)}>
                                    {RISK_LEVEL_LABELS[activity.max_risk_level]}
                                  </Badge>
                                ) : null}
                              </div>

                              {activity.use_case_count ? (
                                <div className="mt-2 flex flex-wrap gap-x-4 gap-y-1 text-xs text-ink-500">
                                  <span>
                                    {activity.use_case_count} usage
                                    {activity.use_case_count > 1 ? 's' : ''}
                                    {activity.in_service_count
                                      ? ` · ${activity.in_service_count} en service`
                                      : ''}
                                  </span>
                                  {activity.controls_total ? (
                                    <span>
                                      contrôles {activity.controls_operating}/
                                      {activity.controls_total}
                                    </span>
                                  ) : null}
                                  {activity.evidence_stale ? (
                                    <span className="text-amber-700">
                                      {activity.evidence_stale} preuve
                                      {activity.evidence_stale > 1 ? 's' : ''} à renouveler
                                    </span>
                                  ) : null}
                                  {activity.open_high_risks ? (
                                    <span className="text-rose-700">
                                      {activity.open_high_risks} risque
                                      {activity.open_high_risks > 1 ? 's' : ''} élevé
                                      {activity.open_high_risks > 1 ? 's' : ''} ouvert
                                      {activity.open_high_risks > 1 ? 's' : ''}
                                    </span>
                                  ) : null}
                                  {activity.open_incidents ? (
                                    <span className="text-rose-700">
                                      {activity.open_incidents} incident
                                      {activity.open_incidents > 1 ? 's' : ''}
                                    </span>
                                  ) : null}
                                  {activity.reviews_due ? (
                                    <span className="text-amber-700">
                                      {activity.reviews_due} revue
                                      {activity.reviews_due > 1 ? 's' : ''} en retard
                                    </span>
                                  ) : null}
                                </div>
                              ) : (
                                <p className="mt-2 text-xs text-ink-400">
                                  Aucun usage d’IA déclaré.
                                </p>
                              )}
                            </Link>
                          </li>
                        )
                      })}

                    {activities.every((a) => !a.activity_id) ? (
                      <li className="px-5 py-4">
                        <Empty>
                          Aucune activité. Un processus sans activité ne porte aucun usage d’IA
                          gouvernable.
                        </Empty>
                      </li>
                    ) : null}
                  </ul>
                </section>
              )
            })
          ) : (
            <Card title="Cartographie">
              <Empty>
                Aucun processus. Commencez par décrire ce que fait l’organisation : la gouvernance
                de l’IA s’y rattachera ensuite.
              </Empty>
            </Card>
          )}
        </div>

        {/* ---------- Panneau ---------- */}
        <div className="flex flex-col gap-5 lg:col-span-2">
          {selected ? (
            <>
              <Card
                title={selected.activity_name ?? 'Activité'}
                subtitle={`${selected.process_name} · ${selected.activity_ref}`}
                action={
                  <Link
                    href={`/admin/organizations/${id}/processus`}
                    scroll={false}
                    className="text-xs text-ink-500 hover:text-ink-900"
                  >
                    Fermer
                  </Link>
                }
              >
                <GovernanceHealth health={activityHealth} compact />
              </Card>

              <Card title="Ce qui s’y joue">
                <div className="flex flex-col">
                  <Metric label="Usages d’IA déclarés" value={selected.use_case_count} />
                  <Metric label="En service" value={selected.in_service_count} />
                  <Metric
                    label="Risque le plus élevé"
                    value={
                      selected.max_risk_level
                        ? RISK_LEVEL_LABELS[selected.max_risk_level]
                        : '—'
                    }
                    tone={riskTone(selected.max_risk_level)}
                  />
                  <Metric
                    label="Risques élevés ouverts"
                    value={selected.open_high_risks}
                    tone={selected.open_high_risks ? 'stop' : 'ok'}
                  />
                  <Metric
                    label="Contrôles opérants"
                    value={`${selected.controls_operating}/${selected.controls_total}`}
                    tone={
                      selected.controls_total && selected.controls_operating < selected.controls_total
                        ? 'warn'
                        : 'neutral'
                    }
                  />
                  <Metric
                    label="Preuves à renouveler"
                    value={selected.evidence_stale}
                    tone={selected.evidence_stale ? 'warn' : 'ok'}
                    suffix={selected.evidence_total ? `/ ${selected.evidence_total}` : undefined}
                  />
                  <Metric
                    label="Incidents ouverts"
                    value={selected.open_incidents}
                    tone={selected.open_incidents ? 'stop' : 'ok'}
                  />
                  <Metric
                    label="Actions échues"
                    value={selected.overdue_actions}
                    tone={selected.overdue_actions ? 'stop' : 'ok'}
                  />
                  <Metric
                    label="Revues en retard"
                    value={selected.reviews_due}
                    tone={selected.reviews_due ? 'warn' : 'ok'}
                  />
                </div>
              </Card>

              <Card
                title="Usages d’IA"
                action={
                  <Link
                    href={`/admin/organizations/${id}/cas-d-usage/nouveau?activite=${selected.activity_id}`}
                    className="text-xs font-medium text-brand-600 hover:underline"
                  >
                    + Déclarer
                  </Link>
                }
              >
                {useCases?.length ? (
                  <ul className="flex flex-col gap-2.5">
                    {useCases.map((useCase) => (
                      <li key={useCase.id} className="flex flex-wrap items-center justify-between gap-2">
                        <Link
                          href={`/admin/use-cases/${useCase.id}`}
                          className="text-sm text-brand-600 hover:underline"
                        >
                          {useCase.name}
                        </Link>
                        <Badge>{USE_CASE_STATUS_LABELS[useCase.status as UseCaseStatus]}</Badge>
                      </li>
                    ))}
                  </ul>
                ) : (
                  <Empty>
                    Aucun usage d’IA sur cette activité. S’il en existe un, il n’est pas encore
                    déclaré.
                  </Empty>
                )}
              </Card>
            </>
          ) : (
            <>
              <Card title="Santé de la gouvernance" subtitle="Sur l’ensemble de l’organisation">
                <GovernanceHealth health={health} />
              </Card>

              <Card title="Ajouter un processus">
                <ProcessForm organizationId={id} />
              </Card>

              <Card title="Ajouter une activité">
                <ActivityForm organizationId={id} processes={processes ?? []} />
              </Card>
            </>
          )}
        </div>
      </div>
      )}
    </Shell>
  )
}

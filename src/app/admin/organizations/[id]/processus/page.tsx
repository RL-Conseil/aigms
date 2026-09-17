import Link from 'next/link'
import { notFound } from 'next/navigation'
import { createClient } from '@/lib/supabase/server'
import { Shell } from '@/components/shell'
import { Card, Empty } from '@/components/ui'
import { InfoTip } from '@/components/info-tip'
import { GovernanceHealth, type Health } from '@/components/governance/governance-health'
import { ActivityStakes, type Stakes } from '@/components/governance/activity-stakes'
import { ProcessTree, type TreeProcess } from '@/components/governance/process-tree'
import {
  CoverageTable,
  SevereRisksCard,
  UncoveredActivities,
  type CoverageRow,
  type HeatmapRow,
} from '@/components/governance/map-views'
import {
  ChartCard,
  CoverageChart,
  RiskChart,
  type ActivityHeatmapRow,
  type Grain,
} from '@/components/governance/map-charts'
import { Disclosure } from '@/components/forms'
import { ControlGraph, type Graph } from '@/components/governance/control-graph'
import {
  RiskPathPanel,
  RiskPicker,
  type RiskChoice,
  type RiskPath,
} from '@/components/governance/risk-path'
import { type RiskLevel } from '@/lib/domain/governance'

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
  searchParams: Promise<{ activite?: string; vue?: string; risque?: string; par?: string }>
}) {
  const { id } = await params
  const { activite, vue, risque, par } = await searchParams
  const view: ViewKey = VIEWS.some((v) => v.key === vue) ? (vue as ViewKey) : 'arbre'
  // Le grain des barres : l'activite, la ou l'on agit, sinon le processus.
  const grain: Grain = par === 'processus' ? 'processus' : 'activite'
  const grainHref = (target: Grain) => `/admin/organizations/${id}/processus?vue=${view}&par=${target}`
  const supabase = await createClient()

  const [{ data: organization }, { data: mapRows }] =
    await Promise.all([
      supabase.from('organization').select('id, name, business_ref').eq('id', id).maybeSingle(),
      supabase.rpc('process_map', { p_organization_id: id }),
    ])

  if (!organization) notFound()

  const rows = (mapRows ?? []) as MapRow[]

  const [{ data: coverageData }, { data: heatmapData }, { data: activityHeatmapData }, { data: graphData }, { data: riskList }, { data: pathData }] =
    await Promise.all([
      view === 'couverture'
        ? supabase.rpc('control_coverage', { p_organization_id: id })
        : Promise.resolve({ data: null }),
      view === 'risques'
        ? supabase.rpc('risk_heatmap', { p_organization_id: id })
        : Promise.resolve({ data: null }),
      view === 'risques' && grain === 'activite'
        ? supabase.rpc('risk_heatmap_by_activity', { p_organization_id: id })
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

  const [{ data: useCases }, { data: activityHealthData }, { data: stakesData }] =
    await Promise.all([
      // Les usages se lisent sous chaque activite de l'arbre : une seule
      // lecture pour toute l'organisation.
      view === 'arbre'
        ? supabase
            .from('ai_use_case')
            .select('id, name, business_ref, status, activity_id')
            .eq('organization_id', id)
            .order('business_ref')
        : Promise.resolve({ data: null }),
      selected
        ? supabase.rpc('governance_health', {
            p_organization_id: id,
            p_activity_id: selected.activity_id,
          })
        : Promise.resolve({ data: null }),
      selected
        ? supabase.rpc('activity_stakes', { p_activity_id: selected.activity_id! })
        : Promise.resolve({ data: null }),
    ])

  const activityHealth = (activityHealthData ?? { available: false }) as Health
  const stakes = (stakesData ?? { available: false }) as Stakes

  // L'arbre : processus, puis activites, chacune avec ses usages. L'ordre est
  // celui de la fonction ; les familles sont posees par le composant.
  const useCasesByActivity = new Map<string, { id: string; name: string; status: string }[]>()
  for (const useCase of useCases ?? []) {
    if (!useCase.activity_id) continue
    const list = useCasesByActivity.get(useCase.activity_id) ?? []
    list.push({ id: useCase.id, name: useCase.name, status: useCase.status })
    useCasesByActivity.set(useCase.activity_id, list)
  }
  // Le « + » d'une activite rattache un cas d'usage existant : ceux qui
  // flottent, et ceux poses ailleurs.
  const activityName = new Map(rows.filter((r) => r.activity_id).map((r) => [r.activity_id!, r.activity_name ?? '—']))
  const candidates = (useCases ?? []).map((u) => ({
    id: u.id,
    name: u.name,
    business_ref: u.business_ref,
    activity_id: u.activity_id,
    activity_name: u.activity_id ? (activityName.get(u.activity_id) ?? null) : null,
  }))
  const processes: TreeProcess[] = []
  for (const row of rows) {
    let process = processes.find((p) => p.process_id === row.process_id)
    if (!process) {
      process = {
        process_id: row.process_id,
        process_code: row.process_code,
        process_name: row.process_name,
        process_category: row.process_category,
        activities: [],
      }
      processes.push(process)
    }
    if (row.activity_id) {
      process.activities.push({
        activity_id: row.activity_id,
        activity_ref: row.activity_ref,
        activity_name: row.activity_name ?? '—',
        use_case_count: row.use_case_count,
        in_service_count: row.in_service_count,
        max_risk_level: row.max_risk_level,
        open_high_risks: row.open_high_risks,
        controls_total: row.controls_total,
        controls_operating: row.controls_operating,
        evidence_stale: row.evidence_stale,
        open_incidents: row.open_incidents,
        reviews_due: row.reviews_due,
        overdue_actions: row.overdue_actions,
        use_cases: useCasesByActivity.get(row.activity_id) ?? [],
      })
    }
  }

  return (
    <Shell
      breadcrumb={[
        { href: '/admin/organizations', label: 'Organisations' },
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
          <InfoTip label="Comment lire cette carte" title="Quatre lectures du même modèle">
            <div className="flex flex-col gap-3 text-sm leading-relaxed text-ink-600">
              <p>
                Un seul jeu de données, quatre questions. Les onglets ne filtrent pas une liste :
                ils changent la question posée à la même carte.
              </p>

              <ul className="flex flex-col gap-2.5">
                <li>
                  <strong className="font-medium text-ink-800">Processus</strong> — ce que fait
                  l’organisation, et où l’IA intervient. L’arbre descend du processus vers ses
                  activités ; chaque activité annonce ce qui s’y joue, et le panneau de droite
                  détaille celle qu’on sélectionne.
                </li>
                <li>
                  <strong className="font-medium text-ink-800">Couverture</strong> — ce qui tient
                  réellement, en barres, par activité ou par processus. Un contrôle n’est compté
                  comme couvrant que s’il est <em>opérant</em> et <em>prouvé</em> par une preuve
                  validée non échue. Un contrôle déclaré sans preuve ne protège personne, et
                  c’est ce qu’un auditeur vient vérifier.
                </li>
                <li>
                  <strong className="font-medium text-ink-800">Risques</strong> — la répartition
                  par niveau, en barres, par activité ou par processus. Les couleurs comptent les
                  risques <em>ouverts</em>, pas le total : un risque accepté est une décision
                  assumée, avec un responsable et une date de revue. Le laisser clignoter en rouge
                  reviendrait à confondre une décision avec une alerte.
                </li>
                <li>
                  <strong className="font-medium text-ink-800">Graphe</strong> — ce qu’une
                  hiérarchie ne sait pas montrer : un contrôle partagé entre plusieurs cas d’usage,
                  une preuve mutualisée, un risque dont rien ne redescend vers une preuve. Suivre
                  un risque met en évidence son chemin, du processus jusqu’à la preuve, et nomme
                  l’endroit exact où la chaîne rompt.
                </li>
              </ul>

              <p className="text-[13px] text-ink-500">
                Les cases vides comptent autant que les autres : une activité sans usage d’IA
                déclaré, un processus sans activité, une case de la matrice à zéro sont des
                informations, pas des trous.
              </p>
            </div>
          </InfoTip>
        </div>
      }
    >
      {/*
        Le bandeau du haut ne bouge pas d'une vue a l'autre : les quatre
        lectures y restent a la meme place. Ce qui n'a de sens que sur l'arbre
        — ajouter un processus, une activite — vient dessous.
      */}
      {view === 'arbre' ? (
        <div className="mb-5 flex flex-wrap items-center gap-3">
          <Link
            href={`/admin/organizations/${id}/processus/nouveau`}
            className="rounded-md border border-ink-200 px-3.5 py-2 text-sm text-ink-700 hover:bg-ink-100"
          >
            Ajouter un processus
          </Link>
          <Link
            href={`/admin/organizations/${id}/processus/activite`}
            className="rounded-md border border-ink-200 px-3.5 py-2 text-sm text-ink-700 hover:bg-ink-100"
          >
            Ajouter une activité
          </Link>
          <span className="text-xs text-ink-500">
            Un cas d’usage se déclare depuis la vue d’ensemble, puis se rattache ici avec le « + » de son activité.
          </span>
        </div>
      ) : null}

      {view === 'couverture' ? (
        <div className="flex flex-col gap-5">
          <ChartCard
            title="Couverture des contrôles"
            subtitle="Un contrôle ne compte comme couvrant que s’il est opérant et prouvé par une preuve validée non échue."
            grain={grain}
            href={grainHref}
          >
            <CoverageChart rows={(coverageData ?? []) as CoverageRow[]} grain={grain} organizationId={id} />
          </ChartCard>
          {grain === 'activite' ? (
            <>
              <Disclosure
                title="Le détail, en tableau"
                summary="Obligatoires statués, dernier test, date de la dernière preuve"
              >
                <CoverageTable rows={(coverageData ?? []) as CoverageRow[]} organizationId={id} />
              </Disclosure>
              <UncoveredActivities rows={(coverageData ?? []) as CoverageRow[]} organizationId={id} />
            </>
          ) : null}
        </div>
      ) : view === 'risques' ? (
        <div className="flex flex-col gap-5">
          <ChartCard
            title="Répartition des risques"
            subtitle="Les couleurs comptent les risques encore ouverts, par niveau ; le gris, ce qui a été traité ou accepté."
            grain={grain}
            href={grainHref}
          >
            <RiskChart
              rows={
                grain === 'activite'
                  ? ((activityHeatmapData ?? []) as ActivityHeatmapRow[])
                  : ((heatmapData ?? []) as HeatmapRow[])
              }
              grain={grain}
              organizationId={id}
            />
          </ChartCard>
          <SevereRisksCard
            rows={(heatmapData ?? []) as HeatmapRow[]}
            activities={rows
              .filter((r) => r.activity_id && r.open_high_risks > 0)
              .map((r) => ({
                process_id: r.process_id,
                activity_id: r.activity_id!,
                activity_name: r.activity_name ?? '—',
                open_high_risks: r.open_high_risks,
              }))}
            organizationId={id}
          />
        </div>
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
        <div className="lg:col-span-3">
          {rows.length ? (
            <ProcessTree
              organizationId={id}
              processes={processes}
              selectedActivity={activite}
              candidates={candidates}
            />
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

              <Card
                title="Ce qui s’y joue"
                subtitle="Chaque chiffre s’ouvre sur les pièces qu’il compte, et conduit là où on agit."
              >
                <ActivityStakes
                  organizationId={id}
                  activityId={selected.activity_id!}
                  counts={selected}
                  stakes={stakes}
                />
              </Card>
            </>
          ) : (
            <Card
              title="Sélectionner une activité"
              subtitle="Le panneau détaillera ce qui s’y joue : usages déclarés, risques, contrôles, preuves."
            >
              <Empty>
                Cliquez une activité dans l’arbre. Les compteurs qu’elle affiche disent déjà ce qui
                y appelle une action.
              </Empty>
            </Card>
          )}
        </div>
      </div>
      )}
    </Shell>
  )
}

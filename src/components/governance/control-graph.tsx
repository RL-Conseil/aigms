'use client'

import { useMemo, useState } from 'react'
import {
  Background,
  Controls,
  MarkerType,
  MiniMap,
  Position,
  ReactFlow,
  type Edge,
  type Node,
} from '@xyflow/react'
import '@xyflow/react/dist/style.css'

/**
 * AI Control Graph.
 *
 * L'arbre de la vue « Processus » montre une hierarchie. Il ne sait pas montrer
 * ce qui la traverse : un controle qui sert plusieurs cas d'usage, une preuve
 * unique adossee a plusieurs controles, un risque dont rien ne redescend vers
 * une preuve. C'est la seule raison d'etre de ce graphe — pas la decoration.
 *
 * Les six couches se lisent de gauche a droite, dans l'ordre ou la gouvernance
 * se construit : ce que fait l'organisation, puis ce qu'elle y met d'IA, puis ce
 * que cela expose, puis ce qui le tient, puis ce qui le demontre.
 */

export type GraphLayer = 'process' | 'activity' | 'use_case' | 'risk' | 'control' | 'evidence'

export type GraphNode = {
  id: string
  layer: GraphLayer
  entity_id: string
  ref: string | null
  label: string
  tone: 'neutral' | 'live' | 'ok' | 'warn' | 'stop'
  meta: Record<string, unknown>
}

export type GraphEdge = {
  id: string
  source: string
  target: string
  kind: 'structure' | 'exposure' | 'applicability' | 'mitigation' | 'evidence'
  meta?: Record<string, unknown>
}

export type Graph = { available: boolean; nodes?: GraphNode[]; edges?: GraphEdge[] }

const LAYER_ORDER: GraphLayer[] = [
  'process',
  'activity',
  'use_case',
  'risk',
  'control',
  'evidence',
]

const LAYER_LABELS: Record<GraphLayer, string> = {
  process: 'Processus',
  activity: 'Activité',
  use_case: 'Cas d’usage',
  risk: 'Risque',
  control: 'Contrôle',
  evidence: 'Preuve',
}

const EDGE_LABELS: Record<GraphEdge['kind'], string> = {
  structure: 'Rattachement',
  exposure: 'Expose à',
  applicability: 'Applicable à',
  mitigation: 'Désigné pour traiter',
  evidence: 'Démontré par',
}

// Le ton d'un noeud dit ce qu'il faut en penser, jamais ce qu'il est.
const TONE_STYLE: Record<GraphNode['tone'], { border: string; text: string }> = {
  neutral: { border: 'oklch(0.84 0.02 250)', text: 'oklch(0.22 0.03 250)' },
  live: { border: 'oklch(0.52 0.11 245)', text: 'oklch(0.38 0.12 245)' },
  ok: { border: 'oklch(0.52 0.13 155)', text: 'oklch(0.52 0.13 155)' },
  warn: { border: 'oklch(0.62 0.14 75)', text: 'oklch(0.62 0.14 75)' },
  stop: { border: 'oklch(0.55 0.19 25)', text: 'oklch(0.55 0.19 25)' },
}

const EDGE_STYLE: Record<GraphEdge['kind'], { stroke: string; dash?: string; width: number }> = {
  structure: { stroke: 'oklch(0.84 0.02 250)', width: 1.5 },
  exposure: { stroke: 'oklch(0.55 0.19 25)', width: 1.5 },
  applicability: { stroke: 'oklch(0.84 0.02 250)', dash: '4 4', width: 1.5 },
  mitigation: { stroke: 'oklch(0.52 0.09 200)', width: 2.5 },
  evidence: { stroke: 'oklch(0.52 0.13 155)', width: 1.5 },
}

const NODE_WIDTH = 210
const COLUMN_GAP = 264
const ROW_GAP = 74

type Toggles = {
  risk: boolean
  control: boolean
  evidence: boolean
  emptyActivities: boolean
}

export function ControlGraph({
  graph,
  highlightNodes,
  highlightEdges,
}: {
  graph: Graph
  highlightNodes?: string[]
  highlightEdges?: string[]
}) {
  const [toggles, setToggles] = useState<Toggles>({
    risk: true,
    control: true,
    evidence: true,
    emptyActivities: false,
  })

  const highlighted = useMemo(() => new Set(highlightNodes ?? []), [highlightNodes])
  const highlightedEdges = useMemo(() => new Set(highlightEdges ?? []), [highlightEdges])

  const { nodes, edges, counts } = useMemo(() => {
    const allNodes = graph.nodes ?? []
    const allEdges = graph.edges ?? []

    // --- Filtrage des couches ------------------------------------------------
    const hiddenLayers = new Set<GraphLayer>()
    if (!toggles.risk) hiddenLayers.add('risk')
    if (!toggles.control) hiddenLayers.add('control')
    if (!toggles.evidence) hiddenLayers.add('evidence')

    let kept = allNodes.filter((n) => !hiddenLayers.has(n.layer))

    if (!toggles.emptyActivities) {
      const carrying = new Set(
        allEdges
          .filter((e) => e.source.startsWith('activity:') && e.target.startsWith('use_case:'))
          .map((e) => e.source),
      )
      kept = kept.filter((n) => n.layer !== 'activity' || carrying.has(n.id))
    }

    const keptIds = new Set(kept.map((n) => n.id))
    const keptEdges = allEdges.filter((e) => keptIds.has(e.source) && keptIds.has(e.target))

    // --- Placement -----------------------------------------------------------
    // Une passe de barycentre suffit : le graphe est presque un arbre, chaque
    // couche se range sous la moyenne de ses parents. Les croisements restants
    // sont ceux qui portent l'information — un controle partage entre deux cas
    // d'usage doit se voir croiser.
    const positions = new Map<string, { x: number; y: number }>()
    const rank = new Map<string, number>()

    for (const [column, layer] of LAYER_ORDER.entries()) {
      const inLayer = kept.filter((n) => n.layer === layer)
      const barycenter = new Map<string, number>()

      for (const [index, node] of inLayer.entries()) {
        const parents = keptEdges
          .filter((e) => e.target === node.id)
          .map((e) => rank.get(e.source))
          .filter((v): v is number => v !== undefined)
        barycenter.set(
          node.id,
          parents.length
            ? parents.reduce((a, b) => a + b, 0) / parents.length
            : index + inLayer.length,
        )
      }

      const ordered = [...inLayer].sort(
        (a, b) => (barycenter.get(a.id) ?? 0) - (barycenter.get(b.id) ?? 0),
      )
      for (const [row, node] of ordered.entries()) {
        rank.set(node.id, row)
        positions.set(node.id, { x: column * COLUMN_GAP, y: row * ROW_GAP })
      }
    }

    const dimmed = highlighted.size > 0

    const flowNodes: Node[] = kept.map((node) => {
      const tone = TONE_STYLE[node.tone]
      const isLit = highlighted.has(node.id)
      return {
        id: node.id,
        position: positions.get(node.id) ?? { x: 0, y: 0 },
        sourcePosition: Position.Right,
        targetPosition: Position.Left,
        data: {
          label: (
            <div className="text-left">
              <div className="flex items-baseline gap-1.5">
                <span className="text-[9px] uppercase tracking-wide text-ink-400">
                  {LAYER_LABELS[node.layer]}
                </span>
                {node.ref ? (
                  <span className="font-mono text-[9px] text-ink-400">{node.ref}</span>
                ) : null}
              </div>
              <div className="mt-0.5 text-[11px] leading-snug" style={{ color: tone.text }}>
                {node.label}
              </div>
            </div>
          ),
        },
        style: {
          width: NODE_WIDTH,
          padding: '6px 9px',
          borderRadius: 6,
          border: `1px solid ${tone.border}`,
          borderLeftWidth: isLit ? 4 : 1,
          background: 'white',
          opacity: dimmed && !isLit ? 0.28 : 1,
          boxShadow: isLit ? '0 0 0 2px oklch(0.6 0.09 200 / 0.35)' : 'none',
        },
      }
    })

    const flowEdges: Edge[] = keptEdges.map((edge) => {
      const style = EDGE_STYLE[edge.kind]
      const isLit = highlightedEdges.has(edge.id)
      return {
        id: edge.id,
        source: edge.source,
        target: edge.target,
        label: edge.kind === 'mitigation' ? EDGE_LABELS.mitigation : undefined,
        labelStyle: { fontSize: 9, fill: style.stroke },
        labelBgStyle: { fill: 'white' },
        style: {
          stroke: style.stroke,
          strokeWidth: isLit ? style.width + 1.5 : style.width,
          strokeDasharray: style.dash,
          opacity: dimmed && !isLit ? 0.15 : 1,
        },
        markerEnd: { type: MarkerType.ArrowClosed, color: style.stroke, width: 14, height: 14 },
      }
    })

    const counts: Record<string, number> = {}
    for (const node of allNodes) counts[node.layer] = (counts[node.layer] ?? 0) + 1

    return { nodes: flowNodes, edges: flowEdges, counts }
  }, [graph, toggles, highlighted, highlightedEdges])

  if (!graph.available || !(graph.nodes ?? []).length) {
    return (
      <p className="py-8 text-center text-sm text-ink-400">
        Rien à relier pour l’instant. Le graphe apparaît dès qu’un cas d’usage est rattaché à une
        activité.
      </p>
    )
  }

  return (
    <div className="flex flex-col gap-3">
      {/* ---------- Couches ---------- */}
      <div className="flex flex-wrap items-center gap-x-4 gap-y-2">
        <span className="text-xs font-medium text-ink-500">Couches</span>
        <Toggle
          label={`Risques${counts.risk ? ` (${counts.risk})` : ''}`}
          checked={toggles.risk}
          onChange={(v) => setToggles((t) => ({ ...t, risk: v }))}
        />
        <Toggle
          label={`Contrôles${counts.control ? ` (${counts.control})` : ''}`}
          checked={toggles.control}
          onChange={(v) => setToggles((t) => ({ ...t, control: v }))}
        />
        <Toggle
          label={`Preuves${counts.evidence ? ` (${counts.evidence})` : ''}`}
          checked={toggles.evidence}
          onChange={(v) => setToggles((t) => ({ ...t, evidence: v }))}
        />
        <Toggle
          label="Activités sans usage d’IA"
          checked={toggles.emptyActivities}
          onChange={(v) => setToggles((t) => ({ ...t, emptyActivities: v }))}
        />
      </div>

      <div className="h-[620px] rounded-lg border border-ink-200 bg-ink-50">
        <ReactFlow
          nodes={nodes}
          edges={edges}
          fitView
          minZoom={0.2}
          maxZoom={1.6}
          nodesDraggable={false}
          nodesConnectable={false}
          edgesFocusable={false}
          proOptions={{ hideAttribution: false }}
          aria-label="Graphe de gouvernance"
        >
          <Background gap={20} color="oklch(0.91 0.008 250)" />
          <Controls showInteractive={false} />
          <MiniMap pannable zoomable className="!bg-white" />
        </ReactFlow>
      </div>

      {/* ---------- Legende ---------- */}
      <dl className="flex flex-wrap gap-x-5 gap-y-1.5 text-xs text-ink-500">
        {(Object.keys(EDGE_LABELS) as GraphEdge['kind'][]).map((kind) => (
          <div key={kind} className="flex items-center gap-1.5">
            <svg width="22" height="6" aria-hidden="true">
              <line
                x1="0"
                y1="3"
                x2="22"
                y2="3"
                stroke={EDGE_STYLE[kind].stroke}
                strokeWidth={EDGE_STYLE[kind].width}
                strokeDasharray={EDGE_STYLE[kind].dash}
              />
            </svg>
            <dt className="sr-only">Type de lien</dt>
            <dd>{EDGE_LABELS[kind]}</dd>
          </div>
        ))}
      </dl>

      <p className="text-xs text-ink-400">
        « Applicable à » dit qu’un contrôle a été jugé pertinent pour un cas d’usage. « Désigné pour
        traiter » dit qu’un humain l’a rattaché à un risque précis. Seul le second se démontre devant
        un auditeur.
      </p>
    </div>
  )
}

function Toggle({
  label,
  checked,
  onChange,
}: {
  label: string
  checked: boolean
  onChange: (value: boolean) => void
}) {
  return (
    <label className="flex cursor-pointer items-center gap-1.5 text-xs text-ink-600">
      <input
        type="checkbox"
        checked={checked}
        onChange={(event) => onChange(event.target.checked)}
        className="size-3.5 accent-[oklch(0.45_0.11_245)]"
      />
      {label}
    </label>
  )
}

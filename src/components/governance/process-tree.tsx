'use client'

import Link from 'next/link'
import { useState } from 'react'
import { Badge, Empty } from '@/components/ui'
import { AttachUseCaseButton } from '@/components/governance/attach-use-case'
import {
  RISK_LEVEL_LABELS,
  USE_CASE_STATUS_LABELS,
  type RiskLevel,
  type UseCaseStatus,
} from '@/lib/domain/governance'

/**
 * L'arbre des processus, en trois familles.
 *
 * Pilotage, realisation, support : la typologie usuelle d'une cartographie de
 * processus, et l'ordre dans lequel on la lit. Chaque famille se replie ; la
 * selection courante garde la sienne ouverte.
 *
 * LES USAGES SE LISENT SOUS L'ACTIVITE, pas dans un panneau a cote : c'est la
 * qu'ils se rattachent, et c'est la qu'on cherche a en declarer un — d'ou le
 * « + » a cote de la liste, qui pre-remplit l'activite.
 */

export type TreeActivity = {
  activity_id: string
  activity_ref: string | null
  activity_name: string
  use_case_count: number
  in_service_count: number
  max_risk_level: RiskLevel | null
  open_high_risks: number
  controls_total: number
  controls_operating: number
  evidence_stale: number
  open_incidents: number
  reviews_due: number
  overdue_actions: number
  use_cases: { id: string; name: string; status: string }[]
}

export type UseCaseCandidate = {
  id: string
  name: string
  business_ref: string
  activity_id: string | null
  activity_name: string | null
}

export type TreeProcess = {
  process_id: string
  process_code: string | null
  process_name: string
  process_category: string
  activities: TreeActivity[]
}

const FAMILIES: { key: string; label: string; hint: string }[] = [
  { key: 'management', label: 'Pilotage', hint: 'Ce qui oriente et décide.' },
  { key: 'core', label: 'Réalisation', hint: 'Ce qui produit la valeur pour le client.' },
  { key: 'support', label: 'Support', hint: 'Ce qui rend le reste possible.' },
]

function riskTone(level: RiskLevel | null) {
  if (level === 'critical' || level === 'high') return 'stop' as const
  if (level === 'moderate') return 'warn' as const
  return 'neutral' as const
}

/** Ce qui appelle une action sur l'activite, en une ligne de repères courts. */
function Signals({ activity }: { activity: TreeActivity }) {
  const signals: { text: string; tone: 'warn' | 'stop' | 'neutral' }[] = []
  if (activity.controls_total) {
    signals.push({
      text: `contrôles ${activity.controls_operating}/${activity.controls_total}`,
      tone: activity.controls_operating < activity.controls_total ? 'warn' : 'neutral',
    })
  }
  if (activity.open_high_risks) {
    signals.push({ text: `${activity.open_high_risks} risque(s) élevé(s) ouvert(s)`, tone: 'stop' })
  }
  if (activity.evidence_stale) {
    signals.push({ text: `${activity.evidence_stale} preuve(s) à renouveler`, tone: 'warn' })
  }
  if (activity.open_incidents) {
    signals.push({ text: `${activity.open_incidents} incident(s)`, tone: 'stop' })
  }
  if (activity.overdue_actions) {
    signals.push({ text: `${activity.overdue_actions} action(s) échue(s)`, tone: 'stop' })
  }
  if (activity.reviews_due) {
    signals.push({ text: `${activity.reviews_due} revue(s) en retard`, tone: 'warn' })
  }
  if (!signals.length) return null
  return (
    <span className="flex flex-wrap gap-x-3 gap-y-0.5 text-[11px]">
      {signals.map((s) => (
        <span
          key={s.text}
          className={
            s.tone === 'stop' ? 'text-stop-600' : s.tone === 'warn' ? 'text-warn-600' : 'text-ink-500'
          }
        >
          {s.text}
        </span>
      ))}
    </span>
  )
}

function ActivityRow({
  organizationId,
  activity,
  selected,
  candidates,
}: {
  organizationId: string
  activity: TreeActivity
  selected: boolean
  candidates: UseCaseCandidate[]
}) {
  const base = `/admin/organizations/${organizationId}`
  return (
    <li
      className={`px-5 py-3 ${
        selected ? 'bg-brand-500/5 ring-1 ring-inset ring-brand-500/30' : ''
      }`}
    >
      <div className="flex flex-wrap items-start justify-between gap-2">
        <Link
          href={`${base}/processus?activite=${activity.activity_id}`}
          scroll={false}
          aria-current={selected ? 'true' : undefined}
          className="text-sm font-medium text-ink-900 hover:underline"
        >
          {activity.activity_name}
        </Link>
        <span className="flex items-center gap-2">
          {activity.max_risk_level ? (
            <Badge tone={riskTone(activity.max_risk_level)}>
              {RISK_LEVEL_LABELS[activity.max_risk_level]}
            </Badge>
          ) : null}
        </span>
      </div>

      <div className="mt-1.5">
        <Signals activity={activity} />
      </div>

      {/* Les usages, la ou ils se rattachent — et le « + » pour en declarer un. */}
      <ul className="mt-2 flex flex-wrap items-center gap-1.5">
        {activity.use_cases.map((useCase) => (
          <li key={useCase.id}>
            <Link
              href={`/admin/use-cases/${useCase.id}`}
              title={USE_CASE_STATUS_LABELS[useCase.status as UseCaseStatus] ?? useCase.status}
              className="inline-flex items-center gap-1.5 rounded-full border border-ink-200 bg-white px-2.5 py-0.5 text-xs text-ink-700 hover:border-brand-500 hover:text-brand-700"
            >
              <span
                aria-hidden
                className={`size-1.5 rounded-full ${
                  ['PRODUCTION', 'MONITORING'].includes(useCase.status)
                    ? 'bg-ok-600'
                    : useCase.status === 'RETIRED'
                      ? 'bg-ink-300'
                      : 'bg-warn-600'
                }`}
              />
              {useCase.name}
            </Link>
          </li>
        ))}
        <li>
          <AttachUseCaseButton
            organizationId={organizationId}
            activityId={activity.activity_id}
            activityName={activity.activity_name}
            candidates={candidates
              .filter((c) => c.activity_id !== activity.activity_id)
              .map((c) => ({
                id: c.id,
                name: c.name,
                business_ref: c.business_ref,
                activity_name: c.activity_name,
              }))}
          />
        </li>
        {!activity.use_cases.length ? (
          <li className="text-xs text-ink-400">Aucun usage d’IA déclaré.</li>
        ) : null}
      </ul>
    </li>
  )
}

function Family({
  organizationId,
  label,
  hint,
  processes,
  selectedActivity,
  candidates,
}: {
  organizationId: string
  label: string
  hint: string
  processes: TreeProcess[]
  selectedActivity?: string
  candidates: UseCaseCandidate[]
}) {
  const holdsSelection = processes.some((p) =>
    p.activities.some((a) => a.activity_id === selectedActivity),
  )
  const [open, setOpen] = useState(true)
  const shown = open || holdsSelection
  const activityCount = processes.reduce((n, p) => n + p.activities.length, 0)
  const useCaseCount = processes.reduce(
    (n, p) => n + p.activities.reduce((m, a) => m + a.use_case_count, 0),
    0,
  )

  return (
    <section className="rounded-lg border border-ink-200 bg-white">
      <h2>
        <button
          type="button"
          onClick={() => setOpen((v) => !v)}
          aria-expanded={shown}
          className="flex w-full items-center gap-3 px-5 py-3 text-left hover:bg-ink-50"
        >
          <span className="min-w-0 flex-1">
            <span className="block text-sm font-semibold text-ink-900">{label}</span>
            <span className="block text-xs text-ink-500">
              {processes.length} processus · {activityCount} activité(s) · {useCaseCount} usage(s)
              {' — '}
              {hint}
            </span>
          </span>
          <svg
            width="16"
            height="16"
            viewBox="0 0 16 16"
            fill="none"
            aria-hidden
            className={`shrink-0 text-ink-400 transition-transform ${shown ? 'rotate-180' : ''}`}
          >
            <path
              d="M4 6.4 L8 10.4 L12 6.4"
              stroke="currentColor"
              strokeWidth="1.6"
              strokeLinecap="round"
              strokeLinejoin="round"
            />
          </svg>
        </button>
      </h2>

      {shown ? (
        <div className="divide-y divide-ink-100 border-t border-ink-100">
          {processes.length ? (
            processes.map((process) => (
              <div key={process.process_id}>
                <h3 className="flex items-center gap-2 bg-ink-50/70 px-5 py-2 text-xs font-semibold uppercase tracking-wide text-ink-600">
                  {process.process_code ? (
                    <span className="font-mono font-normal text-ink-400">{process.process_code}</span>
                  ) : null}
                  {process.process_name}
                </h3>
                {process.activities.length ? (
                  <ul className="divide-y divide-ink-100">
                    {process.activities.map((activity) => (
                      <ActivityRow
                        key={activity.activity_id}
                        organizationId={organizationId}
                        activity={activity}
                        selected={activity.activity_id === selectedActivity}
                        candidates={candidates}
                      />
                    ))}
                  </ul>
                ) : (
                  <div className="px-5 py-3">
                    <Empty>
                      Aucune activité — un processus sans activité ne porte aucun usage d’IA
                      gouvernable.{' '}
                      <Link
                        href={`/admin/organizations/${organizationId}/processus/activite?processus=${process.process_id}`}
                        className="text-brand-600 hover:underline"
                      >
                        En ajouter une
                      </Link>
                      .
                    </Empty>
                  </div>
                )}
              </div>
            ))
          ) : (
            <div className="px-5 py-3">
              <Empty>Aucun processus de {label.toLowerCase()} déclaré.</Empty>
            </div>
          )}
        </div>
      ) : null}
    </section>
  )
}

export function ProcessTree({
  organizationId,
  processes,
  selectedActivity,
  candidates,
}: {
  organizationId: string
  processes: TreeProcess[]
  selectedActivity?: string
  /** Tous les cas d'usage de l'organisation : le « + » rattache l'un d'eux. */
  candidates: UseCaseCandidate[]
}) {
  return (
    <div className="flex flex-col gap-4">
      {FAMILIES.map((family) => (
        <Family
          key={family.key}
          organizationId={organizationId}
          label={family.label}
          hint={family.hint}
          processes={processes.filter((p) => p.process_category === family.key)}
          selectedActivity={selectedActivity}
          candidates={candidates}
        />
      ))}
    </div>
  )
}

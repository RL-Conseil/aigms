import Link from 'next/link'
import { createClient } from '@/lib/supabase/server'
import { Shell } from '@/components/shell'
import { Badge, Card, Empty } from '@/components/ui'
import {
  DECISION_TYPE_LABELS,
  formatDate,
  FRESHNESS_LABELS,
  RISK_LEVEL_LABELS,
  USE_CASE_STATUS_LABELS,
  type EvidenceFreshness,
  type RiskLevel,
  type UseCaseStatus,
} from '@/lib/domain/governance'

/**
 * Tableau de bord OPERATE : ce qui appelle une action de l'AI Governance
 * Officer. Chaque bloc repond a une question de pilotage, pas a une entite du
 * modele de donnees.
 */
export default async function DashboardPage() {
  const supabase = await createClient()
  const today = new Date().toISOString().slice(0, 10)

  const [
    { data: dueReviews },
    { data: highRisks },
    { data: pendingDecisions },
    { data: evidence },
    { data: overdueActions },
    { data: incidents },
    { data: blockedGates },
  ] = await Promise.all([
    supabase
      .from('ai_use_case')
      .select('id, business_ref, name, status, next_review_at')
      .not('next_review_at', 'is', null)
      .lte('next_review_at', today)
      .order('next_review_at'),
    supabase
      .from('risk')
      .select('id, business_ref, title, residual_level, inherent_level, status, use_case_id, next_review_at')
      .in('status', ['identified', 'analysed', 'treatment_planned', 'treatment_in_progress'])
      .order('business_ref'),
    supabase
      .from('governance_decision')
      .select('id, business_ref, subject, decision_type, status, review_due_at, use_case_id')
      .or(`status.in.(draft,submitted),review_due_at.lte.${today}`)
      .order('review_due_at', { nullsFirst: false }),
    supabase
      .from('evidence_with_freshness')
      .select('id, business_ref, title, valid_until, freshness_status, validation_status')
      .in('freshness_status', ['expired', 'expiring'])
      .order('valid_until'),
    supabase
      .from('action')
      .select('id, business_ref, title, due_date, status, is_blocking, use_case_id')
      .not('status', 'in', '(done,cancelled)')
      .not('due_date', 'is', null)
      .lte('due_date', today)
      .order('due_date'),
    supabase
      .from('incident')
      .select('id, business_ref, title, severity, status, detected_at')
      .not('status', 'eq', 'CLOSED')
      .order('detected_at', { ascending: false }),
    supabase
      .from('audit_log')
      .select('id, occurred_at, entity_ref, summary')
      .eq('action', 'gate_blocked')
      .order('occurred_at', { ascending: false })
      .limit(5),
  ])

  const criticalRisks = (highRisks ?? []).filter((r) =>
    ['high', 'critical'].includes((r.residual_level ?? r.inherent_level) as string),
  )

  return (
    <Shell
      title="Pilotage"
      subtitle="Ce qui appelle une décision, une preuve ou une action cette semaine."
    >
      <div className="mb-6 grid gap-3 sm:grid-cols-3 lg:grid-cols-6">
        <Stat label="Revues dues" value={dueReviews?.length ?? 0} tone="warn" />
        <Stat label="Risques élevés ouverts" value={criticalRisks.length} tone="stop" />
        <Stat label="Décisions à traiter" value={pendingDecisions?.length ?? 0} tone="warn" />
        <Stat label="Preuves à renouveler" value={evidence?.length ?? 0} tone="warn" />
        <Stat label="Actions échues" value={overdueActions?.length ?? 0} tone="stop" />
        <Stat label="Incidents ouverts" value={incidents?.length ?? 0} tone="stop" />
      </div>

      <div className="grid gap-5 lg:grid-cols-2">
        <Card title="Risques élevés sans traitement abouti">
          {criticalRisks.length ? (
            <ul className="divide-y divide-ink-100">
              {criticalRisks.map((risk) => (
                <li key={risk.id} className="flex items-start justify-between gap-3 py-2.5">
                  <div className="min-w-0">
                    <Link
                      href={`/admin/use-cases/${risk.use_case_id}`}
                      className="text-sm text-brand-600 hover:underline"
                    >
                      {risk.title}
                    </Link>
                    <p className="text-xs text-ink-400">
                      {risk.business_ref} · statut {risk.status}
                    </p>
                  </div>
                  <Badge tone="stop">
                    {RISK_LEVEL_LABELS[(risk.residual_level ?? risk.inherent_level) as RiskLevel]}
                  </Badge>
                </li>
              ))}
            </ul>
          ) : (
            <Empty>Aucun risque élevé en attente de traitement.</Empty>
          )}
        </Card>

        <Card title="Décisions à instruire ou à revoir">
          {pendingDecisions?.length ? (
            <ul className="divide-y divide-ink-100">
              {pendingDecisions.map((d) => (
                <li key={d.id} className="flex items-start justify-between gap-3 py-2.5">
                  <div className="min-w-0">
                    <Link
                      href={`/admin/use-cases/${d.use_case_id}`}
                      className="text-sm text-brand-600 hover:underline"
                    >
                      {d.subject}
                    </Link>
                    <p className="text-xs text-ink-400">
                      {d.business_ref} · {DECISION_TYPE_LABELS[d.decision_type] ?? d.decision_type}
                      {d.review_due_at ? ` · revue le ${formatDate(d.review_due_at)}` : ''}
                    </p>
                  </div>
                  <Badge tone="warn">{d.status}</Badge>
                </li>
              ))}
            </ul>
          ) : (
            <Empty>Aucune décision en attente.</Empty>
          )}
        </Card>

        <Card title="Preuves échues ou proches de l'échéance">
          {evidence?.length ? (
            <ul className="divide-y divide-ink-100">
              {evidence.map((e) => (
                <li key={e.id} className="flex items-start justify-between gap-3 py-2.5">
                  <div className="min-w-0">
                    <p className="text-sm text-ink-900">{e.title}</p>
                    <p className="text-xs text-ink-400">
                      {e.business_ref} · valide jusqu&apos;au {formatDate(e.valid_until)}
                    </p>
                  </div>
                  <Badge tone={e.freshness_status === 'expired' ? 'stop' : 'warn'}>
                    {FRESHNESS_LABELS[e.freshness_status as EvidenceFreshness]}
                  </Badge>
                </li>
              ))}
            </ul>
          ) : (
            <Empty>Toutes les preuves sont à jour.</Empty>
          )}
        </Card>

        <Card title="Actions échues">
          {overdueActions?.length ? (
            <ul className="divide-y divide-ink-100">
              {overdueActions.map((a) => (
                <li key={a.id} className="flex items-start justify-between gap-3 py-2.5">
                  <div className="min-w-0">
                    <Link
                      href={`/admin/use-cases/${a.use_case_id}`}
                      className="text-sm text-brand-600 hover:underline"
                    >
                      {a.title}
                    </Link>
                    <p className="text-xs text-ink-400">
                      {a.business_ref} · échéance {formatDate(a.due_date)}
                    </p>
                  </div>
                  {a.is_blocking ? <Badge tone="stop">Bloquante</Badge> : <Badge>{a.status}</Badge>}
                </li>
              ))}
            </ul>
          ) : (
            <Empty>Aucune action échue.</Empty>
          )}
        </Card>

        <Card title="Revues de cas d'usage dues">
          {dueReviews?.length ? (
            <ul className="divide-y divide-ink-100">
              {dueReviews.map((uc) => (
                <li key={uc.id} className="flex items-start justify-between gap-3 py-2.5">
                  <div className="min-w-0">
                    <Link
                      href={`/admin/use-cases/${uc.id}`}
                      className="text-sm text-brand-600 hover:underline"
                    >
                      {uc.name}
                    </Link>
                    <p className="text-xs text-ink-400">
                      {uc.business_ref} · revue prévue le {formatDate(uc.next_review_at)}
                    </p>
                  </div>
                  <Badge>{USE_CASE_STATUS_LABELS[uc.status as UseCaseStatus]}</Badge>
                </li>
              ))}
            </ul>
          ) : (
            <Empty>Aucune revue échue.</Empty>
          )}
        </Card>

        <Card title="Incidents ouverts">
          {incidents?.length ? (
            <ul className="divide-y divide-ink-100">
              {incidents.map((i) => (
                <li key={i.id} className="flex items-start justify-between gap-3 py-2.5">
                  <div className="min-w-0">
                    <p className="text-sm text-ink-900">{i.title}</p>
                    <p className="text-xs text-ink-400">
                      {i.business_ref} · détecté le {formatDate(i.detected_at)} · {i.status}
                    </p>
                  </div>
                  <Badge tone={i.severity === 'S1' || i.severity === 'S2' ? 'stop' : 'warn'}>
                    {i.severity}
                  </Badge>
                </li>
              ))}
            </ul>
          ) : (
            <Empty>Aucun incident ouvert.</Empty>
          )}
        </Card>

        <Card
          title="Gates refusés récemment"
          subtitle="Les refus sont tracés au même titre que les autorisations."
        >
          {blockedGates?.length ? (
            <ul className="divide-y divide-ink-100">
              {blockedGates.map((entry) => (
                <li key={entry.id} className="py-2.5">
                  <p className="text-sm text-ink-900">{entry.summary}</p>
                  <p className="text-xs text-ink-400">
                    {entry.entity_ref} · {formatDate(entry.occurred_at)}
                  </p>
                </li>
              ))}
            </ul>
          ) : (
            <Empty>Aucun refus enregistré.</Empty>
          )}
        </Card>
      </div>
    </Shell>
  )
}

function Stat({
  label,
  value,
  tone,
}: {
  label: string
  value: number
  tone: 'warn' | 'stop'
}) {
  return (
    <div className="rounded-lg border border-ink-200 bg-white px-4 py-3">
      <p
        className={`text-2xl font-semibold ${
          value === 0 ? 'text-ink-400' : tone === 'stop' ? 'text-rose-700' : 'text-amber-700'
        }`}
      >
        {value}
      </p>
      <p className="mt-0.5 text-xs text-ink-600">{label}</p>
    </div>
  )
}

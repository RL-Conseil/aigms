import { Badge } from '@/components/ui'
import { formatDate } from '@/lib/domain/governance'
import { DECISION_STATUS_LABELS, DECISION_TYPE_LABELS, RISK_LEVEL_LABELS, VERDICT_LABELS, type ReassessmentVerdict, type RiskLevel } from '@/lib/domain/governance'

/**
 * L'ordre du jour d'une revue, tel que la base l'a genere : ce qui s'est
 * passe depuis la derniere revue, et ce qui attend. Il se lit avant, se
 * revoit pendant, s'imprime avec le compte rendu.
 */
export type Agenda = {
  since: string
  decisions: { business_ref: string; subject: string; type: string; status: string; at: string }[]
  pending_decisions: number
  open_capa: { business_ref: string; incident: string; title: string; corrective_action: string; due_date: string | null; status: string }[]
  open_incidents: number
  incidents_since: number
  high_open_risks: { business_ref: string; title: string; level: string; status: string; use_case: string }[]
  changes: { business_ref: string; title: string; status: string; verdict: string | null }[]
  reviews_due: { business_ref: string; name: string; next_review_at: string }[]
  overdue_actions: number
  stale_evidence: number
  vendors_due: { name: string; review_status: string; next_review_at: string | null }[]
}

function Section({ n, title, children }: { n: number; title: string; children: React.ReactNode }) {
  return (
    <section className="doc-keep">
      <h3 className="mb-1.5 text-sm font-semibold text-ink-900">
        <span className="mr-2 font-mono text-xs text-ink-400">{n}.</span>
        {title}
      </h3>
      <div className="text-sm text-ink-700">{children}</div>
    </section>
  )
}

export function ReviewAgenda({ agenda }: { agenda: Agenda }) {
  return (
    <div className="flex flex-col gap-5">
      <p className="text-xs text-ink-500">Période examinée : depuis le {formatDate(agenda.since)}.</p>

      <Section n={1} title={`Décisions de la période (${agenda.decisions.length}) · ${agenda.pending_decisions} à instruire`}>
        {agenda.decisions.length ? (
          <ul className="divide-y divide-ink-100">
            {agenda.decisions.map((d) => (
              <li key={d.business_ref} className="flex items-baseline justify-between gap-3 py-1.5">
                <span><span className="mr-2 font-mono text-xs text-ink-400">{d.business_ref}</span>{d.subject} <span className="text-xs text-ink-400">· {DECISION_TYPE_LABELS[d.type] ?? d.type}</span></span>
                <Badge tone={['approved', 'approved_with_conditions'].includes(d.status) ? 'ok' : d.status === 'rejected' ? 'stop' : 'neutral'}>
                  {DECISION_STATUS_LABELS[d.status] ?? d.status}
                </Badge>
              </li>
            ))}
          </ul>
        ) : <p className="text-ink-400">Aucune décision sur la période.</p>}
      </Section>

      <Section n={2} title={`Incidents et CAPA · ${agenda.incidents_since} incident(s) sur la période, ${agenda.open_incidents} ouvert(s), ${agenda.open_capa.length} CAPA en cours`}>
        {agenda.open_capa.length ? (
          <ul className="divide-y divide-ink-100">
            {agenda.open_capa.map((c) => (
              <li key={c.business_ref} className="py-1.5">
                <span className="mr-2 font-mono text-xs text-ink-400">{c.business_ref}</span>{c.corrective_action}
                <span className="block text-xs text-ink-400">{c.incident} {c.title}{c.due_date ? ` · échéance ${formatDate(c.due_date)}` : ''} · {c.status}</span>
              </li>
            ))}
          </ul>
        ) : <p className="text-ink-400">Aucune CAPA ouverte.</p>}
      </Section>

      <Section n={3} title={`Risques élevés ou critiques non soldés (${agenda.high_open_risks.length})`}>
        {agenda.high_open_risks.length ? (
          <ul className="divide-y divide-ink-100">
            {agenda.high_open_risks.map((r) => (
              <li key={r.business_ref} className="flex items-baseline justify-between gap-3 py-1.5">
                <span><span className="mr-2 font-mono text-xs text-ink-400">{r.business_ref}</span>{r.title} <span className="text-xs text-ink-400">· {r.use_case}</span></span>
                <Badge tone="stop">{RISK_LEVEL_LABELS[r.level as RiskLevel] ?? r.level}</Badge>
              </li>
            ))}
          </ul>
        ) : <p className="text-ok-600">Aucun.</p>}
      </Section>

      <Section n={4} title={`Changements de la période (${agenda.changes.length})`}>
        {agenda.changes.length ? (
          <ul className="divide-y divide-ink-100">
            {agenda.changes.map((c) => (
              <li key={c.business_ref} className="flex items-baseline justify-between gap-3 py-1.5">
                <span><span className="mr-2 font-mono text-xs text-ink-400">{c.business_ref}</span>{c.title}</span>
                <span className="text-xs text-ink-500">{c.verdict ? VERDICT_LABELS[c.verdict as ReassessmentVerdict] ?? c.verdict : 'non qualifié'} · {c.status}</span>
              </li>
            ))}
          </ul>
        ) : <p className="text-ink-400">Aucun changement.</p>}
      </Section>

      <Section n={5} title={`Ce qui attend · ${agenda.reviews_due.length} revue(s) de cas d’usage échue(s), ${agenda.overdue_actions} action(s) échue(s), ${agenda.stale_evidence} preuve(s) à renouveler, ${agenda.vendors_due.length} fournisseur(s) à revoir`}>
        {agenda.reviews_due.length || agenda.vendors_due.length ? (
          <ul className="divide-y divide-ink-100">
            {agenda.reviews_due.map((u) => (
              <li key={u.business_ref} className="py-1.5"><span className="mr-2 font-mono text-xs text-ink-400">{u.business_ref}</span>{u.name} <span className="text-xs text-stop-600">· revue attendue le {formatDate(u.next_review_at)}</span></li>
            ))}
            {agenda.vendors_due.map((v) => (
              <li key={v.name} className="py-1.5">{v.name} <span className="text-xs text-ink-500">· revue tiers {v.review_status}{v.next_review_at ? ` · ${formatDate(v.next_review_at)}` : ''}</span></li>
            ))}
          </ul>
        ) : <p className="text-ink-400">Rien en retard.</p>}
      </Section>
    </div>
  )
}

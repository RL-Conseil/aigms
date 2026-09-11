import Link from 'next/link'
import {
  ATTENTION_ORDER,
  attentionLabel,
  describeAttention,
  isLate,
  type Attention,
  type AttentionKind,
} from '@/lib/governance/attention'

/**
 * Reperes d'avancement.
 *
 * Une pastille dit qu'il y a quelque chose a faire ; elle ne dit pas quoi. La
 * barre, elle, nomme chaque acte. Les deux se completent : la pastille attire
 * dans le menu, la barre explique une fois la page ouverte.
 *
 * Un compteur a zero ne s'affiche pas. Un « 0 action echue » occupe la meme
 * place qu'un vrai retard et apprend a ne plus regarder.
 */

export function AttentionDot({
  count,
  late = true,
  label,
}: {
  count: number
  late?: boolean
  label?: string
}) {
  if (!count) return null

  return (
    <span
      aria-label={label ? `${count} ${label}` : undefined}
      className={`ml-1.5 inline-flex min-w-[1.25rem] items-center justify-center rounded-full px-1.5 py-0.5 text-[11px] font-semibold tabular-nums ${
        late ? 'bg-stop-600/10 text-stop-600' : 'bg-warn-600/10 text-warn-600'
      }`}
    >
      {count > 99 ? '99+' : count}
    </span>
  )
}

/**
 * Ce qui appelle une action, nomme acte par acte.
 *
 * Chaque compteur est un lien : lire un retard sans pouvoir l'atteindre
 * obligerait a le retrouver soi-meme.
 */
export function AttentionBar({
  attention,
  organizationId,
  kinds = ATTENTION_ORDER,
}: {
  attention: Attention
  organizationId: string
  kinds?: AttentionKind[]
}) {
  const shown = kinds.filter((kind) => attention[kind] > 0)

  if (!shown.length) {
    return (
      <p className="rounded-lg border border-ok-600/25 bg-ok-600/5 px-4 py-3 text-sm text-ok-600">
        Rien n’appelle d’action sur cette organisation.
      </p>
    )
  }

  const destination: Record<AttentionKind, string> = {
    overdue_actions: '/admin/pilotage',
    open_incidents: '/admin/pilotage',
    high_risks_open: `/admin/organizations/${organizationId}/processus?vue=risques`,
    reviews_due: '/admin/pilotage',
    stale_evidence: `/admin/organizations/${organizationId}/preuves`,
    evidence_to_review: `/admin/organizations/${organizationId}/preuves`,
    soa_undecided: `/admin/organizations/${organizationId}/declaration-applicabilite`,
  }

  return (
    <ul className="flex flex-wrap gap-2">
      {shown.map((kind) => (
        <li key={kind}>
          <Link
            href={destination[kind]}
            className={`inline-flex items-baseline gap-1.5 rounded-lg border px-3 py-2 text-sm hover:bg-ink-50 ${
              isLate(kind) ? 'border-stop-600/25 bg-stop-600/5' : 'border-ink-200 bg-white'
            }`}
          >
            <span
              className={`text-base font-semibold tabular-nums ${
                isLate(kind) ? 'text-stop-600' : 'text-ink-900'
              }`}
            >
              {attention[kind]}
            </span>
            <span className="text-ink-600">{attentionLabel(kind, attention[kind])}</span>
          </Link>
        </li>
      ))}
    </ul>
  )
}

/** Resume d'une ligne, pour la liste des organisations. */
export function AttentionSummary({ attention }: { attention: Attention }) {
  const parts = describeAttention(attention)

  if (!parts.length) {
    return <span className="text-xs text-ok-600">Rien en attente</span>
  }

  return (
    <span className="text-xs text-ink-500">
      {parts.slice(0, 3).join(' · ')}
      {parts.length > 3 ? ` · +${parts.length - 3}` : ''}
    </span>
  )
}

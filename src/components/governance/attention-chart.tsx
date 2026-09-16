import Link from 'next/link'
import {
  ATTENTION_ORDER,
  ATTENTION_SECTION_ORDER,
  ATTENTION_SECTIONS,
  attentionDestination,
  attentionLabel,
  isLate,
  type Attention,
  type AttentionKind,
} from '@/lib/governance/attention'

/**
 * Ce qui appelle une action, par nature.
 *
 * Un tableau de bord synthetique repond a « ou porter l'effort », pas a « quels
 * sont les elements ». Une barre le dit d'un coup d'oeil ; son libelle conduit
 * a la liste filtree ou l'on agit. Les listes ne sont donc plus sur cette page :
 * elles vivent la ou l'on traite — suivi, preuves, decisions, risques.
 *
 * Sur UNE organisation, chaque libelle est un lien. Sur plusieurs, il n'y a pas
 * d'endroit unique ou aller : la ventilation par organisation, dessous, porte
 * les liens.
 *
 * Pas de bibliotheque : des barres horizontales en HTML se lisent au clavier,
 * s'impriment, et ne coutent rien. L'echelle est relative au plus grand
 * compteur — l'indiquer evite de lire une proportion qui n'existe pas.
 */
export function AttentionChart({
  rows,
  organizationId,
}: {
  rows: Attention[]
  /** Renseigne, chaque libelle devient un lien vers la liste filtree. */
  organizationId?: string
}) {
  const totals = ATTENTION_ORDER.map((kind) => ({
    kind,
    count: rows.reduce((sum, row) => sum + row[kind], 0),
  })).filter((entry) => entry.count > 0)

  if (!totals.length) {
    return (
      <p className="rounded-lg border border-ok-600/25 bg-ok-600/5 px-4 py-3 text-sm text-ok-600">
        Rien n’appelle d’action sur votre périmètre.
      </p>
    )
  }

  const max = Math.max(...totals.map((entry) => entry.count))

  // Par rubrique : la section ou l'on agit sert d'en-tete, et le libelle
  // dessous dit quoi. Lire « Suivi › Actions » au-dessus de « 2 actions
  // echues » situe le chiffre avant meme de cliquer.
  const groups = ATTENTION_SECTION_ORDER.map((section) => ({
    section,
    entries: totals.filter((entry) => ATTENTION_SECTIONS[entry.kind].section === section),
  })).filter((group) => group.entries.length > 0)

  return (
    <div className="flex flex-col gap-4">
      {groups.map((group) => (
        <section key={group.section}>
          <h3 className="mb-1.5 text-[11px] font-semibold uppercase tracking-wide text-ink-500">
            {group.section}
          </h3>
          <div className="flex flex-col gap-2.5 border-l-2 border-ink-100 pl-3">
            {group.entries.map(({ kind, count }) => (
              <Bar key={kind} kind={kind} count={count} max={max} organizationId={organizationId} />
            ))}
          </div>
        </section>
      ))}

      <p className="text-xs leading-relaxed text-ink-500">
        Les longueurs se comparent entre elles, pas à un objectif. Le rouge marque ce qui aurait
        déjà dû être fait, l’ambre ce qui attend une main.
        {organizationId ? ' Chaque libellé ouvre la liste correspondante.' : ''}
      </p>
    </div>
  )
}

function Bar({
  kind,
  count,
  max,
  organizationId,
}: {
  kind: AttentionKind
  count: number
  max: number
  organizationId?: string
}) {
  const label = attentionLabel(kind, count)
  const late = isLate(kind)
  const tab = ATTENTION_SECTIONS[kind].tab
  const body = (
    <>
      <div className="mb-1 flex items-baseline justify-between gap-4">
        <span className={`text-sm ${organizationId ? 'text-ink-800 group-hover:underline' : 'text-ink-700'}`}>
          {tab ? <span className="mr-1.5 text-xs text-ink-400">{tab} ›</span> : null}
          {label}
        </span>
        <span className={`text-sm font-semibold tabular-nums ${late ? 'text-stop-600' : 'text-warn-600'}`}>
          {count}
        </span>
      </div>
      <div className="h-2 rounded-full bg-ink-100">
        <div
          className={`h-2 rounded-full ${late ? 'bg-stop-600' : 'bg-warn-600'}`}
          style={{ width: `${Math.round((count / max) * 100)}%` }}
        />
      </div>
    </>
  )

  if (!organizationId) return <div>{body}</div>
  return (
    <Link
      href={attentionDestination(kind, organizationId)}
      aria-label={`${count} ${label} — ouvrir la liste`}
      className="group block rounded-md -mx-2 px-2 py-1 hover:bg-ink-50"
    >
      {body}
    </Link>
  )
}

/**
 * La ventilation par organisation : sur un portefeuille, c'est la question
 * suivante — « chez qui ? ». Chaque compteur mene a la liste filtree de ce
 * client.
 */
export function AttentionByOrganization({ rows }: { rows: Attention[] }) {
  const active = rows.filter((row) => row.total > 0).sort((a, b) => b.total - a.total)
  if (!active.length) return null

  return (
    <div className="overflow-x-auto">
      <table className="w-full border-collapse text-sm">
        <thead>
          <tr className="border-b border-ink-200 text-left text-xs text-ink-500">
            <th className="py-2 pr-3 font-medium">Organisation</th>
            {ATTENTION_ORDER.map((kind) => (
              <th key={kind} className="px-1.5 py-2 text-center font-medium" title={attentionLabel(kind, 2)}>
                {SHORT[kind]}
              </th>
            ))}
            <th className="py-2 pl-3 text-right font-medium">Total</th>
          </tr>
        </thead>
        <tbody>
          {active.map((row) => (
            <tr key={row.organization_id} className="border-b border-ink-100">
              <th scope="row" className="py-2 pr-3 text-left font-medium text-ink-900">
                <Link href={`/admin/organizations/${row.organization_id}`} className="hover:underline">
                  {row.organization_name}
                </Link>
              </th>
              {ATTENTION_ORDER.map((kind) => (
                <td key={kind} className="px-1.5 py-2 text-center tabular-nums">
                  {row[kind] ? (
                    <Link
                      href={attentionDestination(kind, row.organization_id)}
                      aria-label={`${row.organization_name} : ${row[kind]} ${attentionLabel(kind, row[kind])}`}
                      className={`inline-block min-w-[1.75rem] rounded px-1.5 py-0.5 font-semibold hover:underline ${
                        isLate(kind) ? 'bg-stop-600/10 text-stop-600' : 'bg-warn-600/10 text-warn-600'
                      }`}
                    >
                      {row[kind]}
                    </Link>
                  ) : (
                    <span className="text-ink-300">·</span>
                  )}
                </td>
              ))}
              <td className="py-2 pl-3 text-right font-semibold tabular-nums text-ink-900">{row.total}</td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  )
}

/** En-tetes courts : sept intitules complets ne tiennent pas en largeur. */
const SHORT: Record<AttentionKind, string> = {
  overdue_actions: 'Actions',
  open_incidents: 'Incidents',
  reviews_due: 'Revues',
  high_risks_open: 'Risques',
  stale_evidence: 'À renouveler',
  evidence_to_review: 'À valider',
  soa_undecided: 'SoA',
}

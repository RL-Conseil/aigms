import Link from 'next/link'
import type { ReactNode } from 'react'
import { InfoTip } from '@/components/info-tip'
import {
  ACTION_STATUS_LABELS,
  INCIDENT_STATUS_LABELS,
  RISK_LEVEL_LABELS,
  RISK_STATUS_LABELS,
  CONTROL_STATUS_LABELS,
  controlStatusTone,
  FRESHNESS_LABELS,
  formatDate,
  type EvidenceFreshness,
  type RiskLevel,
} from '@/lib/domain/governance'

/**
 * « Ce qui s'y joue », en tuiles.
 *
 * Neuf lignes de chiffres se lisaient de haut en bas sans qu'aucune ne dise
 * QUOI : deux risques élevés ouverts, mais lesquels ? La tuile garde le
 * chiffre, l'infobulle nomme les pièces, et le lien conduit là où on agit.
 *
 * Les pièces viennent de `app.activity_stakes`, avec les mêmes prédicats que
 * les compteurs de `app.process_map` : ce que la tuile compte et ce que
 * l'infobulle liste ne peuvent pas diverger.
 */

export type Stakes = {
  available: boolean
  risks: {
    id: string
    ref: string
    title: string
    level: RiskLevel
    status: string
    open: boolean
    use_case_id: string
    use_case: string
  }[]
  controls_not_operating: { id: string; code: string; name: string; status: string }[]
  controls_by_use_case: {
    use_case_id: string
    use_case: string
    ref: string
    controls: { id: string; code: string; name: string; status: string; is_mandatory: boolean }[]
  }[]
  stale_evidence: {
    id: string
    ref: string
    title: string
    valid_until: string | null
    freshness: EvidenceFreshness
    control_code: string
  }[]
  open_incidents: {
    id: string
    ref: string
    title: string
    severity: string
    status: string
    use_case_id: string
    use_case: string
  }[]
  overdue_actions: {
    id: string
    ref: string
    title: string
    due_date: string
    status: string
    use_case_id: string
    use_case: string
  }[]
  reviews_due: { use_case_id: string; use_case: string; ref: string; next_review_at: string }[]
}

type Tone = 'neutral' | 'ok' | 'warn' | 'stop'

const VALUE_TONE: Record<Tone, string> = {
  neutral: 'text-ink-900',
  ok: 'text-ok-600',
  warn: 'text-warn-600',
  stop: 'text-stop-600',
}

function Tile({
  label,
  value,
  suffix,
  tone = 'neutral',
  href,
  detail,
  detailTitle,
}: {
  label: string
  value: ReactNode
  suffix?: string
  tone?: Tone
  /** Là où l'on agit sur ce que la tuile compte. */
  href?: string
  /** Les pièces derrière le chiffre. Absent quand il n'y a rien à nommer. */
  detail?: ReactNode
  detailTitle?: string
}) {
  const figure = (
    <span className={`text-lg font-semibold tabular-nums leading-none ${VALUE_TONE[tone]}`}>
      {value}
      {suffix ? <span className="ml-1 text-xs font-normal text-ink-400">{suffix}</span> : null}
    </span>
  )
  return (
    <div className="flex items-start justify-between gap-2 rounded-md border border-ink-100 bg-ink-50/60 px-3 py-2.5">
      <div className="min-w-0">
        <p className="text-[11px] leading-tight text-ink-500">{label}</p>
        <p className="mt-1">
          {href ? (
            <Link href={href} className="hover:underline">
              {figure}
            </Link>
          ) : (
            figure
          )}
        </p>
      </div>
      {detail ? (
        <InfoTip label={`Détail : ${label}`} title={detailTitle ?? label}>
          {detail}
        </InfoTip>
      ) : null}
    </div>
  )
}

function ItemList({ children }: { children: ReactNode }) {
  return <ul className="flex flex-col divide-y divide-ink-100 text-sm">{children}</ul>
}

function Item({
  href,
  primary,
  secondary,
  tone,
}: {
  href: string
  primary: ReactNode
  secondary?: ReactNode
  tone?: Tone
}) {
  return (
    <li className="py-2 first:pt-0 last:pb-0">
      <Link href={href} className="block hover:underline">
        <span className={`block font-medium ${tone ? VALUE_TONE[tone] : 'text-ink-900'}`}>
          {primary}
        </span>
        {secondary ? <span className="block text-xs text-ink-500">{secondary}</span> : null}
      </Link>
    </li>
  )
}

function riskTone(level: RiskLevel | null): Tone {
  if (level === 'critical' || level === 'high') return 'stop'
  if (level === 'moderate') return 'warn'
  return 'neutral'
}

export function ActivityStakes({
  organizationId,
  activityId,
  counts,
  stakes,
}: {
  organizationId: string
  activityId: string
  counts: {
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
  stakes: Stakes
}) {
  const base = `/admin/organizations/${organizationId}`
  const openRisks = stakes.risks.filter((r) => r.open)

  return (
    <div className="grid grid-cols-2 gap-2">
      <Tile
        label="Usages d’IA"
        value={counts.use_case_count}
        suffix={counts.in_service_count ? `${counts.in_service_count} en service` : undefined}
        href={`${base}/processus?activite=${activityId}`}
      />

      <Tile
        label="Risque le plus élevé"
        value={counts.max_risk_level ? RISK_LEVEL_LABELS[counts.max_risk_level] : '—'}
        tone={riskTone(counts.max_risk_level)}
        href={`${base}/processus?vue=risques`}
        detailTitle="Les risques de cette activité"
        detail={
          stakes.risks.length ? (
            <ItemList>
              {stakes.risks.map((r) => (
                <Item
                  key={r.id}
                  href={`/admin/use-cases/${r.use_case_id}`}
                  tone={riskTone(r.level)}
                  primary={`${RISK_LEVEL_LABELS[r.level]} — ${r.title}`}
                  secondary={`${r.ref} · ${RISK_STATUS_LABELS[r.status] ?? r.status} · ${r.use_case}`}
                />
              ))}
            </ItemList>
          ) : undefined
        }
      />

      <Tile
        label="Risques élevés ouverts"
        value={counts.open_high_risks}
        tone={counts.open_high_risks ? 'stop' : 'ok'}
        href={`${base}/processus?vue=risques`}
        detailTitle="Sans traitement abouti ni acceptation"
        detail={
          openRisks.length ? (
            <ItemList>
              {openRisks.map((r) => (
                <Item
                  key={r.id}
                  href={`/admin/use-cases/${r.use_case_id}`}
                  tone="stop"
                  primary={r.title}
                  secondary={`${r.ref} · ${RISK_LEVEL_LABELS[r.level]} · ${RISK_STATUS_LABELS[r.status] ?? r.status}`}
                />
              ))}
            </ItemList>
          ) : undefined
        }
      />

      <Tile
        label="Contrôles applicables"
        value={counts.controls_total}
        suffix={
          counts.controls_total
            ? `· ${counts.controls_operating} opérant${counts.controls_operating > 1 ? 's' : ''}`
            : undefined
        }
        tone={
          counts.controls_total && counts.controls_operating < counts.controls_total
            ? 'warn'
            : 'neutral'
        }
        href={`${base}/controles`}
        detailTitle="Par cas d’usage : ce qui s’applique, et son état"
        detail={
          stakes.controls_by_use_case?.length ? (
            <div className="flex flex-col gap-4">
              {/*
                Un controle proposé n'est pas un controle mis en place, ni un
                controle operant : l'etat se lit sur chaque ligne, sous le cas
                d'usage qui l'attend — c'est la qu'on agit.
              */}
              {stakes.controls_by_use_case.map((group, index) => {
                const operating = group.controls.filter((c) => c.status === 'operating').length
                return (
                  <details key={group.use_case_id} open={index === 0} className="group">
                    <summary className="flex cursor-pointer list-none items-baseline justify-between gap-2 text-xs font-semibold uppercase tracking-wide text-ink-700">
                      <span className="flex items-center gap-1.5">
                        <span aria-hidden className="text-ink-400 transition-transform group-open:rotate-90">›</span>
                        {group.use_case}
                      </span>
                      <span className={`font-normal normal-case tracking-normal ${operating < group.controls.length ? 'text-warn-600' : 'text-ok-600'}`}>
                        {group.ref} · {operating}/{group.controls.length} opérant{operating > 1 ? 's' : ''}
                      </span>
                    </summary>
                    <div className="mt-1.5 pl-3">
                      {group.controls.length ? (
                        <ItemList>
                          {group.controls.map((c) => (
                            <Item
                              key={c.id}
                              href={`/admin/use-cases/${group.use_case_id}?onglet=controles&controle=${c.id}#controle-${c.id}`}
                              tone={controlStatusTone(c.status)}
                              primary={`${c.code} — ${c.name}`}
                              secondary={`${CONTROL_STATUS_LABELS[c.status] ?? c.status}${c.is_mandatory ? ' · obligatoire' : ''}`}
                            />
                          ))}
                        </ItemList>
                      ) : (
                        <p className="text-xs text-ink-400">Aucun contrôle retenu comme applicable.</p>
                      )}
                    </div>
                  </details>
                )
              })}
            </div>
          ) : stakes.controls_not_operating.length ? (
            <ItemList>
              {stakes.controls_not_operating.map((c) => (
                <Item
                  key={c.id}
                  href={`${base}/controles`}
                  tone="warn"
                  primary={`${c.code} — ${c.name}`}
                  secondary={CONTROL_STATUS_LABELS[c.status] ?? c.status}
                />
              ))}
            </ItemList>
          ) : undefined
        }
      />

      <Tile
        label="Preuves à renouveler"
        value={counts.evidence_stale}
        suffix={counts.evidence_total ? `/ ${counts.evidence_total}` : undefined}
        tone={counts.evidence_stale ? 'warn' : 'ok'}
        href={`${base}/preuves?etat=a-renouveler`}
        detailTitle="Échues ou proches de l’échéance"
        detail={
          stakes.stale_evidence.length ? (
            <ItemList>
              {stakes.stale_evidence.map((e) => (
                <Item
                  key={e.id}
                  href={`${base}/preuves?etat=a-renouveler`}
                  tone={e.freshness === 'expired' ? 'stop' : 'warn'}
                  primary={e.title}
                  secondary={`${e.ref} · ${FRESHNESS_LABELS[e.freshness]}${
                    e.valid_until ? ` le ${formatDate(e.valid_until)}` : ''
                  } · contrôle ${e.control_code}`}
                />
              ))}
            </ItemList>
          ) : undefined
        }
      />

      <Tile
        label="Incidents ouverts"
        value={counts.open_incidents}
        tone={counts.open_incidents ? 'stop' : 'ok'}
        href={`${base}/suivi?vue=incidents`}
        detailTitle="Non clos"
        detail={
          stakes.open_incidents.length ? (
            <ItemList>
              {stakes.open_incidents.map((i) => (
                <Item
                  key={i.id}
                  href={`/admin/use-cases/${i.use_case_id}`}
                  tone="stop"
                  primary={`${i.severity} — ${i.title}`}
                  secondary={`${i.ref} · ${INCIDENT_STATUS_LABELS[i.status] ?? i.status} · ${i.use_case}`}
                />
              ))}
            </ItemList>
          ) : undefined
        }
      />

      <Tile
        label="Actions échues"
        value={counts.overdue_actions}
        tone={counts.overdue_actions ? 'stop' : 'ok'}
        href={`${base}/suivi?vue=actions&etat=echues`}
        detailTitle="Échéance dépassée"
        detail={
          stakes.overdue_actions.length ? (
            <ItemList>
              {stakes.overdue_actions.map((a) => (
                <Item
                  key={a.id}
                  href={`/admin/use-cases/${a.use_case_id}`}
                  tone="stop"
                  primary={a.title}
                  secondary={`${a.ref} · échue le ${formatDate(a.due_date)} · ${
                    ACTION_STATUS_LABELS[a.status] ?? a.status
                  } · ${a.use_case}`}
                />
              ))}
            </ItemList>
          ) : undefined
        }
      />

      <Tile
        label="Revues en retard"
        value={counts.reviews_due}
        tone={counts.reviews_due ? 'warn' : 'ok'}
        href={`${base}/suivi?vue=revues`}
        detailTitle="Cas d’usage dont la revue est passée"
        detail={
          stakes.reviews_due.length ? (
            <ItemList>
              {stakes.reviews_due.map((u) => (
                <Item
                  key={u.use_case_id}
                  href={`/admin/use-cases/${u.use_case_id}`}
                  tone="warn"
                  primary={u.use_case}
                  secondary={`${u.ref} · revue attendue le ${formatDate(u.next_review_at)}`}
                />
              ))}
            </ItemList>
          ) : undefined
        }
      />
    </div>
  )
}

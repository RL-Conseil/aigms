import type { ReactNode } from 'react'

/**
 * Sante de la gouvernance.
 *
 * Un nombre sur cent dans un outil de gouvernance se lit spontanement comme un
 * taux de conformite. Ce composant refuse cette lecture : il nomme ce que
 * l'indice mesure, dit ce qu'il ne mesure pas, et affiche ses causes a cote de
 * lui. Un score sans ses causes ne serait qu'une opinion chiffree.
 */

export type Health =
  | { available: false; reason?: string }
  | {
      available: true
      score: number
      band: 'sound' | 'attention' | 'action_required'
      use_cases: number
      causes: { code: string; count: number; penalty: number; label: string }[]
    }

const BANDS: Record<string, { label: string; ring: string; text: string }> = {
  sound: { label: 'Dispositif entretenu', ring: 'ring-emerald-200 bg-emerald-50', text: 'text-emerald-800' },
  attention: { label: 'Points à reprendre', ring: 'ring-amber-200 bg-amber-50', text: 'text-amber-800' },
  action_required: { label: 'Reprise nécessaire', ring: 'ring-rose-200 bg-rose-50', text: 'text-rose-800' },
}

export function GovernanceHealth({ health, compact }: { health: Health; compact?: boolean }) {
  if (!health.available) {
    return (
      <p className="text-sm text-ink-500">
        {health.reason ?? 'Indice non calculable sur ce périmètre.'}
      </p>
    )
  }

  const band = BANDS[health.band]!

  return (
    <div>
      <div className={`flex items-baseline gap-3 rounded-lg px-4 py-3 ring-1 ring-inset ${band.ring}`}>
        <span className={`text-3xl font-semibold tabular-nums ${band.text}`}>{health.score}</span>
        <span className="text-sm text-ink-500">/ 100</span>
        <span className={`ml-auto text-sm font-medium ${band.text}`}>{band.label}</span>
      </div>

      <p className="mt-2.5 text-xs leading-relaxed text-ink-500">
        Mesure l’<strong className="font-medium text-ink-700">entretien du dispositif</strong> :
        risques laissés sans suite, preuves échues, revues en retard. Ce n’est{' '}
        <strong className="font-medium text-ink-700">pas un taux de conformité</strong> — une
        organisation à jour de son entretien peut rester non conforme, et l’inverse est vrai.
      </p>

      {health.causes.length ? (
        <ul className="mt-3 flex flex-col gap-1.5">
          {health.causes.map((cause) => (
            <li key={cause.code} className="flex items-baseline justify-between gap-3 text-[13px]">
              <span className="text-ink-600">{cause.label}</span>
              <span className="shrink-0 tabular-nums text-ink-400">−{cause.penalty}</span>
            </li>
          ))}
        </ul>
      ) : (
        <p className="mt-3 text-[13px] text-emerald-800">
          Rien à reprendre sur ce périmètre.
        </p>
      )}

      {!compact ? (
        <p className="mt-3 border-t border-ink-100 pt-3 text-xs text-ink-400">
          Calculé sur {health.use_cases} usage(s) d’IA. Chaque pénalité est plafonnée : l’indice se
          recalcule de tête à partir des lignes ci-dessus.
        </p>
      ) : null}
    </div>
  )
}

export function Metric({
  label,
  value,
  tone = 'neutral',
  suffix,
}: {
  label: string
  value: ReactNode
  tone?: 'neutral' | 'ok' | 'warn' | 'stop'
  suffix?: string
}) {
  const color =
    tone === 'stop'
      ? 'text-rose-700'
      : tone === 'warn'
        ? 'text-amber-700'
        : tone === 'ok'
          ? 'text-emerald-700'
          : 'text-ink-900'

  return (
    <div className="flex items-baseline justify-between gap-3 border-b border-ink-100 py-2 last:border-0">
      <span className="text-[13px] text-ink-600">{label}</span>
      <span className={`text-sm font-medium tabular-nums ${color}`}>
        {value}
        {suffix ? <span className="text-ink-400"> {suffix}</span> : null}
      </span>
    </div>
  )
}

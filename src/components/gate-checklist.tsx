import type { GateResult } from '@/lib/domain/governance'
import { Badge } from '@/components/ui'

/**
 * Restitution d'un gate. Chaque precondition est affichee, y compris celles qui
 * passent : un responsable doit pouvoir justifier pourquoi une mise en
 * production a ete autorisee, pas seulement pourquoi elle a ete refusee.
 */
export function GateChecklist({ gate }: { gate: GateResult }) {
  return (
    <div>
      <div className="mb-3 flex items-center gap-2">
        <Badge tone={gate.satisfied ? 'ok' : 'stop'}>
          {gate.satisfied ? 'Préconditions satisfaites' : 'Préconditions non satisfaites'}
        </Badge>
        <span className="text-xs text-ink-400">
          {gate.checks.filter((c) => c.satisfied).length} / {gate.checks.length}
        </span>
      </div>

      <ul className="divide-y divide-ink-100">
        {gate.checks.map((check) => (
          <li key={check.code} className="flex gap-3 py-2.5">
            <span
              aria-hidden
              className={`mt-0.5 flex size-5 shrink-0 items-center justify-center rounded-full text-xs font-bold ${
                check.satisfied ? 'bg-emerald-100 text-emerald-700' : 'bg-rose-100 text-rose-700'
              }`}
            >
              {check.satisfied ? '✓' : '!'}
            </span>
            <div className="min-w-0">
              <p className="text-sm font-medium text-ink-900">
                {check.label}
                <span className="sr-only">
                  {check.satisfied ? ' — satisfaite' : ' — non satisfaite'}
                </span>
              </p>
              <p className="text-xs text-ink-600">{check.detail}</p>
            </div>
          </li>
        ))}
      </ul>
    </div>
  )
}

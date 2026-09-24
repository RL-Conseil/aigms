import { isBlocking, type GateResult } from '@/lib/domain/governance'
import { Badge } from '@/components/ui'

/**
 * Restitution d'un gate. Chaque precondition est affichee, y compris celles qui
 * passent : un responsable doit pouvoir justifier pourquoi une mise en
 * production a ete autorisee, pas seulement pourquoi elle a ete refusee.
 *
 * DEPUIS 0097, une precondition peut AVERTIR sans retenir le jalon. Elle se
 * distingue a l'oeil — ambre, pas rouge — et ne compte pas dans le decompte,
 * qui ne parle que de ce qui bloque. Un avertissement melange aux blocages
 * ferait croire a un refus ; separe, il se lit pour ce qu'il est : un ecart
 * que quelqu'un devra assumer nommement.
 */
export function GateChecklist({ gate }: { gate: GateResult }) {
  const blocking = gate.checks.filter(isBlocking)
  const warnings = gate.checks.filter((c) => !isBlocking(c) && !c.satisfied)

  return (
    <div>
      <div className="mb-3 flex flex-wrap items-center gap-2">
        <Badge tone={gate.satisfied ? 'ok' : 'stop'}>
          {gate.satisfied ? 'Préconditions satisfaites' : 'Préconditions non satisfaites'}
        </Badge>
        <span className="text-xs text-ink-400">
          {blocking.filter((c) => c.satisfied).length} / {blocking.length}
        </span>
        {warnings.length ? (
          <Badge tone="warn">
            {warnings.length} avertissement{warnings.length > 1 ? 's' : ''}
          </Badge>
        ) : null}
      </div>

      <ul className="divide-y divide-ink-100">
        {gate.checks.map((check) => {
          const bloquante = isBlocking(check)
          const tone = check.satisfied
            ? 'bg-emerald-100 text-emerald-700'
            : bloquante
              ? 'bg-rose-100 text-rose-700'
              : 'bg-warn-600/15 text-warn-600'
          return (
            <li key={check.code} className="flex gap-3 py-2.5">
              <span
                aria-hidden
                className={`mt-0.5 flex size-5 shrink-0 items-center justify-center rounded-full text-xs font-bold ${tone}`}
              >
                {check.satisfied ? '✓' : bloquante ? '!' : '△'}
              </span>
              <div className="min-w-0">
                <p className="text-sm font-medium text-ink-900">
                  {check.label}
                  {!bloquante && !check.satisfied ? (
                    <span className="ml-2 text-xs font-normal text-warn-600">
                      avertissement — ne retient pas le jalon
                    </span>
                  ) : null}
                  <span className="sr-only">
                    {check.satisfied
                      ? ' — satisfaite'
                      : bloquante
                        ? ' — non satisfaite, retient le jalon'
                        : ' — avertissement, ne retient pas le jalon'}
                  </span>
                </p>
                <p className="text-xs text-ink-600">{check.detail}</p>
                {/*
                  Ce que la verification a constate, nomme. Un compteur se
                  survole ; une liste de codes se verifie.
                */}
                {check.gap?.length ? (
                  <ul className="mt-1 flex flex-wrap gap-1.5">
                    {check.gap.map((g) => (
                      <li
                        key={g.control_id}
                        className={`rounded-full px-2 py-0.5 text-[11px] ${
                          g.is_mandatory ? 'bg-warn-600/10 text-warn-600' : 'bg-ink-100 text-ink-600'
                        }`}
                        title={g.name}
                      >
                        {g.code}
                        {g.is_mandatory ? ' · obligatoire' : ''}
                      </li>
                    ))}
                  </ul>
                ) : null}
              </div>
            </li>
          )
        })}
      </ul>
    </div>
  )
}

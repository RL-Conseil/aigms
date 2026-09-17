import {
  RACI_LETTERS,
  RACI_ROLES,
  ROLE_LABELS,
  ROLE_RACI,
  type RaciLetter,
} from '@/lib/domain/roles'
import { ScrollTable } from '@/components/ui'

/**
 * Le RACI des six roles de gouvernance.
 *
 * Il se lit a cote de la matrice des capacites, et ne dit pas la meme chose :
 * la matrice dit ce que la base LAISSE FAIRE a un role ; le RACI dit ce que
 * l'organisation ATTEND de lui a chaque etape. Les deux se recoupent sans se
 * confondre — un « A » du comite de direction sur l'arbitrage n'est pas un
 * droit d'ecriture, c'est une responsabilite que la decision porte nommement.
 */
const TONE: Record<Exclude<RaciLetter, null>, string> = {
  R: 'bg-brand-500/15 text-brand-700',
  A: 'bg-night-900 text-white',
  C: 'bg-warn-600/15 text-warn-600',
  I: 'bg-ink-100 text-ink-600',
}

export function RaciTable() {
  return (
    <div>
      <ScrollTable>
        <table className="w-full min-w-[720px] text-sm">
          <thead>
            <tr className="border-b border-ink-200 text-left text-xs uppercase tracking-wide text-ink-400">
              <th scope="col" className="pb-2 pr-4 font-medium">Étape du parcours</th>
              {RACI_ROLES.map((role) => (
                <th key={role} scope="col" className="pb-2 px-1.5 text-center font-medium">
                  {ROLE_LABELS[role]}
                </th>
              ))}
            </tr>
          </thead>
          <tbody className="divide-y divide-ink-100">
            {ROLE_RACI.map((row) => (
              <tr key={row.step}>
                <th scope="row" className="py-2.5 pr-4 text-left font-medium text-ink-900">
                  {row.step}
                  <span className="block text-xs font-normal text-ink-400">{row.where}</span>
                </th>
                {RACI_ROLES.map((role) => {
                  const letter = row.cells[role]
                  return (
                    <td key={role} className="px-1.5 py-2.5 text-center">
                      {letter ? (
                        <span
                          title={RACI_LETTERS[letter]}
                          aria-label={`${ROLE_LABELS[role]} : ${RACI_LETTERS[letter]}`}
                          className={`inline-flex size-7 items-center justify-center rounded-md text-xs font-semibold ${TONE[letter]}`}
                        >
                          {letter}
                        </span>
                      ) : (
                        <span className="text-ink-300">—</span>
                      )}
                    </td>
                  )
                })}
              </tr>
            ))}
          </tbody>
        </table>
      </ScrollTable>
      <ul className="mt-4 flex flex-wrap gap-x-5 gap-y-1.5 text-xs text-ink-500">
        {(Object.keys(RACI_LETTERS) as Exclude<RaciLetter, null>[]).map((letter) => (
          <li key={letter} className="flex items-center gap-1.5">
            <span className={`inline-flex size-5 items-center justify-center rounded text-[11px] font-semibold ${TONE[letter]}`}>
              {letter}
            </span>
            {RACI_LETTERS[letter]}
          </li>
        ))}
      </ul>
    </div>
  )
}

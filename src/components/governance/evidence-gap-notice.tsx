import { formatDateTime, type EvidenceGap } from '@/lib/domain/governance'

/**
 * Ce qu'une mise en production a laissé sans preuve, et qui l'a assumé.
 *
 * Figé à la soumission (0098) : une preuve déposée le lendemain ne réécrit
 * pas ce que l'approbateur a lu. C'est ce qui rend l'avertissement autre
 * chose qu'une formalité — il reste au dossier, nommé, avec la parole de
 * l'AI Governance Officer et la date de prise de connaissance.
 *
 * Rien ne s'affiche quand il n'y a pas d'écart : le silence est la
 * situation normale, et un « aucun écart » répété sur chaque décision
 * apprendrait à ne plus lire.
 */
export function EvidenceGapNotice({
  gap,
  statement,
  acknowledgedAt,
  acknowledgedBy,
}: {
  gap: EvidenceGap[] | null
  statement: string | null
  acknowledgedAt: string | null
  acknowledgedBy?: string | null
}) {
  if (!gap?.length) return null

  return (
    <div className="mt-2 rounded-md border border-warn-600/25 bg-warn-600/5 px-3.5 py-2.5">
      <p className="text-xs font-medium text-ink-900">
        Écart de preuve assumé — {gap.length} contrôle(s) applicable(s) sans preuve validée à la
        soumission
      </p>
      <ul className="mt-1.5 flex flex-wrap gap-1.5">
        {gap.map((g) => (
          <li
            key={g.control_id}
            title={g.name}
            className={`rounded-full px-2 py-0.5 text-[11px] ${
              g.is_mandatory ? 'bg-warn-600/15 text-warn-600' : 'bg-white text-ink-600'
            }`}
          >
            {g.code}
            {g.is_mandatory ? ' · obligatoire' : ''}
          </li>
        ))}
      </ul>
      {statement ? (
        <p className="mt-2 text-xs leading-relaxed text-ink-700">
          <span className="font-medium text-ink-900">Ce qu’en dit l’AI Governance Officer : </span>
          {statement}
        </p>
      ) : null}
      <p className="mt-1.5 text-[11px] text-ink-500">
        {acknowledgedAt
          ? `Pris en connaissance${acknowledgedBy ? ` par ${acknowledgedBy}` : ''} le ${formatDateTime(acknowledgedAt)}.`
          : 'En attente de la prise de connaissance par la personne appelée à se prononcer.'}
      </p>
    </div>
  )
}

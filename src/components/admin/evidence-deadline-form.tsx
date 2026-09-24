'use client'

import { useActionState } from 'react'
import { Field, FIELD, FormFeedback, Submit } from '@/components/forms'
import { setEvidenceDeadline } from '@/lib/actions/admin'
import type { Result } from '@/lib/actions/admin'

/**
 * La date a partir de laquelle l'absence de preuve retient la production.
 *
 * 0097 a fait de cet ecart un AVERTISSEMENT, pour ne pas rendre non conformes
 * du jour au lendemain les cas d'usage deja en production. Une voie douce sans
 * terme n'est pas une voie douce : cette date lui en donne un.
 *
 * Elle se fixe ici plutot que dans le code parce que c'est un engagement pris
 * envers UN client — il se negocie, se reporte, et doit se lire.
 */
export function EvidenceDeadlineForm({
  organizationId,
  current,
}: {
  organizationId: string
  current: string | null
}) {
  const [state, formAction, pending] = useActionState<Result | null, FormData>(
    setEvidenceDeadline,
    null,
  )

  return (
    <form action={formAction} className="flex flex-col gap-4">
      <input type="hidden" name="organizationId" value={organizationId} />

      <Field
        label="Preuves exigées à la mise en production à partir du"
        htmlFor="deadline"
        optional
        hint="Vide : l’écart de preuve reste un avertissement, il ne retient rien. Posée, la date se lit au détail du gate et dans les alertes."
      >
        <input
          id="deadline"
          name="enforcedFrom"
          type="date"
          defaultValue={current ?? ''}
          className={FIELD}
        />
      </Field>

      <div className="rounded-md bg-ink-100 px-3.5 py-3 text-xs leading-relaxed text-ink-600">
        <p className="mb-1.5 font-medium text-ink-800">Ce que la poser déclenche, tout de suite :</p>
        <ul className="flex list-disc flex-col gap-1 pl-4">
          <li>l’AI Governance Officer et l’Administrateur client en sont avertis ;</li>
          <li>
            chaque cas d’usage en pilote, en revue ou autorisé qui porte un écart reçoit sa relance,
            adressée à son porteur, avec les contrôles nommés ;
          </li>
          <li>deux rappels sont posés d’avance, à J-30 et J-7.</li>
        </ul>
        <p className="mt-2">
          La reporter rejoue le tout : les alertes précédentes sont remplacées, les rappels se
          reposent sur la nouvelle date. La retirer les efface.
        </p>
      </div>

      <FormFeedback state={state} />
      <Submit pending={pending} idle={current ? 'Modifier l’échéance' : 'Poser l’échéance'} />
    </form>
  )
}

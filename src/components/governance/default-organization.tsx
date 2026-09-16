'use client'

import { useActionState } from 'react'
import { setCurrentOrganization, type ProfileState } from '@/lib/actions/profile'

/**
 * « Par défaut » : l'organisation que l'on ouvre en arrivant, et sur laquelle
 * le pilotage se place sans qu'on le lui demande.
 *
 * Ce n'est qu'un point de vue — il n'ouvre aucun droit. Il se change ici, dans
 * la liste, la ou l'on compare ses clients ; un formulaire a part dans les
 * parametres ne suffisait pas a le faire trouver.
 */
export function DefaultOrganizationButton({
  organizationId,
  isDefault,
}: {
  organizationId: string
  isDefault: boolean
}) {
  const [state, formAction, pending] = useActionState<ProfileState | null, FormData>(
    setCurrentOrganization,
    null,
  )

  if (isDefault) {
    return (
      <span className="inline-flex items-center rounded-md border border-brand-500/40 bg-brand-500/5 px-2.5 py-1 text-xs font-medium text-brand-700">
        Par défaut
      </span>
    )
  }

  return (
    <form action={formAction} className="inline-flex items-center gap-2">
      <input type="hidden" name="organizationId" value={organizationId} />
      <button
        type="submit"
        disabled={pending}
        title="En faire l’organisation ouverte par défaut"
        className="rounded-md border border-ink-200 px-2.5 py-1 text-xs text-ink-600 hover:bg-ink-100 disabled:opacity-60"
      >
        {pending ? '…' : 'Définir par défaut'}
      </button>
      {state && !state.ok ? <span className="text-xs text-stop-600">{state.message}</span> : null}
    </form>
  )
}

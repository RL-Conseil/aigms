'use client'

import { useActionState } from 'react'
import { setCurrentOrganization, type ProfileState } from '@/lib/actions/profile'
import { FIELD, FormFeedback } from '@/components/forms'

/**
 * Choix de l'organisation courante.
 *
 * Il ne s'affiche qu'a partir de deux organisations gerees : proposer de
 * choisir quand il n'y a rien a choisir est une formalite vide.
 */
export function CurrentOrganizationForm({
  organizations,
  current,
}: {
  organizations: { id: string; name: string }[]
  current: string | null
}) {
  const [state, formAction, pending] = useActionState<ProfileState | null, FormData>(
    setCurrentOrganization,
    null,
  )

  if (organizations.length < 2) return null

  return (
    <form action={formAction} className="flex flex-col gap-3">
      <div>
        <label htmlFor="currentOrganization" className="mb-1.5 block text-sm font-medium">
          Organisation courante
        </label>
        <select
          id="currentOrganization"
          name="organizationId"
          defaultValue={current ?? ''}
          required
          className={FIELD}
        >
          <option value="" disabled>
            — Choisir
          </option>
          {organizations.map((organization) => (
            <option key={organization.id} value={organization.id}>
              {organization.name}
            </option>
          ))}
        </select>
        <p className="mt-1.5 text-xs leading-relaxed text-ink-500">
          Elle détermine ce que vous ouvrez en arrivant. Ce n’est qu’un point de vue : vos droits
          restent ceux que l’administration vous a attribués, organisation par organisation.
        </p>
      </div>

      <button
        type="submit"
        disabled={pending}
        className="self-start rounded-md bg-night-900 px-4 py-1.5 text-xs font-medium text-white hover:bg-night-800 disabled:opacity-60"
      >
        {pending ? 'Enregistrement…' : 'Se placer sur cette organisation'}
      </button>

      <FormFeedback state={state} />
    </form>
  )
}

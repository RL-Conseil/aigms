'use client'

import { useActionState } from 'react'
import { updateProfile, updateTenant, type ProfileState } from '@/lib/actions/profile'

const FIELD =
  'w-full rounded-md border border-ink-200 bg-white px-3 py-2 text-sm outline-none focus:border-brand-500 focus:ring-2 focus:ring-brand-500/20'

function Feedback({ state }: { state: ProfileState | null }) {
  if (!state) return null
  return (
    <p
      role="status"
      className={`rounded-md px-4 py-2.5 text-sm ${
        state.ok ? 'bg-emerald-50 text-emerald-800' : 'bg-rose-50 text-rose-800'
      }`}
    >
      {state.message}
    </p>
  )
}

export function ProfileForm({
  fullName,
  jobTitle,
  email,
}: {
  fullName: string | null
  jobTitle: string | null
  email: string
}) {
  const [state, formAction, pending] = useActionState<ProfileState | null, FormData>(
    updateProfile,
    null,
  )

  return (
    <form action={formAction} className="flex flex-col gap-4">
      <div>
        <label htmlFor="profile-email" className="mb-1.5 block text-sm font-medium">
          Adresse électronique
        </label>
        <input
          id="profile-email"
          type="email"
          value={email}
          disabled
          className={`${FIELD} bg-ink-100 text-ink-500`}
        />
        <p className="mt-1.5 text-xs text-ink-500">
          L’adresse identifie le compte : son changement passe par l’administration.
        </p>
      </div>

      <div>
        <label htmlFor="fullName" className="mb-1.5 block text-sm font-medium">
          Nom et prénom
        </label>
        <input
          id="fullName"
          name="fullName"
          type="text"
          required
          defaultValue={fullName ?? ''}
          className={FIELD}
        />
      </div>

      <div>
        <label htmlFor="jobTitle" className="mb-1.5 block text-sm font-medium">
          Fonction
        </label>
        <input
          id="jobTitle"
          name="jobTitle"
          type="text"
          defaultValue={jobTitle ?? ''}
          className={FIELD}
        />
      </div>

      <Feedback state={state} />

      <button
        type="submit"
        disabled={pending}
        className="self-start rounded-md bg-night-900 px-5 py-2.5 text-sm font-medium text-white hover:bg-night-800 disabled:opacity-60"
      >
        {pending ? 'Enregistrement…' : 'Enregistrer'}
      </button>
    </form>
  )
}

export function TenantForm({
  tenantId,
  name,
  editable,
}: {
  tenantId: string
  name: string
  editable: boolean
}) {
  const [state, formAction, pending] = useActionState<ProfileState | null, FormData>(
    updateTenant,
    null,
  )

  return (
    <form action={formAction} className="flex flex-col gap-4">
      <input type="hidden" name="tenantId" value={tenantId} />
      <div>
        <label htmlFor="tenant-name" className="mb-1.5 block text-sm font-medium">
          Nom de l’organisation
        </label>
        <input
          id="tenant-name"
          name="name"
          type="text"
          required
          defaultValue={name}
          disabled={!editable}
          className={editable ? FIELD : `${FIELD} bg-ink-100 text-ink-500`}
        />
        {!editable ? (
          <p className="mt-1.5 text-xs text-ink-500">
            La modification relève de l’administration de la plateforme.
          </p>
        ) : null}
      </div>

      <Feedback state={state} />

      {editable ? (
        <button
          type="submit"
          disabled={pending}
          className="self-start rounded-md bg-night-900 px-5 py-2.5 text-sm font-medium text-white hover:bg-night-800 disabled:opacity-60"
        >
          {pending ? 'Enregistrement…' : 'Enregistrer'}
        </button>
      ) : null}
    </form>
  )
}

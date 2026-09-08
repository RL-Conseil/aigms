'use client'

import { useActionState } from 'react'
import { useRouter } from 'next/navigation'
import { useEffect } from 'react'
import {
  changeAccountRole,
  createAccount,
  createOrganization,
} from '@/lib/actions/admin'
import { ASSIGNABLE_ROLES, ROLE_DESCRIPTIONS, ROLE_LABELS } from '@/lib/domain/roles'

type Result = { ok: true; message: string } | { ok: false; message: string }

const FIELD =
  'w-full rounded-md border border-ink-200 bg-white px-3 py-2 text-sm outline-none focus:border-brand-500 focus:ring-2 focus:ring-brand-500/20'

function Feedback({ state }: { state: Result | null }) {
  if (!state) return null
  return (
    <p
      role="status"
      className={`rounded-md px-4 py-3 text-sm ${
        state.ok ? 'bg-emerald-50 text-emerald-800' : 'bg-rose-50 text-rose-800'
      }`}
    >
      {state.message}
    </p>
  )
}

/** Creation d'une organisation cliente. */
export function OrganizationForm() {
  const router = useRouter()
  const [state, formAction, pending] = useActionState<Result | null, FormData>(
    createOrganization,
    null,
  )

  useEffect(() => {
    if (state?.ok) {
      const timer = setTimeout(() => router.push('/admin'), 1200)
      return () => clearTimeout(timer)
    }
  }, [state, router])

  return (
    <form action={formAction} className="flex flex-col gap-4">
      <div className="grid gap-4 sm:grid-cols-2">
        <div>
          <label htmlFor="name" className="mb-1.5 block text-sm font-medium">
            Nom d’usage
          </label>
          <input id="name" name="name" type="text" required maxLength={160} className={FIELD} />
        </div>
        <div>
          <label htmlFor="legalName" className="mb-1.5 block text-sm font-medium">
            Raison sociale <span className="font-normal text-ink-500">(facultatif)</span>
          </label>
          <input id="legalName" name="legalName" type="text" maxLength={160} className={FIELD} />
        </div>
      </div>

      <div className="grid gap-4 sm:grid-cols-3">
        <div>
          <label htmlFor="sector" className="mb-1.5 block text-sm font-medium">
            Secteur
          </label>
          <input id="sector" name="sector" type="text" maxLength={120} className={FIELD} />
        </div>
        <div>
          <label htmlFor="countryCode" className="mb-1.5 block text-sm font-medium">
            Pays
          </label>
          <input
            id="countryCode"
            name="countryCode"
            type="text"
            maxLength={2}
            placeholder="FR"
            className={`${FIELD} uppercase`}
          />
        </div>
        <div>
          <label htmlFor="headcount" className="mb-1.5 block text-sm font-medium">
            Effectif
          </label>
          <input id="headcount" name="headcount" type="number" min={0} className={FIELD} />
        </div>
      </div>

      <div>
        <label htmlFor="status" className="mb-1.5 block text-sm font-medium">
          Statut
        </label>
        <select id="status" name="status" defaultValue="prospect" className={FIELD}>
          <option value="prospect">Prospect</option>
          <option value="pilot">Pilote</option>
          <option value="active">Actif</option>
          <option value="archived">Archivé</option>
        </select>
      </div>

      <Feedback state={state} />

      <button
        type="submit"
        disabled={pending}
        className="self-start rounded-md bg-night-900 px-5 py-2.5 text-sm font-medium text-white hover:bg-night-800 disabled:opacity-60"
      >
        {pending ? 'Création…' : 'Créer l’organisation'}
      </button>
    </form>
  )
}

/** Declaration d'un compte et attribution de son role. */
export function AccountForm({
  organizations,
}: {
  organizations: { id: string; name: string }[]
}) {
  const [state, formAction, pending] = useActionState<Result | null, FormData>(createAccount, null)

  return (
    <form action={formAction} className="flex flex-col gap-4">
      <div className="grid gap-4 sm:grid-cols-2">
        <div>
          <label htmlFor="fullName" className="mb-1.5 block text-sm font-medium">
            Nom et prénom
          </label>
          <input id="fullName" name="fullName" type="text" required className={FIELD} />
        </div>
        <div>
          <label htmlFor="email" className="mb-1.5 block text-sm font-medium">
            Adresse électronique
          </label>
          <input id="email" name="email" type="email" required className={FIELD} />
        </div>
      </div>

      <div className="grid gap-4 sm:grid-cols-2">
        <div>
          <label htmlFor="jobTitle" className="mb-1.5 block text-sm font-medium">
            Fonction <span className="font-normal text-ink-500">(facultatif)</span>
          </label>
          <input id="jobTitle" name="jobTitle" type="text" className={FIELD} />
        </div>
        <div>
          <label htmlFor="organizationId" className="mb-1.5 block text-sm font-medium">
            Organisation <span className="font-normal text-ink-500">(facultatif)</span>
          </label>
          <select id="organizationId" name="organizationId" defaultValue="" className={FIELD}>
            <option value="">Toutes les organisations</option>
            {organizations.map((org) => (
              <option key={org.id} value={org.id}>
                {org.name}
              </option>
            ))}
          </select>
        </div>
      </div>

      <div>
        <label htmlFor="role" className="mb-1.5 block text-sm font-medium">
          Rôle
        </label>
        <select id="role" name="role" defaultValue="system_owner" className={FIELD}>
          {ASSIGNABLE_ROLES.map((role) => (
            <option key={role} value={role}>
              {ROLE_LABELS[role]}
            </option>
          ))}
        </select>
        <ul className="mt-3 flex flex-col gap-1.5 rounded-md bg-ink-100 px-4 py-3">
          {ASSIGNABLE_ROLES.map((role) => (
            <li key={role} className="text-xs leading-relaxed text-ink-600">
              <span className="font-medium text-ink-900">{ROLE_LABELS[role]}</span> —{' '}
              {ROLE_DESCRIPTIONS[role]}
            </li>
          ))}
        </ul>
      </div>

      <div>
        <label htmlFor="password" className="mb-1.5 block text-sm font-medium">
          Mot de passe provisoire
        </label>
        <input
          id="password"
          name="password"
          type="text"
          required
          minLength={12}
          className={FIELD}
          placeholder="Au moins douze caractères"
        />
        <p className="mt-1.5 text-xs text-ink-500">
          À transmettre à la personne par un canal distinct de son adresse électronique. Le
          changement de mot de passe depuis l’application reste à construire : en attendant, il se
          fait depuis la console Supabase.
        </p>
      </div>

      <Feedback state={state} />

      <button
        type="submit"
        disabled={pending}
        className="self-start rounded-md bg-night-900 px-5 py-2.5 text-sm font-medium text-white hover:bg-night-800 disabled:opacity-60"
      >
        {pending ? 'Création…' : 'Déclarer le compte'}
      </button>
    </form>
  )
}

/** Changement du role d'un compte deja declare. */
export function RoleForm({ userId, currentRole }: { userId: string; currentRole: string }) {
  const [state, formAction, pending] = useActionState<Result | null, FormData>(
    changeAccountRole,
    null,
  )

  return (
    <form action={formAction} className="flex items-center gap-2">
      <input type="hidden" name="userId" value={userId} />
      <label htmlFor={`role-${userId}`} className="sr-only">
        Rôle
      </label>
      <select
        id={`role-${userId}`}
        name="role"
        defaultValue={ASSIGNABLE_ROLES.includes(currentRole as never) ? currentRole : 'auditor'}
        className="rounded-md border border-ink-200 bg-white px-2.5 py-1.5 text-sm"
      >
        {ASSIGNABLE_ROLES.map((role) => (
          <option key={role} value={role}>
            {ROLE_LABELS[role]}
          </option>
        ))}
      </select>
      <button
        type="submit"
        disabled={pending}
        className="rounded-md border border-ink-200 px-3 py-1.5 text-sm text-ink-700 hover:bg-ink-100 disabled:opacity-60"
      >
        {pending ? '…' : 'Appliquer'}
      </button>
      {state ? (
        <span className={`text-xs ${state.ok ? 'text-emerald-700' : 'text-rose-700'}`}>
          {state.ok ? 'Enregistré' : state.message}
        </span>
      ) : null}
    </form>
  )
}

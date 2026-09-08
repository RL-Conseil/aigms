'use client'

import { useActionState } from 'react'
import { submitContactRequest, type ContactState } from '@/lib/actions/contact'

const PROFILES = [
  { value: 'direction', label: 'Direction générale' },
  { value: 'dsi_rssi_dpo', label: 'DSI, RSSI ou DPO' },
  { value: 'metier', label: 'Direction métier' },
  { value: 'conseil_msp_integrateur', label: 'Cabinet, MSP ou intégrateur' },
  { value: 'autre', label: 'Autre' },
] as const

const FIELD =
  'w-full rounded-md border border-ink-200 bg-white px-3.5 py-2.5 text-[15px] outline-none focus:border-brand-500 focus:ring-2 focus:ring-brand-500/20'

function FieldError({ message }: { message?: string }) {
  if (!message) return null
  return (
    <p className="mt-1.5 text-[13px] text-stop-600" role="alert">
      {message}
    </p>
  )
}

export function ContactForm() {
  const [state, formAction, pending] = useActionState<ContactState, FormData>(
    submitContactRequest,
    { status: 'idle' },
  )

  if (state.status === 'success') {
    return (
      <div className="rounded-xl border border-ink-200 bg-white p-10">
        <svg width="40" height="40" viewBox="0 0 40 40" fill="none" aria-hidden className="mb-5">
          <circle cx="20" cy="20" r="18.5" stroke="var(--color-teal-500)" strokeWidth="1.6" />
          <path
            d="M12.5 20.4 L17.6 25.5 L27.5 15"
            stroke="var(--color-teal-500)"
            strokeWidth="2"
            strokeLinecap="round"
            strokeLinejoin="round"
          />
        </svg>
        <h2 className="mb-3 font-serif text-2xl font-medium">Votre demande est enregistrée.</h2>
        <p className="text-[15px] leading-relaxed text-ink-600">
          Nous revenons vers vous sous deux jours ouvrés pour convenir d’un créneau. Si votre
          demande est urgente, répondez simplement au message de confirmation.
        </p>
      </div>
    )
  }

  const fieldErrors = state.status === 'error' ? (state.fieldErrors ?? {}) : {}

  return (
    <form action={formAction} className="rounded-xl border border-ink-200 bg-white p-8 lg:p-10">
      <h2 className="mb-1.5 font-serif text-2xl font-medium">Être rappelé</h2>
      <p className="mb-8 text-[15px] text-ink-600">
        Tous les champs sont nécessaires, sauf mention contraire.
      </p>

      <div className="flex flex-col gap-5">
        <div className="grid gap-5 sm:grid-cols-2">
          <div>
            <label htmlFor="fullName" className="mb-1.5 block text-sm font-medium">
              Nom et prénom
            </label>
            <input id="fullName" name="fullName" type="text" required autoComplete="name" className={FIELD} />
            <FieldError message={fieldErrors.fullName} />
          </div>
          <div>
            <label htmlFor="organization" className="mb-1.5 block text-sm font-medium">
              Organisation
            </label>
            <input
              id="organization"
              name="organization"
              type="text"
              required
              autoComplete="organization"
              className={FIELD}
            />
            <FieldError message={fieldErrors.organization} />
          </div>
        </div>

        <div className="grid gap-5 sm:grid-cols-2">
          <div>
            <label htmlFor="email" className="mb-1.5 block text-sm font-medium">
              Adresse électronique professionnelle
            </label>
            <input id="email" name="email" type="email" required autoComplete="email" className={FIELD} />
            <FieldError message={fieldErrors.email} />
          </div>
          <div>
            <label htmlFor="phone" className="mb-1.5 block text-sm font-medium">
              Téléphone <span className="font-normal text-ink-500">(facultatif)</span>
            </label>
            <input id="phone" name="phone" type="tel" autoComplete="tel" className={FIELD} />
            <FieldError message={fieldErrors.phone} />
          </div>
        </div>

        <div>
          <label htmlFor="profile" className="mb-1.5 block text-sm font-medium">
            Vous êtes
          </label>
          <select id="profile" name="profile" defaultValue="dsi_rssi_dpo" className={FIELD}>
            {PROFILES.map((profile) => (
              <option key={profile.value} value={profile.value}>
                {profile.label}
              </option>
            ))}
          </select>
        </div>

        <div>
          <label htmlFor="message" className="mb-1.5 block text-sm font-medium">
            Vos usages d’IA, en deux lignes{' '}
            <span className="font-normal text-ink-500">(facultatif)</span>
          </label>
          <textarea
            id="message"
            name="message"
            rows={4}
            maxLength={2000}
            placeholder="Ce que vous utilisez déjà, ou ce que vous envisagez, et ce qui vous préoccupe."
            className={FIELD}
          />
          <FieldError message={fieldErrors.message} />
        </div>

        {/* Leurre : invisible pour une personne, rempli par un automate. */}
        <div aria-hidden className="hidden">
          <label htmlFor="website">Site web</label>
          <input id="website" name="website" type="text" tabIndex={-1} autoComplete="off" />
        </div>

        {state.status === 'error' && !Object.keys(fieldErrors).length ? (
          <p role="alert" className="rounded-md bg-rose-50 px-4 py-3 text-sm text-rose-800">
            {state.message}
          </p>
        ) : null}

        <button
          type="submit"
          disabled={pending}
          className="mt-2 rounded-lg bg-night-900 px-7 py-4 text-base font-medium text-white hover:bg-night-800 disabled:opacity-60"
        >
          {pending ? 'Envoi…' : 'Demander à être rappelé'}
        </button>
      </div>
    </form>
  )
}

'use client'

import { useActionState } from 'react'
import { updateProfile, type ProfileState } from '@/lib/actions/profile'
import {
  removeTenantLogo,
  updateTenantBranding,
  uploadTenantLogo,
} from '@/lib/actions/admin'

/** Les actions d'administration rendent la meme forme de resultat. */
type BrandingResult = ProfileState

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

/**
 * Marque de la plateforme.
 *
 * AIGMS se revend : un cabinet qui pilote un portefeuille veut que ses clients
 * voient sa marque. Trois reglages suffisent — un nom, une mention secondaire
 * qui se vide, un logo qui remplace les deux.
 *
 * La mire de connexion n'en depend pas : avant authentification, on ne sait pas
 * quel tenant se presente. Elle garde la marque de l'editeur tant qu'un domaine
 * propre n'y conduit pas.
 */
export function BrandingForm({
  tenantId,
  label,
  tagline,
  logoUrl,
}: {
  tenantId: string
  label: string
  tagline: string | null
  logoUrl: string | null
}) {
  const [state, formAction, pending] = useActionState<BrandingResult | null, FormData>(
    updateTenantBranding,
    null,
  )
  const [uploadState, uploadAction, uploading] = useActionState<BrandingResult | null, FormData>(
    uploadTenantLogo,
    null,
  )
  const [removeState, removeAction, removing] = useActionState<BrandingResult | null, FormData>(
    removeTenantLogo,
    null,
  )

  return (
    <div className="flex flex-col gap-5">
      <form action={formAction} className="flex flex-col gap-4">
        <input type="hidden" name="tenantId" value={tenantId} />

        <div className="grid gap-4 sm:grid-cols-2">
          <div>
            <label htmlFor="brandLabel" className="mb-1.5 block text-sm font-medium">
              Nom porté par l’en-tête
            </label>
            <input
              id="brandLabel"
              name="brandLabel"
              type="text"
              required
              maxLength={60}
              defaultValue={label}
              className={FIELD}
            />
          </div>
          <div>
            <label htmlFor="brandTagline" className="mb-1.5 block text-sm font-medium">
              Mention secondaire
              <span className="ml-2 font-normal text-ink-500">vide = aucune</span>
            </label>
            <input
              id="brandTagline"
              name="brandTagline"
              type="text"
              maxLength={80}
              defaultValue={tagline ?? ''}
              placeholder="by Caritis"
              className={FIELD}
            />
          </div>
        </div>

        <Feedback state={state} />

        <button
          type="submit"
          disabled={pending}
          className="self-start rounded-md bg-night-900 px-5 py-2.5 text-sm font-medium text-white hover:bg-night-800 disabled:opacity-60"
        >
          {pending ? 'Enregistrement…' : 'Enregistrer la marque'}
        </button>
      </form>

      <div className="border-t border-ink-100 pt-5">
        {logoUrl ? (
          <div className="mb-4 flex items-center gap-4 rounded-md border border-ink-200 bg-ink-50 p-4">
            {/* eslint-disable-next-line @next/next/no-img-element -- URL signée
                d'un bucket privé : l'optimiseur d'images ne peut pas la revalider. */}
            <img src={logoUrl} alt="Logo de la plateforme" className="h-10 w-auto max-w-[220px]" />
            <form action={removeAction}>
              <button
                type="submit"
                disabled={removing}
                className="rounded-md border border-ink-200 bg-white px-3.5 py-2 text-sm text-ink-700 hover:bg-ink-100 disabled:opacity-60"
              >
                {removing ? 'Retrait…' : 'Retirer le logo'}
              </button>
            </form>
          </div>
        ) : (
          <p className="mb-4 rounded-md border border-dashed border-ink-200 px-4 py-5 text-center text-sm text-ink-500">
            Aucun logo déposé. L’en-tête porte le nom et la mention ci-dessus.
          </p>
        )}

        <form action={uploadAction} className="flex flex-col gap-3">
          <div>
            <label htmlFor="platform-logo" className="mb-1.5 block text-sm font-medium">
              Déposer un logo
            </label>
            <input
              id="platform-logo"
              name="logo"
              type="file"
              accept="image/png,image/jpeg,image/svg+xml,image/webp"
              required
              className="block w-full text-sm text-ink-600 file:mr-4 file:rounded-md file:border-0 file:bg-night-900 file:px-4 file:py-2 file:text-sm file:font-medium file:text-white hover:file:bg-night-800"
            />
            <p className="mt-1.5 text-xs leading-relaxed text-ink-500">
              PNG, JPEG, SVG ou WebP, 2 Mo au plus. Il remplace le nom et la mention dans
              l’en-tête : un logo porte déjà son propre nom.
            </p>
          </div>

          <Feedback state={uploadState} />
          <Feedback state={removeState} />

          <button
            type="submit"
            disabled={uploading}
            className="self-start rounded-md bg-night-900 px-5 py-2.5 text-sm font-medium text-white hover:bg-night-800 disabled:opacity-60"
          >
            {uploading ? 'Dépôt…' : 'Enregistrer le logo'}
          </button>
        </form>
      </div>
    </div>
  )
}

'use client'

import { useActionState } from 'react'
import { useRouter } from 'next/navigation'
import { useEffect } from 'react'
import {
  changeAccountRole,
  createAccount,
  createOrganization,
  removeOrganizationLogo,
  updateOrganizationIdentity,
  uploadOrganizationLogo,
} from '@/lib/actions/admin'
import { ACTIVITY_PROFILES } from '@/lib/domain/activity-profile'
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


/**
 * Identite postale et legale.
 *
 * Ces champs ne gouvernent rien : aucun gate ne les lit, aucun risque n'en
 * depend. Ils existent pour qu'un document sorti de l'outil — registre des
 * usages, declaration d'applicabilite — puisse etre remis tel quel, avec
 * l'identite de l'organisation en en-tete et sa mention de confidentialite en
 * pied. Ils sont neanmoins journalises : le nom legal qui figure sur une piece
 * remise a un auditeur n'est pas un detail d'affichage.
 */
function IdentityFields({
  current,
}: {
  current?: {
    address_line1: string | null
    address_line2: string | null
    postal_code: string | null
    city: string | null
    registration_number: string | null
    vat_number: string | null
    website: string | null
    contact_name: string | null
    contact_email: string | null
    contact_phone: string | null
    confidentiality_label: string
    document_footer_note: string | null
  }
}) {
  return (
    <>
      <fieldset className="flex flex-col gap-4 rounded-md border border-ink-200 p-4">
        <legend className="px-1.5 text-xs font-medium uppercase tracking-wide text-ink-500">
          Adresse
        </legend>

        <div>
          <label htmlFor="addressLine1" className="mb-1.5 block text-sm font-medium">
            Adresse <span className="font-normal text-ink-500">(facultatif)</span>
          </label>
          <input
            id="addressLine1"
            name="addressLine1"
            type="text"
            maxLength={160}
            defaultValue={current?.address_line1 ?? ''}
            className={FIELD}
          />
        </div>

        <div>
          <label htmlFor="addressLine2" className="mb-1.5 block text-sm font-medium">
            Complément <span className="font-normal text-ink-500">(facultatif)</span>
          </label>
          <input
            id="addressLine2"
            name="addressLine2"
            type="text"
            maxLength={160}
            defaultValue={current?.address_line2 ?? ''}
            className={FIELD}
          />
        </div>

        <div className="grid gap-4 sm:grid-cols-[140px_1fr]">
          <div>
            <label htmlFor="postalCode" className="mb-1.5 block text-sm font-medium">
              Code postal
            </label>
            <input
              id="postalCode"
              name="postalCode"
              type="text"
              maxLength={20}
              defaultValue={current?.postal_code ?? ''}
              className={FIELD}
            />
          </div>
          <div>
            <label htmlFor="city" className="mb-1.5 block text-sm font-medium">
              Ville
            </label>
            <input
              id="city"
              name="city"
              type="text"
              maxLength={120}
              defaultValue={current?.city ?? ''}
              className={FIELD}
            />
          </div>
        </div>
      </fieldset>

      <fieldset className="flex flex-col gap-4 rounded-md border border-ink-200 p-4">
        <legend className="px-1.5 text-xs font-medium uppercase tracking-wide text-ink-500">
          Identifiants et contact
        </legend>

        <div className="grid gap-4 sm:grid-cols-2">
          <div>
            <label htmlFor="registrationNumber" className="mb-1.5 block text-sm font-medium">
              Immatriculation
              <span className="ml-2 font-normal text-ink-500">SIREN, SIRET, n° RCS…</span>
            </label>
            <input
              id="registrationNumber"
              name="registrationNumber"
              type="text"
              maxLength={60}
              defaultValue={current?.registration_number ?? ''}
              className={FIELD}
            />
          </div>
          <div>
            <label htmlFor="vatNumber" className="mb-1.5 block text-sm font-medium">
              Numéro de TVA
            </label>
            <input
              id="vatNumber"
              name="vatNumber"
              type="text"
              maxLength={40}
              defaultValue={current?.vat_number ?? ''}
              className={FIELD}
            />
          </div>
        </div>

        <div>
          <label htmlFor="website" className="mb-1.5 block text-sm font-medium">
            Site web
          </label>
          <input
            id="website"
            name="website"
            type="text"
            maxLength={200}
            placeholder="https://"
            defaultValue={current?.website ?? ''}
            className={FIELD}
          />
        </div>

        <div className="grid gap-4 sm:grid-cols-3">
          <div>
            <label htmlFor="contactName" className="mb-1.5 block text-sm font-medium">
              Contact
            </label>
            <input
              id="contactName"
              name="contactName"
              type="text"
              maxLength={120}
              defaultValue={current?.contact_name ?? ''}
              className={FIELD}
            />
          </div>
          <div>
            <label htmlFor="contactEmail" className="mb-1.5 block text-sm font-medium">
              Adresse électronique
            </label>
            <input
              id="contactEmail"
              name="contactEmail"
              type="email"
              maxLength={254}
              defaultValue={current?.contact_email ?? ''}
              className={FIELD}
            />
          </div>
          <div>
            <label htmlFor="contactPhone" className="mb-1.5 block text-sm font-medium">
              Téléphone
            </label>
            <input
              id="contactPhone"
              name="contactPhone"
              type="text"
              maxLength={40}
              defaultValue={current?.contact_phone ?? ''}
              className={FIELD}
            />
          </div>
        </div>
      </fieldset>

      <fieldset className="flex flex-col gap-4 rounded-md border border-ink-200 p-4">
        <legend className="px-1.5 text-xs font-medium uppercase tracking-wide text-ink-500">
          Pied de page des documents
        </legend>

        <div className="grid gap-4 sm:grid-cols-[200px_1fr]">
          <div>
            <label htmlFor="confidentialityLabel" className="mb-1.5 block text-sm font-medium">
              Mention de confidentialité
            </label>
            <input
              id="confidentialityLabel"
              name="confidentialityLabel"
              type="text"
              maxLength={60}
              required
              defaultValue={current?.confidentiality_label ?? 'Confidentiel'}
              className={FIELD}
            />
          </div>
          <div>
            <label htmlFor="documentFooterNote" className="mb-1.5 block text-sm font-medium">
              Mention libre <span className="font-normal text-ink-500">(facultatif)</span>
            </label>
            <input
              id="documentFooterNote"
              name="documentFooterNote"
              type="text"
              maxLength={240}
              placeholder="Diffusion restreinte — comité de gouvernance"
              defaultValue={current?.document_footer_note ?? ''}
              className={FIELD}
            />
          </div>
        </div>
        <p className="text-xs leading-relaxed text-ink-500">
          Un registre d’usages d’IA et une déclaration d’applicabilité ne circulent pas librement.
          Ce qui est écrit ici figure au pied de chaque page imprimée.
        </p>
      </fieldset>
    </>
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

      {/*
        Le profil d'activite n'est pas une categorie descriptive : il determine
        les typologies de preuves attendues et leur criticite, donc ce que la
        Declaration d'Applicabilite exigera. Il se renseigne ici, une fois.
      */}
      <div>
        <label htmlFor="activityProfile" className="mb-1.5 block text-sm font-medium">
          Rôle vis-à-vis de l’IA
          <span className="ml-2 font-normal text-ink-500">ISO/IEC 42001</span>
        </label>
        <select id="activityProfile" name="activityProfile" defaultValue="" required className={FIELD}>
          <option value="" disabled>
            — Choisir le rôle exercé
          </option>
          {ACTIVITY_PROFILES.map((profile) => (
            <option key={profile.value} value={profile.value}>
              {profile.label} — {profile.hint}
            </option>
          ))}
        </select>
        <p className="mt-1.5 text-xs leading-relaxed text-ink-500">
          Il commande les typologies de preuves attendues et leur criticité. Un hébergeur démontre
          l’isolation de ses calculs, pas l’équité d’un modèle qu’il n’entraîne pas.
        </p>
      </div>

      <IdentityFields />

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
          À transmettre par un canal distinct de son adresse électronique : la personne reçoit un
          courriel d’ouverture d’accès — adresse de connexion et rôle — mais jamais son mot de
          passe. Le changement de mot de passe depuis l’application reste à construire ; en
          attendant, il se fait depuis la console Supabase.
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

/**
 * Completer ou corriger l'identite d'une organisation existante.
 *
 * Les organisations anterieures a la migration 0035 n'ont pas d'adresse, et une
 * adresse demenage. Le meme ecran sert donc a completer comme a corriger.
 */
export function OrganizationIdentityForm({
  organization,
}: {
  organization: {
    id: string
    name: string
    legal_name: string | null
    address_line1: string | null
    address_line2: string | null
    postal_code: string | null
    city: string | null
    registration_number: string | null
    vat_number: string | null
    website: string | null
    contact_name: string | null
    contact_email: string | null
    contact_phone: string | null
    confidentiality_label: string
    document_footer_note: string | null
  }
}) {
  const [state, formAction, pending] = useActionState<Result | null, FormData>(
    updateOrganizationIdentity,
    null,
  )

  return (
    <form action={formAction} className="flex flex-col gap-4">
      <input type="hidden" name="organizationId" value={organization.id} />

      <div>
        <label htmlFor="legalName" className="mb-1.5 block text-sm font-medium">
          Raison sociale
          <span className="ml-2 font-normal text-ink-500">
            portée en en-tête des documents imprimés
          </span>
        </label>
        <input
          id="legalName"
          name="legalName"
          type="text"
          maxLength={160}
          defaultValue={organization.legal_name ?? ''}
          placeholder={organization.name}
          className={FIELD}
        />
      </div>

      <IdentityFields current={organization} />

      <Feedback state={state} />

      <button
        type="submit"
        disabled={pending}
        className="self-start rounded-md bg-night-900 px-5 py-2.5 text-sm font-medium text-white hover:bg-night-800 disabled:opacity-60"
      >
        {pending ? 'Enregistrement…' : 'Enregistrer l’identité'}
      </button>
    </form>
  )
}

/**
 * Le logo de l'organisation.
 *
 * Il vit dans un bucket prive : le logo d'un client n'a pas a etre servi
 * publiquement a qui devine son URL. L'apercu ci-dessous passe par une URL
 * signee, valable une heure — le temps d'ouvrir la page et d'imprimer.
 */
export function OrganizationLogoForm({
  organizationId,
  logoUrl,
}: {
  organizationId: string
  logoUrl: string | null
}) {
  const [uploadState, uploadAction, uploading] = useActionState<Result | null, FormData>(
    uploadOrganizationLogo,
    null,
  )
  const [removeState, removeAction, removing] = useActionState<Result | null, FormData>(
    removeOrganizationLogo,
    null,
  )

  return (
    <div className="flex flex-col gap-4">
      {logoUrl ? (
        <div className="flex items-center gap-4 rounded-md border border-ink-200 bg-ink-50 p-4">
          {/* eslint-disable-next-line @next/next/no-img-element -- URL signée
              d'un bucket privé : l'optimiseur d'images ne peut pas la revalider. */}
          <img src={logoUrl} alt="Logo de l’organisation" className="h-12 w-auto max-w-[220px]" />
          <form action={removeAction}>
            <input type="hidden" name="organizationId" value={organizationId} />
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
        <p className="rounded-md border border-dashed border-ink-200 px-4 py-6 text-center text-sm text-ink-500">
          Aucun logo. Les documents imprimés porteront l’en-tête par défaut.
        </p>
      )}

      <form action={uploadAction} className="flex flex-col gap-3">
        <input type="hidden" name="organizationId" value={organizationId} />
        <div>
          <label htmlFor="logo" className="mb-1.5 block text-sm font-medium">
            Déposer un logo
          </label>
          <input
            id="logo"
            name="logo"
            type="file"
            accept="image/png,image/jpeg,image/svg+xml,image/webp"
            required
            className="block w-full text-sm text-ink-600 file:mr-4 file:rounded-md file:border-0 file:bg-night-900 file:px-4 file:py-2 file:text-sm file:font-medium file:text-white hover:file:bg-night-800"
          />
          <p className="mt-1.5 text-xs text-ink-500">
            PNG, JPEG, SVG ou WebP, 2 Mo au plus. Un fond transparent s’imprime mieux.
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
  )
}

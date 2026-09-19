'use client'

import { useActionState } from 'react'
import { updateAssetLabels, type FormState } from '@/lib/actions/registry'
import { Field, FIELD, FormFeedback, Submit } from '@/components/forms'
import { Modal } from '@/components/modal'

/** Corriger la fiche d'un actif : ce qui le decrit, d'un crayon a cote du nom. */
export function AssetLabelForm({
  organizationId,
  asset,
  people,
  vendors,
}: {
  organizationId: string
  asset: {
    id: string
    name: string
    description: string | null
    version: string | null
    hosting_location: string | null
    contains_personal_data: boolean
    owner_user_id: string | null
    vendor_id: string | null
  }
  people: { id: string; label: string }[]
  vendors: { id: string; name: string }[]
}) {
  const [state, formAction, pending] = useActionState<FormState | null, FormData>(updateAssetLabels, null)
  const errors = state && !state.ok ? (state.fieldErrors ?? {}) : {}
  return (
    <Modal
      trigger={
        <svg width="16" height="16" viewBox="0 0 16 16" fill="none" aria-hidden>
          <path d="M11.3 2.3a1.4 1.4 0 0 1 2 2L5.5 12.1 2.5 13l.9-3L11.3 2.3Z" stroke="currentColor" strokeWidth="1.4" strokeLinejoin="round" />
        </svg>
      }
      triggerLabel="Modifier la fiche"
      triggerClassName="inline-flex size-7 items-center justify-center rounded-full border border-ink-200 text-ink-500 hover:border-ink-400 hover:text-ink-900"
      title="Corriger la fiche de l’actif"
    >
      {() => (
        <form action={formAction} className="flex flex-col gap-4">
          <input type="hidden" name="organizationId" value={organizationId} />
          <input type="hidden" name="assetId" value={asset.id} />
          <Field label="Nom" htmlFor="asset-name" error={errors.name}>
            <input id="asset-name" name="name" type="text" required defaultValue={asset.name} className={FIELD} />
          </Field>
          <Field label="Description" htmlFor="asset-description" optional>
            <textarea id="asset-description" name="description" rows={3} defaultValue={asset.description ?? ''} className={FIELD} />
          </Field>
          <div className="grid gap-4 sm:grid-cols-2">
            <Field label="Version" htmlFor="asset-version" optional>
              <input id="asset-version" name="version" type="text" defaultValue={asset.version ?? ''} className={FIELD} />
            </Field>
            <Field label="Hébergement" htmlFor="asset-hosting" optional>
              <input id="asset-hosting" name="hostingLocation" type="text" defaultValue={asset.hosting_location ?? ''} className={FIELD} />
            </Field>
            <Field label="Responsable" htmlFor="asset-owner" optional>
              <select id="asset-owner" name="ownerUserId" defaultValue={asset.owner_user_id ?? ''} className={FIELD}>
                <option value="">— Aucun</option>
                {people.map((p) => (
                  <option key={p.id} value={p.id}>{p.label}</option>
                ))}
              </select>
            </Field>
            <Field label="Fournisseur" htmlFor="asset-vendor" optional>
              <select id="asset-vendor" name="vendorId" defaultValue={asset.vendor_id ?? ''} className={FIELD}>
                <option value="">— Aucun</option>
                {vendors.map((v) => (
                  <option key={v.id} value={v.id}>{v.name}</option>
                ))}
              </select>
            </Field>
          </div>
          <label className="flex items-center gap-2.5 text-sm">
            <input type="checkbox" name="containsPersonalData" defaultChecked={asset.contains_personal_data} className="size-4 rounded border-ink-300" />
            Contient des données personnelles
          </label>
          <FormFeedback state={state} />
          <Submit pending={pending} idle="Enregistrer" />
        </form>
      )}
    </Modal>
  )
}

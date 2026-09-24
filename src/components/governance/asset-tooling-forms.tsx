'use client'

import { useActionState, useTransition } from 'react'
import { Field, FIELD, FormFeedback, Submit } from '@/components/forms'
import { Modal } from '@/components/modal'
import { attachAssetTooling, detachAssetTooling, type FormState } from '@/lib/actions/asset-tooling'

/**
 * Avec quoi cet actif a ete fait.
 *
 * Les phases sont celles du cycle de vie d'ISO/IEC 42001 A.6, dans l'ordre ou
 * elles se suivent : l'ordre porte l'information autant que les mots.
 */
export const TOOLING_PHASES = [
  { value: 'design', label: 'Conception' },
  { value: 'data', label: 'Données' },
  { value: 'training', label: 'Entraînement' },
  { value: 'validation', label: 'Validation' },
  { value: 'deployment', label: 'Déploiement' },
  { value: 'operation', label: 'Exploitation' },
] as const

export type ToolingPhase = (typeof TOOLING_PHASES)[number]['value']

export const PHASE_LABELS: Record<string, string> = Object.fromEntries(
  TOOLING_PHASES.map((p) => [p.value, p.label]),
)

export type AssetTooling = {
  id: string
  tooling_id: string
  product: string
  phase: ToolingPhase
  note: string | null
  role: string
  family: string | null
  vendor: { id: string; name: string; review_status: string } | null
}

export function AttachAssetToolingForm({
  organizationId,
  assetId,
  available,
}: {
  organizationId: string
  assetId: string
  available: { id: string; product: string; family: string | null }[]
}) {
  const [state, formAction, pending] = useActionState<FormState | null, FormData>(
    attachAssetTooling,
    null,
  )
  const errors = state && !state.ok ? (state.fieldErrors ?? {}) : {}

  return (
    <Modal
      trigger="Rattacher un outil"
      triggerClassName="rounded-md border border-ink-200 px-3 py-1.5 text-sm text-ink-700 hover:bg-ink-100"
      title="Avec quoi cet actif a été fait"
      description="ISO/IEC 42001 A.4.4 et l’annexe IV de l’AI Act demandent de documenter, par système, l’outillage employé pour le construire et l’exploiter."
    >
      {() => (
        <form action={formAction} className="flex flex-col gap-4">
          <input type="hidden" name="organizationId" value={organizationId} />
          <input type="hidden" name="assetId" value={assetId} />

          {available.length ? (
            <Field label="Outil" htmlFor="at-tooling" error={errors.toolingId}>
              <select id="at-tooling" name="toolingId" defaultValue="" required className={FIELD}>
                <option value="" disabled>
                  — Choisir un outil déclaré
                </option>
                {available.map((t) => (
                  <option key={t.id} value={t.id}>
                    {t.product}
                    {t.family ? ` — ${t.family}` : ''}
                  </option>
                ))}
              </select>
            </Field>
          ) : (
            <p className="rounded-md bg-warn-600/5 px-3.5 py-2.5 text-sm text-warn-600">
              Aucun outil n’est déclaré sur cette organisation. La carte d’outillage se tient depuis
              « Contrôles et outillages ».
            </p>
          )}

          <Field
            label="À quel moment il a servi"
            htmlFor="at-phase"
            hint="Un même outil peut servir à deux moments : rattachez-le une fois par phase."
          >
            <select id="at-phase" name="phase" defaultValue="operation" className={FIELD}>
              {TOOLING_PHASES.map((p) => (
                <option key={p.value} value={p.value}>
                  {p.label}
                </option>
              ))}
            </select>
          </Field>

          <Field label="Note" htmlFor="at-note" optional hint="Ce qu’il a fait exactement, et ce qu’il n’a pas fait.">
            <textarea id="at-note" name="note" rows={2} className={FIELD} />
          </Field>

          <FormFeedback state={state} />
          {available.length ? <Submit pending={pending} idle="Rattacher" /> : null}
        </form>
      )}
    </Modal>
  )
}

export function DetachAssetToolingButton({
  organizationId,
  assetId,
  id,
  product,
}: {
  organizationId: string
  assetId: string
  id: string
  product: string
}) {
  const [pending, start] = useTransition()
  return (
    <button
      type="button"
      disabled={pending}
      onClick={() => {
        if (!confirm(`Retirer « ${product} » de cet actif ?`)) return
        start(async () => {
          await detachAssetTooling(organizationId, assetId, id)
        })
      }}
      className="text-xs text-ink-400 hover:text-stop-600 disabled:opacity-60"
    >
      {pending ? 'Retrait…' : 'Retirer'}
    </button>
  )
}

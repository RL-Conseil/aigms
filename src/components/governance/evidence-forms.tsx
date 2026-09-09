'use client'

import { useActionState, useState } from 'react'
import {
  attachEvidence,
  reviewEvidence,
  uploadEvidence,
  type FormState,
} from '@/lib/actions/evidence'
import { Field, FIELD, FormFeedback, Submit } from '@/components/forms'

/**
 * Saisie du dossier de preuves.
 *
 * Un depot n'est pas une validation : le formulaire le dit, et la preuve arrive
 * « a valider ». Confondre les deux reviendrait a laisser celui qui fournit la
 * piece attester lui-meme de sa recevabilite.
 */

const EVIDENCE_TYPES = [
  { value: 'document', label: 'Document' },
  { value: 'screenshot', label: 'Capture d’écran' },
  { value: 'log_extract', label: 'Extrait de journal' },
  { value: 'attestation', label: 'Attestation' },
  { value: 'test_result', label: 'Résultat de test' },
  { value: 'configuration', label: 'Configuration' },
  { value: 'declarative', label: 'Déclarative — aucune pièce jointe' },
] as const

export type ControlChoice = {
  id: string
  code: string
  name: string
  is_evidenced: boolean
  status: string
}

export function EvidenceUploadForm({
  organizationId,
  controls,
  defaultControlId,
}: {
  organizationId: string
  controls: ControlChoice[]
  defaultControlId?: string
}) {
  const [state, formAction, pending] = useActionState<FormState | null, FormData>(
    uploadEvidence,
    null,
  )
  const [declarative, setDeclarative] = useState(false)
  const errors = state && !state.ok ? (state.fieldErrors ?? {}) : {}

  return (
    <form action={formAction} className="flex flex-col gap-4">
      <input type="hidden" name="organizationId" value={organizationId} />

      <Field label="Ce que la preuve démontre" htmlFor="evidence-title" error={errors.title}>
        <input
          id="evidence-title"
          name="title"
          type="text"
          required
          className={FIELD}
          placeholder="Rapport de test de biais — version 2026-09"
        />
      </Field>

      <div className="grid gap-4 sm:grid-cols-2">
        <Field label="Nature" htmlFor="evidence-type">
          <select
            id="evidence-type"
            name="evidenceType"
            defaultValue="document"
            className={FIELD}
            onChange={(event) => setDeclarative(event.target.value === 'declarative')}
          >
            {EVIDENCE_TYPES.map((type) => (
              <option key={type.value} value={type.value}>
                {type.label}
              </option>
            ))}
          </select>
        </Field>

        <Field
          label="Origine"
          htmlFor="evidence-source"
          hint="Qui ou quel système a produit cette pièce."
          error={errors.source}
        >
          <input
            id="evidence-source"
            name="source"
            type="text"
            required
            className={FIELD}
            placeholder="Recette applicative"
          />
        </Field>
      </div>

      {declarative ? null : (
        <Field
          label="Fichier"
          htmlFor="evidence-file"
          hint="25 Mo maximum. L’empreinte SHA-256 du fichier est calculée au dépôt : elle permettra à un auditeur d’établir que la pièce n’a pas changé."
          error={errors.file}
          optional
        >
          <input
            id="evidence-file"
            name="file"
            type="file"
            className="w-full text-sm file:mr-3 file:rounded-md file:border-0 file:bg-ink-100 file:px-3 file:py-2 file:text-sm file:text-ink-700"
          />
        </Field>
      )}

      <div className="grid gap-4 sm:grid-cols-2">
        <Field
          label="Lien externe"
          htmlFor="evidence-url"
          hint="Si la pièce vit ailleurs et doit y rester."
          optional
          error={errors.externalUrl}
        >
          <input
            id="evidence-url"
            name="externalUrl"
            type="url"
            className={FIELD}
            placeholder="https://…"
          />
        </Field>

        <Field
          label="Valable jusqu’au"
          htmlFor="evidence-valid-until"
          hint="Une preuve sans échéance ne se renouvelle jamais."
          optional
        >
          <input id="evidence-valid-until" name="validUntil" type="date" className={FIELD} />
        </Field>
      </div>

      <div className="grid gap-4 sm:grid-cols-[1fr_140px]">
        <Field label="Contrôle démontré" htmlFor="evidence-control" optional>
          <select
            key={defaultControlId ?? 'aucun'}
            id="evidence-control"
            name="controlId"
            defaultValue={defaultControlId ?? ''}
            className={FIELD}
          >
            <option value="">— Rattacher plus tard</option>
            {controls.map((control) => (
              <option key={control.id} value={control.id}>
                {control.code} — {control.name}
                {control.is_evidenced ? '' : ' (sans preuve valide)'}
              </option>
            ))}
          </select>
        </Field>

        <Field label="Version" htmlFor="evidence-version" optional error={errors.version}>
          <input id="evidence-version" name="version" type="text" className={FIELD} placeholder="1.2" />
        </Field>
      </div>

      <FormFeedback state={state} />
      <Submit pending={pending} idle="Déposer la preuve">
        Dépôt en cours…
      </Submit>
    </form>
  )
}

// -----------------------------------------------------------------------------
// Verdict
// -----------------------------------------------------------------------------
export function EvidenceReviewForm({
  organizationId,
  evidenceId,
  awaiting,
}: {
  organizationId: string
  evidenceId: string
  /**
   * Les boutons ne s'affichent que sur une piece a valider, mais le composant
   * reste monte apres l'acte : sinon la confirmation disparaitrait avec les
   * boutons qui l'ont produite, au moment precis ou elle informe.
   */
  awaiting: boolean
}) {
  const [state, formAction, pending] = useActionState<FormState | null, FormData>(
    reviewEvidence,
    null,
  )

  if (!awaiting && !state) return null

  return (
    <form action={formAction} className="flex flex-col gap-2">
      <input type="hidden" name="organizationId" value={organizationId} />
      <input type="hidden" name="evidenceId" value={evidenceId} />
      <div className={`flex flex-wrap gap-2 ${awaiting ? '' : 'hidden'}`}>
        <button
          type="submit"
          name="verdict"
          value="validated"
          disabled={pending}
          className="rounded-md bg-night-900 px-3.5 py-1.5 text-xs font-medium text-white hover:bg-night-800 disabled:opacity-60"
        >
          Valider en mon nom
        </button>
        <button
          type="submit"
          name="verdict"
          value="rejected"
          disabled={pending}
          className="rounded-md border border-ink-200 px-3.5 py-1.5 text-xs text-ink-700 hover:bg-ink-100 disabled:opacity-60"
        >
          Rejeter
        </button>
      </div>
      <FormFeedback state={state} />
    </form>
  )
}

// -----------------------------------------------------------------------------
// Rattachement
// -----------------------------------------------------------------------------
/**
 * Rattachement d'une preuve a un controle supplementaire.
 *
 * Une preuve sert souvent plusieurs controles — un rapport d'audit annuel
 * demontre a la fois la tenue du registre, la revue des fournisseurs et la
 * formation. La table d'association est donc N–N, et le seul interdit est le
 * doublon.
 *
 * D'ou deux partis pris d'ecran : la liste ne propose QUE des controles pas
 * encore rattaches — decouvrir un doublon sur un message d'erreur serait le
 * decouvrir trop tard — et le formulaire se replie, parce que rattacher est un
 * geste occasionnel qui n'a pas a encombrer chaque ligne du registre.
 */
export function EvidenceAttachForm({
  organizationId,
  evidenceId,
  controls,
}: {
  organizationId: string
  evidenceId: string
  /** Controles pas encore rattaches a cette preuve. */
  controls: ControlChoice[]
}) {
  const [state, formAction, pending] = useActionState<FormState | null, FormData>(
    attachEvidence,
    null,
  )

  if (!controls.length) return null

  return (
    <form action={formAction} className="flex flex-col gap-2">
      <input type="hidden" name="organizationId" value={organizationId} />
      <input type="hidden" name="evidenceId" value={evidenceId} />

      <details className="group">
        <summary className="inline-flex cursor-pointer list-none items-center gap-1 text-xs font-medium text-brand-600 hover:underline">
          <span aria-hidden="true" className="transition-transform group-open:rotate-45">
            +
          </span>
          Rattacher à un autre contrôle
        </summary>

        <div className="mt-2 flex flex-wrap items-center gap-2">
          <label className="sr-only" htmlFor={`attach-${evidenceId}`}>
            Contrôle à rattacher
          </label>
          <select
            id={`attach-${evidenceId}`}
            name="controlId"
            defaultValue=""
            className={`${FIELD} max-w-xs text-xs`}
          >
            <option value="">— Choisir un contrôle</option>
            {controls.map((control) => (
              <option key={control.id} value={control.id}>
                {control.code} — {control.name}
                {control.is_evidenced ? '' : ' (sans preuve valide)'}
              </option>
            ))}
          </select>
          <button
            type="submit"
            disabled={pending}
            className="rounded-md border border-ink-200 px-3 py-1.5 text-xs text-ink-700 hover:bg-ink-100 disabled:opacity-60"
          >
            Rattacher
          </button>
        </div>
      </details>

      <FormFeedback state={state} />
    </form>
  )
}

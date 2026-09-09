'use client'

import { useActionState, useState } from 'react'
import {
  attachEvidence,
  reviewEvidence,
  uploadEvidence,
  type FormState,
} from '@/lib/actions/evidence'
import { Field, FIELD, FormFeedback, Submit } from '@/components/forms'
import {
  ACTIVITY_PROFILE_LABELS,
  CRITICALITY_LABELS,
  type ActivityProfile,
  type EvidenceCriticality,
} from '@/lib/domain/activity-profile'

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

export type TypologyChoice = {
  id: string
  code: string
  ordinal: number
  name: string
  technical_description: string
  deliverables: string[]
  normative_references: string[]
  criticality: EvidenceCriticality | null
  profile: ActivityProfile | null
}

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
  typologies,
  defaultControlId,
}: {
  organizationId: string
  controls: ControlChoice[]
  /** Typologies de la matrice, les plus critiques pour ce profil en tete. */
  typologies: TypologyChoice[]
  defaultControlId?: string
}) {
  const [state, formAction, pending] = useActionState<FormState | null, FormData>(
    uploadEvidence,
    null,
  )
  const [declarative, setDeclarative] = useState(false)
  const [typologyId, setTypologyId] = useState('')
  const errors = state && !state.ok ? (state.fieldErrors ?? {}) : {}
  const chosen = typologies.find((t) => t.id === typologyId)
  const profile = typologies[0]?.profile ?? null

  return (
    <form action={formAction} className="flex flex-col gap-4">
      <input type="hidden" name="organizationId" value={organizationId} />

      {/*
        La typologie se choisit AVANT le reste : elle dit ce qu'il faut
        consigner et quel livrable est attendu. La poser apres reviendrait a
        laisser deposer d'abord et se demander ensuite si la piece convient.
      */}
      <Field
        label="Typologie de preuve"
        htmlFor="evidence-typology"
        optional
        hint={
          profile
            ? `Classées par criticité pour un profil « ${ACTIVITY_PROFILE_LABELS[profile]} ».`
            : 'Le rôle de l’organisation vis-à-vis de l’IA n’est pas renseigné : toutes les typologies sont proposées, sans criticité.'
        }
      >
        <select
          id="evidence-typology"
          name="typologyId"
          value={typologyId}
          onChange={(event) => setTypologyId(event.target.value)}
          className={FIELD}
        >
          <option value="">— Aucune typologie technique</option>
          {typologies.map((typology) => (
            <option key={typology.id} value={typology.id}>
              {typology.criticality ? `${CRITICALITY_LABELS[typology.criticality]} · ` : ''}
              {typology.name}
            </option>
          ))}
        </select>
      </Field>

      {chosen ? (
        <div
          className={`rounded-md border-l-4 bg-ink-50 px-4 py-3 ${
            chosen.criticality === 'critical' || chosen.criticality === 'high'
              ? 'border-stop-600'
              : chosen.criticality === 'moderate'
                ? 'border-warn-600'
                : 'border-ink-300'
          }`}
        >
          <p className="text-xs font-semibold uppercase tracking-wide text-ink-500">
            À consigner
          </p>
          <p className="mt-1 text-sm text-ink-800">{chosen.technical_description}</p>

          <p className="mt-3 text-xs font-semibold uppercase tracking-wide text-ink-500">
            Livrables qui font preuve
          </p>
          <ul className="mt-1 flex list-disc flex-col gap-0.5 pl-4 text-sm text-ink-700">
            {chosen.deliverables.map((deliverable) => (
              <li key={deliverable}>{deliverable}</li>
            ))}
          </ul>

          {chosen.normative_references.length ? (
            <p className="mt-3 text-xs text-ink-500">
              {chosen.normative_references.join(' · ')}
            </p>
          ) : null}
        </div>
      ) : null}

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

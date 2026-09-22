'use client'

import { useActionState, useState, useTransition } from 'react'
import { Field, FIELD, FormFeedback, Submit } from '@/components/forms'
import { Modal } from '@/components/modal'
import { removeTooling, retainTooling, saveTooling, type FormState } from '@/lib/actions/tooling'

/**
 * Declarer avec quoi l'organisation tient ses controles, et retenir ce qui
 * vaut pour un controle donne. Le referentiel propose une famille ; on y
 * inscrit le produit employe.
 */

export type ToolFamily = {
  code: string
  acronym: string | null
  name: string
  domain: string | null
  phase: string | null
  definition: string | null
  examples: string[]
  expected_evidence: string[]
  controls: number
  declared: {
    id: string
    product: string
    note: string | null
    vendor: { id: string; name: string; review_status: string } | null
    connector: { id: string; name: string; status: string } | null
    used_by: number
  } | null
}

const errorsOf = (state: FormState | null) => (state && !state.ok ? (state.fieldErrors ?? {}) : {})

export function ToolingForm({
  organizationId,
  family,
  vendors,
}: {
  organizationId: string
  family: ToolFamily
  vendors: { id: string; name: string }[]
}) {
  const [state, formAction, pending] = useActionState<FormState | null, FormData>(saveTooling, null)
  const errors = errorsOf(state)
  const declared = family.declared

  return (
    <Modal
      trigger={declared ? 'Corriger' : 'Déclarer le produit'}
      triggerClassName={
        declared
          ? 'text-xs text-brand-600 hover:underline'
          : 'rounded-md border border-ink-200 px-2.5 py-1 text-xs text-ink-700 hover:bg-ink-100'
      }
      title={family.name}
      description={family.definition ?? 'Avec quoi cette famille de contrôles se tient chez vous.'}
    >
      {() => (
        <form action={formAction} className="flex flex-col gap-4">
          <input type="hidden" name="organizationId" value={organizationId} />
          <input type="hidden" name="toolCode" value={family.code} />
          {declared ? <input type="hidden" name="toolingId" value={declared.id} /> : null}

          {family.examples.length ? (
            <p className="rounded-md bg-ink-100 px-3.5 py-2.5 text-xs leading-relaxed text-ink-600">
              Exemples de cette famille : {family.examples.join(', ')}. Inscrivez ce que vous employez
              réellement — ce n’est pas un inventaire du SI, une ligne par famille suffit.
            </p>
          ) : null}

          <Field label="Produit employé" htmlFor={`product-${family.code}`} error={errors.product}>
            <input
              id={`product-${family.code}`}
              name="product"
              type="text"
              required
              defaultValue={declared?.product ?? ''}
              className={FIELD}
              placeholder={family.examples[0] ?? 'Nom du produit'}
            />
          </Field>

          {/*
            Le connecteur ne se choisit pas ici : brancher une source releve
            de l'administration de la plateforme, et la maniere dont un
            fournisseur ouvrira son API pour tirer les preuves reste a poser.
            La colonne existe en base, l'ecran ne la propose pas encore.
          */}
          <Field label="Fournisseur" htmlFor={`vendor-${family.code}`} optional hint="S’il figure au registre des tiers : sa revue conditionne la production.">
            <select id={`vendor-${family.code}`} name="vendorId" defaultValue={declared?.vendor?.id ?? ''} className={FIELD}>
              <option value="">—</option>
              {vendors.map((v) => (
                <option key={v.id} value={v.id}>{v.name}</option>
              ))}
            </select>
          </Field>

          <Field label="Note" htmlFor={`note-${family.code}`} optional hint="Version, périmètre, ce qu’il couvre et ce qu’il ne couvre pas.">
            <textarea id={`note-${family.code}`} name="note" rows={2} defaultValue={declared?.note ?? ''} className={FIELD} />
          </Field>

          {family.expected_evidence.length ? (
            <p className="text-xs leading-relaxed text-ink-500">
              Ce que cette famille produit d’ordinaire comme preuve : {family.expected_evidence.join(', ')}.
            </p>
          ) : null}

          <FormFeedback state={state} />
          <Submit pending={pending} idle={declared ? 'Enregistrer' : 'Déclarer'} />
        </form>
      )}
    </Modal>
  )
}

export function RemoveToolingButton({
  organizationId,
  toolingId,
  product,
  usedBy,
}: {
  organizationId: string
  toolingId: string
  product: string
  usedBy: number
}) {
  const [pending, start] = useTransition()
  return (
    <button
      type="button"
      disabled={pending}
      onClick={() => {
        const warn = usedBy
          ? `${product} est retenu par ${usedBy} contrôle(s). Le retirer les laissera sans outil. Continuer ?`
          : `Retirer ${product} de la carte ?`
        if (confirm(warn)) start(() => void removeTooling(organizationId, toolingId))
      }}
      className="text-xs text-ink-400 hover:text-stop-600 hover:underline disabled:opacity-50"
    >
      Retirer
    </button>
  )
}

// -----------------------------------------------------------------------------
// Ce qu'un controle retient
// -----------------------------------------------------------------------------
export type ControlToolingView = {
  suggested: { code: string; acronym: string | null; name: string; examples: string[]; declared: { id: string; product: string } | null }[]
  retained: { id: string; tooling_id: string; product: string; family: string | null; rationale: string | null }[]
  available: { id: string; tool_code: string; product: string; family: string | null }[]
}

export function ControlToolingForm({
  organizationId,
  controlId,
  controlCode,
  view,
}: {
  organizationId: string
  controlId: string
  controlCode: string
  view: ControlToolingView
}) {
  const [state, formAction, pending] = useActionState<FormState | null, FormData>(retainTooling, null)
  const [checked, setChecked] = useState<Set<string>>(new Set(view.retained.map((r) => r.tooling_id)))
  const suggestedIds = new Set(view.suggested.map((s) => s.declared?.id).filter(Boolean) as string[])

  const toggle = (id: string) =>
    setChecked((prev) => {
      const next = new Set(prev)
      if (next.has(id)) next.delete(id)
      else next.add(id)
      return next
    })

  return (
    <Modal
      trigger={view.retained.length ? `Se tient avec ${view.retained.length}` : 'Avec quoi il se tient'}
      triggerClassName="text-xs text-brand-600 hover:underline"
      title={`Avec quoi ${controlCode} se tient`}
      description="Le référentiel AIGMS suggère une famille d’outillage ; vous retenez le produit employé chez vous. Le contrôle-type n’est pas modifié."
    >
      {() => (
        <form action={formAction} className="flex flex-col gap-4">
          <input type="hidden" name="organizationId" value={organizationId} />
          <input type="hidden" name="controlId" value={controlId} />

          {view.suggested.length ? (
            <div className="rounded-md bg-ink-100 px-3.5 py-2.5 text-xs leading-relaxed text-ink-600">
              Le référentiel AIGMS suggère :{' '}
              {view.suggested.map((s) => s.acronym ?? s.name).join(', ')}.
            </div>
          ) : (
            <p className="rounded-md bg-ink-100 px-3.5 py-2.5 text-xs text-ink-600">
              Le référentiel AIGMS ne suggère aucune famille pour ce contrôle — ou ce contrôle est libre,
              sans lien vers un contrôle-type. Retenez ce qui vaut chez vous.
            </p>
          )}

          {view.available.length ? (
            <fieldset className="flex flex-col gap-2">
              <legend className="mb-1 text-sm font-medium">Outils de l’organisation</legend>
              {view.available.map((tool) => (
                <label key={tool.id} className="flex items-start gap-2.5 text-sm">
                  <input
                    type="checkbox"
                    name="toolingIds"
                    value={tool.id}
                    checked={checked.has(tool.id)}
                    onChange={() => toggle(tool.id)}
                    className="mt-0.5 size-4 rounded border-ink-300"
                  />
                  <span className="min-w-0">
                    {tool.product}
                    <span className="block text-xs text-ink-400">
                      {tool.family ?? tool.tool_code}
                      {suggestedIds.has(tool.id) ? ' · suggéré par le référentiel' : ''}
                    </span>
                  </span>
                </label>
              ))}
            </fieldset>
          ) : (
            <p className="text-sm text-warn-600">
              Aucun outil déclaré pour cette organisation. La carte d’outillage est gérée depuis
              « Outillage », au registre des contrôles.
            </p>
          )}

          <Field label="Pourquoi ce choix" htmlFor={`why-${controlId}`} optional hint="Ce que l’outil couvre pour ce contrôle, et où sa preuve se prend.">
            <textarea id={`why-${controlId}`} name="rationale" rows={2} defaultValue={view.retained[0]?.rationale ?? ''} className={FIELD} />
          </Field>

          <FormFeedback state={state} />
          <Submit pending={pending} idle="Retenir" />
        </form>
      )}
    </Modal>
  )
}

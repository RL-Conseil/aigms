'use client'

import { useActionState } from 'react'
import { placeMeasureOnAsset } from '@/lib/actions/controls'
import type { FormState } from '@/lib/actions/controls'
import { Field, FIELD, FormFeedback, Submit } from '@/components/forms'
import { Modal } from '@/components/modal'
import { ASSET_KIND_LABELS, ASSET_MEASURE_STATUS_LABELS } from '@/lib/domain/governance'

/**
 * Poser une mesure technique sur un actif du cas d'usage.
 *
 * Une mesure technique ne « s'applique » pas a un cas d'usage en l'air : elle
 * se tient sur un actif — ce modele, ce systeme, ce jeu de donnees — et c'est
 * la qu'on la prouve. Sans actif rattache, la fenetre le dit, et renvoie au
 * rattachement.
 */
export function AssetMeasureForm({
  useCaseId,
  control,
  assets,
  placed,
}: {
  useCaseId: string
  control: { id: string; code: string; name: string }
  assets: { asset_id: string; name: string; kind: string }[]
  /** Les actifs qui portent deja la mesure, pour proposer les autres d'abord. */
  placed: string[]
}) {
  const [state, formAction, pending] = useActionState<FormState | null, FormData>(placeMeasureOnAsset, null)
  const errors = state && !state.ok ? (state.fieldErrors ?? {}) : {}
  const remaining = assets.filter((a) => !placed.includes(a.asset_id))

  return (
    <Modal
      trigger={placed.length ? 'Poser sur un autre actif' : 'Poser sur un actif'}
      triggerClassName="rounded-md border border-ink-200 px-2.5 py-1 text-xs font-medium text-ink-700 hover:bg-ink-100"
      title="Poser la mesure sur un actif"
      description={`${control.code} — ${control.name}`}
    >
      {() =>
        assets.length ? (
          <form action={formAction} className="flex flex-col gap-4">
            <input type="hidden" name="useCaseId" value={useCaseId} />
            <input type="hidden" name="controlId" value={control.id} />
            <Field label="Actif" htmlFor={`am-asset-${control.id}`} error={errors.assetId}>
              <select id={`am-asset-${control.id}`} name="assetId" required defaultValue="" className={FIELD}>
                <option value="" disabled>
                  Choisir…
                </option>
                {(remaining.length ? remaining : assets).map((a) => (
                  <option key={a.asset_id} value={a.asset_id}>
                    {a.name} — {ASSET_KIND_LABELS[a.kind] ?? a.kind}
                  </option>
                ))}
              </select>
            </Field>
            <div className="grid gap-4 sm:grid-cols-2">
              <Field label="État sur cet actif" htmlFor={`am-status-${control.id}`}>
                <select id={`am-status-${control.id}`} name="status" defaultValue="planned" className={FIELD}>
                  {Object.entries(ASSET_MEASURE_STATUS_LABELS).map(([value, label]) => (
                    <option key={value} value={value}>
                      {label}
                    </option>
                  ))}
                </select>
              </Field>
              <Field label="Note" htmlFor={`am-note-${control.id}`} optional hint="Comment elle est mise en œuvre ici.">
                <input id={`am-note-${control.id}`} name="note" type="text" className={FIELD} />
              </Field>
            </div>
            <FormFeedback state={state} />
            <Submit pending={pending} idle="Poser la mesure" />
          </form>
        ) : (
          <p className="text-sm text-ink-600">
            Aucun actif n’est rattaché à ce cas d’usage. Une mesure technique se pose sur un actif :
            rattachez d’abord le modèle, le système ou le jeu de données concerné (fil conducteur).
          </p>
        )
      }
    </Modal>
  )
}

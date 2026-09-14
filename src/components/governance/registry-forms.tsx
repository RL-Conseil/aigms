'use client'

import { useActionState, useState } from 'react'
import {
  createAsset,
  createVendor,
  linkAssetToUseCase,
  linkVendorToUseCase,
  reviewVendor,
  saveImpactAssessment,
  saveOversightPlan,
  type FormState,
} from '@/lib/actions/registry'
import { Field, FIELD, FormFeedback, Submit } from '@/components/forms'
import { Modal } from '@/components/modal'

/**
 * Saisie du registre.
 *
 * Deux de ces objets vivent dans le referentiel de l'organisation — un
 * fournisseur, un actif — et se lisent hors du contexte ou ils ont ete crees :
 * ils ont leur page. Les deux autres n'existent que par le cas d'usage qu'ils
 * decrivent : ils se saisissent sur place.
 */

const CRITICALITIES = [
  ['low', 'Faible'],
  ['moderate', 'Modérée'],
  ['high', 'Élevée'],
  ['critical', 'Critique'],
] as const

const REVIEW_STATUSES = [
  ['not_started', 'Non commencée'],
  ['in_progress', 'En cours'],
  ['approved', 'Approuvée'],
  ['approved_with_conditions', 'Approuvée sous conditions'],
  ['rejected', 'Rejetée'],
  ['expired', 'Échue'],
] as const

const ASSET_KINDS = [
  ['ai_system', 'Système d’IA — ce qui est déployé et utilisé'],
  ['ai_model', 'Modèle — entraîné ou acquis, servant un ou plusieurs systèmes'],
  ['ai_agent', 'Agent — enchaîne des actions avec une autonomie propre'],
  ['dataset', 'Jeu de données — entraînement, réglage ou évaluation'],
] as const

export function VendorForm({ organizationId }: { organizationId: string }) {
  const [state, formAction, pending] = useActionState<FormState | null, FormData>(
    createVendor,
    null,
  )
  const errors = state && !state.ok ? (state.fieldErrors ?? {}) : {}

  return (
    <form action={formAction} className="flex flex-col gap-4">
      <input type="hidden" name="organizationId" value={organizationId} />

      <div className="grid gap-4 sm:grid-cols-[1fr_140px_120px]">
        <Field label="Nom" htmlFor="vendor-name" error={errors.name}>
          <input id="vendor-name" name="name" type="text" required className={FIELD} />
        </Field>
        <Field label="Criticité" htmlFor="vendor-criticality">
          <select id="vendor-criticality" name="criticality" defaultValue="moderate" className={FIELD}>
            {CRITICALITIES.map(([value, label]) => (
              <option key={value} value={value}>
                {label}
              </option>
            ))}
          </select>
        </Field>
        <Field label="Pays" htmlFor="vendor-country" optional error={errors.countryCode}>
          <input
            id="vendor-country"
            name="countryCode"
            type="text"
            maxLength={2}
            className={`${FIELD} uppercase`}
            placeholder="FR"
          />
        </Field>
      </div>

      {/*
        Les quatre points qu'une revue tiers examine, et que le gate PRODUCTION
        finit par exiger. Les poser a la creation evite d'y revenir en urgence
        au moment de la mise en service.
      */}
      <fieldset className="flex flex-col gap-2 rounded-md border border-ink-200 px-4 py-3">
        <legend className="px-1 text-xs font-semibold uppercase tracking-wide text-ink-500">
          Ce que la revue tiers vérifie
        </legend>
        {[
          ['isModelProvider', 'Fournit un modèle d’IA', 'Un fournisseur de modèle engage davantage : réentraînement, localisation, réversibilité.'],
          ['dpaSigned', 'Contrat de traitement signé', 'Requis dès que des données personnelles lui parviennent.'],
          ['securityAssessed', 'Sécurité évaluée', 'Revue conduite, avec sa trace.'],
          ['reversibilityDocumented', 'Réversibilité documentée', 'Ce qu’on fait s’il interrompt le service ou change ses conditions.'],
        ].map(([name, label, hint]) => (
          <label key={name} className="flex items-start gap-2.5 text-sm">
            <input type="checkbox" name={name} className="mt-0.5 size-4 accent-[oklch(0.45_0.11_245)]" />
            <span>
              {label}
              <span className="mt-0.5 block text-xs leading-relaxed text-ink-500">{hint}</span>
            </span>
          </label>
        ))}
      </fieldset>

      <Field label="Sous-traitants ultérieurs" htmlFor="vendor-sub" optional>
        <textarea id="vendor-sub" name="subprocessors" rows={2} className={FIELD} />
      </Field>

      <Field label="Notes" htmlFor="vendor-notes" optional>
        <textarea id="vendor-notes" name="notes" rows={2} className={FIELD} />
      </Field>

      <FormFeedback state={state} />
      <Submit pending={pending} idle="Enregistrer le fournisseur" />
    </form>
  )
}

export function VendorReviewForm({
  organizationId,
  vendorId,
  name,
  reviewStatus,
  nextReviewAt,
}: {
  organizationId: string
  vendorId: string
  name: string
  reviewStatus: string
  nextReviewAt: string | null
}) {
  const [state, formAction, pending] = useActionState<FormState | null, FormData>(
    reviewVendor,
    null,
  )

  return (
    <Modal
      trigger="Revue tiers"
      title={`${name} — revue tiers`}
      description="Le gate PRODUCTION exige une revue close pour chaque tiers impliqué."
    >
      {() => (
        <form action={formAction} className="flex flex-col gap-4">
          <input type="hidden" name="organizationId" value={organizationId} />
          <input type="hidden" name="vendorId" value={vendorId} />

          <Field label="Résultat de la revue" htmlFor={`rev-${vendorId}`}>
            <select id={`rev-${vendorId}`} name="reviewStatus" defaultValue={reviewStatus} className={FIELD}>
              {REVIEW_STATUSES.map(([value, label]) => (
                <option key={value} value={value}>
                  {label}
                </option>
              ))}
            </select>
          </Field>

          <Field label="Prochaine revue" htmlFor={`rev-next-${vendorId}`} optional>
            <input
              id={`rev-next-${vendorId}`}
              name="nextReviewAt"
              type="date"
              defaultValue={nextReviewAt ?? ''}
              className={FIELD}
            />
          </Field>

          <Field label="Constats" htmlFor={`rev-notes-${vendorId}`} optional>
            <textarea id={`rev-notes-${vendorId}`} name="notes" rows={3} className={FIELD} />
          </Field>

          <FormFeedback state={state} />
          <Submit pending={pending} idle="Enregistrer la revue" />
        </form>
      )}
    </Modal>
  )
}

export function AssetForm({
  organizationId,
  vendors,
  people,
}: {
  organizationId: string
  vendors: { id: string; name: string }[]
  people: { id: string; label: string }[]
}) {
  const [state, formAction, pending] = useActionState<FormState | null, FormData>(createAsset, null)
  const errors = state && !state.ok ? (state.fieldErrors ?? {}) : {}

  return (
    <form action={formAction} className="flex flex-col gap-4">
      <input type="hidden" name="organizationId" value={organizationId} />

      <Field label="Nature" htmlFor="asset-kind">
        <select id="asset-kind" name="kind" defaultValue="ai_system" className={FIELD}>
          {ASSET_KINDS.map(([value, label]) => (
            <option key={value} value={value}>
              {label}
            </option>
          ))}
        </select>
      </Field>

      <div className="grid gap-4 sm:grid-cols-[1fr_140px]">
        <Field label="Nom" htmlFor="asset-name" error={errors.name}>
          <input id="asset-name" name="name" type="text" required className={FIELD} />
        </Field>
        <Field label="Version" htmlFor="asset-version" optional>
          <input id="asset-version" name="version" type="text" className={FIELD} />
        </Field>
      </div>

      <Field label="Description" htmlFor="asset-description" optional>
        <textarea id="asset-description" name="description" rows={2} className={FIELD} />
      </Field>

      <div className="grid gap-4 sm:grid-cols-2">
        <Field label="Fournisseur" htmlFor="asset-vendor" optional>
          <select id="asset-vendor" name="vendorId" defaultValue="" className={FIELD}>
            <option value="">— Interne ou sans fournisseur</option>
            {vendors.map((vendor) => (
              <option key={vendor.id} value={vendor.id}>
                {vendor.name}
              </option>
            ))}
          </select>
        </Field>
        <Field label="Responsable" htmlFor="asset-owner" optional>
          <select id="asset-owner" name="ownerUserId" defaultValue="" className={FIELD}>
            <option value="">— À désigner</option>
            {people.map((person) => (
              <option key={person.id} value={person.id}>
                {person.label}
              </option>
            ))}
          </select>
        </Field>
      </div>

      <Field
        label="Localisation d’hébergement"
        htmlFor="asset-hosting"
        optional
        hint="Où le traitement a lieu. Un transfert hors UE se documente."
      >
        <input id="asset-hosting" name="hostingLocation" type="text" className={FIELD} />
      </Field>

      <label className="flex items-start gap-2.5 text-sm">
        <input
          type="checkbox"
          name="containsPersonalData"
          className="mt-0.5 size-4 accent-[oklch(0.45_0.11_245)]"
        />
        <span>
          Contient des données à caractère personnel
          <span className="mt-0.5 block text-xs leading-relaxed text-ink-500">
            Déclenche l’articulation avec l’analyse d’impact RGPD.
          </span>
        </span>
      </label>

      <FormFeedback state={state} />
      <Submit pending={pending} idle="Inscrire l’actif" />
    </form>
  )
}

// -----------------------------------------------------------------------------
// Rattachements
// -----------------------------------------------------------------------------
export function LinkAssetForm({
  useCaseId,
  assets,
}: {
  useCaseId: string
  assets: { id: string; name: string; kind: string }[]
}) {
  const [state, formAction, pending] = useActionState<FormState | null, FormData>(
    linkAssetToUseCase,
    null,
  )

  if (!assets.length) return null

  return (
    <Modal trigger="Rattacher un actif" title="Actif d’IA employé par ce cas d’usage">
      {() => (
        <form action={formAction} className="flex flex-col gap-4">
          <input type="hidden" name="useCaseId" value={useCaseId} />
          <Field label="Actif" htmlFor="link-asset">
            <select id="link-asset" name="assetId" defaultValue="" required className={FIELD}>
              <option value="" disabled>
                — Choisir
              </option>
              {assets.map((asset) => (
                <option key={asset.id} value={asset.id}>
                  {asset.name}
                </option>
              ))}
            </select>
          </Field>
          <Field label="Relation" htmlFor="link-relation" optional hint="Ex. « modèle sous-jacent », « jeu d’évaluation ».">
            <input id="link-relation" name="relation" type="text" className={FIELD} />
          </Field>
          <FormFeedback state={state} />
          <Submit pending={pending} idle="Rattacher" />
        </form>
      )}
    </Modal>
  )
}

export function LinkVendorForm({
  useCaseId,
  vendors,
}: {
  useCaseId: string
  vendors: { id: string; name: string }[]
}) {
  const [state, formAction, pending] = useActionState<FormState | null, FormData>(
    linkVendorToUseCase,
    null,
  )

  if (!vendors.length) return null

  return (
    <Modal
      trigger="Rattacher un fournisseur"
      title="Fournisseur impliqué"
      description="Sa revue tiers devra être close avant la mise en production."
    >
      {() => (
        <form action={formAction} className="flex flex-col gap-4">
          <input type="hidden" name="useCaseId" value={useCaseId} />
          <Field label="Fournisseur" htmlFor="link-vendor">
            <select id="link-vendor" name="vendorId" defaultValue="" required className={FIELD}>
              <option value="" disabled>
                — Choisir
              </option>
              {vendors.map((vendor) => (
                <option key={vendor.id} value={vendor.id}>
                  {vendor.name}
                </option>
              ))}
            </select>
          </Field>
          <FormFeedback state={state} />
          <Submit pending={pending} idle="Rattacher" />
        </form>
      )}
    </Modal>
  )
}

// -----------------------------------------------------------------------------
// Supervision humaine
// -----------------------------------------------------------------------------
export function OversightForm({
  useCaseId,
  people,
  current,
}: {
  useCaseId: string
  people: { id: string; label: string }[]
  current: {
    status: string
    accountable_user_id?: string | null
    stop_authority_user_id?: string | null
    intervention_triggers: string | null
    override_procedure: string | null
    stop_procedure: string | null
    monitoring_cadence: string | null
    expected_evidence: string | null
    not_applicable_rationale: string | null
  } | null
}) {
  const [state, formAction, pending] = useActionState<FormState | null, FormData>(
    saveOversightPlan,
    null,
  )
  const [status, setStatus] = useState(current?.status ?? 'draft')

  return (
    <Modal
      trigger={current ? 'Modifier le plan' : 'Décrire la supervision'}
      title="Plan de supervision humaine"
      description="Qui peut interrompre le système, à quels signaux, et par quelle procédure."
    >
      {() => (
        <form action={formAction} className="flex flex-col gap-4">
          <input type="hidden" name="useCaseId" value={useCaseId} />

          <Field label="État du plan" htmlFor={`ov-status-${useCaseId}`}>
            <select
              id={`ov-status-${useCaseId}`}
              name="status"
              value={status}
              onChange={(event) => setStatus(event.target.value)}
              className={FIELD}
            >
              <option value="draft">Brouillon</option>
              <option value="submitted">Soumis</option>
              <option value="approved">Approuvé</option>
              <option value="not_applicable">Non applicable</option>
            </select>
          </Field>

          {status === 'not_applicable' ? (
            <Field
              label="Pourquoi la supervision ne s’applique pas"
              htmlFor={`ov-na-${useCaseId}`}
              hint="La base l’exige : une supervision écartée sans motif ne se défend pas."
            >
              <textarea
                id={`ov-na-${useCaseId}`}
                name="notApplicableRationale"
                rows={3}
                required
                defaultValue={current?.not_applicable_rationale ?? ''}
                className={FIELD}
              />
            </Field>
          ) : (
            <>
              <div className="grid gap-4 sm:grid-cols-2">
                <Field label="Responsable redevable" htmlFor={`ov-acc-${useCaseId}`}>
                  <select
                    id={`ov-acc-${useCaseId}`}
                    name="accountableUserId"
                    defaultValue={current?.accountable_user_id ?? ''}
                    className={FIELD}
                  >
                    <option value="">— À désigner</option>
                    {people.map((person) => (
                      <option key={person.id} value={person.id}>
                        {person.label}
                      </option>
                    ))}
                  </select>
                </Field>
                <Field
                  label="Autorité d’arrêt"
                  htmlFor={`ov-stop-${useCaseId}`}
                  hint="Au-delà de L2, la base l’exige nommément."
                >
                  <select
                    id={`ov-stop-${useCaseId}`}
                    name="stopAuthorityUserId"
                    defaultValue={current?.stop_authority_user_id ?? ''}
                    className={FIELD}
                  >
                    <option value="">— À désigner</option>
                    {people.map((person) => (
                      <option key={person.id} value={person.id}>
                        {person.label}
                      </option>
                    ))}
                  </select>
                </Field>
              </div>

              <Field
                label="Déclencheurs d’intervention"
                htmlFor={`ov-trig-${useCaseId}`}
                hint="À quels signaux un humain reprend la main. Sans eux, la supervision ne se démontre pas."
              >
                <textarea
                  id={`ov-trig-${useCaseId}`}
                  name="interventionTriggers"
                  rows={3}
                  defaultValue={current?.intervention_triggers ?? ''}
                  className={FIELD}
                />
              </Field>

              <Field label="Procédure de reprise en main" htmlFor={`ov-over-${useCaseId}`} optional>
                <textarea
                  id={`ov-over-${useCaseId}`}
                  name="overrideProcedure"
                  rows={2}
                  defaultValue={current?.override_procedure ?? ''}
                  className={FIELD}
                />
              </Field>

              <Field label="Procédure d’arrêt" htmlFor={`ov-stopp-${useCaseId}`} optional>
                <textarea
                  id={`ov-stopp-${useCaseId}`}
                  name="stopProcedure"
                  rows={2}
                  defaultValue={current?.stop_procedure ?? ''}
                  className={FIELD}
                />
              </Field>

              <div className="grid gap-4 sm:grid-cols-2">
                <Field label="Cadence de surveillance" htmlFor={`ov-cad-${useCaseId}`} optional>
                  <input
                    id={`ov-cad-${useCaseId}`}
                    name="monitoringCadence"
                    type="text"
                    defaultValue={current?.monitoring_cadence ?? ''}
                    className={FIELD}
                  />
                </Field>
                <Field label="Prochaine revue" htmlFor={`ov-next-${useCaseId}`} optional>
                  <input id={`ov-next-${useCaseId}`} name="nextReviewAt" type="date" className={FIELD} />
                </Field>
              </div>

              <Field label="Preuves attendues" htmlFor={`ov-evi-${useCaseId}`} optional>
                <textarea
                  id={`ov-evi-${useCaseId}`}
                  name="expectedEvidence"
                  rows={2}
                  defaultValue={current?.expected_evidence ?? ''}
                  className={FIELD}
                />
              </Field>
            </>
          )}

          <FormFeedback state={state} />
          <Submit pending={pending} idle="Enregistrer le plan" />
        </form>
      )}
    </Modal>
  )
}

// -----------------------------------------------------------------------------
// Évaluation d'impact
// -----------------------------------------------------------------------------
export function ImpactForm({ useCaseId }: { useCaseId: string }) {
  const [state, formAction, pending] = useActionState<FormState | null, FormData>(
    saveImpactAssessment,
    null,
  )
  const errors = state && !state.ok ? (state.fieldErrors ?? {}) : {}

  return (
    <Modal
      trigger="Conduire une évaluation"
      title="Évaluation d’impact"
      description="Les effets sur les personnes, les groupes et la société — pas la sécurité du système."
    >
      {() => (
        <form action={formAction} className="flex flex-col gap-4">
          <input type="hidden" name="useCaseId" value={useCaseId} />

          <Field
            label="Périmètre examiné"
            htmlFor={`ia-scope-${useCaseId}`}
            error={errors.scopeDescription}
            hint="Sur qui, et sous quel angle. C’est ce qui délimite ce que l’évaluation couvre — et ce qu’elle ne couvre pas."
          >
            <textarea
              id={`ia-scope-${useCaseId}`}
              name="scopeDescription"
              rows={3}
              required
              className={FIELD}
            />
          </Field>

          <div className="grid gap-4 sm:grid-cols-2">
            <Field label="Méthodologie" htmlFor={`ia-meth-${useCaseId}`}>
              <input
                id={`ia-meth-${useCaseId}`}
                name="methodology"
                type="text"
                defaultValue="ISO/IEC 42005"
                className={FIELD}
              />
            </Field>
            <Field label="Phase du cycle de vie" htmlFor={`ia-phase-${useCaseId}`} optional>
              <input
                id={`ia-phase-${useCaseId}`}
                name="lifecyclePhase"
                type="text"
                placeholder="Avant mise en service"
                className={FIELD}
              />
            </Field>
          </div>

          <Field label="État" htmlFor={`ia-status-${useCaseId}`}>
            <select id={`ia-status-${useCaseId}`} name="status" defaultValue="in_progress" className={FIELD}>
              <option value="draft">Brouillon</option>
              <option value="in_progress">En cours</option>
              <option value="completed">Terminée</option>
              <option value="reopened">Rouverte</option>
            </select>
          </Field>

          <label className="flex items-start gap-2.5 text-sm">
            <input type="checkbox" name="dpiaRequired" className="mt-0.5 size-4 accent-[oklch(0.45_0.11_245)]" />
            <span>
              Une analyse d’impact RGPD est due
              <span className="mt-0.5 block text-xs leading-relaxed text-ink-500">
                L’AIPD ne se substitue pas à cette évaluation, et réciproquement : les deux
                coexistent, et la référence de l’AIPD se consigne ici.
              </span>
            </span>
          </label>

          <Field label="Référence de l’AIPD" htmlFor={`ia-dpia-${useCaseId}`} optional>
            <input id={`ia-dpia-${useCaseId}`} name="dpiaReference" type="text" className={FIELD} />
          </Field>

          <Field label="Conclusion" htmlFor={`ia-concl-${useCaseId}`} optional>
            <textarea id={`ia-concl-${useCaseId}`} name="conclusion" rows={3} className={FIELD} />
          </Field>

          <Field label="Prochaine revue" htmlFor={`ia-next-${useCaseId}`} optional>
            <input id={`ia-next-${useCaseId}`} name="nextReviewAt" type="date" className={FIELD} />
          </Field>

          <FormFeedback state={state} />
          <Submit pending={pending} idle="Enregistrer l’évaluation" />
        </form>
      )}
    </Modal>
  )
}

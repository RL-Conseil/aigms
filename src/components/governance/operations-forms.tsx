'use client'

import { useActionState, useState } from 'react'
import {
  closeCapa,
  createAction,
  declareIncident,
  progressIncident,
  saveCapa,
  submitChangeRequest,
  updateActionStatus,
  type FormState,
} from '@/lib/actions/operations'
import { Field, FIELD, FormFeedback, Submit } from '@/components/forms'
import { Modal } from '@/components/modal'
import { ACTION_STATUS_LABELS, INCIDENT_STATUS_LABELS } from '@/lib/domain/governance'

/**
 * Saisie du suivi operationnel.
 *
 * Tout se saisit sur place, en fenetre : une action, un incident, une CAPA,
 * une demande de changement n'existent que par le cas d'usage ou
 * l'organisation qu'ils concernent, et se relisent la ou ils ont ete ouverts.
 *
 * Les regles vivent en base et s'affichent quand elle les oppose ; les
 * formulaires les annoncent avant, pour eviter le refus quand c'est possible.
 */

type Person = { id: string; label: string }
type UseCaseChoice = { id: string; name: string; business_ref: string }

const errorsOf = (state: FormState | null) => (state && !state.ok ? (state.fieldErrors ?? {}) : {})

function PeopleSelect({
  id,
  name,
  people,
  defaultValue,
}: {
  id: string
  name: string
  people: Person[]
  defaultValue?: string | null
}) {
  return (
    <select id={id} name={name} defaultValue={defaultValue ?? ''} className={FIELD}>
      <option value="">— À désigner</option>
      {people.map((p) => (
        <option key={p.id} value={p.id}>
          {p.label}
        </option>
      ))}
    </select>
  )
}

function UseCaseSelect({
  id,
  useCases,
  defaultValue,
}: {
  id: string
  useCases: UseCaseChoice[]
  defaultValue?: string
}) {
  return (
    <select id={id} name="useCaseId" defaultValue={defaultValue ?? ''} className={FIELD}>
      <option value="">— Transverse à l’organisation</option>
      {useCases.map((u) => (
        <option key={u.id} value={u.id}>
          {u.business_ref} — {u.name}
        </option>
      ))}
    </select>
  )
}

// -----------------------------------------------------------------------------
// Action
// -----------------------------------------------------------------------------
export function ActionForm({
  organizationId,
  useCaseId,
  useCases,
  people,
}: {
  organizationId: string
  /** Fixe : le formulaire vit sur la fiche du cas d'usage. */
  useCaseId?: string
  /** Sinon, a choisir — ou transverse. */
  useCases?: UseCaseChoice[]
  people: Person[]
}) {
  const [state, formAction, pending] = useActionState<FormState | null, FormData>(createAction, null)
  const errors = errorsOf(state)

  return (
    <Modal
      trigger="Ouvrir une action"
      title="Ouvrir une action"
      description="Ce qui doit être fait, par qui, pour quand — et si le gate PRODUCTION doit l’attendre."
    >
      {() => (
        <form action={formAction} className="flex flex-col gap-4">
          <input type="hidden" name="organizationId" value={organizationId} />
          {useCaseId ? <input type="hidden" name="useCaseId" value={useCaseId} /> : null}

          {!useCaseId && useCases ? (
            <Field label="Cas d’usage concerné" htmlFor="act-uc" optional>
              <UseCaseSelect id="act-uc" useCases={useCases} />
            </Field>
          ) : null}

          <Field label="Titre" htmlFor="act-title" error={errors.title}>
            <input id="act-title" name="title" type="text" required className={FIELD} />
          </Field>

          <Field label="Description" htmlFor="act-desc" optional>
            <textarea id="act-desc" name="description" rows={3} className={FIELD} />
          </Field>

          <div className="grid gap-4 sm:grid-cols-2">
            <Field label="Responsable" htmlFor="act-owner" optional>
              <PeopleSelect id="act-owner" name="ownerUserId" people={people} />
            </Field>
            <Field label="Échéance" htmlFor="act-due" optional>
              <input id="act-due" name="dueDate" type="date" className={FIELD} />
            </Field>
          </div>

          <label className="flex items-start gap-2.5 text-sm text-ink-700">
            <input type="checkbox" name="isBlocking" className="mt-0.5" />
            <span>
              <span className="font-medium text-ink-900">Bloquante pour la mise en production</span>
              <span className="block text-xs text-ink-500">
                Tant qu’elle n’est pas close, le gate PRODUCTION du cas d’usage la retient.
              </span>
              {errors.isBlocking ? (
                <span className="block text-xs text-stop-600">{errors.isBlocking}</span>
              ) : null}
            </span>
          </label>

          <FormFeedback state={state} />
          <Submit pending={pending} idle="Ouvrir l’action" />
        </form>
      )}
    </Modal>
  )
}

export function ActionStatusForm({
  organizationId,
  useCaseId,
  action,
}: {
  organizationId: string
  useCaseId?: string | null
  action: { id: string; title: string; status: string }
}) {
  const [state, formAction, pending] = useActionState<FormState | null, FormData>(
    updateActionStatus,
    null,
  )
  const [status, setStatus] = useState(action.status === 'overdue' ? 'open' : action.status)
  const errors = errorsOf(state)
  const closed = action.status === 'done' || action.status === 'cancelled'

  return (
    <Modal
      trigger={closed ? 'Voir' : 'Avancer'}
      title={action.title}
      description="Le statut change ; la clôture se motive et se date."
      hideTrigger={closed && !state}
    >
      {() => (
        <form action={formAction} className="flex flex-col gap-4">
          <input type="hidden" name="organizationId" value={organizationId} />
          <input type="hidden" name="actionId" value={action.id} />
          {useCaseId ? <input type="hidden" name="useCaseId" value={useCaseId} /> : null}

          <Field label="Statut" htmlFor={`act-status-${action.id}`}>
            <select
              id={`act-status-${action.id}`}
              name="status"
              value={status}
              onChange={(e) => setStatus(e.target.value)}
              className={FIELD}
            >
              {(['open', 'in_progress', 'blocked', 'done', 'cancelled'] as const).map((s) => (
                <option key={s} value={s}>
                  {ACTION_STATUS_LABELS[s]}
                </option>
              ))}
            </select>
          </Field>

          {status === 'done' || status === 'cancelled' ? (
            <Field
              label={status === 'done' ? 'Ce qui a été fait' : 'Pourquoi elle est annulée'}
              htmlFor={`act-note-${action.id}`}
              error={errors.closureNote}
              hint={status === 'done' ? 'C’est ce qu’un auditeur lira.' : undefined}
            >
              <textarea id={`act-note-${action.id}`} name="closureNote" rows={3} className={FIELD} />
            </Field>
          ) : null}

          <FormFeedback state={state} />
          <Submit pending={pending} idle="Enregistrer" />
        </form>
      )}
    </Modal>
  )
}

// -----------------------------------------------------------------------------
// Incident
// -----------------------------------------------------------------------------
const INCIDENT_KIND_LABELS: Record<string, string> = {
  incident: 'Incident',
  non_conformity: 'Non-conformité',
  observation: 'Observation',
  near_miss: 'Presque-accident',
}

const SEVERITY_LABELS: Record<string, string> = {
  S1: 'S1 — Critique',
  S2: 'S2 — Majeur',
  S3: 'S3 — Modéré',
  S4: 'S4 — Mineur',
}

export function IncidentForm({
  organizationId,
  useCaseId,
  useCases,
  people,
}: {
  organizationId: string
  useCaseId?: string
  useCases?: UseCaseChoice[]
  people: Person[]
}) {
  const [state, formAction, pending] = useActionState<FormState | null, FormData>(
    declareIncident,
    null,
  )
  const [kind, setKind] = useState('incident')
  const [severity, setSeverity] = useState('S3')
  const [recurrence, setRecurrence] = useState(false)
  const errors = errorsOf(state)
  const significant = severity === 'S1' || severity === 'S2' || kind === 'non_conformity' || recurrence

  return (
    <Modal
      trigger="Déclarer un incident"
      title="Déclarer un incident"
      description="Les faits, quand, avec quelle gravité. L’analyse vient après."
    >
      {() => (
        <form action={formAction} className="flex flex-col gap-4">
          <input type="hidden" name="organizationId" value={organizationId} />
          {useCaseId ? <input type="hidden" name="useCaseId" value={useCaseId} /> : null}

          {!useCaseId && useCases ? (
            <Field label="Cas d’usage concerné" htmlFor="inc-uc" optional>
              <UseCaseSelect id="inc-uc" useCases={useCases} />
            </Field>
          ) : null}

          <Field label="Titre" htmlFor="inc-title" error={errors.title}>
            <input id="inc-title" name="title" type="text" required className={FIELD} />
          </Field>

          <Field
            label="Ce qui s’est passé"
            htmlFor="inc-desc"
            error={errors.description}
            hint="Les faits, pas l’interprétation : qui a vu quoi, quand, avec quel effet."
          >
            <textarea id="inc-desc" name="description" rows={4} required className={FIELD} />
          </Field>

          <div className="grid gap-4 sm:grid-cols-3">
            <Field label="Nature" htmlFor="inc-kind">
              <select
                id="inc-kind"
                name="kind"
                value={kind}
                onChange={(e) => setKind(e.target.value)}
                className={FIELD}
              >
                {Object.entries(INCIDENT_KIND_LABELS).map(([v, l]) => (
                  <option key={v} value={v}>
                    {l}
                  </option>
                ))}
              </select>
            </Field>
            <Field label="Gravité" htmlFor="inc-sev">
              <select
                id="inc-sev"
                name="severity"
                value={severity}
                onChange={(e) => setSeverity(e.target.value)}
                className={FIELD}
              >
                {Object.entries(SEVERITY_LABELS).map(([v, l]) => (
                  <option key={v} value={v}>
                    {l}
                  </option>
                ))}
              </select>
            </Field>
            <Field label="Détecté le" htmlFor="inc-at" optional>
              <input id="inc-at" name="detectedAt" type="datetime-local" className={FIELD} />
            </Field>
          </div>

          <Field label="Responsable du traitement" htmlFor="inc-owner" optional>
            <PeopleSelect id="inc-owner" name="ownerUserId" people={people} />
          </Field>

          <label className="flex items-start gap-2.5 text-sm text-ink-700">
            <input
              type="checkbox"
              name="isRecurrence"
              checked={recurrence}
              onChange={(e) => setRecurrence(e.target.checked)}
              className="mt-0.5"
            />
            <span>
              <span className="font-medium text-ink-900">Récurrence</span>
              <span className="block text-xs text-ink-500">Un incident semblable s’est déjà produit.</span>
            </span>
          </label>

          {significant ? (
            <p className="rounded-md border border-ink-200 bg-ink-50 px-3.5 py-3 text-xs leading-relaxed text-ink-600">
              <strong className="font-medium text-ink-800">Incident significatif.</strong> Sa clôture
              exigera une CAPA close — correction, cause, action corrective, et un test d’efficacité
              vérifié nominativement. La base le refuse sinon.
            </p>
          ) : null}

          <FormFeedback state={state} />
          <Submit pending={pending} idle="Déclarer l’incident" />
        </form>
      )}
    </Modal>
  )
}

export function IncidentProgressForm({
  organizationId,
  useCaseId,
  incident,
}: {
  organizationId: string
  useCaseId?: string | null
  incident: {
    id: string
    title: string
    status: string
    containment_action: string | null
    root_cause: string | null
    significant: boolean
    has_closed_capa: boolean
  }
}) {
  const [state, formAction, pending] = useActionState<FormState | null, FormData>(
    progressIncident,
    null,
  )
  const [status, setStatus] = useState(incident.status)
  const errors = errorsOf(state)
  const closed = incident.status === 'CLOSED'

  return (
    <Modal
      trigger={closed ? 'Voir' : 'Faire avancer'}
      title={incident.title}
      description="Circonscrire, investiguer, planifier, vérifier, clore — chaque étape porte ce qu’elle exige."
      hideTrigger={closed && !state}
    >
      {() => (
        <form action={formAction} className="flex flex-col gap-4">
          <input type="hidden" name="organizationId" value={organizationId} />
          <input type="hidden" name="incidentId" value={incident.id} />
          {useCaseId ? <input type="hidden" name="useCaseId" value={useCaseId} /> : null}

          <Field label="Statut" htmlFor={`inc-status-${incident.id}`}>
            <select
              id={`inc-status-${incident.id}`}
              name="status"
              value={status}
              onChange={(e) => setStatus(e.target.value)}
              className={FIELD}
            >
              {Object.entries(INCIDENT_STATUS_LABELS).map(([v, l]) => (
                <option key={v} value={v}>
                  {l}
                </option>
              ))}
            </select>
          </Field>

          {status !== 'OPEN' ? (
            <Field
              label="Ce qui a été fait pour circonscrire"
              htmlFor={`inc-cont-${incident.id}`}
              error={errors.containmentAction}
            >
              <textarea
                id={`inc-cont-${incident.id}`}
                name="containmentAction"
                rows={3}
                defaultValue={incident.containment_action ?? ''}
                className={FIELD}
              />
            </Field>
          ) : null}

          {['INVESTIGATING', 'ACTION_PLAN', 'EFFECTIVENESS_REVIEW', 'CLOSED'].includes(status) ? (
            <Field
              label="Cause racine"
              htmlFor={`inc-cause-${incident.id}`}
              error={errors.rootCause}
              optional={status !== 'CLOSED'}
              hint="Exigée à la clôture : un incident clos sans cause racine se reproduit."
            >
              <textarea
                id={`inc-cause-${incident.id}`}
                name="rootCause"
                rows={3}
                defaultValue={incident.root_cause ?? ''}
                className={FIELD}
              />
            </Field>
          ) : null}

          {status === 'CLOSED' ? (
            <>
              <Field label="Note de clôture" htmlFor={`inc-note-${incident.id}`} optional>
                <textarea id={`inc-note-${incident.id}`} name="closureNote" rows={2} className={FIELD} />
              </Field>
              {incident.significant && !incident.has_closed_capa ? (
                <p className="rounded-md border border-warn-600/40 bg-amber-50 px-3.5 py-3 text-xs leading-relaxed text-ink-700">
                  Cet incident est significatif et <strong className="font-medium">aucune CAPA n’est close</strong>.
                  La base refusera la clôture : ouvrir la CAPA, la conduire, vérifier son efficacité.
                </p>
              ) : null}
            </>
          ) : null}

          <FormFeedback state={state} />
          <Submit pending={pending} idle="Enregistrer" />
        </form>
      )}
    </Modal>
  )
}

// -----------------------------------------------------------------------------
// CAPA
// -----------------------------------------------------------------------------
const CAPA_STATUS_LABELS: Record<string, string> = {
  draft: 'Brouillon',
  in_progress: 'En cours',
  implemented: 'Mise en œuvre',
  effectiveness_tested: 'Efficacité testée',
  ineffective: 'Inefficace — à reprendre',
  closed: 'Close',
}

export function CapaForm({
  organizationId,
  useCaseId,
  incidentId,
  people,
  current,
}: {
  organizationId: string
  useCaseId?: string | null
  incidentId: string
  people: Person[]
  current?: {
    id: string
    correction: string
    cause_analysis: string
    corrective_action: string
    preventive_action: string | null
    owner_user_id: string | null
    due_date: string | null
    status: string
  } | null
}) {
  const [state, formAction, pending] = useActionState<FormState | null, FormData>(saveCapa, null)
  const errors = errorsOf(state)
  const key = current?.id ?? incidentId

  return (
    <Modal
      trigger={current ? 'Modifier la CAPA' : 'Ouvrir une CAPA'}
      title={current ? 'Action corrective et préventive' : 'Ouvrir une CAPA'}
      description="Corriger tout de suite, comprendre pourquoi, empêcher que ça se reproduise."
    >
      {() => (
        <form action={formAction} className="flex flex-col gap-4">
          <input type="hidden" name="organizationId" value={organizationId} />
          <input type="hidden" name="incidentId" value={incidentId} />
          {current ? <input type="hidden" name="capaId" value={current.id} /> : null}
          {useCaseId ? <input type="hidden" name="useCaseId" value={useCaseId} /> : null}

          <Field
            label="Correction immédiate"
            htmlFor={`capa-corr-${key}`}
            error={errors.correction}
            hint="Ce qui a été fait tout de suite pour limiter l’effet."
          >
            <textarea
              id={`capa-corr-${key}`}
              name="correction"
              rows={2}
              required
              defaultValue={current?.correction ?? ''}
              className={FIELD}
            />
          </Field>

          <Field
            label="Analyse de cause"
            htmlFor={`capa-cause-${key}`}
            error={errors.causeAnalysis}
            hint="Pourquoi c’est arrivé — la cause, pas le symptôme."
          >
            <textarea
              id={`capa-cause-${key}`}
              name="causeAnalysis"
              rows={3}
              required
              defaultValue={current?.cause_analysis ?? ''}
              className={FIELD}
            />
          </Field>

          <Field
            label="Action corrective"
            htmlFor={`capa-corrective-${key}`}
            error={errors.correctiveAction}
            hint="Ce qui empêche que ça se reproduise."
          >
            <textarea
              id={`capa-corrective-${key}`}
              name="correctiveAction"
              rows={2}
              required
              defaultValue={current?.corrective_action ?? ''}
              className={FIELD}
            />
          </Field>

          <Field label="Action préventive" htmlFor={`capa-prev-${key}`} optional>
            <textarea
              id={`capa-prev-${key}`}
              name="preventiveAction"
              rows={2}
              defaultValue={current?.preventive_action ?? ''}
              className={FIELD}
            />
          </Field>

          <div className="grid gap-4 sm:grid-cols-3">
            <Field label="Responsable" htmlFor={`capa-owner-${key}`} optional>
              <PeopleSelect
                id={`capa-owner-${key}`}
                name="ownerUserId"
                people={people}
                defaultValue={current?.owner_user_id}
              />
            </Field>
            <Field label="Échéance" htmlFor={`capa-due-${key}`} optional>
              <input
                id={`capa-due-${key}`}
                name="dueDate"
                type="date"
                defaultValue={current?.due_date ?? ''}
                className={FIELD}
              />
            </Field>
            <Field label="Avancement" htmlFor={`capa-status-${key}`}>
              <select
                id={`capa-status-${key}`}
                name="status"
                defaultValue={current?.status && current.status !== 'closed' ? current.status : 'draft'}
                className={FIELD}
              >
                {(['draft', 'in_progress', 'implemented', 'effectiveness_tested', 'ineffective'] as const).map(
                  (s) => (
                    <option key={s} value={s}>
                      {CAPA_STATUS_LABELS[s]}
                    </option>
                  ),
                )}
              </select>
            </Field>
          </div>

          <p className="text-xs leading-relaxed text-ink-500">
            La clôture est un acte à part : elle exige un test d’efficacité, et c’est la personne
            qui le vérifie qui la signe.
          </p>

          <FormFeedback state={state} />
          <Submit pending={pending} idle={current ? 'Enregistrer' : 'Ouvrir la CAPA'} />
        </form>
      )}
    </Modal>
  )
}

export function CapaCloseForm({
  organizationId,
  useCaseId,
  capa,
}: {
  organizationId: string
  useCaseId?: string | null
  capa: { id: string; status: string }
}) {
  const [state, formAction, pending] = useActionState<FormState | null, FormData>(closeCapa, null)
  const errors = errorsOf(state)
  const [effective, setEffective] = useState(true)

  return (
    <Modal
      trigger="Vérifier l’efficacité"
      title="Vérifier l’efficacité"
      description="Le test conduit, ce qu’il a montré. La vérification est enregistrée en votre nom."
      hideTrigger={capa.status === 'closed' && !state}
    >
      {() => (
        <form action={formAction} className="flex flex-col gap-4">
          <input type="hidden" name="organizationId" value={organizationId} />
          <input type="hidden" name="capaId" value={capa.id} />
          {useCaseId ? <input type="hidden" name="useCaseId" value={useCaseId} /> : null}

          <Field label="Test conduit" htmlFor={`capa-test-${capa.id}`} error={errors.effectivenessTest}>
            <textarea id={`capa-test-${capa.id}`} name="effectivenessTest" rows={3} required className={FIELD} />
          </Field>

          <Field label="Résultat" htmlFor={`capa-result-${capa.id}`} error={errors.effectivenessResult}>
            <textarea id={`capa-result-${capa.id}`} name="effectivenessResult" rows={3} required className={FIELD} />
          </Field>

          <label className="flex items-start gap-2.5 text-sm text-ink-700">
            <input
              type="checkbox"
              name="effective"
              checked={effective}
              onChange={(e) => setEffective(e.target.checked)}
              className="mt-0.5"
            />
            <span>
              <span className="font-medium text-ink-900">L’action est efficace</span>
              <span className="block text-xs text-ink-500">
                {effective
                  ? 'La CAPA sera close, en votre nom, datée.'
                  : 'La CAPA sera marquée inefficace et restera à reprendre.'}
              </span>
            </span>
          </label>

          <FormFeedback state={state} />
          <Submit pending={pending} idle={effective ? 'Clore la CAPA' : 'Marquer inefficace'} />
        </form>
      )}
    </Modal>
  )
}

// -----------------------------------------------------------------------------
// Demande de changement
// -----------------------------------------------------------------------------
export const CHANGE_TYPE_LABELS: Record<string, string> = {
  MODEL: 'Modèle',
  DATASET: 'Données',
  PURPOSE: 'Finalité',
  VENDOR: 'Fournisseur',
  AUTONOMY: 'Autonomie',
  POPULATION: 'Population concernée',
  TERRITORY: 'Territoire',
  SECURITY: 'Sécurité',
  DEPLOYMENT: 'Déploiement',
}

export const CHANGE_FACTS: { name: string; label: string; hint: string }[] = [
  { name: 'changesPurpose', label: 'La finalité change', hint: 'Une autre chose est décidée ou produite.' },
  { name: 'newPopulationAffected', label: 'De nouvelles personnes sont concernées', hint: 'Un public que l’évaluation d’impact n’a pas vu.' },
  { name: 'newTerritory', label: 'Un nouveau territoire', hint: 'Un autre droit peut s’appliquer.' },
  { name: 'changesPersonalData', label: 'Les données personnelles changent', hint: 'Nature, volume ou base légale.' },
  { name: 'changesVendor', label: 'Le fournisseur change', hint: 'La revue tiers est à refaire.' },
  { name: 'changesModel', label: 'Le modèle change', hint: 'Version, famille ou éditeur.' },
  { name: 'changesDataset', label: 'Les jeux de données changent', hint: 'Entraînement, réglage ou évaluation.' },
  { name: 'securityRelevant', label: 'Incidence sur la sécurité', hint: 'Surface d’attaque, secrets, accès.' },
]

export function ChangeRequestForm({
  organizationId,
  useCaseId,
  currentAutonomy,
}: {
  organizationId: string
  useCaseId: string
  currentAutonomy: string
}) {
  const [state, formAction, pending] = useActionState<FormState | null, FormData>(
    submitChangeRequest,
    null,
  )
  const [increasesAutonomy, setIncreasesAutonomy] = useState(false)
  const errors = errorsOf(state)

  return (
    <Modal
      trigger="Demander un changement"
      title="Demander un changement"
      description="Les faits déclarés ici sont ce que le moteur de réévaluation lit. Il dit ensuite ce qui doit être réévalué."
    >
      {() => (
        <form action={formAction} className="flex flex-col gap-4">
          <input type="hidden" name="organizationId" value={organizationId} />
          <input type="hidden" name="useCaseId" value={useCaseId} />

          <Field label="Titre" htmlFor="chg-title" error={errors.title}>
            <input id="chg-title" name="title" type="text" required className={FIELD} />
          </Field>

          <Field label="Ce qui change" htmlFor="chg-desc" error={errors.description}>
            <textarea id="chg-desc" name="description" rows={3} required className={FIELD} />
          </Field>

          <fieldset>
            <legend className="mb-1.5 text-sm font-medium text-ink-900">Nature du changement</legend>
            {errors.changeTypes ? <p className="mb-1 text-xs text-stop-600">{errors.changeTypes}</p> : null}
            <div className="grid grid-cols-2 gap-x-4 gap-y-1.5 sm:grid-cols-3">
              {Object.entries(CHANGE_TYPE_LABELS).map(([value, label]) => (
                <label key={value} className="flex items-center gap-2 text-sm text-ink-700">
                  <input type="checkbox" name="changeTypes" value={value} />
                  {label}
                </label>
              ))}
            </div>
          </fieldset>

          <fieldset>
            <legend className="mb-1.5 text-sm font-medium text-ink-900">Ce que le moteur lit</legend>
            <div className="flex flex-col gap-2">
              <label className="flex items-start gap-2.5 text-sm text-ink-700">
                <input
                  type="checkbox"
                  name="increasesAutonomy"
                  checked={increasesAutonomy}
                  onChange={(e) => setIncreasesAutonomy(e.target.checked)}
                  className="mt-0.5"
                />
                <span>
                  <span className="font-medium text-ink-900">L’autonomie augmente</span>
                  <span className="block text-xs text-ink-500">
                    Aujourd’hui {currentAutonomy}. Au-delà de L2, la supervision humaine est réévaluée.
                  </span>
                </span>
              </label>
              {increasesAutonomy ? (
                <Field label="Niveau visé" htmlFor="chg-autonomy" error={errors.newAutonomyLevel}>
                  <select id="chg-autonomy" name="newAutonomyLevel" defaultValue="" className={FIELD}>
                    <option value="">— Choisir</option>
                    {['L1', 'L2', 'L3', 'L4'].map((l) => (
                      <option key={l} value={l}>
                        {l}
                      </option>
                    ))}
                  </select>
                </Field>
              ) : null}
              {CHANGE_FACTS.map((fact) => (
                <label key={fact.name} className="flex items-start gap-2.5 text-sm text-ink-700">
                  <input type="checkbox" name={fact.name} className="mt-0.5" />
                  <span>
                    <span className="font-medium text-ink-900">{fact.label}</span>
                    <span className="block text-xs text-ink-500">{fact.hint}</span>
                  </span>
                </label>
              ))}
            </div>
          </fieldset>

          <Field label="Prévu le" htmlFor="chg-planned" optional>
            <input id="chg-planned" name="plannedAt" type="date" className={FIELD} />
          </Field>

          <FormFeedback state={state} />
          <Submit pending={pending} idle="Soumettre et qualifier" />
        </form>
      )}
    </Modal>
  )
}

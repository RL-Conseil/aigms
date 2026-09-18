'use client'

import { useActionState, useState } from 'react'
import {
  createControl,
  createRiskTreatment,
  mapControlToRequirement,
  setControlApplicability,
  setControlState,
  type FormState,
} from '@/lib/actions/controls'
import { Field, FIELD, FormFeedback, Submit } from '@/components/forms'
import { Modal } from '@/components/modal'
import { ControlFinder } from '@/components/governance/control-finder'
import { CONTROL_STATUS_LABELS } from '@/lib/domain/governance'

/**
 * Saisie du dispositif de maitrise.
 *
 * Le motif suit la regle posee pour la saisie : une page pour ce qui vit seul,
 * une fenetre pour ce qui n'a de sens que dans l'ecran ouvert. Un controle
 * appartient au referentiel de l'organisation et se lit hors contexte : il a sa
 * page. Une applicabilite, une correspondance, un traitement n'existent que par
 * l'objet qu'on regarde : ils se saisissent sur place.
 */

const CONTROL_STATUSES = [
  ['proposed', 'Proposé — décrit, pas encore en place'],
  ['implemented', 'Mis en place — en service, pas encore éprouvé'],
  ['operating', 'Opérant — fonctionne et se vérifie'],
  ['ineffective', 'Inefficace — en place mais ne produit pas son effet'],
  ['retired', 'Retiré — n’est plus exercé'],
] as const

export function ControlForm({
  organizationId,
  people,
}: {
  organizationId: string
  people: { id: string; label: string }[]
}) {
  const [state, formAction, pending] = useActionState<FormState | null, FormData>(
    createControl,
    null,
  )
  const errors = state && !state.ok ? (state.fieldErrors ?? {}) : {}

  return (
    <form action={formAction} className="flex flex-col gap-4">
      <input type="hidden" name="organizationId" value={organizationId} />

      <div className="grid gap-4 sm:grid-cols-[140px_1fr]">
        <Field label="Code" htmlFor="ctl-code" error={errors.code} hint="Unique, ex. CTL-10">
          <input
            id="ctl-code"
            name="code"
            type="text"
            required
            maxLength={24}
            className={`${FIELD} uppercase`}
            placeholder="CTL-10"
          />
        </Field>

        <Field label="Intitulé" htmlFor="ctl-name" error={errors.name}>
          <input
            id="ctl-name"
            name="name"
            type="text"
            required
            className={FIELD}
            placeholder="Revue humaine des réponses avant envoi"
          />
        </Field>
      </div>

      <Field
        label="Objectif"
        htmlFor="ctl-objective"
        error={errors.objective}
        hint="Ce que le contrôle GARANTIT, pas ce qu’il fait. C’est la phrase qu’un auditeur lit en premier."
      >
        <textarea
          id="ctl-objective"
          name="objective"
          rows={3}
          required
          className={FIELD}
          placeholder="Garantir qu’aucune réponse générée n’atteint un client sans relecture humaine."
        />
      </Field>

      <div className="grid gap-4 sm:grid-cols-2">
        <Field label="État" htmlFor="ctl-status">
          <select id="ctl-status" name="status" defaultValue="proposed" className={FIELD}>
            {CONTROL_STATUSES.map(([value, label]) => (
              <option key={value} value={value}>
                {label}
              </option>
            ))}
          </select>
        </Field>

        <Field
          label="Responsable"
          htmlFor="ctl-owner"
          hint="Un contrôle a toujours un responsable : à défaut, vous."
        >
          <select id="ctl-owner" name="ownerUserId" defaultValue="" className={FIELD}>
            <option value="">— Vous-même</option>
            {people.map((person) => (
              <option key={person.id} value={person.id}>
                {person.label}
              </option>
            ))}
          </select>
        </Field>
      </div>

      <div className="grid gap-4 sm:grid-cols-3">
        <Field label="Fréquence de test" htmlFor="ctl-frequency" optional>
          <input
            id="ctl-frequency"
            name="frequency"
            type="text"
            className={FIELD}
            placeholder="Trimestrielle"
          />
        </Field>
        <Field label="Dernier test" htmlFor="ctl-last" optional>
          <input id="ctl-last" name="lastTestedAt" type="date" className={FIELD} />
        </Field>
        <Field label="Prochain test" htmlFor="ctl-next" optional>
          <input id="ctl-next" name="nextTestAt" type="date" className={FIELD} />
        </Field>
      </div>

      <Field
        label="Procédure de test"
        htmlFor="ctl-procedure"
        optional
        hint="Comment on vérifie qu’il fonctionne. Sans elle, « opérant » est une affirmation."
      >
        <textarea id="ctl-procedure" name="testProcedure" rows={2} className={FIELD} />
      </Field>

      {/*
        Ce qu'un controle-type porte d'office — pieces qui demontrent,
        questions qu'un evaluateur pose — un controle libre le dit ici, pour
        que le registre se lise pareil quelle que soit l'origine du controle.
      */}
      <div className="grid gap-4 sm:grid-cols-2">
        <Field
          label="Preuves attendues"
          htmlFor="ctl-evidence"
          optional
          hint="Une par ligne : les pièces qui démontrent le contrôle."
        >
          <textarea id="ctl-evidence" name="expectedEvidence" rows={3} className={FIELD} placeholder={'Procédure signée\nJournal des revues'} />
        </Field>
        <Field
          label="Questions d’évaluation"
          htmlFor="ctl-questions"
          optional
          hint="Une par ligne : ce qu’un évaluateur demande pour juger le contrôle."
        >
          <textarea id="ctl-questions" name="assessmentQuestions" rows={3} className={FIELD} placeholder={'La procédure est-elle datée et approuvée ?'} />
        </Field>
      </div>

      <label className="flex items-start gap-2.5 text-sm">
        <input type="checkbox" name="isMandatory" className="mt-0.5 size-4 accent-[oklch(0.45_0.11_245)]" />
        <span>
          <span className="font-medium">Contrôle obligatoire</span>
          <span className="mt-0.5 block text-xs leading-relaxed text-ink-500">
            Le gate PRODUCTION exige qu’un contrôle obligatoire applicable soit affecté et opérant.
            Ce n’est donc pas une étiquette : cocher engage le passage en service.
          </span>
        </span>
      </label>

      <FormFeedback state={state} />
      <Submit pending={pending} idle="Créer le contrôle" />
    </form>
  )
}

// -----------------------------------------------------------------------------
// État d'exploitation
// -----------------------------------------------------------------------------
export function ControlStateForm({
  organizationId,
  controlId,
  code,
  status,
  lastTestedAt,
  nextTestAt,
}: {
  organizationId: string
  controlId: string
  code: string
  status: string
  lastTestedAt: string | null
  nextTestAt: string | null
}) {
  const [state, formAction, pending] = useActionState<FormState | null, FormData>(
    setControlState,
    null,
  )

  return (
    <Modal
      trigger="Changer l’état"
      title={`${code} — état du contrôle`}
      description="« Opérant » est ce qui le fait compter dans le taux de couverture."
    >
      {() => (
        <form action={formAction} className="flex flex-col gap-4">
          <input type="hidden" name="organizationId" value={organizationId} />
          <input type="hidden" name="controlId" value={controlId} />

          <Field label="État" htmlFor={`state-${controlId}`}>
            <select
              id={`state-${controlId}`}
              name="status"
              defaultValue={status}
              className={FIELD}
            >
              {CONTROL_STATUSES.map(([value, label]) => (
                <option key={value} value={value}>
                  {label}
                </option>
              ))}
            </select>
          </Field>

          <div className="grid gap-4 sm:grid-cols-2">
            <Field label="Dernier test" htmlFor={`last-${controlId}`} optional>
              <input
                id={`last-${controlId}`}
                name="lastTestedAt"
                type="date"
                defaultValue={lastTestedAt ?? ''}
                className={FIELD}
              />
            </Field>
            <Field label="Prochain test" htmlFor={`next-${controlId}`} optional>
              <input
                id={`next-${controlId}`}
                name="nextTestAt"
                type="date"
                defaultValue={nextTestAt ?? ''}
                className={FIELD}
              />
            </Field>
          </div>

          <p className="text-xs leading-relaxed text-ink-500">
            Un contrôle opérant ne compte comme couvrant que s’il est adossé à une preuve validée et
            non échue. Changer l’état ne suffit donc pas à couvrir une exigence.
          </p>

          <FormFeedback state={state} />
          <Submit pending={pending} idle="Enregistrer l’état" />
        </form>
      )}
    </Modal>
  )
}

// -----------------------------------------------------------------------------
// Correspondance à une exigence
// -----------------------------------------------------------------------------
export function RequirementMappingForm({
  organizationId,
  controlId,
  code,
  requirements,
}: {
  organizationId: string
  controlId: string
  code: string
  requirements: { id: string; reference: string; title: string }[]
}) {
  const [state, formAction, pending] = useActionState<FormState | null, FormData>(
    mapControlToRequirement,
    null,
  )

  return (
    <Modal
      trigger="Rattacher une exigence"
      title={`${code} — exigence satisfaite`}
      description="C’est ce rattachement qui alimente la Déclaration d’Applicabilité."
    >
      {() => (
        <form action={formAction} className="flex flex-col gap-4">
          <input type="hidden" name="organizationId" value={organizationId} />
          <input type="hidden" name="controlId" value={controlId} />

          <Field label="Exigence" htmlFor={`req-${controlId}`}>
            <select id={`req-${controlId}`} name="requirementId" defaultValue="" required className={FIELD}>
              <option value="" disabled>
                — Choisir une exigence
              </option>
              {requirements.map((requirement) => (
                <option key={requirement.id} value={requirement.id}>
                  {requirement.reference} — {requirement.title}
                </option>
              ))}
            </select>
          </Field>

          <Field
            label="En quoi il y répond"
            htmlFor={`note-${controlId}`}
            optional
            hint="Un même contrôle sert souvent plusieurs référentiels : la note dit lequel de ses effets répond ici."
          >
            <textarea id={`note-${controlId}`} name="coverageNote" rows={2} className={FIELD} />
          </Field>

          <FormFeedback state={state} />
          <Submit pending={pending} idle="Rattacher" />
        </form>
      )}
    </Modal>
  )
}

// -----------------------------------------------------------------------------
// Applicabilité à un cas d'usage
// -----------------------------------------------------------------------------
export function ApplicabilityForm({
  useCaseId,
  controls,
}: {
  useCaseId: string
  controls: { id: string; code: string; name: string; status: string }[]
}) {
  const [state, formAction, pending] = useActionState<FormState | null, FormData>(
    setControlApplicability,
    null,
  )
  const errors = state && !state.ok ? (state.fieldErrors ?? {}) : {}

  if (!controls.length) return null

  return (
    <Modal
      trigger="Statuer un contrôle"
      title="Applicabilité d’un contrôle"
      description="Applicable, non applicable, ou à déterminer — mais jamais vide."
    >
      {() => (
        <form action={formAction} className="flex flex-col gap-4">
          <input type="hidden" name="useCaseId" value={useCaseId} />

          <Field label="Contrôle" htmlFor="app-control" error={errors.controlId}>
            <select id="app-control" name="controlId" defaultValue="" required className={FIELD}>
              <option value="" disabled>
                — Choisir un contrôle
              </option>
              {controls.map((control) => (
                <option key={control.id} value={control.id}>
                  {control.code} — {control.name} (
                  {CONTROL_STATUS_LABELS[control.status] ?? control.status})
                </option>
              ))}
            </select>
          </Field>

          <Field label="Applicabilité" htmlFor="app-status">
            <select id="app-status" name="status" defaultValue="applicable" className={FIELD}>
              <option value="applicable">Applicable</option>
              <option value="not_applicable">Non applicable</option>
              <option value="to_determine">À déterminer</option>
            </select>
          </Field>

          <Field
            label="Justification"
            htmlFor="app-justification"
            error={errors.justification}
            hint="Obligatoire pour une exclusion : un « non applicable » silencieux est ce qu’un auditeur relève en premier."
          >
            <textarea id="app-justification" name="justification" rows={3} className={FIELD} />
          </Field>

          <FormFeedback state={state} />
          <Submit pending={pending} idle="Statuer" />
        </form>
      )}
    </Modal>
  )
}

// -----------------------------------------------------------------------------
// Traitement d'un risque
// -----------------------------------------------------------------------------
// Accepter n'est pas un traitement : c'est un acte a part, nominatif, reserve
// au responsable du risque (0058). Les trois strategies restantes ont chacune
// une consequence que la base applique (0059) — et qu'on annonce ici.
const STRATEGIES = [
  {
    value: 'reduce',
    label: 'Réduire — agir sur la vraisemblance ou la gravité',
    consequence:
      'Un contrôle est désigné, obligatoirement : il devient applicable à ce cas d’usage et rejoint la Déclaration d’Applicabilité. Le traitement compte quand il est effectif ; le risque se recote ensuite.',
  },
  {
    value: 'avoid',
    label: 'Éviter — renoncer à l’usage qui porte le risque',
    consequence:
      'Aucun contrôle attendu. Une action s’ouvre pour le responsable : traduire l’évitement en demande de changement de périmètre, ou en suspension du cas d’usage.',
  },
  {
    value: 'transfer',
    label: 'Transférer — contrat, assurance, tiers',
    consequence:
      'Un tiers porte le risque : le traitement ne comptera comme effectif qu’une fois un fournisseur rattaché au cas d’usage revu (revue approuvée, même sous conditions).',
  },
] as const

export function RiskTreatmentForm({
  riskId,
  useCaseId,
  riskTitle,
  riskScenario,
  organizationId,
  people,
  controls,
}: {
  riskId: string
  useCaseId: string
  riskTitle: string
  /** Le scenario, pour chercher le controle qui traite. */
  riskScenario?: string
  organizationId: string
  people: { id: string; label: string }[]
  controls: { id: string; code: string; name: string }[]
}) {
  const [state, formAction, pending] = useActionState<FormState | null, FormData>(
    createRiskTreatment,
    null,
  )
  const errors = state && !state.ok ? (state.fieldErrors ?? {}) : {}
  const [strategy, setStrategy] = useState<(typeof STRATEGIES)[number]['value']>('reduce')
  const [options, setOptions] = useState(controls)
  const [controlId, setControlId] = useState('')
  const chosen = STRATEGIES.find((s) => s.value === strategy)!

  return (
    <Modal
      trigger="Traiter"
      title="Traitement du risque"
      description={riskTitle}
    >
      {() => (
        <form action={formAction} className="flex flex-col gap-4">
          <input type="hidden" name="riskId" value={riskId} />
          <input type="hidden" name="useCaseId" value={useCaseId} />

          <Field label="Stratégie" htmlFor={`strategy-${riskId}`} hint={chosen.consequence}>
            <select
              id={`strategy-${riskId}`}
              name="strategy"
              value={strategy}
              onChange={(event) => setStrategy(event.target.value as typeof strategy)}
              className={FIELD}
            >
              {STRATEGIES.map((option) => (
                <option key={option.value} value={option.value}>
                  {option.label}
                </option>
              ))}
            </select>
          </Field>

          <Field
            label="Ce qui sera fait"
            htmlFor={`desc-${riskId}`}
            error={errors.description}
          >
            <textarea id={`desc-${riskId}`} name="description" rows={3} required className={FIELD} />
          </Field>

          <div className="grid gap-4 sm:grid-cols-2">
            <Field
              label="Responsable"
              htmlFor={`owner-${riskId}`}
              error={errors.ownerUserId}
              hint="Il en est averti, et rappelé à l’échéance."
            >
              <select id={`owner-${riskId}`} name="ownerUserId" defaultValue="" required className={FIELD}>
                <option value="" disabled>
                  Choisir…
                </option>
                {people.map((person) => (
                  <option key={person.id} value={person.id}>
                    {person.label}
                  </option>
                ))}
              </select>
            </Field>
            <Field label="Échéance" htmlFor={`due-${riskId}`} optional>
              <input id={`due-${riskId}`} name="dueDate" type="date" className={FIELD} />
            </Field>
          </div>

          {/*
            Le lien decide en ADR-0010 : c'est lui, et lui seul, qui relie un
            risque a la mesure censee le reduire. La proximite par cas d'usage
            partage ne demontre rien.
          */}
          {strategy !== 'avoid' ? (
            <>
              <Field
                label="Contrôle qui le met en œuvre"
                htmlFor={`control-${riskId}`}
                optional={strategy !== 'reduce'}
                error={errors.controlId}
                hint={
                  strategy === 'reduce'
                    ? 'Obligatoire pour réduire : c’est lui qui agit. Il devient applicable à ce cas d’usage.'
                    : 'Sans contrôle désigné, le chemin du risque s’arrête à l’intention : « un traitement est prévu mais rien ne l’exécute ».'
                }
              >
                <select
                  id={`control-${riskId}`}
                  name="controlId"
                  value={controlId}
                  onChange={(event) => setControlId(event.target.value)}
                  required={strategy === 'reduce'}
                  className={FIELD}
                >
                  <option value="">{strategy === 'reduce' ? 'Choisir…' : '— Aucun pour l’instant'}</option>
                  {options.map((control) => (
                    <option key={control.id} value={control.id}>
                      {control.code} — {control.name}
                    </option>
                  ))}
                </select>
              </Field>
              <ControlFinder
                organizationId={organizationId}
                useCaseId={useCaseId}
                readQuery={() => {
                  const form = document.getElementById(`desc-${riskId}`) as HTMLTextAreaElement | null
                  return [riskTitle, riskScenario ?? '', form?.value ?? ''].filter(Boolean).join(' ')
                }}
                ownerUserId={() => (document.getElementById(`owner-${riskId}`) as HTMLSelectElement | null)?.value ?? ''}
                onPick={(option) => {
                  setOptions((current) => (current.some((c) => c.id === option.id) ? current : [...current, option]))
                  setControlId(option.id)
                }}
              />
            </>
          ) : null}

          <FormFeedback state={state} />
          <Submit pending={pending} idle="Enregistrer le traitement" />
        </form>
      )}
    </Modal>
  )
}



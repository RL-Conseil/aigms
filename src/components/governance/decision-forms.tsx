'use client'

import { useActionState, useState } from 'react'
import {
  linkDecisionEvidence,
  ruleOnDecision,
  submitDecision,
  type FormState,
} from '@/lib/actions/decisions'
import { Field, FIELD, FormFeedback, Submit } from '@/components/forms'
import { Modal } from '@/components/modal'
import { CHANGE_FACTS, CHANGE_TYPE_LABELS } from '@/components/governance/operations-forms'

/**
 * Saisie du registre de decisions.
 *
 * Deux actes, deux personnes. Soumettre enonce ce qui est decide et pourquoi ;
 * se prononcer engage nominativement. Sur une mise en production, une
 * acceptation de risque ou une exception, la base refuse que ce soit la meme
 * personne — l'ecran ne l'anticipe pas, il presente le refus.
 */

const DECISION_TYPES = [
  ['use_case_authorization', 'Autorisation d’usage'],
  ['pilot_approval', 'Approbation de pilote'],
  ['go_production', 'Mise en production'],
  ['risk_acceptance', 'Acceptation de risque'],
  ['policy_exception', 'Exception de politique'],
  ['significant_change', 'Changement significatif'],
  ['suspension', 'Suspension'],
  ['retirement', 'Retrait'],
] as const

/** Types dont la base exige une date de revue une fois approuves. */
const NEEDS_REVIEW = ['go_production', 'risk_acceptance', 'policy_exception']

/** Types sur lesquels l'auteur ne peut pas se prononcer lui-meme. */
const SEPARATED = ['go_production', 'risk_acceptance', 'policy_exception']

/** Types qui portent un changement sur le systeme. */
const CHANGE_DECISIONS = ['significant_change', 'suspension', 'retirement']

/** Le jalon que porte chaque type de decision, et ce qu'il signifie. */
const MILESTONE_HINTS: Record<string, string> = {
  use_case_authorization: 'Approuvée, elle fait passer le cas d’usage « Approuvé » (ou « sous conditions », ou « Refusé »).',
  pilot_approval: 'Approuvée, elle ouvre le pilote.',
  go_production: 'Approuvée, elle met en production — à sa date d’effet. Le gate doit être prêt, et une preuve validée rattachée.',
  suspension: 'Approuvée, elle suspend le cas d’usage jusqu’à reprise ou retrait.',
  retirement: 'Approuvée, elle retire le cas d’usage — définitivement.',
}

export function DecisionForm({
  organizationId,
  useCases,
  people,
  defaultUseCaseId,
  fixedUseCaseId,
  allowedTypes,
  evidence = [],
  evidenceGap = [],
}: {
  organizationId: string
  useCases: { id: string; name: string; business_ref: string }[]
  /** Personnes declarees sur l'organisation qui peuvent se prononcer. */
  people: { userId: string; label: string }[]
  defaultUseCaseId?: string
  /** Depuis la fiche : le cas d'usage est celui-la, sans choix. */
  fixedUseCaseId?: string
  /** Depuis la fiche : les types qui ont un sens au jalon courant. */
  allowedTypes?: string[]
  /** Les preuves validees de l'organisation, a rattacher a la decision. */
  evidence?: { id: string; business_ref: string; title: string }[]
  /**
   * Les controles applicables que rien ne prouve, au moment ou l'on ouvre le
   * formulaire. Non vide : la mise en production reste possible, mais elle
   * s'explique (0098).
   */
  evidenceGap?: { control_id: string; code: string; name: string; is_mandatory: boolean }[]
}) {
  const [state, formAction, pending] = useActionState<FormState | null, FormData>(
    submitDecision,
    null,
  )
  const types = allowedTypes?.length
    ? DECISION_TYPES.filter(([value]) => allowedTypes.includes(value))
    : DECISION_TYPES
  const [type, setType] = useState<string>(types[0]?.[0] ?? 'use_case_authorization')
  const errors = state && !state.ok ? (state.fieldErrors ?? {}) : {}

  return (
    <form action={formAction} className="flex flex-col gap-4">
      <input type="hidden" name="organizationId" value={organizationId} />

      <div className="grid gap-4 sm:grid-cols-2">
        <Field label="Type de décision" htmlFor="dec-type" hint={MILESTONE_HINTS[type]}>
          <select
            id="dec-type"
            name="decisionType"
            value={type}
            onChange={(event) => setType(event.target.value)}
            className={FIELD}
          >
            {types.map(([value, label]) => (
              <option key={value} value={value}>
                {label}
              </option>
            ))}
          </select>
        </Field>

        {fixedUseCaseId ? (
          <input type="hidden" name="useCaseId" value={fixedUseCaseId} />
        ) : (
          <Field
            label="Cas d’usage concerné"
            htmlFor="dec-use-case"
            optional
            hint="Une exception de politique peut porter sur l’organisation entière."
          >
            <select
              id="dec-use-case"
              name="useCaseId"
              defaultValue={defaultUseCaseId ?? ''}
              className={FIELD}
            >
              <option value="">— Décision transverse</option>
              {useCases.map((useCase) => (
                <option key={useCase.id} value={useCase.id}>
                  {useCase.business_ref} — {useCase.name}
                </option>
              ))}
            </select>
          </Field>
        )}
      </div>

      <Field label="Objet" htmlFor="dec-subject" error={errors.subject}>
        <input id="dec-subject" name="subject" type="text" required className={FIELD} />
      </Field>

      <Field
        label="Ce qui est décidé"
        htmlFor="dec-statement"
        error={errors.decisionStatement}
        hint="L’énoncé de la décision, pas la demande qui y conduit. C’est cette phrase qui sera lue dans deux ans."
      >
        <textarea id="dec-statement" name="decisionStatement" rows={3} required className={FIELD} />
      </Field>

      <Field
        label="Justification"
        htmlFor="dec-rationale"
        error={errors.rationale}
        hint="Pourquoi cette décision, au vu de quoi. C’est ce qu’un auditeur lit en premier."
      >
        <textarea id="dec-rationale" name="rationale" rows={3} required className={FIELD} />
      </Field>

      <Field
        label="Contexte"
        htmlFor="dec-context"
        error={errors.context}
        hint="Ce qui amène à décider : la situation, ce qui a changé, ce qui presse. Exigé."
      >
        <textarea id="dec-context" name="context" rows={2} required className={FIELD} />
      </Field>

      <Field
        label="Options écartées"
        htmlFor="dec-options"
        optional
        hint="Ce qui a été envisagé et non retenu. Une décision sans alternative examinée se défend mal."
      >
        <textarea id="dec-options" name="optionsConsidered" rows={2} className={FIELD} />
      </Field>

      <Field label="Conditions" htmlFor="dec-conditions" optional>
        <textarea id="dec-conditions" name="conditions" rows={2} className={FIELD} />
      </Field>

      <div className="grid gap-4 sm:grid-cols-2">
        <Field label="Date d’effet" htmlFor="dec-effective" optional>
          <input id="dec-effective" name="effectiveFrom" type="date" className={FIELD} />
        </Field>
        <Field
          label="Date de revue"
          htmlFor="dec-review"
          optional={!NEEDS_REVIEW.includes(type)}
          hint={
            NEEDS_REVIEW.includes(type)
              ? 'Exigée par la base une fois la décision approuvée : rien ne doit dormir.'
              : undefined
          }
        >
          <input id="dec-review" name="reviewDueAt" type="date" className={FIELD} />
        </Field>
      </div>

      <fieldset>
        <legend className="mb-1 text-sm font-medium">
          Preuves sur lesquelles la décision se fonde
          {type === 'go_production' ? '' : <span className="ml-1 font-normal text-ink-500">(facultatif)</span>}
        </legend>
        <p className="mb-2 text-xs text-ink-500">
          {type === 'go_production'
            ? 'Une mise en production s’appuie sur au moins une preuve validée.'
            : 'Les pièces validées du registre ; c’est ce qu’un auditeur lira avec la décision.'}
        </p>
        {evidence.length ? (
          <div className="grid max-h-40 gap-1.5 overflow-y-auto rounded-md border border-ink-200 p-2.5 sm:grid-cols-2">
            {evidence.map((e) => (
              <label key={e.id} className="flex items-start gap-2 text-sm text-ink-700">
                <input type="checkbox" name="evidenceIds" value={e.id} className="mt-0.5" />
                <span>
                  <span className="font-mono text-xs text-ink-400">{e.business_ref}</span> {e.title}
                </span>
              </label>
            ))}
          </div>
        ) : (
          <p className="text-xs text-ink-400">Aucune preuve validée au registre pour l’instant.</p>
        )}
        {errors.evidenceIds ? (
          <p role="alert" className="mt-1.5 text-[13px] text-stop-600">{errors.evidenceIds}</p>
        ) : null}
      </fieldset>

      {/*
        L'ecart de preuve, sur une mise en production. Il n'apparait que sur ce
        type-la, et seulement s'il existe : une mise en garde permanente ne se
        lit plus au bout de trois fois.
      */}
      {type === 'go_production' && evidenceGap.length ? (
        <div className="rounded-md border border-warn-600/30 bg-warn-600/5 p-4">
          <p className="text-sm font-medium text-ink-900">
            {evidenceGap.length} contrôle(s) applicable(s) sans preuve validée
          </p>
          <ul className="mt-1.5 flex flex-wrap gap-1.5">
            {evidenceGap.map((g) => (
              <li
                key={g.control_id}
                title={g.name}
                className={`rounded-full px-2 py-0.5 text-[11px] ${
                  g.is_mandatory ? 'bg-warn-600/15 text-warn-600' : 'bg-white text-ink-600'
                }`}
              >
                {g.code}
                {g.is_mandatory ? ' · obligatoire' : ''}
              </li>
            ))}
          </ul>
          <p className="mt-2.5 text-xs leading-relaxed text-ink-600">
            La mise en production reste possible : cet écart n’est pas bloquant. Mais la personne
            appelée à se prononcer en sera avertie, par alerte et par courriel, et devra déclarer en
            avoir pris connaissance. Dites-lui ce qu’il en est.
          </p>

          <div className="mt-3">
            <Field
              label="Ce que vous en dites"
              htmlFor="dec-gap-statement"
              error={errors.evidenceGapStatement}
              hint="Remédiation en cours, pièce non encore présentée par l’organisation, échéance visée. Ce texte part tel quel dans l’avertissement et figure sur la décision remise."
            >
              <textarea id="dec-gap-statement" name="evidenceGapStatement" rows={3} required className={FIELD} />
            </Field>
          </div>
        </div>
      ) : null}

      <Field
        label="Personne appelée à se prononcer"
        htmlFor="dec-approver"
        optional
        error={errors.expectedApproverUserId}
        hint={
          people.length
            ? 'Elle est désignée, pas habilitée : l’approbation restera enregistrée au nom de celui qui la prononce.'
            : 'Aucune personne habilitée n’est déclarée sur cette organisation : la décision restera adressée à personne.'
        }
      >
        <select
          id="dec-approver"
          name="expectedApproverUserId"
          defaultValue=""
          disabled={people.length === 0}
          className={FIELD}
        >
          <option value="">— Personne désignée plus tard</option>
          {people.map((person) => (
            <option key={person.userId} value={person.userId}>
              {person.label}
            </option>
          ))}
        </select>
      </Field>

      {/*
        Une decision de changement significatif, de suspension ou de retrait
        porte un CHANGEMENT : ce qui change se dit ici, une fois, et le
        changement est cree et qualifie a la soumission (0063).
      */}
      {CHANGE_DECISIONS.includes(type) ? (
        <fieldset className="rounded-md border border-ink-200 p-4">
          <legend className="px-1 text-sm font-medium">Ce qui change</legend>
          <p className="mb-3 text-xs leading-relaxed text-ink-500">
            {type === 'significant_change'
              ? 'Le changement est créé et lié à cette décision, puis qualifié par le moteur de réévaluation : la décision ne s’approuve pas sans lui.'
              : 'Une suspension ou un retrait est un changement de déploiement : il est créé et lié à cette décision, qualifié par le moteur.'}
          </p>
          <div className="grid gap-2 sm:grid-cols-3">
            {Object.entries(CHANGE_TYPE_LABELS).map(([value, label]) => (
              <label key={value} className="flex items-center gap-2 text-sm text-ink-700">
                <input
                  type="checkbox"
                  name="changeTypes"
                  value={value}
                  defaultChecked={type !== 'significant_change' && value === 'DEPLOYMENT'}
                />
                {label}
              </label>
            ))}
          </div>
          {type === 'significant_change' ? (
            <div className="mt-3 grid gap-2 border-t border-ink-100 pt-3 sm:grid-cols-2">
              <label className="flex items-start gap-2.5 text-sm text-ink-700">
                <input type="checkbox" name="increasesAutonomy" className="mt-0.5" />
                <span>
                  <span className="font-medium text-ink-900">L’autonomie augmente</span>
                  <span className="block text-xs text-ink-500">Niveau visé à préciser.</span>
                </span>
              </label>
              <Field label="Niveau visé" htmlFor="dec-autonomy" optional>
                <select id="dec-autonomy" name="newAutonomyLevel" defaultValue="" className={FIELD}>
                  <option value="">—</option>
                  {['L0', 'L1', 'L2', 'L3', 'L4'].map((l) => (
                    <option key={l} value={l}>{l}</option>
                  ))}
                </select>
              </Field>
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
          ) : null}
        </fieldset>
      ) : null}

      {SEPARATED.includes(type) ? (
        <p className="rounded-md border border-ink-200 bg-ink-50 px-3.5 py-3 text-xs leading-relaxed text-ink-600">
          Sur ce type de décision, <strong className="font-medium text-ink-800">vous ne pourrez
          pas l’approuver vous-même</strong> : une autre personne devra se prononcer. La base le
          refuse, et c’est ce qui donne sa valeur au registre.
          {type === 'go_production' || type === 'policy_exception' ? (
            <>
              {' '}
              {type === 'policy_exception'
                ? 'Une exception à une politique'
                : 'La mise en production d’un cas d’usage de criticité élevée ou critique'}{' '}
              <strong className="font-medium text-ink-800">s’approuve par le Comité de direction</strong>{' '}
              : la personne désignée doit tenir ce rôle.
            </>
          ) : null}
        </p>
      ) : null}

      <FormFeedback state={state} />
      <Submit pending={pending} idle="Soumettre la décision" />
    </form>
  )
}

// -----------------------------------------------------------------------------
// Se prononcer
// -----------------------------------------------------------------------------
export function DecisionRulingForm({
  organizationId,
  decisionId,
  useCaseId,
  subject,
  decisionType,
  rationale,
  conditions,
  awaiting,
  evidenceGap = [],
  evidenceGapStatement = null,
}: {
  organizationId: string
  decisionId: string
  useCaseId: string | null
  subject: string
  decisionType: string
  rationale: string | null
  conditions: string | null
  /** L'écart figé à la soumission, tel qu'il a été notifié (0098). */
  evidenceGap?: { control_id: string; code: string; name: string; is_mandatory: boolean }[]
  /** Ce que l'AI Governance Officer en a dit. */
  evidenceGapStatement?: string | null
  /**
   * Vrai tant que la decision attend un verdict. Le composant reste monte
   * apres l'acte : la revalidation retire le declencheur, et la confirmation
   * doit lui survivre.
   */
  awaiting: boolean
}) {
  const [state, formAction, pending] = useActionState<FormState | null, FormData>(
    ruleOnDecision,
    null,
  )
  const [verdict, setVerdict] = useState('approved')
  const errors = state && !state.ok ? (state.fieldErrors ?? {}) : {}

  if (!awaiting && !state) return null

  return (
    <Modal
      trigger="Se prononcer"
      title="Se prononcer sur la décision"
      description={subject}
      hideTrigger={!awaiting}
    >
      {() => (
        <form action={formAction} className="flex flex-col gap-4">
          <input type="hidden" name="organizationId" value={organizationId} />
          <input type="hidden" name="decisionId" value={decisionId} />
          <input type="hidden" name="useCaseId" value={useCaseId ?? ''} />

          {/*
            L'ecart d'abord, le verdict ensuite : on ne se prononce pas sur ce
            qu'on n'a pas lu. La case est exigee par la base, pas seulement
            ici — une case cochee a l'ecran ne prouve rien.
          */}
          {evidenceGap.length ? (
            <div className="rounded-md border border-warn-600/30 bg-warn-600/5 p-4">
              <p className="text-sm font-medium text-ink-900">
                Écart de preuve constaté à la soumission
              </p>
              <p className="mt-1 text-xs text-ink-600">
                {evidenceGap.length} contrôle(s) applicable(s) n’étaient démontrés par aucune preuve
                validée :
              </p>
              <ul className="mt-1.5 flex flex-wrap gap-1.5">
                {evidenceGap.map((g) => (
                  <li
                    key={g.control_id}
                    title={g.name}
                    className={`rounded-full px-2 py-0.5 text-[11px] ${
                      g.is_mandatory ? 'bg-warn-600/15 text-warn-600' : 'bg-white text-ink-600'
                    }`}
                  >
                    {g.code}
                    {g.is_mandatory ? ' · obligatoire' : ''}
                  </li>
                ))}
              </ul>
              {evidenceGapStatement ? (
                <p className="mt-2.5 rounded-md bg-white px-3 py-2 text-xs leading-relaxed text-ink-700">
                  <span className="font-medium text-ink-900">Ce qu’en dit l’AI Governance Officer : </span>
                  {evidenceGapStatement}
                </p>
              ) : null}
              <label className="mt-3 flex items-start gap-2.5 text-sm text-ink-800">
                <input
                  type="checkbox"
                  name="gapAcknowledged"
                  className="mt-0.5 size-4 rounded border-ink-300"
                />
                <span>
                  J’ai pris connaissance de cet écart de preuve et l’assume en approuvant.
                  {errors.gapAcknowledged ? (
                    <span className="block text-[13px] text-stop-600">{errors.gapAcknowledged}</span>
                  ) : null}
                </span>
              </label>
            </div>
          ) : null}

          <Field label="Verdict" htmlFor={`verdict-${decisionId}`}>
            <select
              id={`verdict-${decisionId}`}
              name="verdict"
              value={verdict}
              onChange={(event) => setVerdict(event.target.value)}
              className={FIELD}
            >
              <option value="approved">Approuver</option>
              <option value="approved_with_conditions">Approuver sous conditions</option>
              <option value="rejected">Rejeter</option>
            </select>
          </Field>

          {verdict === 'approved_with_conditions' ? (
            <Field
              label="Conditions"
              htmlFor={`cond-${decisionId}`}
              error={errors.conditions}
              hint="Ce qui doit être tenu pour que l’approbation vaille. La base l’exige."
            >
              <textarea
                id={`cond-${decisionId}`}
                name="conditions"
                rows={3}
                required
                defaultValue={conditions ?? ''}
                className={FIELD}
              />
            </Field>
          ) : (
            <input type="hidden" name="conditions" value={conditions ?? ''} />
          )}

          <Field label="Motif du verdict" htmlFor={`rat-${decisionId}`} error={errors.rationale}>
            <textarea
              id={`rat-${decisionId}`}
              name="rationale"
              rows={3}
              required
              defaultValue={rationale ?? ''}
              className={FIELD}
            />
          </Field>

          {verdict !== 'rejected' ? (
            <div className="grid gap-4 sm:grid-cols-2">
              <Field label="Date d’effet" htmlFor={`eff-${decisionId}`}>
                <input
                  id={`eff-${decisionId}`}
                  name="effectiveFrom"
                  type="date"
                  required
                  className={FIELD}
                />
              </Field>
              <Field
                label="Date de revue"
                htmlFor={`rev-${decisionId}`}
                optional={!NEEDS_REVIEW.includes(decisionType)}
              >
                <input id={`rev-${decisionId}`} name="reviewDueAt" type="date" className={FIELD} />
              </Field>
            </div>
          ) : null}

          <p className="text-xs leading-relaxed text-ink-500">
            L’approbation est enregistrée en votre nom et datée. Si vous êtes l’auteur de cette
            décision et qu’elle engage une mise en service, la base refusera : c’est la séparation
            des rôles.
          </p>

          <FormFeedback state={state} />
          <Submit pending={pending} idle="Enregistrer le verdict" />
        </form>
      )}
    </Modal>
  )
}

// -----------------------------------------------------------------------------
// Éléments probants
// -----------------------------------------------------------------------------
const TARGETS = [
  ['risk', 'Risque'],
  ['control', 'Contrôle'],
  ['evidence', 'Preuve'],
  ['impact_assessment', 'Évaluation d’impact'],
  ['use_case', 'Cas d’usage'],
  ['incident', 'Incident'],
  ['change_request', 'Demande de changement'],
] as const

export function DecisionLinkForm({
  organizationId,
  decisionId,
  targets,
}: {
  organizationId: string
  decisionId: string
  targets: Record<string, { id: string; label: string }[]>
}) {
  const [state, formAction, pending] = useActionState<FormState | null, FormData>(
    linkDecisionEvidence,
    null,
  )
  const [type, setType] = useState<string>('risk')
  const options = targets[type] ?? []

  return (
    <Modal
      trigger="Rattacher un élément"
      title="Ce sur quoi la décision se fonde"
      description="Sans ces liens, le registre dit qui a décidé, pas sur quoi."
    >
      {() => (
        <form action={formAction} className="flex flex-col gap-4">
          <input type="hidden" name="organizationId" value={organizationId} />
          <input type="hidden" name="decisionId" value={decisionId} />

          <Field label="Nature de l’élément" htmlFor={`tt-${decisionId}`}>
            <select
              id={`tt-${decisionId}`}
              name="targetType"
              value={type}
              onChange={(event) => setType(event.target.value)}
              className={FIELD}
            >
              {TARGETS.map(([value, label]) => (
                <option key={value} value={value}>
                  {label}
                </option>
              ))}
            </select>
          </Field>

          <Field label="Élément" htmlFor={`ti-${decisionId}`}>
            {options.length ? (
              <select id={`ti-${decisionId}`} name="targetId" defaultValue="" required className={FIELD}>
                <option value="" disabled>
                  — Choisir
                </option>
                {options.map((option) => (
                  <option key={option.id} value={option.id}>
                    {option.label}
                  </option>
                ))}
              </select>
            ) : (
              <p className="rounded-md border border-ink-200 bg-ink-50 px-3.5 py-3 text-sm text-ink-600">
                Aucun élément de cette nature sur cette organisation.
              </p>
            )}
          </Field>

          <Field label="Note" htmlFor={`tn-${decisionId}`} optional>
            <input id={`tn-${decisionId}`} name="note" type="text" className={FIELD} />
          </Field>

          <FormFeedback state={state} />
          {options.length ? <Submit pending={pending} idle="Rattacher" /> : null}
        </form>
      )}
    </Modal>
  )
}

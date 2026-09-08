'use client'

import { useActionState } from 'react'
import {
  acceptRisk,
  createRisk,
  saveClassification,
  saveTriage,
  type FormState,
} from '@/lib/actions/governance'
import { Disclosure, Field, FIELD, FormFeedback, Submit } from '@/components/forms'

/**
 * Etapes de gouvernance saisies depuis la fiche du cas d'usage.
 *
 * Chaque etape est un volet : on ne travaille jamais sur tout le dossier en
 * meme temps, et celle qui reste a faire s'ouvre d'elle-meme. C'est le meme
 * principe que la carte de l'increment suivant — on saisit la ou l'on regarde,
 * sans changer de page.
 */

const CRITICALITY = [
  { value: 'low', label: 'Faible', hint: 'Effet limité, réversible' },
  { value: 'moderate', label: 'Modérée', hint: 'Effet notable, maîtrisable' },
  { value: 'high', label: 'Élevée', hint: 'Effet important sur des personnes ou l’activité' },
  { value: 'critical', label: 'Critique', hint: 'Effet grave, difficilement réversible' },
] as const

export function TriagePanel({
  useCaseId,
  criticality,
  nextReviewAt,
}: {
  useCaseId: string
  criticality: string | null
  nextReviewAt: string | null
}) {
  const [state, formAction, pending] = useActionState<FormState | null, FormData>(saveTriage, null)
  const errors = state && !state.ok ? (state.fieldErrors ?? {}) : {}
  const done = Boolean(criticality)

  return (
    <Disclosure
      title="Trier le cas d’usage"
      summary={
        done
          ? `Criticité retenue : ${CRITICALITY.find((c) => c.value === criticality)?.label ?? criticality}`
          : 'À faire — le passage en évaluation l’exige'
      }
      tone={done ? 'done' : 'todo'}
      defaultOpen={!done}
      stayOpen={Boolean(state)}
    >
      <form action={formAction} className="flex flex-col gap-4">
        <input type="hidden" name="useCaseId" value={useCaseId} />

        <Field
          label="Criticité"
          htmlFor="triage-criticality"
          hint="Elle proportionne le niveau de gouvernance : elle ne préjuge pas de la qualification réglementaire."
        >
          <select
            id="triage-criticality"
            name="criticality"
            defaultValue={criticality ?? 'moderate'}
            className={FIELD}
          >
            {CRITICALITY.map((c) => (
              <option key={c.value} value={c.value}>
                {c.label} — {c.hint}
              </option>
            ))}
          </select>
        </Field>

        <Field
          label="Justification"
          htmlFor="triage-rationale"
          error={errors.rationale}
          hint="Pourquoi ce niveau plutôt qu’un autre. C’est ce qui sera relu à la revue."
        >
          <textarea id="triage-rationale" name="rationale" rows={3} required className={FIELD} />
        </Field>

        <div className="grid gap-4 sm:grid-cols-2">
          <Field label="Portée de la décision" htmlFor="triage-impact" optional>
            <input id="triage-impact" name="decisionImpact" type="text" className={FIELD} />
          </Field>
          <Field label="Prochaine revue" htmlFor="triage-review" optional>
            <input
              id="triage-review"
              name="nextReviewAt"
              type="date"
              defaultValue={nextReviewAt ?? ''}
              className={FIELD}
            />
          </Field>
        </div>

        <FormFeedback state={state} />
        <Submit pending={pending} idle={done ? 'Mettre à jour le triage' : 'Enregistrer le triage'} />
      </form>
    </Disclosure>
  )
}

const FLAGS = [
  { value: 'out_of_scope', label: 'Hors périmètre' },
  { value: 'to_confirm', label: 'À confirmer' },
  { value: 'prohibited_practice_suspected', label: 'Pratique interdite suspectée' },
  { value: 'high_risk_potential', label: 'Haut risque potentiel' },
  { value: 'transparency_obligations', label: 'Obligations de transparence' },
  { value: 'gpai_dependency', label: 'Dépendance à un modèle à usage général' },
  { value: 'privacy_impact', label: 'Impact sur la vie privée' },
  { value: 'security_impact', label: 'Impact sur la sécurité' },
] as const

const ROLES = [
  { value: 'deployer', label: 'Déployeur' },
  { value: 'provider', label: 'Fournisseur' },
  { value: 'importer', label: 'Importateur' },
  { value: 'distributor', label: 'Distributeur' },
  { value: 'other', label: 'Autre' },
  { value: 'undetermined', label: 'À déterminer' },
] as const

export function ClassificationPanel({
  useCaseId,
  current,
}: {
  useCaseId: string
  current: {
    organization_role: string
    flags: string[]
    rationale: string
    legal_review_level: string
    legal_review_completed: boolean
    framework_version: string
    next_review_at: string | null
  } | null
}) {
  const [state, formAction, pending] = useActionState<FormState | null, FormData>(
    saveClassification,
    null,
  )
  const errors = state && !state.ok ? (state.fieldErrors ?? {}) : {}

  return (
    <Disclosure
      title="Qualifier au regard du règlement"
      summary={
        current
          ? `${ROLES.find((r) => r.value === current.organization_role)?.label ?? current.organization_role} · ${current.flags.length} qualification(s)`
          : 'À faire — le passage en revue l’exige'
      }
      tone={current ? 'done' : 'todo'}
      defaultOpen={!current}
      stayOpen={Boolean(state)}
    >
      <div className="mb-4 rounded-md bg-ink-100 px-4 py-3">
        <p className="text-[13px] leading-relaxed text-ink-600">
          Cette qualification est un <strong className="font-semibold">cadrage</strong>, pas un avis
          juridique. Elle oriente les obligations à examiner et le niveau de revue nécessaire ; elle
          ne conclut pas à la conformité.
        </p>
      </div>

      <form action={formAction} className="flex flex-col gap-4">
        <input type="hidden" name="useCaseId" value={useCaseId} />

        <div className="grid gap-4 sm:grid-cols-2">
          <Field label="Rôle de l’organisation" htmlFor="cls-role">
            <select
              id="cls-role"
              name="organizationRole"
              defaultValue={current?.organization_role ?? 'deployer'}
              className={FIELD}
            >
              {ROLES.map((role) => (
                <option key={role.value} value={role.value}>
                  {role.label}
                </option>
              ))}
            </select>
          </Field>

          <Field
            label="Version du référentiel"
            htmlFor="cls-version"
            hint="Les échéances évoluent : la version appliquée est conservée avec la classification."
          >
            <input
              id="cls-version"
              name="frameworkVersion"
              type="text"
              defaultValue={current?.framework_version ?? '2024/1689'}
              className={FIELD}
            />
          </Field>
        </div>

        <fieldset>
          <legend className="mb-2 text-sm font-medium">Qualifications retenues</legend>
          <div className="grid gap-2 sm:grid-cols-2">
            {FLAGS.map((flag) => (
              <label key={flag.value} className="flex items-center gap-2.5 text-sm">
                <input
                  type="checkbox"
                  name="flags"
                  value={flag.value}
                  defaultChecked={current?.flags.includes(flag.value)}
                  className="size-4 rounded border-ink-300"
                />
                {flag.label}
              </label>
            ))}
          </div>
          {errors.flags ? (
            <p role="alert" className="mt-1.5 text-[13px] text-stop-600">
              {errors.flags}
            </p>
          ) : null}
        </fieldset>

        <Field
          label="Justification"
          htmlFor="cls-rationale"
          error={errors.rationale}
          hint="Le raisonnement qui mène à ces qualifications. Un juriste doit pouvoir le reprendre."
        >
          <textarea
            id="cls-rationale"
            name="rationale"
            rows={4}
            required
            defaultValue={current?.rationale ?? ''}
            className={FIELD}
          />
        </Field>

        <div className="grid gap-4 sm:grid-cols-2">
          <Field label="Revue juridique" htmlFor="cls-legal">
            <select
              id="cls-legal"
              name="legalReviewLevel"
              defaultValue={current?.legal_review_level ?? 'internal_review'}
              className={FIELD}
            >
              <option value="none">Non nécessaire</option>
              <option value="internal_review">Revue interne</option>
              <option value="external_counsel_required">Conseil externe requis</option>
            </select>
          </Field>

          <Field label="Prochaine revue" htmlFor="cls-review" optional>
            <input
              id="cls-review"
              name="nextReviewAt"
              type="date"
              defaultValue={current?.next_review_at ?? ''}
              className={FIELD}
            />
          </Field>
        </div>

        <label className="flex items-start gap-2.5 text-sm">
          <input
            type="checkbox"
            name="legalReviewCompleted"
            defaultChecked={current?.legal_review_completed}
            className="mt-0.5 size-4 rounded border-ink-300"
          />
          <span>
            La revue juridique est close
            <span className="block text-xs text-ink-500">
              Tant qu’elle ne l’est pas, le passage en production reste bloqué.
            </span>
          </span>
        </label>

        <FormFeedback state={state} />
        <Submit
          pending={pending}
          idle={current ? 'Remplacer la classification' : 'Enregistrer la classification'}
        />
      </form>
    </Disclosure>
  )
}

const CATEGORIES = [
  ['bias_discrimination', 'Biais et discrimination'],
  ['fundamental_rights', 'Droits fondamentaux'],
  ['privacy', 'Vie privée'],
  ['security', 'Sécurité'],
  ['safety', 'Sécurité des personnes'],
  ['accuracy_robustness', 'Exactitude et robustesse'],
  ['transparency', 'Transparence'],
  ['operational', 'Opérationnel'],
  ['financial', 'Financier'],
  ['reputational', 'Réputation'],
  ['legal_compliance', 'Conformité'],
  ['third_party', 'Tiers'],
  ['environmental', 'Environnement'],
] as const

export function RiskPanel({
  useCaseId,
  riskCount,
  people,
}: {
  useCaseId: string
  riskCount: number
  people: { id: string; label: string }[]
}) {
  const [state, formAction, pending] = useActionState<FormState | null, FormData>(createRisk, null)
  const errors = state && !state.ok ? (state.fieldErrors ?? {}) : {}

  return (
    <Disclosure
      title="Identifier un risque"
      summary={riskCount ? `${riskCount} risque(s) déjà identifié(s)` : 'À faire — le passage en revue exige au moins un risque'}
      tone={riskCount ? 'done' : 'todo'}
      defaultOpen={riskCount === 0}
      stayOpen={Boolean(state)}
    >
      <form action={formAction} className="flex flex-col gap-4">
        <input type="hidden" name="useCaseId" value={useCaseId} />

        <Field label="Intitulé" htmlFor="risk-title" error={errors.title}>
          <input
            id="risk-title"
            name="title"
            type="text"
            required
            className={FIELD}
            placeholder="Réponse erronée transmise au client"
          />
        </Field>

        <Field
          label="Scénario"
          htmlFor="risk-scenario"
          error={errors.scenario}
          hint="Ce qui arrive, à qui, par quel enchaînement. Un risque sans scénario ne se traite pas."
        >
          <textarea id="risk-scenario" name="scenario" rows={3} required className={FIELD} />
        </Field>

        <div className="grid gap-4 sm:grid-cols-2">
          <Field label="Catégorie" htmlFor="risk-category">
            <select id="risk-category" name="category" defaultValue="operational" className={FIELD}>
              {CATEGORIES.map(([value, label]) => (
                <option key={value} value={value}>
                  {label}
                </option>
              ))}
            </select>
          </Field>

          <Field label="Responsable du risque" htmlFor="risk-owner" error={errors.ownerUserId}>
            <select id="risk-owner" name="ownerUserId" required defaultValue="" className={FIELD}>
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
        </div>

        <div className="grid gap-4 sm:grid-cols-3">
          <Field
            label="Vraisemblance"
            htmlFor="risk-likelihood"
            hint="1 improbable, 5 quasi certain"
          >
            <input
              id="risk-likelihood"
              name="inherentLikelihood"
              type="number"
              min={1}
              max={5}
              defaultValue={3}
              required
              className={FIELD}
            />
          </Field>

          <Field label="Gravité" htmlFor="risk-impact" hint="1 négligeable, 5 majeure">
            <input
              id="risk-impact"
              name="inherentImpact"
              type="number"
              min={1}
              max={5}
              defaultValue={3}
              required
              className={FIELD}
            />
          </Field>

          <Field label="Prochaine revue" htmlFor="risk-review" optional>
            <input id="risk-review" name="nextReviewAt" type="date" className={FIELD} />
          </Field>
        </div>

        <p className="text-xs text-ink-500">
          Le niveau est calculé par vraisemblance × gravité : il n’est pas saisi, pour qu’il ne
          puisse pas diverger de sa cotation.
        </p>

        <FormFeedback state={state} />
        <Submit pending={pending} idle="Enregistrer le risque" />
      </form>
    </Disclosure>
  )
}

export function AcceptRiskForm({
  riskId,
  useCaseId,
}: {
  riskId: string
  useCaseId: string
}) {
  const [state, formAction, pending] = useActionState<FormState | null, FormData>(acceptRisk, null)
  const errors = state && !state.ok ? (state.fieldErrors ?? {}) : {}

  return (
    <form action={formAction} className="mt-3 flex flex-col gap-3 rounded-md bg-ink-100 px-4 py-3">
      <input type="hidden" name="riskId" value={riskId} />
      <input type="hidden" name="useCaseId" value={useCaseId} />

      <p className="text-[13px] leading-relaxed text-ink-600">
        Accepter un risque vous engage nominativement. La justification et la date de revue sont
        exigées par la base, non par ce formulaire.
      </p>

      <Field label="Justification de l’acceptation" htmlFor={`accept-${riskId}`} error={errors.rationale}>
        <textarea id={`accept-${riskId}`} name="rationale" rows={2} required className={FIELD} />
      </Field>

      <Field label="Date de revue" htmlFor={`review-${riskId}`} error={errors.reviewAt}>
        <input id={`review-${riskId}`} name="reviewAt" type="date" required className={FIELD} />
      </Field>

      <FormFeedback state={state} />
      <Submit pending={pending} idle="Accepter ce risque" />
    </form>
  )
}

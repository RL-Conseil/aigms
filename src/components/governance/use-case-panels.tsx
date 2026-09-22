'use client'

import { useActionState, useState } from 'react'
import {
  acceptRisk,
  createRisk,
  saveClassification,
  saveTriage,
  type FormState,
} from '@/lib/actions/governance'
import { Field, FIELD, FormFeedback, Submit } from '@/components/forms'
import { Modal } from '@/components/modal'
import { ControlFinder } from '@/components/governance/control-finder'
import {
  CLASSIFICATION_FLAG_EFFECTS,
  CLASSIFICATION_FLAG_LABELS,
  ORGANIZATION_ROLE_LABELS,
} from '@/lib/domain/classification'
import {
  CRITICALITY_CONSEQUENCES,
  CRITICALITY_GRID,
  CRITICALITY_LABELS,
  CRITICALITY_ORDER,
  criticalityRank,
  GRID_EFFECTS,
  suggestCriticality,
  type CriticalitySignal,
  type GridAnswers,
} from '@/lib/domain/criticality'

/**
 * Etapes de gouvernance saisies depuis la fiche du cas d'usage.
 *
 * Chaque etape est un volet : on ne travaille jamais sur tout le dossier en
 * meme temps, et celle qui reste a faire s'ouvre d'elle-meme. C'est le meme
 * principe que la carte de l'increment suivant — on saisit la ou l'on regarde,
 * sans changer de page.
 */

export function CriticalityPanel({
  useCaseId,
  current,
  prefill,
  signal,
}: {
  useCaseId: string
  current: {
    criticality: string | null
    rationale: string | null
    grid: GridAnswers | null
    decision_impact: string | null
    next_review_at: string | null
  }
  /** Ce que la fiche sait deja : autonomie, donnees, personnes vulnerables. */
  prefill: GridAnswers
  signal: CriticalitySignal | null
}) {
  const [state, formAction, pending] = useActionState<FormState | null, FormData>(saveTriage, null)
  const errors = state && !state.ok ? (state.fieldErrors ?? {}) : {}
  const done = Boolean(current.criticality)
  const [answers, setAnswers] = useState<GridAnswers>({ ...prefill, ...(current.grid ?? {}) })
  const suggested = suggestCriticality(answers)
  const [chosen, setChosen] = useState<string>(current.criticality ?? suggested ?? 'moderate')
  // Tant qu'on n'a pas choisi soi-meme, le niveau suit la grille.
  const [touched, setTouched] = useState(Boolean(current.criticality))
  const level = touched ? chosen : (suggested ?? chosen)
  const below = suggested !== null && criticalityRank(level) < criticalityRank(suggested)
  const belowFacts = signal?.observed && criticalityRank(level) < criticalityRank(signal.observed)

  /*
    La criticite se choisit dans une fenetre, comme la qualification : un acte
    court, qui se relit ensuite a droite du fil conducteur. La grille dit ce
    que le niveau engage, pas un adjectif ; l'officer retient le sien.
  */
  return (
    <Modal
      trigger={done ? 'Réviser la criticité' : 'Fixer la criticité'}
      title="Criticité du cas d’usage"
      description="Combien d’effort de gouvernance ce cas d’usage appelle. Un acte humain, tracé."
    >
      {() => (
        <form action={formAction} className="flex flex-col gap-4">
          <input type="hidden" name="useCaseId" value={useCaseId} />

          <div className="rounded-md bg-ink-100 px-4 py-3 text-[13px] leading-relaxed text-ink-600">
            Quatre questions proposent un niveau ; vous retenez le vôtre. La criticité ne dit rien du
            règlement — c’est la qualification qui s’en charge — mais elle commande l’évaluation
            d’impact, l’arbitrage du Comité de direction et la cadence de revue. Les réponses ne
            servent pas qu’à proposer : ce qu’elles constatent — données personnelles ou sensibles,
            personnes vulnérables — s’inscrit sur la fiche et déclenche les règles qui s’y attachent.
          </div>

          <fieldset className="grid gap-3 sm:grid-cols-2">
            {CRITICALITY_GRID.map((q) => (
              <Field key={q.key} label={q.label} htmlFor={`grid-${q.key}`}>
                <select
                  id={`grid-${q.key}`}
                  name={`grid.${q.key}`}
                  value={answers[q.key] ?? ''}
                  onChange={(e) => setAnswers((a) => ({ ...a, [q.key]: e.target.value || undefined }))}
                  className={FIELD}
                >
                  <option value="">—</option>
                  {q.options.map((o) => (
                    <option key={o.value} value={o.value}>
                      {o.label}
                    </option>
                  ))}
                </select>
                {GRID_EFFECTS[`${q.key}:${answers[q.key] ?? ''}`] ? (
                  <p className="mt-1 text-xs leading-snug text-ink-500">{GRID_EFFECTS[`${q.key}:${answers[q.key] ?? ''}`]}</p>
                ) : null}
              </Field>
            ))}
          </fieldset>

          <Field
            label="Criticité retenue"
            htmlFor="triage-criticality"
            hint={
              suggested
                ? `La grille propose : ${CRITICALITY_LABELS[suggested]}.`
                : 'Répondez à la grille pour obtenir une proposition, ou choisissez directement.'
            }
          >
            <select
              id="triage-criticality"
              name="criticality"
              value={level}
              onChange={(e) => {
                setChosen(e.target.value)
                setTouched(true)
              }}
              className={FIELD}
            >
              {CRITICALITY_ORDER.map((c) => (
                <option key={c} value={c}>
                  {CRITICALITY_LABELS[c]} — {CRITICALITY_CONSEQUENCES[c]}
                </option>
              ))}
            </select>
          </Field>
          {signal?.exceeds || belowFacts ? (
            <p className="rounded-md border border-warn-600/40 bg-amber-50 px-3.5 py-2.5 text-xs leading-relaxed text-warn-600">
              Les faits imposent au moins <strong className="font-semibold">{CRITICALITY_LABELS[signal!.observed!]}</strong> :{' '}
              {signal!.reasons.join(' ')}
            </p>
          ) : null}

          <Field
            label="Justification"
            htmlFor="triage-rationale"
            error={errors.rationale}
            hint={
              below
                ? 'Vous retenez moins que la grille ne propose : dites pourquoi. Relu à la revue.'
                : 'Pourquoi ce niveau, en une ou deux phrases. Relu à la revue.'
            }
          >
            <textarea
              id="triage-rationale"
              name="rationale"
              rows={3}
              required
              defaultValue={current.rationale ?? ''}
              className={FIELD}
            />
          </Field>

          <div className="grid gap-4 sm:grid-cols-2">
            <Field label="Portée de la décision" htmlFor="triage-impact" optional hint="Ce que le système décide ou influence, en une phrase.">
              <input
                id="triage-impact"
                name="decisionImpact"
                type="text"
                defaultValue={current.decision_impact ?? ''}
                className={FIELD}
              />
            </Field>
            <Field label="Prochaine revue" htmlFor="triage-review" optional>
              <input
                id="triage-review"
                name="nextReviewAt"
                type="date"
                defaultValue={current.next_review_at ?? ''}
                className={FIELD}
              />
            </Field>
          </div>

          <FormFeedback state={state} />
          <Submit pending={pending} idle={done ? 'Réviser la criticité' : 'Enregistrer la criticité'} />
        </form>
      )}
    </Modal>
  )
}

const FLAGS = Object.entries(CLASSIFICATION_FLAG_LABELS).map(([value, label]) => ({
  value,
  label,
  effect: CLASSIFICATION_FLAG_EFFECTS[value] ?? '',
}))
const ROLES = Object.entries(ORGANIZATION_ROLE_LABELS).map(([value, label]) => ({ value, label }))

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

  // La qualification se pose et se revise depuis la fiche, dans une fenetre :
  // pas d'onglet a rejoindre pour un acte qui se relit ensuite a droite du
  // fil conducteur.
  return (
    <Modal
      trigger={current ? 'Réviser la qualification' : 'Qualifier maintenant'}
      title="Qualification au regard du règlement"
      description="Règlement (UE) 2024/1689 — AI Act. Un cadrage, pas un avis juridique."
    >
      {() => (
      <>
      <div className="mb-4 rounded-md bg-ink-100 px-4 py-3">
        <p className="text-[13px] leading-relaxed text-ink-600">
          Au regard du <strong className="font-semibold">règlement (UE) 2024/1689</strong> — l’AI
          Act. Cette qualification est un <strong className="font-semibold">cadrage</strong>, pas un
          avis juridique : elle dit quelles obligations examiner et quel niveau de revue prévoir ;
          elle ne conclut pas à la conformité.
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
            label="Version du règlement"
            htmlFor="cls-version"
            hint="Le règlement évolue : on note la version qui a servi, pour que la qualification reste lisible plus tard."
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
          <legend className="mb-1 text-sm font-medium">Qualifications retenues</legend>
          {/*
            Chaque case engage quelque chose — un jalon bloque, une evaluation
            exigee, des controles proposes. Le dire sous le libelle, la ou l'on
            coche : une case qu'on coche sans savoir est une case mal cochee.
          */}
          <p className="mb-2 text-xs text-ink-500">Chacune engage la suite : ce qui est écrit dessous se déclenche côté serveur.</p>
          <div className="grid gap-2.5 sm:grid-cols-2">
            {FLAGS.map((flag) => (
              <label key={flag.value} className="flex items-start gap-2.5 text-sm">
                <input
                  type="checkbox"
                  name="flags"
                  value={flag.value}
                  defaultChecked={current?.flags.includes(flag.value)}
                  className="mt-0.5 size-4 rounded border-ink-300"
                />
                <span className="min-w-0">
                  {flag.label}
                  {flag.effect ? <span className="block text-xs leading-snug text-ink-400">{flag.effect}</span> : null}
                </span>
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
          idle={current ? 'Remplacer la qualification' : 'Enregistrer la qualification'}
        />
      </form>
      </>
      )}
    </Modal>
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
  organizationId,
  riskCount,
  people,
  controls = [],
  defaultOwnerUserId,
  criticality,
}: {
  useCaseId: string
  organizationId: string
  riskCount: number
  people: { id: string; label: string }[]
  /** Qui repond du cas d'usage : le responsable redevable, a defaut le porteur. */
  defaultOwnerUserId?: string | null
  /** Eleve ou critique : l'acceptation exigera en plus une decision du Comite. */
  criticality?: string | null
  /** Les controles applicables a ce cas d'usage : l'un d'eux peut traiter le risque des l'identification. */
  controls?: { id: string; code: string; name: string; status: string }[]
}) {
  const [state, formAction, pending] = useActionState<FormState | null, FormData>(createRisk, null)
  const errors = state && !state.ok ? (state.fieldErrors ?? {}) : {}
  const [options, setOptions] = useState<{ id: string; code: string; name: string }[]>(controls)
  const [controlId, setControlId] = useState('')

  // Le volet deplie occupait la colonne au-dessus de la liste des risques :
  // on lisait le formulaire avant ce qu'il complete. Un risque n'existe que
  // par son cas d'usage, il se saisit donc SANS quitter la page — mais a la
  // demande, et depuis la zone qu'il alimente.
  return (
    <Modal
      trigger={riskCount ? 'Identifier un risque' : 'Identifier le premier risque'}
      title="Identifier un risque"
      description="Le niveau se calcule ; il ne se saisit pas."
    >
      {() => (
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

          {/*
            Ce n'est pas la personne qui exécute — le traitement designe son
            propre responsable. C'est celle qui REPOND du risque : elle seule
            pourra l'accepter, et la base le lui reserve.
          */}
          <Field
            label="Qui répond de ce risque"
            htmlFor="risk-owner"
            error={errors.ownerUserId}
            hint={
              criticality === 'high' || criticality === 'critical'
                ? 'Cette personne seule pourra l’accepter — et, ce cas d’usage étant de criticité élevée, une décision approuvée par le Comité de direction sera exigée en plus. Qui exécute la mesure se désigne au traitement.'
                : 'Cette personne seule pourra l’accepter. Qui exécute la mesure se désigne au traitement, pas ici.'
            }
          >
            <select
              id="risk-owner"
              name="ownerUserId"
              required
              defaultValue={defaultOwnerUserId ?? ''}
              className={FIELD}
            >
              <option value="" disabled>
                Choisir…
              </option>
              {people.map((person) => (
                <option key={person.id} value={person.id}>
                  {person.label}
                  {person.id === defaultOwnerUserId ? ' — répond du cas d’usage' : ''}
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

        {/*
          Le traitement est un acte distinct de l'identification — on cote
          d'abord, on traite ensuite. Mais quand le controle qui le traitera
          est deja connu, le dire ici ouvre le traitement sans repasser par
          une seconde fenetre.
        */}
        <Field
          label="Contrôle qui le traitera"
          htmlFor="risk-control"
          optional
          hint={
            options.length
              ? 'Parmi les contrôles affectés à ce cas d’usage, ou trouvé par l’assistant. Un traitement « réduire » s’ouvre alors, porté par le responsable du risque, et le contrôle devient applicable.'
              : 'Aucun contrôle n’est encore affecté à ce cas d’usage : la liste est vide. « Proposer des contrôles » (onglet Contrôles affectés) en calcule depuis les faits ; l’assistant ci-dessous cherche par les mots.'
          }
        >
          <select
            id="risk-control"
            name="controlId"
            value={controlId}
            onChange={(event) => setControlId(event.target.value)}
            className={FIELD}
          >
            <option value="">— À décider au traitement</option>
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
          readQuery={() =>
            [
              (document.getElementById('risk-title') as HTMLInputElement | null)?.value ?? '',
              (document.getElementById('risk-scenario') as HTMLTextAreaElement | null)?.value ?? '',
            ]
              .filter(Boolean)
              .join(' ')
          }
          ownerUserId={() => (document.getElementById('risk-owner') as HTMLSelectElement | null)?.value ?? ''}
          onPick={(option) => {
            setOptions((current) => (current.some((c) => c.id === option.id) ? current : [...current, option]))
            setControlId(option.id)
          }}
        />

        <FormFeedback state={state} />
        <Submit pending={pending} idle="Enregistrer le risque" />
      </form>
      )}
    </Modal>
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

'use client'

import { useActionState } from 'react'
import { updateUseCaseLabels, type FormState } from '@/lib/actions/governance'
import { Field, FIELD, FormFeedback, Submit } from '@/components/forms'
import { Modal } from '@/components/modal'

/**
 * Corriger la fiche d'un cas d'usage.
 *
 * Un cas d'usage se declare une fois et se relit pendant des annees. Entre les
 * deux, une finalite se reformule et un proprietaire change de poste : rien de
 * cela n'est une decision de gouvernance, et rien de cela ne devait attendre une
 * demande de changement.
 *
 * Ce qui QUALIFIE n'est pas ici : criticite, niveau d'autonomie, classification
 * reglementaire, donnees personnelles, personnes vulnerables, statut. Chacun a
 * son acte, date et justifie. Les corriger par un formulaire d'etiquette
 * reviendrait a reclasser un systeme sans le dire.
 */
export function UseCaseLabelForm({
  useCase,
  people,
  trigger = 'Corriger la fiche',
  icon = false,
}: {
  /** Libelle du bouton d'ouverture. */
  trigger?: string
  /** Un crayon a cote du nom, plutot qu'un bouton dans la barre d'actions. */
  icon?: boolean
  useCase: {
    id: string
    name: string
    purpose: string
    expected_benefit: string | null
    owner_user_id: string | null
    accountable_user_id: string | null
    users_description: string | null
    affected_persons: string | null
    data_description: string | null
    decision_impact: string | null
  }
  people: { id: string; label: string }[]
}) {
  const [state, formAction, pending] = useActionState<FormState | null, FormData>(
    updateUseCaseLabels,
    null,
  )
  const errors = state && !state.ok ? (state.fieldErrors ?? {}) : {}

  return (
    <Modal
      trigger={
        icon ? (
          <svg width="16" height="16" viewBox="0 0 16 16" fill="none" aria-hidden>
            <path
              d="M11.3 2.3a1.4 1.4 0 0 1 2 2L5.5 12.1 2.5 13l.9-3L11.3 2.3Z"
              stroke="currentColor"
              strokeWidth="1.4"
              strokeLinejoin="round"
            />
          </svg>
        ) : (
          trigger
        )
      }
      triggerLabel={icon ? trigger : undefined}
      triggerClassName={
        icon
          ? 'inline-flex size-7 items-center justify-center rounded-full border border-ink-200 text-ink-500 hover:border-ink-400 hover:text-ink-900'
          : undefined
      }
      title="Corriger la fiche"
      description="Ce qui décrit le cas d’usage. Sa qualification et son statut se prononcent ailleurs."
    >
      {() => (
        <form action={formAction} className="flex flex-col gap-4">
          <input type="hidden" name="useCaseId" value={useCase.id} />

          <Field label="Nom" htmlFor="uclab-name" error={errors.name}>
            <input
              id="uclab-name"
              name="name"
              type="text"
              required
              defaultValue={useCase.name}
              className={FIELD}
            />
          </Field>

          <Field
            label="Finalité"
            htmlFor="uclab-purpose"
            error={errors.purpose}
            hint="À quoi sert ce système, en une ou deux phrases lisibles hors contexte."
          >
            <textarea
              id="uclab-purpose"
              name="purpose"
              rows={3}
              required
              defaultValue={useCase.purpose}
              className={FIELD}
            />
          </Field>

          <div className="grid gap-4 sm:grid-cols-2">
            <Field label="Propriétaire" htmlFor="uclab-owner" error={errors.ownerUserId}>
              <select
                id="uclab-owner"
                name="ownerUserId"
                required
                defaultValue={useCase.owner_user_id ?? ''}
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
              label="Responsable redevable"
              htmlFor="uclab-accountable"
              error={errors.accountableUserId}
              hint="Distinct du propriétaire opérationnel."
            >
              <select
                id="uclab-accountable"
                name="accountableUserId"
                required
                defaultValue={useCase.accountable_user_id ?? ''}
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

          <Field label="Bénéfice attendu" htmlFor="uclab-benefit" optional>
            <textarea
              id="uclab-benefit"
              name="expectedBenefit"
              rows={2}
              defaultValue={useCase.expected_benefit ?? ''}
              className={FIELD}
            />
          </Field>

          <Field label="Qui l’utilise" htmlFor="uclab-users" optional>
            <textarea
              id="uclab-users"
              name="usersDescription"
              rows={2}
              defaultValue={useCase.users_description ?? ''}
              className={FIELD}
            />
          </Field>

          <Field label="Personnes concernées" htmlFor="uclab-affected" optional>
            <textarea
              id="uclab-affected"
              name="affectedPersons"
              rows={2}
              defaultValue={useCase.affected_persons ?? ''}
              className={FIELD}
            />
          </Field>

          <Field label="Données mobilisées" htmlFor="uclab-data" optional>
            <textarea
              id="uclab-data"
              name="dataDescription"
              rows={2}
              defaultValue={useCase.data_description ?? ''}
              className={FIELD}
            />
          </Field>

          <Field label="Portée des décisions" htmlFor="uclab-impact" optional>
            <textarea
              id="uclab-impact"
              name="decisionImpact"
              rows={2}
              defaultValue={useCase.decision_impact ?? ''}
              className={FIELD}
            />
          </Field>

          <p className="rounded-md border border-ink-200 bg-ink-50 px-3.5 py-3 text-xs leading-relaxed text-ink-600">
            La criticité, le niveau d’autonomie, la classification réglementaire, les données
            personnelles, les personnes vulnérables et le statut ne se corrigent pas ici : chacun
            se prononce dans son écran, daté et justifié.
          </p>

          <FormFeedback state={state} />
          <Submit pending={pending} idle="Enregistrer les corrections" />
        </form>
      )}
    </Modal>
  )
}

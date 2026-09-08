'use client'

import { useActionState } from 'react'
import { createUseCase, type FormState } from '@/lib/actions/governance'
import { Field, FIELD, FormFeedback, Submit } from '@/components/forms'
import { AUTONOMY_LABELS } from '@/lib/domain/governance'

/**
 * Intake d'un cas d'usage.
 *
 * L'ordre des questions suit celui d'un entretien de cadrage : ce qu'on fait,
 * pour qui, avec quelles donnees, avec quelle autonomie. Le gate TRIAGE exige
 * finalite, proprietaire et responsable redevable — les trois champs marques
 * comme requis sont exactement ceux-la.
 */
export function UseCaseForm({
  organizationId,
  activities,
  people,
  defaultActivityId,
}: {
  organizationId: string
  activities: { id: string; name: string; process_name: string }[]
  people: { id: string; label: string }[]
  defaultActivityId?: string
}) {
  const [state, formAction, pending] = useActionState<FormState | null, FormData>(createUseCase, null)
  const errors = state && !state.ok ? (state.fieldErrors ?? {}) : {}

  return (
    <form action={formAction} className="flex flex-col gap-6">
      <input type="hidden" name="organizationId" value={organizationId} />

      <fieldset className="flex flex-col gap-4">
        <legend className="mb-1 text-sm font-semibold text-ink-900">Ce que fait le système</legend>

        <Field label="Nom du cas d’usage" htmlFor="uc-name" error={errors.name}>
          <input
            id="uc-name"
            name="name"
            type="text"
            required
            className={FIELD}
            placeholder="Assistant de rédaction du support client"
          />
        </Field>

        <Field
          label="Finalité"
          htmlFor="uc-purpose"
          error={errors.purpose}
          hint="À quoi sert ce système, concrètement, et où s’arrête son rôle. C’est la phrase qu’un auditeur lira en premier."
        >
          <textarea id="uc-purpose" name="purpose" rows={3} required className={FIELD} />
        </Field>

        <Field label="Activité servie" htmlFor="uc-activity" optional>
          <select
            id="uc-activity"
            name="activityId"
            defaultValue={defaultActivityId ?? ''}
            className={FIELD}
          >
            <option value="">Non rattaché pour l’instant</option>
            {activities.map((activity) => (
              <option key={activity.id} value={activity.id}>
                {activity.process_name} › {activity.name}
              </option>
            ))}
          </select>
        </Field>

        <Field label="Bénéfice attendu" htmlFor="uc-benefit" optional error={errors.expectedBenefit}>
          <input id="uc-benefit" name="expectedBenefit" type="text" className={FIELD} />
        </Field>
      </fieldset>

      <fieldset className="flex flex-col gap-4 border-t border-ink-100 pt-6">
        <legend className="mb-1 text-sm font-semibold text-ink-900">Qui en répond</legend>

        <div className="grid gap-4 sm:grid-cols-2">
          <Field
            label="Propriétaire"
            htmlFor="uc-owner"
            error={errors.ownerUserId}
            hint="Qui exploite le système au quotidien."
          >
            <select id="uc-owner" name="ownerUserId" required defaultValue="" className={FIELD}>
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

          <Field
            label="Responsable redevable"
            htmlFor="uc-accountable"
            error={errors.accountableUserId}
            hint="Qui en répond devant la direction. Peut être la même personne."
          >
            <select
              id="uc-accountable"
              name="accountableUserId"
              required
              defaultValue=""
              className={FIELD}
            >
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

        <Field label="Utilisateurs" htmlFor="uc-users" optional error={errors.usersDescription}>
          <input
            id="uc-users"
            name="usersDescription"
            type="text"
            className={FIELD}
            placeholder="Conseillers du support, 12 personnes"
          />
        </Field>
      </fieldset>

      <fieldset className="flex flex-col gap-4 border-t border-ink-100 pt-6">
        <legend className="mb-1 text-sm font-semibold text-ink-900">
          Données et personnes concernées
        </legend>

        <Field
          label="Personnes affectées"
          htmlFor="uc-affected"
          optional
          error={errors.affectedPersons}
          hint="Qui subit les effets du système, y compris sans l’utiliser."
        >
          <input id="uc-affected" name="affectedPersons" type="text" className={FIELD} />
        </Field>

        <Field label="Données traitées" htmlFor="uc-data" optional error={errors.dataDescription}>
          <textarea id="uc-data" name="dataDescription" rows={2} className={FIELD} />
        </Field>

        <div className="flex flex-col gap-2.5">
          <label className="flex items-start gap-2.5 text-sm">
            <input
              type="checkbox"
              name="involvesPersonalData"
              className="mt-0.5 size-4 rounded border-ink-300"
            />
            <span>
              Des données à caractère personnel sont traitées
              <span className="block text-xs text-ink-500">
                Déclenche l’exigence d’évaluation d’impact et l’articulation avec le RGPD.
              </span>
            </span>
          </label>

          <label className="flex items-start gap-2.5 text-sm">
            <input
              type="checkbox"
              name="involvesVulnerablePersons"
              className="mt-0.5 size-4 rounded border-ink-300"
            />
            <span>
              Des personnes en situation de vulnérabilité sont concernées
              <span className="block text-xs text-ink-500">
                Renforce le niveau d’examen attendu de l’évaluation d’impact.
              </span>
            </span>
          </label>
        </div>
      </fieldset>

      <fieldset className="flex flex-col gap-4 border-t border-ink-100 pt-6">
        <legend className="mb-1 text-sm font-semibold text-ink-900">Autonomie</legend>

        <Field
          label="Niveau d’autonomie"
          htmlFor="uc-autonomy"
          hint="Au-delà de L2, un plan de supervision humaine devra nommer une autorité d’arrêt."
        >
          <select id="uc-autonomy" name="autonomyLevel" defaultValue="L1" className={FIELD}>
            {Object.entries(AUTONOMY_LABELS).map(([value, label]) => (
              <option key={value} value={value}>
                {label}
              </option>
            ))}
          </select>
        </Field>

        <Field
          label="Portée de la décision"
          htmlFor="uc-decision"
          optional
          error={errors.decisionImpact}
          hint="Ce que la sortie du système déclenche, et ce qu’un humain valide avant."
        >
          <textarea id="uc-decision" name="decisionImpact" rows={2} className={FIELD} />
        </Field>
      </fieldset>

      <FormFeedback state={state} />

      <div className="flex flex-wrap items-center gap-4 border-t border-ink-100 pt-6">
        <Submit pending={pending} idle="Déclarer le cas d’usage" />
        <p className="text-xs text-ink-500">
          Le cas d’usage est créé au statut brouillon. Le triage viendra ensuite.
        </p>
      </div>
    </form>
  )
}

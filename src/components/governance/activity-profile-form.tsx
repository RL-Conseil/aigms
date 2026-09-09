'use client'

import { useActionState } from 'react'
import { setActivityProfile, type FormState } from '@/lib/actions/governance'
import { FIELD, FormFeedback } from '@/components/forms'
import { ACTIVITY_PROFILES, type ActivityProfile } from '@/lib/domain/activity-profile'

/**
 * Role de l'organisation vis-a-vis de l'IA.
 *
 * Le changer n'est pas anodin : il requalifie la criticite de chaque typologie
 * de preuve, donc le regime — technique, organisationnel, exclusion — que la
 * Declaration d'Applicabilite exige de chaque exigence de l'Annexe A. Le
 * formulaire le dit avant, pas apres.
 */
export function ActivityProfileForm({
  organizationId,
  current,
}: {
  organizationId: string
  current: ActivityProfile | null
}) {
  const [state, formAction, pending] = useActionState<FormState | null, FormData>(
    setActivityProfile,
    null,
  )

  return (
    <form action={formAction} className="flex flex-col gap-3">
      <input type="hidden" name="organizationId" value={organizationId} />

      <div>
        <label htmlFor="activityProfile" className="mb-1.5 block text-sm font-medium">
          Rôle vis-à-vis de l’IA
          <span className="ml-2 font-normal text-ink-500">ISO/IEC 42001</span>
        </label>
        <select
          id="activityProfile"
          name="activityProfile"
          defaultValue={current ?? ''}
          required
          className={FIELD}
        >
          <option value="" disabled>
            — Non renseigné
          </option>
          {ACTIVITY_PROFILES.map((profile) => (
            <option key={profile.value} value={profile.value}>
              {profile.label} — {profile.hint}
            </option>
          ))}
        </select>
      </div>

      <p className="text-xs leading-relaxed text-ink-500">
        Il commande les typologies de preuves attendues et leur criticité. Un hébergeur démontre
        l’isolation de ses calculs, pas l’équité d’un modèle qu’il n’entraîne pas. Le modifier
        recalcule le régime de preuve exigé par la Déclaration d’Applicabilité.
      </p>

      <button
        type="submit"
        disabled={pending}
        className="self-start rounded-md bg-night-900 px-4 py-1.5 text-xs font-medium text-white hover:bg-night-800 disabled:opacity-60"
      >
        {pending ? 'Enregistrement…' : 'Enregistrer le rôle'}
      </button>

      <FormFeedback state={state} />
    </form>
  )
}

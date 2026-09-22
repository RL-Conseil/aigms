'use client'

import { useActionState } from 'react'
import { saveNotificationPreference, type ProfileState } from '@/lib/actions/profile'
import { Field, FIELD, FormFeedback, Submit } from '@/components/forms'

/**
 * Comment cette personne veut etre prevenue.
 *
 * Le meme formulaire sert dans « Mes parametres » et dans la page des comptes :
 * c'est la politique RLS qui decide si l'on peut regler celle d'un autre. Ce
 * qui ne peut pas attendre — arret d'urgence, incident a qualifier, decision
 * qui retient un jalon — part tout de suite ; le reste attend la synthese.
 */
export type NotificationPreference = {
  email_enabled: boolean
  immediate_enabled: boolean
  digest: string
}

export function NotificationForm({
  userId,
  preference,
  compact = false,
}: {
  userId: string
  preference: NotificationPreference
  /** Dans la liste des comptes : sans l'explication, qui est donnée une fois. */
  compact?: boolean
}) {
  const [state, formAction, pending] = useActionState<ProfileState | null, FormData>(
    saveNotificationPreference,
    null,
  )

  return (
    <form action={formAction} className="flex flex-col gap-3">
      <input type="hidden" name="userId" value={userId} />

      <label className="flex items-start gap-2.5 text-sm text-ink-700">
        <input
          type="checkbox"
          name="emailEnabled"
          defaultChecked={preference.email_enabled}
          className="mt-0.5 size-4 accent-[oklch(0.45_0.11_245)]"
        />
        <span>
          Notification par courriel
          {compact ? null : (
            <span className="block text-xs text-ink-500">
              Décochée, les alertes restent lisibles dans « Mes alertes » — rien n’est perdu, rien n’est
              envoyé.
            </span>
          )}
        </span>
      </label>

      <label className="flex items-start gap-2.5 text-sm text-ink-700">
        <input
          type="checkbox"
          name="immediateEnabled"
          defaultChecked={preference.immediate_enabled}
          className="mt-0.5 size-4 accent-[oklch(0.45_0.11_245)]"
        />
        <span>
          Prévenir tout de suite de ce qui ne peut pas attendre
          {compact ? null : (
            <span className="block text-xs text-ink-500">
              Arrêt d’urgence recommandé, incident à qualifier sous 24 h, décision qui retient un jalon,
              criticité dépassée par les faits, preuve échue.
            </span>
          )}
        </span>
      </label>

      <Field
        label="Synthèse"
        htmlFor={`digest-${userId}`}
        hint={compact ? undefined : 'Ce qui reste à faire avancer : actions, incidents, alertes non lues, avec les liens qui y conduisent.'}
      >
        <select id={`digest-${userId}`} name="digest" defaultValue={preference.digest} className={FIELD}>
          <option value="daily">Chaque jour</option>
          <option value="weekly">Chaque semaine</option>
          <option value="none">Aucune synthèse</option>
        </select>
      </Field>

      <FormFeedback state={state} />
      <Submit pending={pending} idle="Enregistrer" />
    </form>
  )
}

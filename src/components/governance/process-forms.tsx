'use client'

import { useActionState } from 'react'
import { createActivity, createProcess, type FormState } from '@/lib/actions/governance'
import { Field, FIELD, FormFeedback, Submit } from '@/components/forms'

const CATEGORIES = [
  { value: 'management', label: 'Pilotage', hint: 'Direction, gouvernance, performance' },
  { value: 'core', label: 'Réalisation', hint: 'Ce qui crée la valeur pour le client' },
  { value: 'support', label: 'Support', hint: 'Ressources humaines, systèmes d’information, achats' },
] as const

export function ProcessForm({ organizationId }: { organizationId: string }) {
  const [state, formAction, pending] = useActionState<FormState | null, FormData>(createProcess, null)
  const errors = state && !state.ok ? (state.fieldErrors ?? {}) : {}

  return (
    <form action={formAction} className="flex flex-col gap-4">
      <input type="hidden" name="organizationId" value={organizationId} />

      <div className="grid gap-4 sm:grid-cols-[1fr_120px]">
        <Field label="Nom du processus" htmlFor="process-name" error={errors.name}>
          <input id="process-name" name="name" type="text" required className={FIELD} placeholder="Servir le client" />
        </Field>
        <Field label="Code" htmlFor="process-code" optional error={errors.code}>
          <input id="process-code" name="code" type="text" maxLength={16} className={`${FIELD} uppercase`} placeholder="SUP" />
        </Field>
      </div>

      <Field label="Nature" htmlFor="process-category">
        <select id="process-category" name="category" defaultValue="core" className={FIELD}>
          {CATEGORIES.map((c) => (
            <option key={c.value} value={c.value}>
              {c.label} — {c.hint}
            </option>
          ))}
        </select>
      </Field>

      <Field label="Description" htmlFor="process-description" optional error={errors.description}>
        <textarea id="process-description" name="description" rows={2} className={FIELD} />
      </Field>

      <FormFeedback state={state} />
      <Submit pending={pending} idle="Créer le processus" />
    </form>
  )
}

export function ActivityForm({
  organizationId,
  processes,
  defaultProcessId,
}: {
  organizationId: string
  processes: { id: string; name: string }[]
  defaultProcessId?: string
}) {
  const [state, formAction, pending] = useActionState<FormState | null, FormData>(createActivity, null)
  const errors = state && !state.ok ? (state.fieldErrors ?? {}) : {}

  if (!processes.length) {
    return (
      <p className="text-sm text-ink-500">
        Créez d’abord un processus : une activité s’y rattache.
      </p>
    )
  }

  return (
    <form action={formAction} className="flex flex-col gap-4">
      <input type="hidden" name="organizationId" value={organizationId} />

      <Field label="Processus de rattachement" htmlFor="activity-process">
        <select
          id="activity-process"
          name="processId"
          defaultValue={defaultProcessId ?? processes[0]?.id}
          className={FIELD}
        >
          {processes.map((p) => (
            <option key={p.id} value={p.id}>
              {p.name}
            </option>
          ))}
        </select>
      </Field>

      <Field label="Nom de l’activité" htmlFor="activity-name" error={errors.name}>
        <input
          id="activity-name"
          name="name"
          type="text"
          required
          className={FIELD}
          placeholder="Traitement des demandes clients"
        />
      </Field>

      <Field label="Description" htmlFor="activity-description" optional error={errors.description}>
        <textarea id="activity-description" name="description" rows={2} className={FIELD} />
      </Field>

      <FormFeedback state={state} />
      <Submit pending={pending} idle="Créer l’activité" />
    </form>
  )
}

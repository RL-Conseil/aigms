'use client'

import { useActionState, useState } from 'react'
import {
  saveConnector,
  setConnectorStatus,
  testConnector,
  type ConnectorState,
} from '@/lib/actions/connectors'
import {
  CAPABILITY_LABELS,
  CONNECTOR_CATALOG,
  CONNECTOR_KINDS,
  type ConnectorKind,
} from '@/lib/domain/connectors'

const FIELD =
  'w-full rounded-md border border-ink-200 bg-white px-3 py-2 text-sm outline-none focus:border-brand-500 focus:ring-2 focus:ring-brand-500/20'

function Feedback({ state }: { state: ConnectorState | null }) {
  if (!state) return null
  return (
    <p
      role="status"
      className={`rounded-md px-4 py-3 text-sm ${
        state.ok ? 'bg-emerald-50 text-emerald-800' : 'bg-rose-50 text-rose-800'
      }`}
    >
      {state.message}
    </p>
  )
}

export function ConnectorForm() {
  const [state, formAction, pending] = useActionState<ConnectorState | null, FormData>(
    saveConnector,
    null,
  )
  const [kind, setKind] = useState<ConnectorKind>('vanta')
  const entry = CONNECTOR_CATALOG[kind]

  return (
    <form action={formAction} className="flex flex-col gap-4">
      <div>
        <label htmlFor="kind" className="mb-1.5 block text-sm font-medium">
          Plateforme
        </label>
        <select
          id="kind"
          name="kind"
          value={kind}
          onChange={(e) => setKind(e.target.value as ConnectorKind)}
          className={FIELD}
        >
          {CONNECTOR_KINDS.map((k) => (
            <option key={k} value={k}>
              {CONNECTOR_CATALOG[k].label}
            </option>
          ))}
        </select>
        <p className="mt-1.5 text-xs text-ink-500">{entry.role}</p>
      </div>

      <div className="grid gap-4 sm:grid-cols-2">
        <div>
          <label htmlFor="displayName" className="mb-1.5 block text-sm font-medium">
            Nom du connecteur
          </label>
          <input
            id="displayName"
            name="displayName"
            type="text"
            required
            defaultValue={`${entry.label} — production`}
            key={`name-${kind}`}
            className={FIELD}
          />
        </div>
        <div>
          <label htmlFor="sourceOfTruth" className="mb-1.5 block text-sm font-medium">
            Source de vérité
          </label>
          <input
            id="sourceOfTruth"
            name="sourceOfTruth"
            type="text"
            required
            defaultValue={entry.label}
            key={`sot-${kind}`}
            className={FIELD}
          />
        </div>
      </div>

      <div className="grid gap-4 sm:grid-cols-2">
        <div>
          <label htmlFor="baseUrl" className="mb-1.5 block text-sm font-medium">
            URL de base
          </label>
          <input
            id="baseUrl"
            name="baseUrl"
            type="url"
            placeholder="https://api.exemple.com"
            className={FIELD}
          />
        </div>
        <div>
          <label htmlFor="credentialEnvVar" className="mb-1.5 block text-sm font-medium">
            Variable d’environnement du secret
          </label>
          <input
            id="credentialEnvVar"
            name="credentialEnvVar"
            type="text"
            defaultValue={entry.suggestedEnvVar}
            key={`env-${kind}`}
            pattern="[A-Z][A-Z0-9_]{2,63}"
            className={`${FIELD} font-mono text-[13px]`}
          />
        </div>
      </div>

      <div className="rounded-md border border-amber-200 bg-amber-50 px-4 py-3">
        <p className="text-[13px] leading-relaxed text-amber-900">
          <strong className="font-semibold">Ne collez jamais le secret ici.</strong> Ce champ attend
          le <em>nom</em> de la variable d’environnement ; la valeur se pose dans le coffre de la
          plateforme d’hébergement. La base refuse toute saisie ayant l’apparence d’un jeton.
        </p>
      </div>

      <fieldset>
        <legend className="mb-2 text-sm font-medium">Capacités lues</legend>
        <div className="grid gap-2 sm:grid-cols-2">
          {(Object.keys(CAPABILITY_LABELS) as (keyof typeof CAPABILITY_LABELS)[]).map((capability) => (
            <label key={capability} className="flex items-center gap-2.5 text-sm">
              <input
                type="checkbox"
                name="capabilities"
                value={capability}
                defaultChecked={entry.defaultCapabilities.includes(capability)}
                key={`${kind}-${capability}`}
                className="size-4 rounded border-ink-300"
              />
              {CAPABILITY_LABELS[capability]}
            </label>
          ))}
        </div>
      </fieldset>

      <div className="grid gap-4 sm:grid-cols-2">
        <div>
          <label htmlFor="syncFrequency" className="mb-1.5 block text-sm font-medium">
            Fréquence
          </label>
          <select id="syncFrequency" name="syncFrequency" defaultValue="daily" className={FIELD}>
            <option value="hourly">Horaire</option>
            <option value="daily">Quotidienne</option>
            <option value="weekly">Hebdomadaire</option>
            <option value="on_demand">À la demande</option>
          </select>
        </div>
        <div>
          <label htmlFor="retentionNote" className="mb-1.5 block text-sm font-medium">
            Rétention <span className="font-normal text-ink-500">(facultatif)</span>
          </label>
          <input id="retentionNote" name="retentionNote" type="text" className={FIELD} />
        </div>
      </div>

      <div>
        <label htmlFor="description" className="mb-1.5 block text-sm font-medium">
          Note <span className="font-normal text-ink-500">(facultatif)</span>
        </label>
        <textarea id="description" name="description" rows={2} className={FIELD} />
      </div>

      <Feedback state={state} />

      <button
        type="submit"
        disabled={pending}
        className="self-start rounded-md bg-night-900 px-5 py-2.5 text-sm font-medium text-white hover:bg-night-800 disabled:opacity-60"
      >
        {pending ? 'Enregistrement…' : 'Déclarer le connecteur'}
      </button>
    </form>
  )
}

export function ConnectorActions({
  connectorId,
  status,
}: {
  connectorId: string
  status: string
}) {
  const [testState, testAction, testing] = useActionState<ConnectorState | null, FormData>(
    testConnector,
    null,
  )
  const [statusState, statusAction, changing] = useActionState<ConnectorState | null, FormData>(
    setConnectorStatus,
    null,
  )

  return (
    <div className="flex flex-col items-end gap-2">
      <div className="flex items-center gap-2">
        <form action={testAction}>
          <input type="hidden" name="connectorId" value={connectorId} />
          <button
            type="submit"
            disabled={testing}
            className="rounded-md border border-ink-200 px-3 py-1.5 text-sm text-ink-700 hover:bg-ink-100 disabled:opacity-60"
          >
            {testing ? 'Test…' : 'Tester'}
          </button>
        </form>

        <form action={statusAction} className="flex items-center gap-2">
          <input type="hidden" name="connectorId" value={connectorId} />
          <label htmlFor={`status-${connectorId}`} className="sr-only">
            Statut
          </label>
          <select
            id={`status-${connectorId}`}
            name="status"
            defaultValue={status}
            className="rounded-md border border-ink-200 bg-white px-2.5 py-1.5 text-sm"
          >
            <option value="draft">Brouillon</option>
            <option value="configured">Configuré</option>
            <option value="active">Actif</option>
            <option value="suspended">Suspendu</option>
            <option value="retired">Retiré</option>
          </select>
          <button
            type="submit"
            disabled={changing}
            className="rounded-md border border-ink-200 px-3 py-1.5 text-sm text-ink-700 hover:bg-ink-100 disabled:opacity-60"
          >
            {changing ? '…' : 'Appliquer'}
          </button>
        </form>
      </div>

      {testState ? (
        <p className={`max-w-md text-right text-xs ${testState.ok ? 'text-emerald-700' : 'text-rose-700'}`}>
          {testState.message}
        </p>
      ) : null}
      {statusState && !statusState.ok ? (
        <p className="max-w-md text-right text-xs text-rose-700">{statusState.message}</p>
      ) : null}
    </div>
  )
}

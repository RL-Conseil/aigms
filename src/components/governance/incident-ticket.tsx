'use client'

import { useActionState } from 'react'
import Link from 'next/link'
import { incidentStep, qualifyIncident, type FormState } from '@/lib/actions/operations'
import { Field, FIELD, FormFeedback, Submit } from '@/components/forms'
import { Modal } from '@/components/modal'
import { INCIDENT_TRIGGER_LABELS } from '@/lib/domain/governance'
import { formatDateTime } from '@/lib/domain/governance'

/**
 * Le ticket d'incident, au format du kit de preuve : ce qu'un auditeur lit
 * — la chronologie entre la detection, la qualification, la recommandation
 * d'arret, l'action technique, et les deux signatures de cloture.
 */
export type Ticket = {
  id: string
  business_ref: string
  title: string
  status: string
  kind: string
  severity: string
  detected_at: string
  trigger_source: string
  asset: { name: string } | null
  fundamental_rights_impacted: boolean
  fundamental_rights_detail: string | null
  officer: string | null
  owner: string | null
  qualified_at: string | null
  qualified_by: string | null
  stop_recommended_at: string | null
  stop_recommended_by: string | null
  stop_validated_at: string | null
  stop_validated_by: string | null
  stop_executed_at: string | null
  stop_executed_by: string | null
  stop_note: string | null
  closure_officer_at: string | null
  closure_officer_by: string | null
  closure_owner_at: string | null
  closure_owner_by: string | null
}

const KINDS: [string, string][] = [
  ['incident', 'Incident'],
  ['non_conformity', 'Non-conformité'],
  ['observation', 'Observation'],
  ['near_miss', 'Presque-accident'],
]

function Step({ label, at, by, tone }: { label: string; at: string | null; by: string | null; tone: 'done' | 'todo' | 'wait' }) {
  return (
    <li className="flex items-baseline gap-2 text-xs">
      <span aria-hidden className={`mt-1 size-2 shrink-0 rounded-full ${tone === 'done' ? 'bg-ok-600' : tone === 'todo' ? 'bg-warn-600' : 'bg-ink-300'}`} />
      <span className={at ? 'text-ink-800' : 'text-ink-500'}>
        {label}
        {at ? ` — ${formatDateTime(at)}${by ? ` par ${by}` : ''}` : ''}
      </span>
    </li>
  )
}

function StepButton({
  organizationId,
  incidentId,
  step,
  label,
  withNote,
}: {
  organizationId: string
  incidentId: string
  step: 'recommend' | 'validate' | 'execute' | 'officer_sign' | 'owner_sign'
  label: string
  withNote?: string
}) {
  const [state, formAction, pending] = useActionState<FormState | null, FormData>(incidentStep, null)
  return (
    <form action={formAction} className="flex flex-wrap items-center gap-2">
      <input type="hidden" name="organizationId" value={organizationId} />
      <input type="hidden" name="incidentId" value={incidentId} />
      <input type="hidden" name="step" value={step} />
      {withNote ? (
        <input name="note" type="text" placeholder={withNote} className="min-w-[14rem] flex-1 rounded-md border border-ink-200 px-2.5 py-1.5 text-xs" />
      ) : null}
      <button type="submit" disabled={pending} className="rounded-md border border-ink-200 bg-white px-2.5 py-1.5 text-xs font-medium text-ink-700 hover:bg-ink-100 disabled:opacity-60">
        {pending ? '…' : label}
      </button>
      {state ? <span className={`text-xs ${state.ok ? 'text-ok-600' : 'text-stop-600'}`}>{state.message}</span> : null}
    </form>
  )
}

export function IncidentTicket({
  organizationId,
  ticket,
  people,
  lateQualification,
}: {
  organizationId: string
  ticket: Ticket
  people: { id: string; label: string }[]
  /** Calcule par le serveur : plus de 24 h sans qualification. */
  lateQualification: boolean
}) {
  const [qState, qAction, qPending] = useActionState<FormState | null, FormData>(qualifyIncident, null)
  const closed = ticket.status === 'CLOSED'
  const hours = ticket.qualified_at ? Math.round((new Date(ticket.qualified_at).getTime() - new Date(ticket.detected_at).getTime()) / 36e5) : null

  return (
    <div className="mt-3 rounded-md border border-ink-100 bg-ink-50/60 p-3">
      <div className="flex flex-wrap items-baseline justify-between gap-2">
        <p className="text-xs font-semibold uppercase tracking-wide text-ink-500">Ticket {ticket.business_ref}</p>
        <span className="flex gap-3 text-xs">
          <Link href={`/admin/organizations/${organizationId}/impression/incident/${ticket.id}`} className="text-brand-600 hover:underline">Imprimer</Link>
          <a href={`/admin/organizations/${organizationId}/suivi/incidents/${ticket.id}/export`} className="text-brand-600 hover:underline">Exporter (JSON)</a>
        </span>
      </div>
      <p className="mt-1 text-xs text-ink-600">
        Déclencheur : {INCIDENT_TRIGGER_LABELS[ticket.trigger_source] ?? ticket.trigger_source}
        {ticket.asset ? ` · actif : ${ticket.asset.name}` : ''}
        {` · officer : ${ticket.officer ?? '—'} · porteur : ${ticket.owner ?? '—'}`}
        {ticket.fundamental_rights_impacted ? ` · droits fondamentaux touchés${ticket.fundamental_rights_detail ? ` (${ticket.fundamental_rights_detail})` : ''}` : ''}
      </p>

      <div className="mt-3 grid gap-4 sm:grid-cols-3">
        {/* 1. Qualification sous 24 h */}
        <div>
          <p className="mb-1 text-xs font-medium text-ink-700">Qualification (24 h)</p>
          <ul className="flex flex-col gap-1">
            <Step label="Détecté" at={ticket.detected_at} by={null} tone="done" />
            <Step
              label={ticket.qualified_at ? `Qualifié${hours !== null ? ` en ${hours} h` : ''}` : lateQualification ? 'À qualifier — 24 h dépassées' : 'À qualifier'}
              at={ticket.qualified_at}
              by={ticket.qualified_by}
              tone={ticket.qualified_at ? 'done' : 'todo'}
            />
          </ul>
          {!ticket.qualified_at && !closed ? (
            <Modal trigger="Qualifier" triggerClassName="mt-2 rounded-md bg-night-900 px-2.5 py-1.5 text-xs font-medium text-white hover:bg-night-800" title="Qualifier l’incident" description="Sévérité, nature, droits fondamentaux — un acte daté, en votre nom.">
              {() => (
                <form action={qAction} className="flex flex-col gap-4">
                  <input type="hidden" name="organizationId" value={organizationId} />
                  <input type="hidden" name="incidentId" value={ticket.id} />
                  <div className="grid gap-4 sm:grid-cols-2">
                    <Field label="Nature" htmlFor={`q-kind-${ticket.id}`}>
                      <select id={`q-kind-${ticket.id}`} name="kind" defaultValue={ticket.kind} className={FIELD}>
                        {KINDS.map(([v, l]) => <option key={v} value={v}>{l}</option>)}
                      </select>
                    </Field>
                    <Field label="Sévérité" htmlFor={`q-sev-${ticket.id}`}>
                      <select id={`q-sev-${ticket.id}`} name="severity" defaultValue={ticket.severity} className={FIELD}>
                        {['S1', 'S2', 'S3', 'S4'].map((s) => <option key={s} value={s}>{s}</option>)}
                      </select>
                    </Field>
                  </div>
                  <label className="flex items-start gap-2.5 text-sm text-ink-700">
                    <input type="checkbox" name="fundamentalRightsImpacted" defaultChecked={ticket.fundamental_rights_impacted} className="mt-0.5" />
                    <span className="font-medium text-ink-900">Des droits fondamentaux sont touchés</span>
                  </label>
                  <Field label="Lesquels, comment" htmlFor={`q-rights-${ticket.id}`} optional>
                    <input id={`q-rights-${ticket.id}`} name="fundamentalRightsDetail" type="text" defaultValue={ticket.fundamental_rights_detail ?? ''} className={FIELD} />
                  </Field>
                  <Field label="AI Governance Officer en charge" htmlFor={`q-officer-${ticket.id}`} optional>
                    <select id={`q-officer-${ticket.id}`} name="officerUserId" defaultValue="" className={FIELD}>
                      <option value="">— Inchangé</option>
                      {people.map((p) => <option key={p.id} value={p.id}>{p.label}</option>)}
                    </select>
                  </Field>
                  <FormFeedback state={qState} />
                  <Submit pending={qPending} idle="Qualifier" />
                </form>
              )}
            </Modal>
          ) : null}
        </div>

        {/* 2. Arret d'urgence */}
        <div>
          <p className="mb-1 text-xs font-medium text-ink-700">Arrêt d’urgence (kill-switch)</p>
          <ul className="flex flex-col gap-1">
            <Step label="Recommandé par l’AI Governance Officer" at={ticket.stop_recommended_at} by={ticket.stop_recommended_by} tone={ticket.stop_recommended_at ? 'done' : 'wait'} />
            <Step label="Validé par le Porteur" at={ticket.stop_validated_at} by={ticket.stop_validated_by} tone={ticket.stop_validated_at ? 'done' : ticket.stop_recommended_at ? 'todo' : 'wait'} />
            <Step label="Exécuté (coupure ou mode dégradé)" at={ticket.stop_executed_at} by={ticket.stop_executed_by} tone={ticket.stop_executed_at ? 'done' : ticket.stop_validated_at ? 'todo' : 'wait'} />
          </ul>
          {ticket.stop_note ? <p className="mt-1 text-xs text-ink-500">{ticket.stop_note}</p> : null}
          {!closed ? (
            <div className="mt-2 flex flex-col gap-1.5">
              {!ticket.stop_recommended_at ? <StepButton organizationId={organizationId} incidentId={ticket.id} step="recommend" label="Recommander l’arrêt" withNote="Seuil dépassé, dérive constatée…" /> : null}
              {ticket.stop_recommended_at && !ticket.stop_validated_at ? <StepButton organizationId={organizationId} incidentId={ticket.id} step="validate" label="Valider l’arrêt (Porteur)" /> : null}
              {ticket.stop_validated_at && !ticket.stop_executed_at ? <StepButton organizationId={organizationId} incidentId={ticket.id} step="execute" label="Tracer l’exécution" withNote="Ce qui a été coupé, ou basculé" /> : null}
            </div>
          ) : null}
        </div>

        {/* 3. Double signature */}
        <div>
          <p className="mb-1 text-xs font-medium text-ink-700">Clôture — deux signatures</p>
          <ul className="flex flex-col gap-1">
            <Step label="Validation de l’AI Governance Officer" at={ticket.closure_officer_at} by={ticket.closure_officer_by} tone={ticket.closure_officer_at ? 'done' : 'todo'} />
            <Step label="Approbation du Porteur" at={ticket.closure_owner_at} by={ticket.closure_owner_by} tone={ticket.closure_owner_at ? 'done' : 'todo'} />
          </ul>
          {!closed ? (
            <div className="mt-2 flex flex-col gap-1.5">
              {!ticket.closure_officer_at ? <StepButton organizationId={organizationId} incidentId={ticket.id} step="officer_sign" label="Valider (officer)" /> : null}
              {!ticket.closure_owner_at ? <StepButton organizationId={organizationId} incidentId={ticket.id} step="owner_sign" label="Approuver (Porteur)" /> : null}
              {ticket.closure_officer_at && ticket.closure_owner_at ? (
                <p className="text-xs text-ok-600">Les deux signatures sont là : « Avancer » vers Clos.</p>
              ) : null}
            </div>
          ) : null}
        </div>
      </div>
    </div>
  )
}

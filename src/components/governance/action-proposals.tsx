'use client'

import { useActionState, useState } from 'react'
import { retainSuggestedActions, type FormState } from '@/lib/actions/operations'
import { FIELD, FormFeedback, Submit } from '@/components/forms'
import { Modal } from '@/components/modal'

/**
 * Propositions d'actions pour un cas d'usage.
 *
 * Derivees des ecarts que la plateforme connait — controle non operant, risque
 * non traite, preuve a renouveler, precondition du gate, revue passee, incident
 * sans CAPA. Chaque ligne porte sa source, un responsable PRESSENTI — que
 * l'utilisateur confirme ou change : designer est un acte humain —, une
 * echeance proposee, et si l'action retient le gate PRODUCTION.
 */

export type ActionProposal = {
  key: string
  title: string
  description: string
  source: string
  source_id: string | null
  suggested_owner_id: string | null
  suggested_owner: string | null
  due_in_days: number
  is_blocking: boolean
  reason: string
}

export type ActionSuggestions = { available: boolean; reason?: string; proposals?: ActionProposal[] }

const SOURCE_LABELS: Record<string, string> = {
  control: 'Contrôle',
  risk: 'Risque',
  impact_finding: 'Évaluation d’impact',
  incident: 'Incident',
  management_review: 'Revue',
  manual: 'Gate',
  decision: 'Décision',
  change_request: 'Changement',
  audit_finding: 'Audit',
}

function plusDays(days: number): string {
  const d = new Date()
  d.setDate(d.getDate() + days)
  return d.toISOString().slice(0, 10)
}

type Row = { checked: boolean; ownerUserId: string; dueDate: string; isBlocking: boolean }

export function ActionProposals({
  organizationId,
  useCaseId,
  suggestions,
  people,
}: {
  organizationId: string
  useCaseId: string
  suggestions: ActionSuggestions
  people: { id: string; label: string }[]
}) {
  const [state, formAction, pending] = useActionState<FormState | null, FormData>(
    retainSuggestedActions,
    null,
  )
  const proposals = suggestions.proposals ?? []
  const [rows, setRows] = useState<Record<string, Row>>(() =>
    Object.fromEntries(
      proposals.map((p) => [
        p.key,
        { checked: false, ownerUserId: p.suggested_owner_id ?? '', dueDate: plusDays(p.due_in_days), isBlocking: p.is_blocking },
      ]),
    ),
  )
  const patch = (key: string, change: Partial<Row>) =>
    setRows((prev) => ({ ...prev, [key]: { ...prev[key]!, ...change } }))

  const selections = proposals
    .filter((p) => rows[p.key]?.checked)
    .map((p) => ({
      title: p.title,
      description: p.description,
      source: p.source,
      sourceId: p.source_id,
      ownerUserId: rows[p.key]!.ownerUserId || null,
      dueDate: rows[p.key]!.dueDate,
      isBlocking: rows[p.key]!.isBlocking,
      reason: p.reason,
    }))
  const checkedCount = selections.length
  const allChecked = proposals.length > 0 && proposals.every((p) => rows[p.key]?.checked)

  return (
    <Modal
      trigger="Proposer des actions"
      title="Propositions d’actions"
      description="Dérivées des écarts du cas d’usage. Le responsable est pressenti, pas imposé ; l’échéance se change. Rien ne s’écrit avant que vous ne reteniez."
    >
      {() => (
        <form action={formAction} className="flex flex-col gap-4">
          <input type="hidden" name="organizationId" value={organizationId} />
          <input type="hidden" name="useCaseId" value={useCaseId} />
          <input type="hidden" name="selections" value={JSON.stringify(selections)} />

          {!suggestions.available ? (
            <p className="rounded-md border border-ink-200 bg-ink-50 px-3.5 py-3 text-sm text-ink-600">
              {suggestions.reason ?? 'Aucune proposition.'}
            </p>
          ) : !proposals.length ? (
            <p className="rounded-md border border-ok-600/25 bg-ok-600/5 px-3.5 py-3 text-sm text-ok-600">
              Aucun écart à transformer en action : contrôles opérants, risques traités, preuves valides,
              gate satisfait. Ou des actions sont déjà ouvertes sur chacun.
            </p>
          ) : (
            <>
              <div className="flex items-center justify-between text-xs text-ink-500">
                <span>{proposals.length} proposition(s), du plus bloquant au moins urgent.</span>
                <button
                  type="button"
                  onClick={() => setRows((prev) => Object.fromEntries(Object.entries(prev).map(([k, r]) => [k, { ...r, checked: !allChecked }])))}
                  className="text-brand-600 hover:underline"
                >
                  {allChecked ? 'Tout décocher' : 'Tout cocher'}
                </button>
              </div>

              <ul className="divide-y divide-ink-100 rounded-md border border-ink-200">
                {proposals.map((p) => {
                  const row = rows[p.key]!
                  return (
                    <li key={p.key} className="px-3.5 py-3">
                      <label className="flex items-start gap-3">
                        <input
                          type="checkbox"
                          className="mt-1"
                          checked={row.checked}
                          onChange={(e) => patch(p.key, { checked: e.target.checked })}
                        />
                        <span className="min-w-0 flex-1">
                          <span className="flex flex-wrap items-center gap-2 text-sm">
                            <span className="rounded bg-ink-100 px-1.5 py-0.5 text-[10px] text-ink-600">
                              {SOURCE_LABELS[p.source] ?? p.source}
                            </span>
                            <span className="font-medium text-ink-900">{p.title}</span>
                            {p.is_blocking ? (
                              <span className="rounded bg-stop-600/10 px-1.5 py-0.5 text-[10px] text-stop-600">retient le gate</span>
                            ) : null}
                          </span>
                          <span className="mt-1 block text-xs leading-relaxed text-ink-700">{p.description}</span>
                          <span className="mt-0.5 block text-xs text-ink-500">{p.reason}</span>
                        </span>
                      </label>

                      {row.checked ? (
                        <div className="mt-2 grid gap-3 pl-7 sm:grid-cols-[1fr_150px_auto]">
                          <div>
                            <label htmlFor={`own-${p.key}`} className="mb-1 block text-[11px] font-medium text-ink-600">
                              Responsable{p.suggested_owner ? ` — pressenti : ${p.suggested_owner}` : ''}
                            </label>
                            <select
                              id={`own-${p.key}`}
                              value={row.ownerUserId}
                              onChange={(e) => patch(p.key, { ownerUserId: e.target.value })}
                              className={FIELD}
                            >
                              <option value="">— À désigner</option>
                              {people.map((person) => (
                                <option key={person.id} value={person.id}>
                                  {person.label}
                                </option>
                              ))}
                            </select>
                          </div>
                          <div>
                            <label htmlFor={`due-${p.key}`} className="mb-1 block text-[11px] font-medium text-ink-600">
                              Échéance
                            </label>
                            <input
                              id={`due-${p.key}`}
                              type="date"
                              value={row.dueDate}
                              onChange={(e) => patch(p.key, { dueDate: e.target.value })}
                              className={FIELD}
                            />
                          </div>
                          <label className="flex items-end gap-2 pb-2 text-xs text-ink-700">
                            <input
                              type="checkbox"
                              checked={row.isBlocking}
                              onChange={(e) => patch(p.key, { isBlocking: e.target.checked })}
                            />
                            Bloquante
                          </label>
                        </div>
                      ) : null}
                    </li>
                  )
                })}
              </ul>
            </>
          )}

          <FormFeedback state={state} />
          <div className="flex items-center justify-between gap-3">
            <span className="text-xs text-ink-500">{checkedCount} coché(s)</span>
            <Submit pending={pending} idle={`Ouvrir la sélection${checkedCount ? ` (${checkedCount})` : ''}`} />
          </div>
        </form>
      )}
    </Modal>
  )
}

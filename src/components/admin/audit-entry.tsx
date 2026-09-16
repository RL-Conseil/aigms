'use client'

import { useState } from 'react'
import type { AuditRow } from '@/lib/admin/audit-log'

/**
 * Une ligne du journal, depliable sur son avant/apres.
 *
 * Replie, elle dit qui, quand, quoi. Depliee, elle ne montre que les champs
 * qui ont change — l'etat complet est dans l'export. Une creation montre
 * l'apres, une suppression l'avant.
 */

const TONE: Record<string, string> = {
  delete: 'bg-stop-600/10 text-stop-600',
  gate_blocked: 'bg-stop-600/10 text-stop-600',
  decision_rejected: 'bg-stop-600/10 text-stop-600',
  create: 'bg-ok-600/10 text-ok-600',
  decision_approved: 'bg-ok-600/10 text-ok-600',
  evidence_validated: 'bg-ok-600/10 text-ok-600',
  export: 'bg-warn-600/10 text-warn-600',
  read_sensitive: 'bg-warn-600/10 text-warn-600',
}

function Value({ value }: { value: unknown }) {
  if (value === null || value === undefined) return <span className="text-ink-400">∅</span>
  if (typeof value === 'object') {
    return <code className="whitespace-pre-wrap break-all text-[11px]">{JSON.stringify(value)}</code>
  }
  return <span className="break-all">{String(value)}</span>
}

export function AuditEntry({
  row,
  actionLabel,
  roleLabel,
  when,
  changed,
}: {
  row: AuditRow
  actionLabel: string
  roleLabel: string | null
  when: string
  changed: string[]
}) {
  const [open, setOpen] = useState(false)
  const hasDetail = Boolean(row.before_state || row.after_state || Object.keys(row.metadata ?? {}).length)

  return (
    <li className="py-3 first:pt-0 last:pb-0">
      <div className="flex items-start justify-between gap-3">
        <div className="min-w-0">
          <div className="flex flex-wrap items-center gap-2">
            <span className={`rounded px-1.5 py-0.5 text-[11px] font-medium ${TONE[row.action] ?? 'bg-ink-100 text-ink-700'}`}>
              {actionLabel}
            </span>
            <span className="font-mono text-[11px] text-ink-400">{row.entity_type}</span>
            {row.entity_ref ? <span className="font-mono text-[11px] text-ink-500">{row.entity_ref}</span> : null}
          </div>
          <p className="mt-1 text-sm text-ink-900">{row.summary ?? '—'}</p>
          <p className="text-xs text-ink-500">
            {when} · {row.actor_email ?? 'système'}
            {roleLabel ? ` · ${roleLabel}` : ''}
            {changed.length ? ` · ${changed.length} champ(s) modifié(s)` : ''}
          </p>
        </div>
        {hasDetail ? (
          <button
            type="button"
            onClick={() => setOpen((v) => !v)}
            aria-expanded={open}
            className="shrink-0 rounded-md border border-ink-200 px-2.5 py-1 text-xs text-ink-600 hover:bg-ink-100"
          >
            {open ? 'Replier' : 'Détail'}
          </button>
        ) : null}
      </div>

      {open ? (
        <div className="mt-3 rounded-md border border-ink-100 bg-ink-50 p-3 text-xs">
          {row.action === 'update' && changed.length ? (
            <table className="w-full border-collapse">
              <thead>
                <tr className="text-left text-[11px] text-ink-500">
                  <th className="pb-1 pr-3 font-medium">Champ</th>
                  <th className="pb-1 pr-3 font-medium">Avant</th>
                  <th className="pb-1 font-medium">Après</th>
                </tr>
              </thead>
              <tbody>
                {changed.map((key) => (
                  <tr key={key} className="border-t border-ink-100 align-top">
                    <td className="py-1 pr-3 font-mono text-[11px] text-ink-700">{key}</td>
                    <td className="py-1 pr-3 text-stop-600"><Value value={row.before_state?.[key]} /></td>
                    <td className="py-1 text-ok-600"><Value value={row.after_state?.[key]} /></td>
                  </tr>
                ))}
              </tbody>
            </table>
          ) : (
            <pre className="max-h-72 overflow-auto whitespace-pre-wrap break-all text-[11px] text-ink-700">
              {JSON.stringify(
                row.action === 'delete' ? row.before_state : (row.after_state ?? row.metadata),
                null,
                2,
              )}
            </pre>
          )}
          {Object.keys(row.metadata ?? {}).length && row.action === 'update' ? (
            <p className="mt-2 font-mono text-[11px] text-ink-500">metadata : {JSON.stringify(row.metadata)}</p>
          ) : null}
        </div>
      ) : null}
    </li>
  )
}

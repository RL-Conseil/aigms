'use client'

import { useState, useTransition } from 'react'
import {
  adoptCatalogControl,
  searchControlsForRisk,
  type ControlMatch,
} from '@/lib/actions/controls'
import { CONTROL_STATUS_LABELS } from '@/lib/domain/governance'

/**
 * Trouver le controle qui traite un risque, a partir de ce qu'on a ecrit.
 *
 * L'utilisateur decrit le risque ; la base cherche dans les controles de
 * l'organisation, puis dans les referentiels publies, et propose. Retenir un
 * controle de l'organisation le selectionne ; retenir un controle-type
 * l'ajoute d'abord au registre — porte par le responsable indique — puis le
 * selectionne. « L'assistant propose, l'humain retient » (ADR-0018).
 *
 * Le composant ne possede pas le champ : il rend la liste des options a jour
 * et la valeur choisie a son parent, qui tient le <select>.
 */
export type ControlOption = { id: string; code: string; name: string }

export function ControlFinder({
  organizationId,
  useCaseId,
  /** Ce qu'on a ecrit : intitule et scenario, lus au moment du clic. */
  readQuery,
  ownerUserId,
  onPick,
}: {
  organizationId: string
  useCaseId: string
  readQuery: () => string
  /** Le responsable a donner a un controle-type adopte. */
  ownerUserId?: () => string
  onPick: (option: ControlOption) => void
}) {
  const [matches, setMatches] = useState<ControlMatch[] | null>(null)
  const [message, setMessage] = useState<string | null>(null)
  const [pending, startTransition] = useTransition()
  const [adopting, setAdopting] = useState<string | null>(null)

  function search() {
    const query = readQuery()
    setMessage(null)
    startTransition(async () => {
      const result = await searchControlsForRisk({ organizationId, useCaseId, query })
      if (!result.ok) {
        setMatches(null)
        setMessage(result.message)
        return
      }
      setMatches(result.matches)
      if (!result.matches.length) setMessage('Rien ne correspond : reformuler, ou statuer un contrôle libre.')
    })
  }

  function pick(match: ControlMatch) {
    if (match.source === 'control' && match.control_id) {
      onPick({ id: match.control_id, code: match.code, name: match.name })
      setMatches(null)
      return
    }
    if (!match.catalog_control_id) return
    setAdopting(match.catalog_control_id)
    startTransition(async () => {
      const result = await adoptCatalogControl({
        organizationId,
        catalogControlId: match.catalog_control_id!,
        ownerUserId: ownerUserId?.() || undefined,
      })
      setAdopting(null)
      if (!result.ok) {
        setMessage(result.message)
        return
      }
      onPick({ id: result.controlId, code: result.code, name: result.name })
      setMatches(null)
      setMessage(`${result.code} ajouté au registre des contrôles, à l’état « proposé », et retenu.`)
    })
  }

  return (
    <div className="rounded-md border border-dashed border-ink-200 bg-ink-50/60 px-3.5 py-3">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <p className="text-xs text-ink-600">
          Pas sûr du contrôle ? L’assistant cherche, d’après l’intitulé et le scénario, dans le registre et
          les référentiels.
        </p>
        <button
          type="button"
          onClick={search}
          disabled={pending}
          className="rounded-md border border-ink-200 bg-white px-3 py-1.5 text-xs font-medium text-ink-700 hover:bg-ink-100 disabled:opacity-60"
        >
          {pending && !adopting ? 'Recherche…' : 'Chercher un contrôle approprié'}
        </button>
      </div>

      {message ? <p className="mt-2 text-xs text-ink-600">{message}</p> : null}

      {matches?.length ? (
        <ul className="mt-3 flex flex-col divide-y divide-ink-100 rounded-md border border-ink-200 bg-white">
          {matches.map((m) => (
            <li key={`${m.source}-${m.control_id ?? m.catalog_control_id}`} className="flex items-start justify-between gap-3 px-3 py-2">
              <div className="min-w-0">
                <p className="text-sm text-ink-900">
                  <span className="font-mono text-xs text-ink-500">{m.code}</span> {m.name}
                </p>
                <p className="text-xs text-ink-500">
                  {m.source === 'catalog'
                    ? 'Référentiel — sera ajouté au registre'
                    : `Registre · ${CONTROL_STATUS_LABELS[m.status] ?? m.status}${m.applicable ? ' · déjà applicable à ce cas d’usage' : ''}`}
                </p>
                {m.why ? <p className="mt-0.5 text-xs text-ink-400">{m.why}</p> : null}
              </div>
              <button
                type="button"
                onClick={() => pick(m)}
                disabled={pending}
                className="shrink-0 rounded-md bg-night-900 px-2.5 py-1 text-xs font-medium text-white hover:bg-night-800 disabled:opacity-60"
              >
                {adopting === m.catalog_control_id ? 'Ajout…' : 'Retenir'}
              </button>
            </li>
          ))}
        </ul>
      ) : null}
    </div>
  )
}

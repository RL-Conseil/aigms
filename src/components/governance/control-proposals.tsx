'use client'

import { useActionState, useMemo, useState } from 'react'
import { retainSuggestedControls, type FormState } from '@/lib/actions/controls'
import { FormFeedback, Submit } from '@/components/forms'
import { Modal } from '@/components/modal'

/**
 * Propositions de controles pour un cas d'usage.
 *
 * L'assistant propose, l'humain retient. Les propositions viennent de
 * `app.suggest_controls` — regles d'applicabilite, faits du cas d'usage, role
 * de l'organisation — et chacune porte son motif. On coche, on retient, rien
 * ne s'ecrit avant.
 *
 * Trois rangs selon le role : ce qu'on lit d'abord, ensuite, et ce qui n'est
 * la que parce qu'un fait l'a declenche. Trois etats : deja affecte (grise),
 * present dans la liste operationnelle mais pas affecte, a ajouter depuis le
 * referentiel.
 */

export type Proposal = {
  catalog_control_id: string
  framework_code: string
  code: string
  title: string
  domain_code: string
  domain_name: string
  phase: string | null
  tier: 'core' | 'relevant' | 'secondary'
  mandatory: boolean
  reasons: string[]
  state: 'already_affected' | 'operational_not_affected' | 'to_add'
  control_id: string | null
  tools: { code: string; acronym: string | null; automation: string | null }[]
}

export type Suggestions = {
  available: boolean
  reason?: string
  facts?: string[]
  profile?: string | null
  proposals?: Proposal[]
}

const TIER_LABELS: Record<Proposal['tier'], { title: string; hint: string }> = {
  core: { title: 'À lire d’abord', hint: 'Les domaines au cœur du rôle de l’organisation.' },
  relevant: { title: 'Ensuite', hint: 'Pertinents pour ce rôle, sans être au premier plan.' },
  secondary: { title: 'Déclenchés par un fait', hint: 'Hors du cœur du rôle, mais un fait du cas d’usage les appelle.' },
}

const FACT_LABELS: Record<string, string> = {
  personal_data: 'données personnelles',
  vulnerable_persons: 'personnes vulnérables',
  autonomy_gte_l3: 'autonomie L3 ou plus',
  criticality_high: 'criticité élevée ou critique',
  external_vendor: 'fournisseur tiers',
  model_provider: 'fournisseur de modèle',
  role_host: 'rôle : hébergeur',
  role_developer: 'rôle : développeur',
  role_integrator: 'rôle : intégrateur',
  role_business_user: 'rôle : utilisateur métier',
}

export function ControlProposals({
  organizationId,
  useCaseId,
  suggestions,
}: {
  organizationId: string
  useCaseId: string
  suggestions: Suggestions
}) {
  const [state, formAction, pending] = useActionState<FormState | null, FormData>(
    retainSuggestedControls,
    null,
  )
  const proposals = useMemo(() => suggestions.proposals ?? [], [suggestions.proposals])
  const selectable = proposals.filter((p) => p.state !== 'already_affected')
  const [checked, setChecked] = useState<Set<string>>(new Set())
  const [openTiers, setOpenTiers] = useState<Set<string>>(new Set(['core']))

  const toggle = (id: string) =>
    setChecked((prev) => {
      const next = new Set(prev)
      if (next.has(id)) next.delete(id)
      else next.add(id)
      return next
    })
  const toggleTier = (tier: string) =>
    setOpenTiers((prev) => {
      const next = new Set(prev)
      if (next.has(tier)) next.delete(tier)
      else next.add(tier)
      return next
    })
  const checkAll = (ids: string[]) =>
    setChecked((prev) => {
      const next = new Set(prev)
      const all = ids.every((id) => next.has(id))
      for (const id of ids) {
        if (all) next.delete(id)
        else next.add(id)
      }
      return next
    })

  const selections = proposals
    .filter((p) => checked.has(p.catalog_control_id))
    .map((p) => ({ catalogControlId: p.catalog_control_id, controlId: p.control_id, reason: p.reasons.join(' ') }))

  const tiers = (['core', 'relevant', 'secondary'] as const)
    .map((tier) => ({ tier, items: proposals.filter((p) => p.tier === tier) }))
    .filter((t) => t.items.length)

  return (
    <Modal
      trigger="Proposer des contrôles"
      title="Propositions de contrôles"
      description="Calculées depuis le référentiel, le rôle de l’organisation et les faits du cas d’usage. Rien ne s’écrit avant que vous ne reteniez."
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
          ) : (
            <>
              <p className="text-xs leading-relaxed text-ink-500">
                Ce que l’assistant a lu :{' '}
                {(suggestions.facts ?? []).length
                  ? (suggestions.facts ?? []).map((f) => FACT_LABELS[f] ?? f).join(' · ')
                  : 'aucun fait particulier'}
                . {proposals.length} proposition(s), {selectable.length} à retenir,{' '}
                {proposals.length - selectable.length} déjà affectée(s).
              </p>

              {tiers.map(({ tier, items }) => {
                const ids = items.filter((p) => p.state !== 'already_affected').map((p) => p.catalog_control_id)
                const open = openTiers.has(tier)
                return (
                  <section key={tier} className="rounded-md border border-ink-200">
                    <div className="flex items-center justify-between gap-3 px-3.5 py-2.5">
                      <button
                        type="button"
                        onClick={() => toggleTier(tier)}
                        aria-expanded={open}
                        className="min-w-0 flex-1 text-left"
                      >
                        <span className="block text-sm font-semibold text-ink-900">
                          {TIER_LABELS[tier].title}{' '}
                          <span className="font-normal text-ink-500">· {items.length}</span>
                        </span>
                        <span className="block text-xs text-ink-500">{TIER_LABELS[tier].hint}</span>
                      </button>
                      {ids.length ? (
                        <button
                          type="button"
                          onClick={() => checkAll(ids)}
                          className="shrink-0 text-xs text-brand-600 hover:underline"
                        >
                          {ids.every((id) => checked.has(id)) ? 'Tout décocher' : 'Tout cocher'}
                        </button>
                      ) : null}
                    </div>

                    {open ? (
                      <ul className="divide-y divide-ink-100 border-t border-ink-100">
                        {items.map((p) => {
                          const affected = p.state === 'already_affected'
                          return (
                            <li key={p.catalog_control_id} className={`px-3.5 py-2.5 ${affected ? 'opacity-60' : ''}`}>
                              <label className="flex items-start gap-3">
                                <input
                                  type="checkbox"
                                  className="mt-1"
                                  disabled={affected}
                                  checked={affected || checked.has(p.catalog_control_id)}
                                  onChange={() => toggle(p.catalog_control_id)}
                                />
                                <span className="min-w-0 flex-1">
                                  <span className="flex flex-wrap items-center gap-2 text-sm">
                                    <span className="font-mono text-xs text-ink-400">{p.code}</span>
                                    <span className="font-medium text-ink-900">{p.title}</span>
                                    {p.state === 'already_affected' ? (
                                      <span className="rounded bg-ink-100 px-1.5 py-0.5 text-[10px] text-ink-600">déjà affecté</span>
                                    ) : p.state === 'operational_not_affected' ? (
                                      <span className="rounded bg-warn-600/10 px-1.5 py-0.5 text-[10px] text-warn-600">dans la liste, à affecter</span>
                                    ) : (
                                      <span className="rounded bg-brand-500/10 px-1.5 py-0.5 text-[10px] text-brand-700">à ajouter depuis le référentiel</span>
                                    )}
                                  </span>
                                  <span className="mt-0.5 block text-xs text-ink-500">
                                    {p.domain_code} · {p.domain_name}
                                    {p.phase ? ` · ${p.phase}` : ''}
                                  </span>
                                  <span className="mt-1 block text-xs leading-relaxed text-ink-700">
                                    {p.reasons.join(' ')}
                                  </span>
                                  {p.tools.length ? (
                                    <span className="mt-1 block text-xs text-ink-500">
                                      Se tient avec :{' '}
                                      {p.tools.map((t) => t.acronym ?? t.code).join(', ')}
                                    </span>
                                  ) : null}
                                </span>
                              </label>
                            </li>
                          )
                        })}
                      </ul>
                    ) : null}
                  </section>
                )
              })}
            </>
          )}

          <FormFeedback state={state} />
          <div className="flex items-center justify-between gap-3">
            <span className="text-xs text-ink-500">{checked.size} coché(s)</span>
            <Submit pending={pending} idle={`Retenir la sélection${checked.size ? ` (${checked.size})` : ''}`} />
          </div>
        </form>
      )}
    </Modal>
  )
}

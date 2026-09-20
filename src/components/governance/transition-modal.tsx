'use client'

import { useState } from 'react'
import { Modal } from '@/components/modal'
import { TransitionPanel } from '@/components/transition-panel'
import { DecisionForm } from '@/components/governance/decision-forms'
import { ChangeRequestFields } from '@/components/governance/operations-forms'
import { USE_CASE_STATUS_LABELS, type UseCaseStatus } from '@/lib/domain/governance'

/**
 * « Faire évoluer », la porte unique — a trois intentions.
 *
 *   * Franchir un jalon : les jalons NON engageants (triage, evaluation,
 *     revue, surveillance, retours) — une transition immediate, avec motif.
 *   * Decider : les jalons ENGAGEANTS (approuve, pilote, production,
 *     suspension, retrait) — c'est la decision, approuvee, qui franchira.
 *   * Prevoir un changement du systeme : une evolution a une date prevue,
 *     que le moteur de reevaluation lit — pas un jalon.
 *
 * Trois choses differentes, une seule porte : on ne se demande plus laquelle
 * des trois fenetres ouvrir.
 */
const ENGAGING: UseCaseStatus[] = ['APPROVED', 'CONDITIONAL_APPROVAL', 'REJECTED', 'PILOT', 'PRODUCTION', 'SUSPENDED', 'RETIRED']

type Intent = 'step' | 'decide' | 'change'

export function TransitionModal({
  useCaseId,
  organizationId,
  status,
  targets,
  unsettledRisks,
  unassessedRisks,
  currentAutonomy,
  decisionTypes,
  people,
  evidence,
}: {
  useCaseId: string
  organizationId: string
  status: UseCaseStatus
  targets: UseCaseStatus[]
  unsettledRisks: number
  unassessedRisks: number
  currentAutonomy: string
  decisionTypes: string[]
  people: { userId: string; label: string }[]
  evidence: { id: string; business_ref: string; title: string }[]
}) {
  const steps = targets.filter((t) => !ENGAGING.includes(t))
  const engaging = targets.filter((t) => ENGAGING.includes(t))
  const [intent, setIntent] = useState<Intent | null>(null)

  const INTENTS: { key: Intent; title: string; body: string; available: boolean }[] = [
    {
      key: 'step',
      title: 'Franchir un jalon',
      body: steps.length
        ? `Vers ${steps.map((t) => USE_CASE_STATUS_LABELS[t]).join(', ')} — tout de suite, avec un motif. Le gate de Revue reste le juge.`
        : 'Aucun jalon simple depuis ce statut : les suivants se décident.',
      available: steps.length > 0,
    },
    {
      key: 'decide',
      title: 'Décider',
      body: engaging.length || decisionTypes.length
        ? `Approuvé, pilote, production, suspension, retrait — un acte de gouvernance : approuvée, la décision franchit le jalon à sa date d’effet.${engaging.length ? ` D’ici : ${engaging.map((t) => USE_CASE_STATUS_LABELS[t]).join(', ')}.` : ''}`
        : 'Rien à décider depuis ce statut.',
      available: decisionTypes.length > 0,
    },
    {
      key: 'change',
      title: 'Prévoir un changement du système',
      body: 'Modèle, données, finalité, fournisseur, autonomie, population… à une date prévue. Le moteur dit ce qu’il rouvre, et si une décision s’impose. Le statut ne bouge pas.',
      available: status !== 'RETIRED',
    },
  ]

  return (
    <Modal
      trigger="Faire évoluer"
      triggerClassName="rounded-md bg-night-900 px-3.5 py-1.5 text-xs font-medium text-white hover:bg-night-800"
      title="Faire évoluer le cas d’usage"
      description={`Statut courant : ${USE_CASE_STATUS_LABELS[status]}. Trois intentions, une porte.`}
      closeOnSuccess={intent === 'change' || intent === 'decide'}
    >
      {() => (
        <div className="flex flex-col gap-4">
          <nav aria-label="Intention" className="grid gap-2 sm:grid-cols-3">
            {INTENTS.map((option) => (
              <button
                key={option.key}
                type="button"
                disabled={!option.available}
                aria-pressed={intent === option.key}
                onClick={() => setIntent(option.key)}
                className={`rounded-md border px-3 py-2.5 text-left transition-colors disabled:cursor-not-allowed disabled:opacity-50 ${
                  intent === option.key
                    ? 'border-night-900 bg-night-900 text-white'
                    : 'border-ink-200 bg-white hover:bg-ink-50'
                }`}
              >
                <span className="block text-sm font-semibold">{option.title}</span>
                <span className={`mt-0.5 block text-xs leading-relaxed ${intent === option.key ? 'text-white/80' : 'text-ink-500'}`}>
                  {option.body}
                </span>
              </button>
            ))}
          </nav>

          {intent === 'step' ? (
            <TransitionPanel
              useCaseId={useCaseId}
              targets={steps}
              unsettledRisks={unsettledRisks}
              unassessedRisks={unassessedRisks}
            />
          ) : intent === 'decide' ? (
            <DecisionForm
              organizationId={organizationId}
              useCases={[]}
              people={people}
              fixedUseCaseId={useCaseId}
              allowedTypes={decisionTypes}
              evidence={evidence}
            />
          ) : intent === 'change' ? (
            <ChangeRequestFields organizationId={organizationId} useCaseId={useCaseId} currentAutonomy={currentAutonomy} />
          ) : (
            <p className="text-sm text-ink-500">Choisir ce que l’on veut faire.</p>
          )}
        </div>
      )}
    </Modal>
  )
}

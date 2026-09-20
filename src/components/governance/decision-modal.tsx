'use client'

import { Modal } from '@/components/modal'
import { DecisionForm } from '@/components/governance/decision-forms'

/**
 * Decider, depuis la fiche du cas d'usage.
 *
 * La decision se prend la ou l'on lit le dossier — pas dans le registre.
 * Les types proposes sont ceux qui ont un sens au jalon courant ; le cas
 * d'usage est fixe ; les preuves validees se rattachent a la soumission.
 */
export function DecisionModal({
  organizationId,
  useCaseId,
  allowedTypes,
  people,
  evidence,
  trigger = 'Soumettre une décision',
}: {
  organizationId: string
  useCaseId: string
  allowedTypes: string[]
  people: { userId: string; label: string }[]
  evidence: { id: string; business_ref: string; title: string }[]
  trigger?: string
}) {
  return (
    <Modal
      trigger={trigger}
      title="Décider"
      description="Un acte de gouvernance : approuvée, la décision franchit le jalon qu’elle porte. Contexte et justification exigés."
    >
      {() => (
        <DecisionForm
          organizationId={organizationId}
          useCases={[]}
          people={people}
          fixedUseCaseId={useCaseId}
          allowedTypes={allowedTypes}
          evidence={evidence}
        />
      )}
    </Modal>
  )
}

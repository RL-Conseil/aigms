'use client'

import { Modal } from '@/components/modal'
import { TransitionPanel } from '@/components/transition-panel'
import type { UseCaseStatus } from '@/lib/domain/governance'

/**
 * « Faire évoluer », depuis l'en-tete de la fiche.
 *
 * La fenetre recoit une fonction de rendu : elle ne peut donc s'ecrire que
 * cote client — un composant serveur ne passe pas de fonction a un composant
 * client. D'ou ce petit composant, qui n'a pas d'autre raison d'etre.
 */
export function TransitionModal({
  useCaseId,
  targets,
  unsettledRisks,
  unassessedRisks,
}: {
  useCaseId: string
  targets: UseCaseStatus[]
  unsettledRisks: number
  unassessedRisks: number
}) {
  return (
    <Modal
      closeOnSuccess={false}
      trigger="Faire évoluer"
      triggerClassName="rounded-md bg-night-900 px-3.5 py-1.5 text-xs font-medium text-white hover:bg-night-800"
      title="Faire évoluer le cas d’usage"
      description="Le serveur vérifie les préconditions ; un refus dit quoi corriger."
    >
      {() => (
        <TransitionPanel
          useCaseId={useCaseId}
          targets={targets}
          unsettledRisks={unsettledRisks}
          unassessedRisks={unassessedRisks}
        />
      )}
    </Modal>
  )
}

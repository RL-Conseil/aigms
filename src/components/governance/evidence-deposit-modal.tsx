'use client'

import { Modal } from '@/components/modal'
import { EvidenceUploadForm, type ControlChoice, type TypologyChoice } from '@/components/governance/evidence-forms'

/**
 * Deposer une preuve sans quitter la fiche.
 *
 * Le depot est le meme qu'au registre — la piece, ce qu'elle demontre, le
 * controle qu'elle prouve — mais il s'ouvre la ou l'on lit ce qui manque, le
 * controle deja choisi. Naviguer vers le registre pour revenir ensuite
 * faisait perdre le fil.
 */
export function EvidenceDepositModal({
  organizationId,
  controls,
  typologies,
  defaultControlId,
  useCaseId,
  trigger = 'Déposer une preuve',
  triggerClassName,
}: {
  organizationId: string
  controls: ControlChoice[]
  typologies: TypologyChoice[]
  defaultControlId?: string
  useCaseId?: string
  trigger?: string
  triggerClassName?: string
}) {
  return (
    <Modal
      trigger={trigger}
      triggerClassName={triggerClassName}
      title="Déposer une preuve"
      description="Un dépôt n’est pas une validation : la pièce arrivera « à valider »."
    >
      {() =>
        controls.length || typologies.length ? (
          <EvidenceUploadForm
            organizationId={organizationId}
            controls={controls}
            typologies={typologies}
            defaultControlId={defaultControlId}
            useCaseId={useCaseId}
          />
        ) : (
          <p className="text-sm text-ink-600">Aucun contrôle auquel rattacher une preuve pour l’instant.</p>
        )
      }
    </Modal>
  )
}

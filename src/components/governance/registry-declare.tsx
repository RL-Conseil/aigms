'use client'

import { Modal } from '@/components/modal'
import { AssetForm, VendorForm } from '@/components/governance/registry-forms'

/**
 * Declarer un actif d'IA ou un fournisseur sans quitter la page : le registre
 * qu'on lit est celui qu'on alimente. Les formulaires sont ceux de la page
 * d'inscription — une seule fiche, quel que soit l'endroit d'ou on declare.
 */
export function DeclareAssetModal({
  organizationId,
  vendors,
  people,
  trigger = 'Déclarer un actif d’IA',
  triggerClassName,
}: {
  organizationId: string
  vendors: { id: string; name: string }[]
  people: { id: string; label: string }[]
  trigger?: string
  triggerClassName?: string
}) {
  return (
    <Modal
      trigger={trigger}
      triggerClassName={triggerClassName}
      title="Déclarer un actif d’IA"
      description="Système, modèle, agent ou jeu de données que l’organisation emploie. Sa gouvernance se pose ensuite par les cas d’usage qui l’emploient."
    >
      {() => <AssetForm organizationId={organizationId} vendors={vendors} people={people} />}
    </Modal>
  )
}

export function DeclareVendorModal({
  organizationId,
  trigger = 'Déclarer un fournisseur',
  triggerClassName,
}: {
  organizationId: string
  trigger?: string
  triggerClassName?: string
}) {
  return (
    <Modal
      trigger={trigger}
      triggerClassName={triggerClassName}
      title="Déclarer un fournisseur"
      description="Un tiers impliqué : sa revue (DPA, sécurité, réversibilité) est une précondition de production."
    >
      {() => <VendorForm organizationId={organizationId} />}
    </Modal>
  )
}

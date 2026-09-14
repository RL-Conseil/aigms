import { notFound } from 'next/navigation'
import Link from 'next/link'
import { createClient } from '@/lib/supabase/server'
import { Shell } from '@/components/shell'
import { Card, Empty } from '@/components/ui'
import { InfoTip } from '@/components/info-tip'
import {
  OrganizationIdentityForm,
  OrganizationLogoForm,
} from '@/components/admin/forms'
import { documentIdentity } from '@/lib/governance/document-identity'
import { getViewerContext, isAdministrating } from '@/lib/auth/context'
import { ROLE_LABELS } from '@/lib/domain/roles'

/**
 * Identite documentaire de l'organisation.
 *
 * Reservee a l'administration, comme le role vis-a-vis de l'IA : ce qui figure
 * en en-tete d'une declaration d'applicabilite remise a un auditeur n'est pas
 * un reglage d'affichage que chacun ajuste.
 */
export default async function OrganizationIdentityPage({
  params,
}: {
  params: Promise<{ id: string }>
}) {
  const { id } = await params
  const viewer = await getViewerContext()
  const supabase = await createClient()

  const { data: organization } = await supabase
    .from('organization')
    .select(
      `id, name, legal_name, address_line1, address_line2, postal_code, city,
       registration_number, vat_number, website, contact_name, contact_email,
       contact_phone, confidentiality_label, document_footer_note`,
    )
    .eq('id', id)
    .maybeSingle()

  if (!organization) notFound()

  if (!isAdministrating(viewer)) {
    return (
      <Shell
        breadcrumb={[
          { href: '/admin/organizations', label: 'Organisations' },
          { href: `/admin/organizations/${id}`, label: organization.name },
        ]}
        organization={{ id, section: 'apercu' }}
        title="Identité documentaire"
      >
        <Card title="Accès réservé">
          <Empty>
            L’identité portée par les documents remis relève de l’administration de la plateforme.
            Votre rôle — {viewer?.role ? ROLE_LABELS[viewer.role] : 'non attribué'} — ne l’inclut
            pas.
          </Empty>
        </Card>
      </Shell>
    )
  }

  const identity = await documentIdentity(id)

  return (
    <Shell
      breadcrumb={[
        { href: '/admin/organizations', label: 'Organisations' },
        { href: `/admin/organizations/${id}`, label: organization.name },
      ]}
      organization={{ id, section: 'apercu' }}
      title="Identité documentaire"
      subtitle="Ce que porteront les documents sortis de l’outil : en-tête, logo, mention de confidentialité."
      actions={
        <div className="flex items-center gap-3">
          <Link
            href={`/admin/organizations/${id}/impression/registre`}
            className="rounded-md border border-ink-200 px-3.5 py-2 text-sm text-ink-700 hover:bg-ink-100"
          >
            Aperçu du registre
          </Link>
          <InfoTip label="À quoi servent ces informations" title="Un document qui se remet tel quel">
            <div className="flex flex-col gap-3 text-sm leading-relaxed text-ink-600">
              <p>
                Une déclaration d’applicabilité remise à un auditeur n’est pas une capture d’écran.
                Elle porte le nom légal de l’organisation, son adresse, son immatriculation, son
                logo, et la mention sous laquelle elle circule.
              </p>
              <p>
                <strong className="font-medium text-ink-800">Rien de tout cela ne gouverne.</strong>{' '}
                Aucun gate ne lit ces champs, aucun risque n’en dépend. Ils sont néanmoins
                journalisés : le nom légal qui figure sur une pièce remise n’est pas un détail
                d’affichage.
              </p>
              <p>
                <strong className="font-medium text-ink-800">Le logo vit dans un espace privé.</strong>{' '}
                Il n’est pas servi publiquement à qui devine son adresse : chaque affichage passe
                par un lien signé, valable une heure.
              </p>
            </div>
          </InfoTip>
        </div>
      }
    >
      <div className="grid max-w-5xl gap-5 lg:grid-cols-[1fr_320px]">
        <Card
          title="En-tête et pied de page"
          subtitle="Repris à l’identique par le registre et la déclaration d’applicabilité."
        >
          <OrganizationIdentityForm organization={organization} />
        </Card>

        <Card title="Logo" subtitle="Porté en haut de chaque page imprimée.">
          <OrganizationLogoForm organizationId={id} logoUrl={identity?.logoUrl ?? null} />
        </Card>
      </div>
    </Shell>
  )
}

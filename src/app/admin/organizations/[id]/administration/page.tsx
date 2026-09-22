import { notFound } from 'next/navigation'
import Link from 'next/link'
import { createClient } from '@/lib/supabase/server'
import { Shell } from '@/components/shell'
import { organizationReadiness } from '@/lib/governance/readiness'
import { ReadinessCard } from '@/components/governance/readiness-banner'
import { RegistryImportForm } from '@/components/governance/registry-import'
import { Badge, Card, Empty } from '@/components/ui'
import { InfoTip } from '@/components/info-tip'
import { OrganizationIdentityForm, OrganizationLogoForm } from '@/components/admin/forms'
import { ActivityProfileForm } from '@/components/governance/activity-profile-form'
import { documentIdentity } from '@/lib/governance/document-identity'
import { getViewerContext, isAdministrating } from '@/lib/auth/context'
import { ROLE_LABELS } from '@/lib/domain/roles'
import { ACTIVITY_PROFILE_LABELS, type ActivityProfile } from '@/lib/domain/activity-profile'

/**
 * Administration d'une organisation.
 *
 * Tout ce qui se regle sur une organisation sans etre un acte de gouvernance :
 * son nom, son role vis-a-vis de l'IA, l'identite que portent ses documents,
 * son logo. Reserve a l'administration de la plateforme, et retire de la vue
 * d'ensemble — la ou l'on gouverne, on ne reconfigure pas.
 *
 * Il n'y a pas de suppression, et la base la refuse (migration 0038) : une
 * organisation s'archive, pour que ses decisions et ses preuves restent
 * lisibles.
 */
export default async function OrganizationAdministrationPage({
  params,
}: {
  params: Promise<{ id: string }>
}) {
  const { id } = await params
  const viewer = await getViewerContext()
  const supabase = await createClient()

  const { data: organization, error } = await supabase
    .from('organization')
    .select(
      `id, name, business_ref, status, ai_activity_profile, legal_name,
       address_line1, address_line2, postal_code, city,
       registration_number, vat_number, website, contact_name, contact_email,
       contact_phone, confidentiality_label, document_footer_note`,
    )
    .eq('id', id)
    .maybeSingle()

  // Une colonne absente — schema en retard sur le code — n'est pas une
  // organisation introuvable : l'erreur se lit en clair, elle ne se deguise
  // pas en 404.
  if (error) throw new Error(`Lecture de l’organisation refusée : ${error.message}`)
  if (!organization) notFound()
  const readiness = await organizationReadiness(id)

  const breadcrumb = [
    { href: '/admin/organizations', label: 'Organisations' },
    { href: `/admin/organizations/${id}`, label: organization.name },
    { label: 'Administration' },
  ]

  if (!isAdministrating(viewer)) {
    return (
      <Shell breadcrumb={breadcrumb} title="Administration">
        <Card title="Accès réservé">
          <Empty>
            Le nom, le rôle vis-à-vis de l’IA et l’identité portée par les documents relèvent de
            l’administration de la plateforme. Votre rôle —{' '}
            {viewer?.role ? ROLE_LABELS[viewer.role] : 'non attribué'} — ne l’inclut pas.
          </Empty>
        </Card>
      </Shell>
    )
  }

  const identity = await documentIdentity(id)
  const profile = (organization.ai_activity_profile ?? null) as ActivityProfile | null

  return (
    <Shell
      breadcrumb={breadcrumb}
      title={`Administrer ${organization.name}`}
      subtitle="Nom, rôle vis-à-vis de l’IA, identité des documents remis, logo."
      actions={
        <div className="flex items-center gap-3">
          <Badge tone="info">{organization.business_ref}</Badge>
          <Badge>{organization.status}</Badge>
          <Link
            href={`/admin/organizations/${id}`}
            className="rounded-md border border-ink-200 px-3.5 py-2 text-sm text-ink-700 hover:bg-ink-100"
          >
            Vue d’ensemble
          </Link>
          <InfoTip label="Ce que cet écran règle" title="Configurer n’est pas gouverner">
            <div className="flex flex-col gap-3 text-sm leading-relaxed text-ink-600">
              <p>
                Ce qui se règle ici ne relève d’aucun acte de gouvernance : aucun gate ne lit ces
                champs, aucun risque n’en dépend. C’est pourquoi ils ont quitté la vue d’ensemble,
                où l’on gouverne, et sont réservés à l’administration.
              </p>
              <p>
                <strong className="font-medium text-ink-800">Le rôle vis-à-vis de l’IA</strong> est
                l’exception : le changer requalifie la criticité de chaque typologie de preuve,
                donc ce que la Déclaration d’Applicabilité exige. Il se change ici, et il est
                journalisé.
              </p>
              <p>
                <strong className="font-medium text-ink-800">Il n’y a pas de suppression.</strong>{' '}
                Une organisation s’archive — statut « archived » — pour que ses décisions et ses
                preuves restent lisibles. La base refuse toute suppression, quel que soit le rôle.
              </p>
            </div>
          </InfoTip>
        </div>
      }
    >
      <div className="grid max-w-5xl gap-5 lg:grid-cols-[1fr_320px]">
        <div className="flex flex-col gap-5">
          <Card
            title="Identité"
            subtitle="Le nom d’usage des écrans ; la raison sociale, l’adresse et les mentions des documents remis."
          >
            <OrganizationIdentityForm organization={organization} />
          </Card>

          {/*
            Reprise de donnees : l'inventaire des actifs et le registre des
            fournisseurs existent presque toujours ailleurs (CMDB, registre des
            traitements, tableur). L'administration peut les verser — c'est une
            reprise, pas un acte de gouvernance. Voir docs/admin/IMPORTER_ACTIFS_ET_FOURNISSEURS.md.
          */}
          {/*
            Un atelier de decouverte recense dix a trente usages en deux
            heures : les ressaisir un a un est ce qui fait deborder l'atelier.
          */}
          <Card
            title="Importer les cas d’usage"
            subtitle="Depuis la feuille d’un atelier de découverte ou un tableur. Le statut ne s’importe jamais : chaque usage entre en brouillon et franchit ses jalons par la transition."
          >
            <RegistryImportForm organizationId={id} what="cas d’usage" />
          </Card>
          <Card
            title="Importer les actifs d’IA"
            subtitle="Depuis une CMDB, un registre des traitements ou un tableur. Rapprochement par nom : une ligne connue met à jour, une nouvelle crée."
          >
            <RegistryImportForm organizationId={id} what="actifs" />
          </Card>
          <Card
            title="Importer les fournisseurs"
            subtitle="Fournisseurs de modèles, d’hébergement, de services. Chaque fournisseur créé arrive « revue non commencée »."
          >
            <RegistryImportForm organizationId={id} what="fournisseurs" />
          </Card>
        </div>

        <div className="flex flex-col gap-5">
          {readiness ? (
            <Card
              title="Les six rôles"
              subtitle={readiness.ready ? 'Organisation opérationnelle' : `${readiness.missing.length} rôle(s) sans titulaire`}
              tone={readiness.ready ? 'neutral' : 'warn'}
              action={
                <Link href="/admin/comptes" className="text-xs font-medium text-brand-600 hover:underline">
                  Comptes et rôles
                </Link>
              }
            >
              <ReadinessCard readiness={readiness} />
            </Card>
          ) : null}
          <Card
            title="Rôle de l’organisation vis-à-vis de l’IA"
            subtitle={profile ? ACTIVITY_PROFILE_LABELS[profile] : 'Non renseigné'}
          >
            <ActivityProfileForm organizationId={id} current={profile} />
          </Card>

          <Card title="Logo" subtitle="Porté en haut de chaque page imprimée.">
            <OrganizationLogoForm organizationId={id} logoUrl={identity?.logoUrl ?? null} />
          </Card>
        </div>
      </div>
    </Shell>
  )
}

import { Shell } from '@/components/shell'
import { Card, Empty } from '@/components/ui'
import { OrganizationForm } from '@/components/admin/forms'
import { getViewerContext, isAdministrating } from '@/lib/auth/context'
import { ROLE_LABELS } from '@/lib/domain/roles'

export default async function NewOrganizationPage() {
  const viewer = await getViewerContext()

  if (!isAdministrating(viewer)) {
    return (
      <Shell title="Nouvelle organisation">
        <Card title="Accès réservé">
          <Empty>
            La création d’organisations relève de l’administration de la plateforme. Votre rôle —{' '}
            {viewer?.role ? ROLE_LABELS[viewer.role] : 'non attribué'} — ne l’inclut pas.
          </Empty>
        </Card>
      </Shell>
    )
  }

  return (
    <Shell
      breadcrumb={[{ href: '/admin', label: 'Portefeuille' }]}
      title="Nouvelle organisation"
      subtitle="Le client entre au portefeuille. Sa gouvernance sera portée par les rôles que vous attribuerez ensuite."
    >
      <div className="max-w-3xl">
        <Card title="Identité de l’organisation">
          <OrganizationForm />
        </Card>
      </div>
    </Shell>
  )
}

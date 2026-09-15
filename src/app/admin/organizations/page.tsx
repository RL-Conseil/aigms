import Link from 'next/link'
import { createClient } from '@/lib/supabase/server'
import { Shell } from '@/components/shell'
import { Badge, Card, Empty } from '@/components/ui'
import { formatDate } from '@/lib/domain/governance'
import { getViewerContext, isAdministrating } from '@/lib/auth/context'
import { managedOrganizations } from '@/lib/governance/organizations'
import { ROLE_LABELS, type AppRole } from '@/lib/domain/roles'
import { AttentionSummary } from '@/components/governance/attention'
import { attentionByOrganization } from '@/lib/governance/attention'

/**
 * Les organisations que ce compte gere.
 *
 * L'ecran a quitte la racine de l'espace de travail : on n'y atterrit plus a
 * chaque connexion. On y vient pour changer de client, ce qui est un geste
 * occasionnel — d'ou sa place dans le menu de l'utilisateur, sous « Mon
 * organisation ».
 *
 * Le sous-titre suit le role : administrer des organisations et en gouverner
 * les usages sont deux metiers.
 */
export default async function ManagedOrganizationsPage() {
  const supabase = await createClient()
  const administrating = isAdministrating(await getViewerContext())

  // « Gerer » n'est pas « pouvoir lire » : une personne voit les organisations
  // de son tenant, elle ne gouverne que celles sur lesquelles l'administration
  // lui a attribue un role. Montrer les autres proposerait un travail qu'on ne
  // peut pas faire.
  const organizations = await managedOrganizations()

  const { data: useCases } = await supabase
    .from('ai_use_case')
    .select('id, organization_id, status')

  // Ce qui appelle une action, organisation par organisation : une liste de
  // clients sans cet indice oblige a les ouvrir un par un pour savoir lequel
  // demande du travail.
  const attention = administrating ? [] : await attentionByOrganization()
  const attentionByOrg = new Map(attention.map((row) => [row.organization_id, row]))

  const countsByOrg = new Map<string, { total: number; production: number }>()
  for (const uc of useCases ?? []) {
    const entry = countsByOrg.get(uc.organization_id) ?? { total: 0, production: 0 }
    entry.total += 1
    if (uc.status === 'PRODUCTION' || uc.status === 'MONITORING') entry.production += 1
    countsByOrg.set(uc.organization_id, entry)
  }

  return (
    <Shell
      title="Organisations gérées"
      subtitle={
        administrating
          ? 'Les organisations déclarées sur la plateforme.'
          : 'Celles sur lesquelles l’administration vous a attribué un rôle.'
      }
      actions={
        administrating ? (
          <Link
            href="/admin/organisations/nouvelle"
            className="rounded-md bg-night-900 px-4 py-2.5 text-sm font-medium text-white hover:bg-night-800"
          >
            Nouvelle organisation
          </Link>
        ) : undefined
      }
    >
      <Card title="Liste" subtitle={`${organizations.length} organisation(s)`}>
        {organizations.length ? (
          <ul className="divide-y divide-ink-100">
            {organizations.map((org) => {
              const counts = countsByOrg.get(org.id) ?? { total: 0, production: 0 }
              return (
                <li key={org.id} className="flex items-center justify-between gap-4 py-3">
                  <div className="min-w-0">
                    <Link
                      href={`/admin/organizations/${org.id}`}
                      className="text-sm font-medium text-brand-600 hover:underline"
                    >
                      {org.name}
                    </Link>
                    <p className="text-xs text-ink-400">
                      {org.business_ref} · {org.sector ?? 'Secteur non renseigné'} ·{' '}
                      {org.headcount ? `${org.headcount} personnes` : 'Effectif non renseigné'} ·
                      depuis le {formatDate(org.created_at)}
                    </p>
                    {attentionByOrg.has(org.id) ? (
                      <p className="mt-1">
                        <AttentionSummary attention={attentionByOrg.get(org.id)!} />
                      </p>
                    ) : null}
                  </div>
                  <div className="flex shrink-0 items-center gap-2">
                    {org.role ? (
                      <Badge tone="info">{ROLE_LABELS[org.role as AppRole] ?? org.role}</Badge>
                    ) : null}
                    <Badge>{counts.total} cas d&apos;usage</Badge>
                    <Badge tone={counts.production > 0 ? 'ok' : 'neutral'}>
                      {counts.production} en service
                    </Badge>
                    <Badge>{org.status}</Badge>
                    {administrating ? (
                      <Link
                        href={`/admin/organizations/${org.id}/administration`}
                        className="rounded-md border border-ink-200 px-3 py-1.5 text-xs text-ink-700 hover:bg-ink-100"
                      >
                        Administrer
                      </Link>
                    ) : null}
                  </div>
                </li>
              )
            })}
          </ul>
        ) : (
          <Empty>
            {administrating
              ? 'Aucune organisation. Commencez par en créer une : elle accueillera ensuite ses comptes et ses cas d’usage.'
              : 'Aucun rôle ne vous a été attribué sur une organisation. L’administration de la plateforme les attribue.'}
          </Empty>
        )}
      </Card>
    </Shell>
  )
}

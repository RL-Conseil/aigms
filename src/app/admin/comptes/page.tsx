import { createClient } from '@/lib/supabase/server'
import { Shell } from '@/components/shell'
import { Badge, Card, Empty } from '@/components/ui'
import { AccountForm, RoleForm } from '@/components/admin/forms'
import { getViewerContext, isAdministrating } from '@/lib/auth/context'
import { ROLE_LABELS, type AppRole } from '@/lib/domain/roles'
import { formatDate } from '@/lib/domain/governance'

/**
 * Comptes et roles du portefeuille.
 *
 * L'administration ouvre les acces ; elle ne gouverne pas. Cette page est donc
 * son poste de travail principal : declarer qui entre, avec quel role, sur
 * quelle organisation.
 */
export default async function AccountsPage() {
  const viewer = await getViewerContext()

  if (!isAdministrating(viewer)) {
    return (
      <Shell title="Comptes et rôles">
        <Card title="Accès réservé">
          <Empty>
            La gestion des comptes relève de l’administration de la plateforme. Votre rôle —{' '}
            {viewer?.role ? ROLE_LABELS[viewer.role] : 'non attribué'} — ne l’inclut pas.
          </Empty>
        </Card>
      </Shell>
    )
  }

  const supabase = await createClient()

  const [{ data: memberships }, { data: organizations }, { data: assignments }] = await Promise.all([
    supabase
      .from('membership')
      .select('id, role, status, created_at, user:user_id (id, email, full_name, job_title)')
      .order('created_at'),
    supabase.from('organization').select('id, name').order('name'),
    supabase
      .from('role_assignment')
      .select('user_id, role, organization:organization_id (name)'),
  ])

  const assignmentsByUser = new Map<string, string[]>()
  for (const assignment of assignments ?? []) {
    const org = assignment.organization as unknown as { name: string } | null
    if (!org) continue
    const list = assignmentsByUser.get(assignment.user_id) ?? []
    list.push(`${org.name} — ${ROLE_LABELS[assignment.role as AppRole] ?? assignment.role}`)
    assignmentsByUser.set(assignment.user_id, list)
  }

  return (
    <Shell
      title="Comptes et rôles"
      subtitle="Qui accède au portefeuille, avec quel rôle et sur quelle organisation."
      actions={<Badge tone="info">{memberships?.length ?? 0} compte(s)</Badge>}
    >
      <div className="grid gap-5 lg:grid-cols-5">
        <div className="lg:col-span-3">
          <Card title="Comptes déclarés">
            {memberships?.length ? (
              <ul className="divide-y divide-ink-100">
                {memberships.map((membership) => {
                  const user = membership.user as unknown as {
                    id: string
                    email: string
                    full_name: string | null
                    job_title: string | null
                  } | null
                  if (!user) return null

                  const role = membership.role as AppRole
                  const scoped = assignmentsByUser.get(user.id) ?? []
                  const isAdmin = role === 'platform_admin'

                  return (
                    <li key={membership.id} className="py-4">
                      <div className="flex flex-wrap items-start justify-between gap-3">
                        <div className="min-w-0">
                          <p className="text-sm font-medium text-ink-900">
                            {user.full_name ?? user.email}
                          </p>
                          <p className="text-xs text-ink-400">
                            {user.email}
                            {user.job_title ? ` · ${user.job_title}` : ''} · rattaché le{' '}
                            {formatDate(membership.created_at)}
                          </p>
                          {scoped.length ? (
                            <p className="mt-1.5 text-xs text-ink-600">
                              Affectations : {scoped.join(' ; ')}
                            </p>
                          ) : null}
                        </div>
                        <div className="flex shrink-0 flex-col items-end gap-2">
                          <Badge tone={isAdmin ? 'warn' : 'neutral'}>{ROLE_LABELS[role]}</Badge>
                          {isAdmin ? (
                            <span className="text-xs text-ink-400">
                              Non modifiable depuis l’application
                            </span>
                          ) : (
                            <RoleForm userId={user.id} currentRole={role} />
                          )}
                        </div>
                      </div>
                    </li>
                  )
                })}
              </ul>
            ) : (
              <Empty>Aucun compte déclaré.</Empty>
            )}
          </Card>
        </div>

        <div className="lg:col-span-2">
          <Card
            title="Déclarer un compte"
            subtitle="Le compte est créé, rattaché au portefeuille et doté de son rôle."
          >
            <AccountForm organizations={organizations ?? []} />
          </Card>
        </div>
      </div>
    </Shell>
  )
}

import { redirect } from 'next/navigation'
import { createClient } from '@/lib/supabase/server'
import { Shell } from '@/components/shell'
import { Badge, Card, Empty, Field } from '@/components/ui'
import { ProfileForm, TenantForm } from '@/components/admin/settings-forms'
import { getViewerContext, isAdministrating } from '@/lib/auth/context'
import { ROLE_DESCRIPTIONS, ROLE_LABELS, type AppRole } from '@/lib/domain/roles'

export default async function SettingsPage() {
  const viewer = await getViewerContext()
  if (!viewer) redirect('/login')

  const administrating = isAdministrating(viewer)
  const supabase = await createClient()

  const { data: assignments } = await supabase
    .from('role_assignment')
    .select('role, valid_until, organization:organization_id (id, name)')
    .eq('user_id', viewer.userId)

  return (
    <Shell
      title="Paramètres"
      subtitle="Votre compte et l’organisation à laquelle il est rattaché."
    >
      <div className="grid gap-5 lg:grid-cols-2">
        <Card title="Votre compte">
          <ProfileForm
            fullName={viewer.fullName}
            jobTitle={viewer.jobTitle}
            email={viewer.email}
          />
        </Card>

        <div className="flex flex-col gap-5">
          <Card title="Votre rôle">
            {viewer.role ? (
              <dl className="space-y-3">
                <Field label="Rôle sur l’ensemble des organisations">
                  <span className="inline-flex items-center gap-2">
                    <Badge tone={administrating ? 'warn' : 'info'}>
                      {ROLE_LABELS[viewer.role]}
                    </Badge>
                  </span>
                  <p className="mt-2 text-sm leading-relaxed text-ink-600">
                    {ROLE_DESCRIPTIONS[viewer.role]}
                  </p>
                </Field>

                <Field label="Affectations par organisation">
                  {assignments?.length ? (
                    <ul className="mt-1 space-y-1.5">
                      {assignments.map((assignment, index) => {
                        const org = assignment.organization as unknown as {
                          id: string
                          name: string
                        } | null
                        return (
                          <li key={`${org?.id}-${index}`} className="text-sm">
                            {org?.name ?? '—'} —{' '}
                            {ROLE_LABELS[assignment.role as AppRole] ?? assignment.role}
                            {assignment.valid_until
                              ? ` (jusqu’au ${new Date(assignment.valid_until).toLocaleDateString('fr-FR')})`
                              : ''}
                          </li>
                        )
                      })}
                    </ul>
                  ) : (
                    <span className="text-sm text-ink-500">
                      Aucune affectation ciblée : votre rôle porte sur toutes les organisations.
                    </span>
                  )}
                </Field>

                <p className="border-t border-ink-100 pt-3 text-xs leading-relaxed text-ink-500">
                  Les rôles sont attribués par l’administration de la plateforme. Ils ne se
                  modifient pas depuis cette page.
                </p>
              </dl>
            ) : (
              <Empty>Aucun rôle attribué. Contactez l’administration de la plateforme.</Empty>
            )}
          </Card>

          <div id="organisation">
            <Card title="Votre organisation">
              {viewer.tenantId && viewer.tenantName ? (
                <TenantForm
                  tenantId={viewer.tenantId}
                  name={viewer.tenantName}
                  editable={administrating}
                />
              ) : (
                <Empty>Aucune organisation rattachée à ce compte.</Empty>
              )}
            </Card>
          </div>
        </div>
      </div>
    </Shell>
  )
}

import Link from 'next/link'
import { notFound } from 'next/navigation'
import { createClient } from '@/lib/supabase/server'
import { Shell } from '@/components/shell'
import { Badge, Card, Empty } from '@/components/ui'
import { ActivityForm, ProcessForm } from '@/components/governance/process-forms'
import { USE_CASE_STATUS_LABELS, type UseCaseStatus } from '@/lib/domain/governance'

/**
 * Cartographie des processus.
 *
 * La gouvernance part de l'activite metier : un usage d'IA se gouverne parce
 * qu'il sert un processus. Cet ecran est l'ossature sur laquelle les cas
 * d'usage se rattachent — et un noeud vide y est une invitation a saisir, non
 * un trou dans un rapport.
 */

const CATEGORY_LABELS: Record<string, string> = {
  management: 'Pilotage',
  core: 'Réalisation',
  support: 'Support',
}

export default async function ProcessMapPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params
  const supabase = await createClient()

  const [{ data: organization }, { data: processes }, { data: activities }, { data: useCases }] =
    await Promise.all([
      supabase.from('organization').select('id, name, business_ref').eq('id', id).maybeSingle(),
      supabase
        .from('process')
        .select('id, business_ref, code, name, description, category, display_order')
        .eq('organization_id', id)
        .order('display_order'),
      supabase
        .from('activity')
        .select('id, business_ref, name, description, process_id, display_order')
        .eq('organization_id', id)
        .order('display_order'),
      supabase
        .from('ai_use_case')
        .select('id, business_ref, name, status, criticality, activity_id')
        .eq('organization_id', id)
        .order('business_ref'),
    ])

  if (!organization) notFound()

  const activitiesByProcess = new Map<string, NonNullable<typeof activities>>()
  for (const activity of activities ?? []) {
    const list = activitiesByProcess.get(activity.process_id) ?? []
    list.push(activity)
    activitiesByProcess.set(activity.process_id, list)
  }

  const useCasesByActivity = new Map<string, NonNullable<typeof useCases>>()
  for (const useCase of useCases ?? []) {
    if (!useCase.activity_id) continue
    const list = useCasesByActivity.get(useCase.activity_id) ?? []
    list.push(useCase)
    useCasesByActivity.set(useCase.activity_id, list)
  }

  const unattached = (useCases ?? []).filter((u) => !u.activity_id)

  return (
    <Shell
      breadcrumb={[
        { href: '/admin', label: 'Organisations' },
        { href: `/admin/organizations/${id}`, label: organization.name },
      ]}
      title="Cartographie des processus"
      subtitle="Ce que fait l’organisation, et où l’IA intervient."
      actions={
        <Link
          href={`/admin/organizations/${id}/cas-d-usage/nouveau`}
          className="rounded-md bg-night-900 px-4 py-2.5 text-sm font-medium text-white hover:bg-night-800"
        >
          Déclarer un cas d’usage
        </Link>
      }
    >
      <div className="grid gap-5 lg:grid-cols-5">
        <div className="flex flex-col gap-5 lg:col-span-3">
          {processes?.length ? (
            processes.map((process) => {
              const processActivities = activitiesByProcess.get(process.id) ?? []
              return (
                <Card
                  key={process.id}
                  title={`${process.code ? `${process.code} — ` : ''}${process.name}`}
                  subtitle={process.description ?? undefined}
                  action={<Badge>{CATEGORY_LABELS[process.category] ?? process.category}</Badge>}
                >
                  {processActivities.length ? (
                    <ul className="flex flex-col gap-3">
                      {processActivities.map((activity) => {
                        const activityUseCases = useCasesByActivity.get(activity.id) ?? []
                        return (
                          <li key={activity.id} className="rounded-md border border-ink-200 px-4 py-3">
                            <div className="flex flex-wrap items-start justify-between gap-2">
                              <div className="min-w-0">
                                <p className="text-sm font-medium text-ink-900">{activity.name}</p>
                                {activity.description ? (
                                  <p className="text-xs text-ink-500">{activity.description}</p>
                                ) : null}
                              </div>
                              <span className="text-xs text-ink-400">{activity.business_ref}</span>
                            </div>

                            {activityUseCases.length ? (
                              <ul className="mt-3 flex flex-col gap-1.5 border-t border-ink-100 pt-3">
                                {activityUseCases.map((useCase) => (
                                  <li
                                    key={useCase.id}
                                    className="flex flex-wrap items-center justify-between gap-2"
                                  >
                                    <Link
                                      href={`/admin/use-cases/${useCase.id}`}
                                      className="text-sm text-brand-600 hover:underline"
                                    >
                                      {useCase.name}
                                    </Link>
                                    <span className="flex items-center gap-1.5">
                                      {useCase.criticality ? (
                                        <Badge
                                          tone={
                                            useCase.criticality === 'critical' ||
                                            useCase.criticality === 'high'
                                              ? 'stop'
                                              : 'neutral'
                                          }
                                        >
                                          {useCase.criticality}
                                        </Badge>
                                      ) : null}
                                      <Badge>
                                        {USE_CASE_STATUS_LABELS[useCase.status as UseCaseStatus]}
                                      </Badge>
                                    </span>
                                  </li>
                                ))}
                              </ul>
                            ) : (
                              <p className="mt-3 border-t border-ink-100 pt-3 text-xs text-ink-400">
                                Aucun usage d’IA déclaré sur cette activité.{' '}
                                <Link
                                  href={`/admin/organizations/${id}/cas-d-usage/nouveau?activite=${activity.id}`}
                                  className="text-brand-600 hover:underline"
                                >
                                  En déclarer un
                                </Link>
                                .
                              </p>
                            )}
                          </li>
                        )
                      })}
                    </ul>
                  ) : (
                    <Empty>
                      Aucune activité. Un processus sans activité ne porte aucun usage d’IA
                      gouvernable.
                    </Empty>
                  )}
                </Card>
              )
            })
          ) : (
            <Card title="Cartographie">
              <Empty>
                Aucun processus. Commencez par décrire ce que fait l’organisation : la gouvernance
                de l’IA s’y rattachera ensuite.
              </Empty>
            </Card>
          )}

          {unattached.length ? (
            <Card
              title="Cas d’usage non rattachés"
              subtitle="Déclarés avant la cartographie, ou transverses."
            >
              <ul className="flex flex-col gap-2">
                {unattached.map((useCase) => (
                  <li key={useCase.id} className="flex items-center justify-between gap-3">
                    <Link
                      href={`/admin/use-cases/${useCase.id}`}
                      className="text-sm text-brand-600 hover:underline"
                    >
                      {useCase.name}
                    </Link>
                    <span className="text-xs text-ink-400">{useCase.business_ref}</span>
                  </li>
                ))}
              </ul>
            </Card>
          ) : null}
        </div>

        <div className="flex flex-col gap-5 lg:col-span-2">
          <Card title="Ajouter un processus">
            <ProcessForm organizationId={id} />
          </Card>
          <Card title="Ajouter une activité">
            <ActivityForm organizationId={id} processes={processes ?? []} />
          </Card>
        </div>
      </div>
    </Shell>
  )
}

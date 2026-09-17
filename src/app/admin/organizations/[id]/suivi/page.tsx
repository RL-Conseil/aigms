import Link from 'next/link'
import { notFound } from 'next/navigation'
import { createClient } from '@/lib/supabase/server'
import { Shell } from '@/components/shell'
import { Badge, Card, Empty, Stat, StatStrip } from '@/components/ui'
import { InfoTip } from '@/components/info-tip'
import { SegmentedFilter } from '@/components/governance/segmented-filter'
import {
  ActionForm,
  ActionStatusForm,
  IncidentForm,
  IncidentProgressForm,
} from '@/components/governance/operations-forms'
import { describePerson, organizationPeople } from '@/lib/governance/people'
import {
  ACTION_STATUS_LABELS,
  INCIDENT_STATUS_LABELS,
  USE_CASE_STATUS_LABELS,
  formatDate,
  formatDateTime,
  type UseCaseStatus,
} from '@/lib/domain/governance'

/**
 * Suivi operationnel de l'organisation.
 *
 * Les actions, incidents et revues vivent sur les cas d'usage ; ce qui manquait,
 * c'est l'endroit ou l'on voit d'un coup ce qui est en retard chez ce client
 * sans ouvrir chaque fiche. Le pilotage le fait pour tous les clients ; cette
 * page le fait pour un seul, et permet d'agir sur place.
 *
 * Trois lectures : les actions (echues en tete), les incidents (ouverts en
 * tete), les revues de cas d'usage passees. Une action ou un incident peut
 * etre transverse — sans cas d'usage — et se declare ici.
 */

const VIEWS = [
  { key: 'actions', label: 'Actions' },
  { key: 'incidents', label: 'Incidents' },
  { key: 'revues', label: 'Revues' },
] as const
type ViewKey = (typeof VIEWS)[number]['key']

const ACTION_FILTERS = [
  { key: '', label: 'Ouvertes' },
  { key: 'echues', label: 'Échues' },
  { key: 'bloquantes', label: 'Bloquantes' },
  { key: 'closes', label: 'Closes' },
] as const

const INCIDENT_FILTERS = [
  { key: '', label: 'Ouverts' },
  { key: 'significatifs', label: 'Significatifs' },
  { key: 'clos', label: 'Clos' },
] as const

export default async function FollowUpPage({
  params,
  searchParams,
}: {
  params: Promise<{ id: string }>
  searchParams: Promise<{ vue?: string; etat?: string }>
}) {
  const { id } = await params
  const { vue, etat } = await searchParams
  const view: ViewKey = VIEWS.some((v) => v.key === vue) ? (vue as ViewKey) : 'actions'
  const supabase = await createClient()
  const today = new Date().toISOString().slice(0, 10)

  const [{ data: organization }, { data: actions }, { data: incidents }, { data: useCases }, people] =
    await Promise.all([
      supabase.from('organization').select('id, name, business_ref').eq('id', id).maybeSingle(),
      supabase
        .from('action')
        .select('id, business_ref, title, status, due_date, is_blocking, use_case_id, owner:owner_user_id (full_name, email)')
        .eq('organization_id', id)
        .order('due_date', { nullsFirst: false }),
      supabase
        .from('incident')
        .select(
          'id, business_ref, title, kind, severity, status, detected_at, containment_action, root_cause, is_recurrence, use_case_id, capa:capa (status)',
        )
        .eq('organization_id', id)
        .order('detected_at', { ascending: false }),
      supabase
        .from('ai_use_case')
        .select('id, name, business_ref, status, next_review_at')
        .eq('organization_id', id)
        .order('business_ref'),
      organizationPeople(id),
    ])

  if (!organization) notFound()

  const useCaseName = new Map((useCases ?? []).map((u) => [u.id, u.name]))
  const peopleChoices = people.map((p) => ({ id: p.userId, label: describePerson(p) }))
  const person = (value: unknown) => {
    const p = value as { full_name: string | null; email: string } | null
    return p ? p.full_name?.trim() || p.email : null
  }

  // --- Actions ---------------------------------------------------------------
  const allActions = actions ?? []
  const openActions = allActions.filter((a) => !['done', 'cancelled'].includes(a.status))
  const overdue = openActions.filter((a) => a.due_date !== null && a.due_date < today)
  const blocking = openActions.filter((a) => a.is_blocking)
  const shownActions =
    etat === 'echues'
      ? overdue
      : etat === 'bloquantes'
        ? blocking
        : etat === 'closes'
          ? allActions.filter((a) => ['done', 'cancelled'].includes(a.status))
          : openActions

  // --- Incidents -------------------------------------------------------------
  const allIncidents = incidents ?? []
  const isSignificant = (i: (typeof allIncidents)[number]) =>
    ['S1', 'S2'].includes(i.severity) || i.kind === 'non_conformity' || i.is_recurrence
  const openIncidents = allIncidents.filter((i) => i.status !== 'CLOSED')
  const shownIncidents =
    etat === 'significatifs'
      ? openIncidents.filter(isSignificant)
      : etat === 'clos'
        ? allIncidents.filter((i) => i.status === 'CLOSED')
        : openIncidents

  // --- Revues ----------------------------------------------------------------
  const reviewsDue = (useCases ?? []).filter(
    (u) => u.next_review_at !== null && u.next_review_at < today && u.status !== 'RETIRED',
  )

  const base = `/admin/organizations/${id}/suivi`

  return (
    <Shell
      breadcrumb={[
        { href: '/admin/organizations', label: 'Organisations' },
        { href: `/admin/organizations/${id}`, label: organization.name },
      ]}
      organization={{ id, section: 'suivi' }}
      title="Suivi d’actions"
      subtitle="Ce qui reste à faire, ce qui s’est passé, ce qui doit être revu."
      actions={
        <div className="flex flex-wrap items-center gap-3">
          <nav aria-label="Lecture du suivi" className="flex rounded-md border border-ink-200 bg-white p-0.5">
            {VIEWS.map((option) => (
              <Link
                key={option.key}
                href={`${base}?vue=${option.key}`}
                aria-current={view === option.key ? 'page' : undefined}
                className={`rounded px-3 py-1.5 text-sm ${
                  view === option.key ? 'bg-night-900 font-medium text-white' : 'text-ink-600 hover:bg-ink-100'
                }`}
              >
                {option.label}
              </Link>
            ))}
          </nav>
          {view === 'actions' ? (
            <ActionForm organizationId={id} useCases={useCases ?? []} people={peopleChoices} />
          ) : view === 'incidents' ? (
            <IncidentForm organizationId={id} useCases={useCases ?? []} people={peopleChoices} />
          ) : null}
          <InfoTip label="Comment lire le suivi" title="Trois listes, un même principe : rien ne dort">
            <div className="flex flex-col gap-3 text-sm leading-relaxed text-ink-600">
              <p>
                <strong className="font-medium text-ink-800">Actions</strong> — ce qui reste à faire,
                par qui, pour quand. Une action <em>bloquante</em> retient le gate PRODUCTION de son
                cas d’usage ; une action sans échéance ne remonte jamais en retard.
              </p>
              <p>
                <strong className="font-medium text-ink-800">Incidents</strong> — ce qui s’est passé.
                Un incident se clôt sur une cause racine ; s’il est significatif, sur une CAPA close
                dont l’efficacité a été vérifiée nominativement. La CAPA se conduit depuis la fiche du
                cas d’usage.
              </p>
              <p>
                <strong className="font-medium text-ink-800">Revues</strong> — les cas d’usage dont la
                date de revue est passée. Une gouvernance qui ne revoit pas ses usages en service ne
                les gouverne plus.
              </p>
            </div>
          </InfoTip>
        </div>
      }
    >
      <StatStrip>
        <Stat label="Actions ouvertes" value={openActions.length} />
        <Stat label="Échues" value={overdue.length} tone="stop" />
        <Stat label="Incidents ouverts" value={openIncidents.length} tone="stop" />
        <Stat label="Revues en retard" value={reviewsDue.length} tone="warn" />
      </StatStrip>

      {view === 'actions' ? (
        <>
          <div className="mb-5">
            <SegmentedFilter
              label="Filtrer les actions"
              param="etat"
              basePath={base}
              current={{ vue: 'actions' }}
              selected={etat}
              options={ACTION_FILTERS.map((o) => ({
                key: o.key,
                label: o.label,
                count:
                  o.key === ''
                    ? openActions.length
                    : o.key === 'echues'
                      ? overdue.length
                      : o.key === 'bloquantes'
                        ? blocking.length
                        : allActions.length - openActions.length,
              }))}
            />
          </div>
          <Card title="Actions" subtitle={`${shownActions.length} action(s)`}>
            {shownActions.length ? (
              <ul className="divide-y divide-ink-100">
                {shownActions.map((a) => {
                  const late = !['done', 'cancelled'].includes(a.status) && a.due_date !== null && a.due_date < today
                  return (
                    <li key={a.id} className="flex items-start justify-between gap-3 py-3 first:pt-0 last:pb-0">
                      <div className="min-w-0">
                        <div className="flex flex-wrap items-center gap-2">
                          <span className="text-sm font-medium text-ink-900">{a.title}</span>
                          {a.is_blocking ? <Badge tone="stop">Bloquante</Badge> : null}
                          {late ? <Badge tone="stop">Échue</Badge> : null}
                        </div>
                        <p className="text-xs text-ink-500">
                          {a.business_ref} · {ACTION_STATUS_LABELS[a.status] ?? a.status}
                          {a.due_date ? ` · échéance ${formatDate(a.due_date)}` : ' · sans échéance'}
                          {person(a.owner) ? ` · ${person(a.owner)}` : ' · sans responsable'}
                          {' · '}
                          {a.use_case_id ? (
                            <Link href={`/admin/use-cases/${a.use_case_id}`} className="text-brand-600 hover:underline">
                              {useCaseName.get(a.use_case_id) ?? 'cas d’usage'}
                            </Link>
                          ) : (
                            'transverse'
                          )}
                        </p>
                      </div>
                      <ActionStatusForm organizationId={id} useCaseId={a.use_case_id} action={a} />
                    </li>
                  )
                })}
              </ul>
            ) : (
              <Empty>Aucune action dans ce filtre.</Empty>
            )}
          </Card>
        </>
      ) : view === 'incidents' ? (
        <>
          <div className="mb-5">
            <SegmentedFilter
              label="Filtrer les incidents"
              param="etat"
              basePath={base}
              current={{ vue: 'incidents' }}
              selected={etat}
              options={INCIDENT_FILTERS.map((o) => ({
                key: o.key,
                label: o.label,
                count:
                  o.key === ''
                    ? openIncidents.length
                    : o.key === 'significatifs'
                      ? openIncidents.filter(isSignificant).length
                      : allIncidents.length - openIncidents.length,
              }))}
            />
          </div>
          <Card title="Incidents" subtitle={`${shownIncidents.length} incident(s)`}>
            {shownIncidents.length ? (
              <ul className="divide-y divide-ink-100">
                {shownIncidents.map((incident) => {
                  const significant = isSignificant(incident)
                  const capas = (incident.capa ?? []) as { status: string }[]
                  return (
                    <li key={incident.id} className="flex items-start justify-between gap-3 py-3 first:pt-0 last:pb-0">
                      <div className="min-w-0">
                        <div className="flex flex-wrap items-center gap-2">
                          <Badge tone={['S1', 'S2'].includes(incident.severity) ? 'stop' : 'warn'}>
                            {incident.severity}
                          </Badge>
                          <span className="text-sm font-medium text-ink-900">{incident.title}</span>
                        </div>
                        <p className="text-xs text-ink-500">
                          {incident.business_ref} · {INCIDENT_STATUS_LABELS[incident.status] ?? incident.status}
                          {' · détecté le '}
                          {formatDateTime(incident.detected_at)}
                          {significant
                            ? capas.some((c) => c.status === 'closed')
                              ? ' · CAPA close'
                              : ' · CAPA close exigée'
                            : ''}
                          {' · '}
                          {incident.use_case_id ? (
                            <Link href={`/admin/use-cases/${incident.use_case_id}`} className="text-brand-600 hover:underline">
                              {useCaseName.get(incident.use_case_id) ?? 'cas d’usage'}
                            </Link>
                          ) : (
                            'transverse'
                          )}
                        </p>
                      </div>
                      <IncidentProgressForm
                        organizationId={id}
                        useCaseId={incident.use_case_id}
                        incident={{
                          id: incident.id,
                          title: incident.title,
                          status: incident.status,
                          containment_action: incident.containment_action,
                          root_cause: incident.root_cause,
                          significant,
                          has_closed_capa: capas.some((c) => c.status === 'closed'),
                        }}
                      />
                    </li>
                  )
                })}
              </ul>
            ) : (
              <Empty>Aucun incident dans ce filtre.</Empty>
            )}
          </Card>
        </>
      ) : (
        <Card title="Revues en retard" subtitle={`${reviewsDue.length} cas d’usage`}>
          {reviewsDue.length ? (
            <ul className="divide-y divide-ink-100">
              {reviewsDue.map((u) => (
                <li key={u.id} className="flex items-center justify-between gap-3 py-3 first:pt-0 last:pb-0">
                  <div>
                    <Link href={`/admin/use-cases/${u.id}`} className="text-sm font-medium text-brand-600 hover:underline">
                      {u.name}
                    </Link>
                    <p className="text-xs text-ink-500">
                      {u.business_ref} · revue attendue le {formatDate(u.next_review_at)}
                    </p>
                  </div>
                  <Badge>{USE_CASE_STATUS_LABELS[u.status as UseCaseStatus] ?? u.status}</Badge>
                </li>
              ))}
            </ul>
          ) : (
            <Empty>Aucune revue en retard. Les dates de revue se posent au triage et à la mise en production.</Empty>
          )}
        </Card>
      )}
    </Shell>
  )
}

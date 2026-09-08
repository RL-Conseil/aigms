import Link from 'next/link'
import { notFound } from 'next/navigation'
import { createClient } from '@/lib/supabase/server'
import { Shell } from '@/components/shell'
import { Badge, Card, Empty, Field } from '@/components/ui'
import {
  AUTONOMY_LABELS,
  formatDate,
  USE_CASE_STATUS_LABELS,
  type UseCaseStatus,
} from '@/lib/domain/governance'

function statusTone(status: UseCaseStatus) {
  if (status === 'PRODUCTION' || status === 'MONITORING') return 'ok' as const
  if (status === 'REJECTED' || status === 'RETIRED') return 'stop' as const
  if (status === 'PILOT' || status === 'CONDITIONAL_APPROVAL') return 'warn' as const
  return 'neutral' as const
}

export default async function OrganizationPage({
  params,
}: {
  params: Promise<{ id: string }>
}) {
  const { id } = await params
  const supabase = await createClient()

  const { data: organization } = await supabase
    .from('organization')
    .select('id, business_ref, name, legal_name, sector, country_code, headcount, status')
    .eq('id', id)
    .maybeSingle()

  if (!organization) notFound()

  const [{ data: useCases }, { data: vendors }, { data: units }] = await Promise.all([
    supabase
      .from('ai_use_case')
      .select('id, business_ref, name, status, criticality, autonomy_level, next_review_at')
      .eq('organization_id', id)
      .order('business_ref'),
    supabase
      .from('vendor')
      .select('id, business_ref, name, criticality, review_status, next_review_at')
      .eq('organization_id', id)
      .order('name'),
    supabase.from('business_unit').select('id, name').eq('organization_id', id).order('name'),
  ])

  return (
    <Shell
      breadcrumb={[{ href: '/admin', label: 'Organisations' }]}
      title={organization.name}
      subtitle={`${organization.business_ref} — ${organization.legal_name ?? organization.name}`}
      actions={
        <div className="flex items-center gap-3">
          <Link
            href={`/admin/organizations/${id}/declaration-applicabilite`}
            className="rounded-md border border-ink-200 px-3.5 py-2 text-sm text-ink-700 hover:bg-ink-100"
          >
            Déclaration d’Applicabilité
          </Link>
          <Badge>{organization.status}</Badge>
        </div>
      }
    >
      <div className="grid gap-5 lg:grid-cols-3">
        <div className="lg:col-span-2">
          <Card
            title="Cas d'usage IA"
            subtitle="Chaque gouvernance part d'un usage réel."
          >
            {useCases?.length ? (
              <ul className="divide-y divide-ink-100">
                {useCases.map((uc) => (
                  <li key={uc.id} className="flex items-center justify-between gap-4 py-3">
                    <div className="min-w-0">
                      <Link
                        href={`/admin/use-cases/${uc.id}`}
                        className="text-sm font-medium text-brand-600 hover:underline"
                      >
                        {uc.name}
                      </Link>
                      <p className="text-xs text-ink-400">
                        {uc.business_ref} · {AUTONOMY_LABELS[uc.autonomy_level] ?? uc.autonomy_level}
                        {uc.next_review_at ? ` · revue le ${formatDate(uc.next_review_at)}` : ''}
                      </p>
                    </div>
                    <div className="flex shrink-0 gap-2">
                      {uc.criticality ? <Badge>{uc.criticality}</Badge> : null}
                      <Badge tone={statusTone(uc.status as UseCaseStatus)}>
                        {USE_CASE_STATUS_LABELS[uc.status as UseCaseStatus]}
                      </Badge>
                    </div>
                  </li>
                ))}
              </ul>
            ) : (
              <Empty>Aucun cas d&apos;usage déclaré.</Empty>
            )}
          </Card>
        </div>

        <div className="space-y-5">
          <Card title="Contexte">
            <dl className="space-y-3">
              <Field label="Secteur">{organization.sector ?? '—'}</Field>
              <Field label="Pays">{organization.country_code ?? '—'}</Field>
              <Field label="Effectif">{organization.headcount ?? '—'}</Field>
              <Field label="Entités">
                {units?.length ? units.map((u) => u.name).join(', ') : '—'}
              </Field>
            </dl>
          </Card>

          <Card title="Fournisseurs" subtitle="Revue tiers requise avant mise en service.">
            {vendors?.length ? (
              <ul className="space-y-3">
                {vendors.map((v) => (
                  <li key={v.id} className="text-sm">
                    <div className="flex items-center justify-between gap-2">
                      <span className="font-medium text-ink-900">{v.name}</span>
                      <Badge
                        tone={
                          v.review_status === 'approved' ||
                          v.review_status === 'approved_with_conditions'
                            ? 'ok'
                            : 'warn'
                        }
                      >
                        {v.review_status}
                      </Badge>
                    </div>
                    <p className="text-xs text-ink-400">
                      Criticité {v.criticality}
                      {v.next_review_at ? ` · revue le ${formatDate(v.next_review_at)}` : ''}
                    </p>
                  </li>
                ))}
              </ul>
            ) : (
              <Empty>Aucun fournisseur enregistré.</Empty>
            )}
          </Card>
        </div>
      </div>
    </Shell>
  )
}

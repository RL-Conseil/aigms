import Link from 'next/link'
import { notFound } from 'next/navigation'
import { createClient } from '@/lib/supabase/server'
import { Shell } from '@/components/shell'
import { Badge, Card, Empty, Field } from '@/components/ui'
import { ActivityProfileForm } from '@/components/governance/activity-profile-form'
import {
  ACTIVITY_PROFILE_LABELS,
  CRITICALITY_LABELS,
  criticalityTone,
  type ActivityProfile,
  type EvidenceCriticality,
} from '@/lib/domain/activity-profile'
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
    .select(
      'id, business_ref, name, legal_name, sector, country_code, headcount, status, ai_activity_profile',
    )
    .eq('id', id)
    .maybeSingle()

  if (!organization) notFound()

  const [{ data: useCases }, { data: vendors }, { data: units }, { data: typologyRows }] =
    await Promise.all([
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
      supabase.rpc('typology_coverage', { p_organization_id: id }),
    ])

  const profile = (organization.ai_activity_profile ?? null) as ActivityProfile | null
  const typologies = (typologyRows ?? []) as {
    code: string
    name: string
    criticality: EvidenceCriticality | null
    evidence_total: number
    evidence_valid: number
  }[]
  // Ce que le rôle retenu rend exigeant, tout de suite : le lien entre le choix
  // et ses conséquences se perd si l'un et l'autre vivent sur deux écrans.
  const demanding = typologies.filter(
    (t) => t.criticality === 'critical' || t.criticality === 'high',
  )

  return (
    <Shell
      breadcrumb={[{ href: '/admin', label: 'Organisations' }]}
      title={organization.name}
      subtitle={`${organization.business_ref} — ${organization.legal_name ?? organization.name}`}
      actions={
        <div className="flex items-center gap-3">
          <Link
            href={`/admin/organizations/${id}/processus`}
            className="rounded-md border border-ink-200 px-3.5 py-2 text-sm text-ink-700 hover:bg-ink-100"
          >
            Processus
          </Link>
          <Link
            href={`/admin/organizations/${id}/preuves`}
            className="rounded-md border border-ink-200 px-3.5 py-2 text-sm text-ink-700 hover:bg-ink-100"
          >
            Preuves
          </Link>
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
          <Card
            title="Rôle vis-à-vis de l’IA"
            subtitle={
              profile
                ? ACTIVITY_PROFILE_LABELS[profile]
                : 'Non renseigné — aucune criticité ne peut être attribuée'
            }
          >
            <ActivityProfileForm organizationId={id} current={profile} />

            {profile ? (
              <div className="mt-4 border-t border-ink-100 pt-3">
                <p className="mb-2 text-xs font-medium text-ink-600">
                  Ce que ce rôle rend exigeant
                </p>
                {demanding.length ? (
                  <ul className="flex flex-col gap-1.5">
                    {demanding.map((typology) => (
                      <li
                        key={typology.code}
                        className="flex items-baseline justify-between gap-2 text-sm"
                      >
                        <span className="text-ink-800">
                          <span className="mr-2 font-mono text-xs text-ink-400">
                            {typology.code}
                          </span>
                          {typology.name}
                        </span>
                        <span className="flex shrink-0 items-center gap-2">
                          <span
                            className={`text-xs ${
                              typology.evidence_valid === 0 ? 'text-stop-600' : 'text-ink-500'
                            }`}
                          >
                            {typology.evidence_valid} preuve
                            {typology.evidence_valid > 1 ? 's' : ''}
                          </span>
                          <Badge tone={criticalityTone(typology.criticality)}>
                            {typology.criticality
                              ? CRITICALITY_LABELS[typology.criticality]
                              : '—'}
                          </Badge>
                        </span>
                      </li>
                    ))}
                  </ul>
                ) : (
                  <Empty>
                    Aucune typologie critique ou élevée pour ce rôle. La matrice reste consultable
                    depuis le registre des preuves.
                  </Empty>
                )}
                <Link
                  href={`/admin/organizations/${id}/preuves`}
                  className="mt-3 inline-block text-xs font-medium text-brand-600 hover:underline"
                >
                  Voir la matrice complète et déposer une preuve
                </Link>
              </div>
            ) : null}
          </Card>

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

import Link from 'next/link'
import { notFound } from 'next/navigation'
import { createClient } from '@/lib/supabase/server'
import { Shell } from '@/components/shell'
import { Badge, Card, Empty } from '@/components/ui'
import { ActivityProfileForm } from '@/components/governance/activity-profile-form'
import { documentIdentity, formatPostalAddress } from '@/lib/governance/document-identity'
import { AttentionBar } from '@/components/governance/attention'
import { SegmentedFilter } from '@/components/governance/segmented-filter'
import { VendorReviewForm } from '@/components/governance/registry-forms'
import { attentionFor } from '@/lib/governance/attention'
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
  VENDOR_REVIEW_LABELS,
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
  searchParams,
}: {
  params: Promise<{ id: string }>
  searchParams: Promise<{ inventaire?: string }>
}) {
  const { id } = await params
  const { inventaire } = await searchParams
  const tab = inventaire === 'fournisseurs' ? 'fournisseurs' : 'cas-d-usage'
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

  const attention = await attentionFor(id)
  const identity = await documentIdentity(id)
  const postalAddress = identity ? formatPostalAddress(identity) : ''

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
      breadcrumb={[{ href: '/admin/organizations', label: 'Organisations' }]}
      title={organization.name}
      subtitle={[
        `${organization.business_ref} — ${organization.legal_name ?? organization.name}`,
        organization.sector,
        organization.country_code,
        organization.headcount ? `${organization.headcount} personnes` : null,
        units?.length ? units.map((u) => u.name).join(', ') : null,
      ]
        .filter(Boolean)
        .join(' · ')}
      organization={{ id, section: 'apercu' }}
      actions={
        <div className="flex items-center gap-3">
          <Badge>{organization.status}</Badge>
          {/*
            Le registre est la piece qu'on demande en premier. Elle s'imprime
            avec l'identite de l'organisation en en-tete et sa mention de
            confidentialite en pied — voir /identite.
          */}
          <Link
            href={`/admin/organizations/${id}/impression/registre`}
            className="rounded-md border border-ink-200 px-3.5 py-2 text-sm text-ink-700 hover:bg-ink-100"
          >
            Imprimer le registre
          </Link>
          <Link
            href={`/admin/organizations/${id}/cas-d-usage/nouveau`}
            className="rounded-md bg-night-900 px-4 py-2.5 text-sm font-medium text-white hover:bg-night-800"
          >
            Déclarer un cas d’usage
          </Link>
        </div>
      }
    >
      {/*
        Ce qui appelle une action se lit AVANT le contenu : ouvrir une fiche
        pour decouvrir en bas de page qu'une preuve a expire depuis trois
        semaines est une decouverte trop tardive.
      */}
      {attention ? (
        <div className="mb-5">
          <AttentionBar attention={attention} organizationId={id} />
        </div>
      ) : null}

      <div className="grid gap-5 lg:grid-cols-3">
        <div className="lg:col-span-2">
          <Card
            title={tab === 'fournisseurs' ? 'Fournisseurs' : "Cas d'usage IA"}
            subtitle={
              tab === 'fournisseurs'
                ? 'Revue tiers requise avant mise en service.'
                : "Chaque gouvernance part d'un usage réel."
            }
            action={
              <div className="flex flex-wrap items-center gap-3">
                <SegmentedFilter
                  label="Inventaire"
                  param="inventaire"
                  basePath={`/admin/organizations/${id}`}
                  selected={tab === 'fournisseurs' ? 'fournisseurs' : ''}
                  options={[
                    { key: '', label: 'Cas d’usage IA', count: useCases?.length ?? 0 },
                    { key: 'fournisseurs', label: 'Fournisseurs', count: vendors?.length ?? 0 },
                  ]}
                />
                {tab === 'fournisseurs' ? (
                  <Link
                    href={`/admin/organizations/${id}/registre/nouveau`}
                    className="rounded-md border border-ink-200 px-3.5 py-1.5 text-xs font-medium text-ink-700 hover:bg-ink-100"
                  >
                    Déclarer un fournisseur
                  </Link>
                ) : null}
              </div>
            }
          >
            {tab === 'fournisseurs' ? (
              vendors?.length ? (
                <ul className="divide-y divide-ink-100">
                  {vendors.map((v) => (
                    <li key={v.id} className="flex items-center justify-between gap-4 py-3">
                      <div className="min-w-0">
                        <span className="text-sm font-medium text-ink-900">{v.name}</span>
                        <p className="text-xs text-ink-400">
                          {v.business_ref} · criticité {v.criticality}
                          {v.next_review_at ? ` · revue le ${formatDate(v.next_review_at)}` : ''}
                        </p>
                      </div>
                      <div className="flex shrink-0 items-center gap-2">
                        <Badge
                          tone={
                            v.review_status === 'approved' ||
                            v.review_status === 'approved_with_conditions'
                              ? 'ok'
                              : 'warn'
                          }
                        >
                          {VENDOR_REVIEW_LABELS[v.review_status] ?? v.review_status}
                        </Badge>
                        <VendorReviewForm
                          organizationId={id}
                          vendorId={v.id}
                          name={v.name}
                          reviewStatus={v.review_status}
                          nextReviewAt={v.next_review_at}
                        />
                      </div>
                    </li>
                  ))}
                </ul>
              ) : (
                <Empty>
                  Aucun fournisseur enregistré. Tant qu’un tiers impliqué n’est pas déclaré, sa
                  revue ne peut pas être close — et le gate PRODUCTION l’exige.
                </Empty>
              )
            ) : useCases?.length ? (
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
          {/*
            L'identite documentaire ne se lit pas ici : elle se remplit une fois
            et se relit dans les documents qu'elle sert. Un lien suffit.
          */}
          <Card
            title="Identité documentaire"
            subtitle={
              identity?.logoUrl
                ? `${identity.legalName} · logo déposé`
                : 'En-tête, logo et mention de confidentialité des documents remis'
            }
          >
            <div className="flex flex-col gap-3">
              <p className="text-sm leading-relaxed text-ink-600">
                {postalAddress || 'Aucune adresse renseignée.'}
              </p>
              <div className="flex flex-wrap gap-2">
                <Link
                  href={`/admin/organizations/${id}/identite`}
                  className="rounded-md border border-ink-200 px-3.5 py-2 text-sm text-ink-700 hover:bg-ink-100"
                >
                  Compléter l’identité
                </Link>
                <Link
                  href={`/admin/organizations/${id}/impression/declaration-applicabilite`}
                  className="rounded-md border border-ink-200 px-3.5 py-2 text-sm text-ink-700 hover:bg-ink-100"
                >
                  Imprimer la Déclaration
                </Link>
              </div>
            </div>
          </Card>

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

        </div>
      </div>
    </Shell>
  )
}

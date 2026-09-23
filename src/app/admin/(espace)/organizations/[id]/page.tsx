import Link from 'next/link'
import { notFound } from 'next/navigation'
import { createClient } from '@/lib/supabase/server'
import { Shell } from '@/components/shell'
import { Badge, Card, Empty } from '@/components/ui'
import { AttentionBar } from '@/components/governance/attention'
import { SegmentedFilter } from '@/components/governance/segmented-filter'
import { VendorLabelForm, VendorReviewForm } from '@/components/governance/registry-forms'
import { DeclareAssetModal, DeclareVendorModal } from '@/components/governance/registry-declare'
import { AssetLabelForm } from '@/components/governance/asset-label-form'
import { organizationPeople } from '@/lib/governance/people'
import { attentionFor } from '@/lib/governance/attention-data'
import {
  ASSET_KIND_LABELS,
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
  const tab = inventaire === 'fournisseurs' ? 'fournisseurs' : inventaire === 'actifs' ? 'actifs' : 'cas-d-usage'
  const supabase = await createClient()

  const { data: organization } = await supabase
    .from('organization')
    .select(
      'id, business_ref, name, legal_name, sector, country_code, headcount, status, ai_activity_profile',
    )
    .eq('id', id)
    .maybeSingle()

  if (!organization) notFound()

  const [{ data: useCases }, { data: vendors }, { data: units }, { data: assetRows }, { data: assetRegister }] =
    await Promise.all([
      supabase
        .from('ai_use_case')
        .select('id, business_ref, name, status, criticality, autonomy_level, next_review_at')
        .eq('organization_id', id)
        .order('business_ref'),
      supabase
        .from('vendor')
        .select(
          'id, business_ref, name, criticality, review_status, next_review_at, country_code, subprocessors, notes',
        )
        .eq('organization_id', id)
        .order('name'),
      supabase.from('business_unit').select('id, name').eq('organization_id', id).order('name'),
      // Les actifs : ce que l'organisation emploie. La lecture du registre
      // (cas d'usage, mesures) et la ligne brute (pour corriger la fiche).
      supabase
        .from('ai_asset')
        .select('id, name, description, version, hosting_location, contains_personal_data, owner_user_id, vendor_id')
        .eq('organization_id', id),
      supabase.rpc('asset_register', { p_organization_id: id }),
    ])

  type RegisterAsset = {
    id: string
    business_ref: string
    name: string
    kind: string
    version: string | null
    hosting_location: string | null
    contains_personal_data: boolean
    vendor: { id: string; name: string; review_status: string } | null
    owner: string | null
    use_cases: { id: string; name: string; business_ref: string; status: string }[]
    measures: { id: string }[]
  }
  const assets = ((assetRegister ?? []) as RegisterAsset[]).sort((a, b) => a.name.localeCompare(b.name))
  const usedAssets = assets.filter((a) => a.use_cases.length)
  const idleAssets = assets.filter((a) => !a.use_cases.length)
  const assetRow = new Map((assetRows ?? []).map((a) => [a.id, a]))
  const vendorChoices = (vendors ?? []).map((v) => ({ id: v.id, name: v.name }))
  const people = (await organizationPeople(id)).map((p) => ({ id: p.userId, label: p.jobTitle ? `${p.name} — ${p.jobTitle}` : p.name }))

  const attention = await attentionFor(id)

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
            confidentialite en pied — reglees en administration.
          */}
          <Link
            href={`/admin/organizations/${id}/impression/registre`}
            className="rounded-md border border-ink-200 px-3.5 py-2 text-sm text-ink-700 hover:bg-ink-100"
          >
            Imprimer le registre
          </Link>
          {/*
            Le journal a quitte la fiche du cas d'usage : c'est une lecture
            d'audit, pas une rubrique de travail. Il se lit ici, par
            organisation, filtre par cas d'usage.
          */}
          <Link
            href={`/admin/organizations/${id}/journal`}
            className="rounded-md border border-ink-200 px-3.5 py-2 text-sm text-ink-700 hover:bg-ink-100"
          >
            Journal d’audit
          </Link>
          <Link
            href={`/admin/organizations/${id}/etudes-impact`}
            className="rounded-md bg-night-900 px-4 py-2.5 text-sm font-medium text-white hover:bg-night-800"
          >
            Conduire une étude d’impact IA
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

      {/*
        Le role de l'organisation vis-a-vis de l'IA se lit en pilotage : c'est
        une lecture de conformite, pas une entree du registre. La liste des
        usages prend toute la largeur.
      */}
      <div className="grid gap-5">
        <div>
          <Card
            title={tab === 'fournisseurs' ? 'Fournisseurs' : tab === 'actifs' ? 'Actifs d’IA' : "Cas d'usage IA"}
            subtitle={
              tab === 'fournisseurs'
                ? 'Revue tiers requise avant mise en service.'
                : tab === 'actifs'
                  ? `Ce que les cas d’usage emploient — systèmes, modèles, agents, jeux de données.${idleAssets.length ? ` ${idleAssets.length} déclaré(s) sans cas d’usage.` : ''}`
                  : "Chaque gouvernance part d'un usage réel."
            }
            action={
              <div className="flex flex-wrap items-center gap-3">
                <SegmentedFilter
                  label="Inventaire"
                  param="inventaire"
                  basePath={`/admin/organizations/${id}`}
                  selected={tab === 'fournisseurs' ? 'fournisseurs' : tab === 'actifs' ? 'actifs' : ''}
                  options={[
                    { key: '', label: 'Cas d’usage IA', count: useCases?.length ?? 0 },
                    { key: 'fournisseurs', label: 'Fournisseurs', count: vendors?.length ?? 0 },
                    { key: 'actifs', label: 'Actifs d’IA', count: usedAssets.length, hint: 'Actifs employés par au moins un cas d’usage.' },
                  ]}
                />
                {tab === 'actifs' ? (
                  <>
                    <DeclareAssetModal
                      organizationId={id}
                      vendors={vendorChoices}
                      people={people}
                      triggerClassName="rounded-md border border-ink-200 px-3.5 py-1.5 text-xs font-medium text-ink-700 hover:bg-ink-100"
                    />
                    <Link href={`/admin/organizations/${id}/actifs`} className="text-xs text-brand-600 hover:underline">
                      Registre complet
                    </Link>
                  </>
                ) : null}
                {tab === 'fournisseurs' ? (
                  <>
                    <DeclareVendorModal
                      organizationId={id}
                      triggerClassName="rounded-md border border-ink-200 px-3.5 py-1.5 text-xs font-medium text-ink-700 hover:bg-ink-100"
                    />
                  </>
                ) : null}
              </div>
            }
          >
            {tab === 'actifs' ? (
              assets.length ? (
                <ul className="divide-y divide-ink-100">
                  {[...usedAssets, ...idleAssets].map((a) => {
                    const row = assetRow.get(a.id)
                    return (
                      <li key={a.id} className="flex items-center justify-between gap-4 py-3">
                        <div className="min-w-0">
                          <Link href={`/admin/organizations/${id}/actifs/${a.id}`} className="text-sm font-medium text-brand-600 hover:underline">
                            {a.name}
                          </Link>
                          <p className="text-xs text-ink-400">
                            {a.business_ref} · {ASSET_KIND_LABELS[a.kind] ?? a.kind}
                            {a.version ? ` · v${a.version}` : ''}
                            {a.vendor ? ` · ${a.vendor.name}` : ''}
                            {a.hosting_location ? ` · ${a.hosting_location}` : ''}
                            {a.use_cases.length
                              ? ` · ${a.use_cases.map((u) => u.name).join(', ')}`
                              : ' · sans cas d’usage'}
                            {a.measures.length ? ` · ${a.measures.length} mesure(s) technique(s)` : ' · aucune mesure technique'}
                          </p>
                        </div>
                        <div className="flex shrink-0 items-center gap-2">
                          {a.contains_personal_data ? <Badge tone="warn">Données personnelles</Badge> : null}
                          {a.vendor && !['approved', 'approved_with_conditions'].includes(a.vendor.review_status) ? (
                            <Badge tone="warn">Tiers non revu</Badge>
                          ) : null}
                          {row ? (
                            <AssetLabelForm
                              organizationId={id}
                              asset={{
                                id: a.id, name: a.name, description: row.description, version: row.version, hosting_location: row.hosting_location,
                                contains_personal_data: row.contains_personal_data, owner_user_id: row.owner_user_id, vendor_id: row.vendor_id,
                              }}
                              people={people}
                              vendors={vendorChoices}
                            />
                          ) : null}
                        </div>
                      </li>
                    )
                  })}
                </ul>
              ) : (
                <Empty>Aucun actif d’IA déclaré. Un actif se rattache ensuite au cas d’usage qui l’emploie, depuis sa fiche.</Empty>
              )
            ) : tab === 'fournisseurs' ? (
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
                        <VendorLabelForm organizationId={id} vendor={v} />
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
      </div>
    </Shell>
  )
}

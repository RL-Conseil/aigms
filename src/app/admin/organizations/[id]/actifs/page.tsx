import Link from 'next/link'
import { notFound } from 'next/navigation'
import { createClient } from '@/lib/supabase/server'
import { Shell } from '@/components/shell'
import { Badge, Card, Empty } from '@/components/ui'
import { ASSET_KIND_LABELS, ASSET_MEASURE_STATUS_LABELS, USE_CASE_STATUS_LABELS, VENDOR_REVIEW_LABELS, formatDate, type UseCaseStatus } from '@/lib/domain/governance'
import { CRITICALITY_LABELS, type Criticality } from '@/lib/domain/criticality'
import { VendorLabelForm, VendorReviewForm } from '@/components/governance/registry-forms'
import { DeclareAssetModal, DeclareVendorModal } from '@/components/governance/registry-declare'
import { organizationPeople } from '@/lib/governance/people'

/**
 * Le registre des actifs d'IA.
 *
 * Ce que l'organisation emploie — systemes, modeles, agents, jeux de donnees
 * — avec, pour chacun, les cas d'usage qui s'en servent et les mesures
 * techniques posees dessus. C'est l'inventaire qu'ISO/IEC 42001 (A.6) et
 * l'AI Act demandent, et c'est la ou la gouvernance touche la technique.
 */
export type RegisterAsset = {
  id: string
  business_ref: string
  name: string
  kind: string
  description: string | null
  version: string | null
  hosting_location: string | null
  contains_personal_data: boolean
  vendor: { id: string; name: string; review_status: string } | null
  owner: string | null
  use_cases: { id: string; name: string; business_ref: string; status: string; relation: string }[]
  measures: { id: string; control_id: string; code: string; name: string; measure_kind: string; control_status: string; status: string; note: string | null; verified_at: string | null }[]
}

const KIND_ORDER = ['ai_system', 'ai_agent', 'ai_model', 'dataset']

export default async function AssetRegisterPage({
  params,
  searchParams,
}: {
  params: Promise<{ id: string }>
  searchParams: Promise<{ nature?: string }>
}) {
  const { id } = await params
  const { nature } = await searchParams
  const supabase = await createClient()
  const [{ data: organization }, { data: registerData }, { data: vendors }, people] = await Promise.all([
    supabase.from('organization').select('id, name').eq('id', id).maybeSingle(),
    supabase.rpc('asset_register', { p_organization_id: id }),
    supabase
      .from('vendor')
      .select('id, business_ref, name, is_model_provider, criticality, country_code, review_status, next_review_at, subprocessors, notes')
      .eq('organization_id', id)
      .order('name'),
    organizationPeople(id),
  ])
  if (!organization) notFound()
  const vendorChoices = (vendors ?? []).map((v) => ({ id: v.id, name: v.name }))
  const peopleChoices = people.map((p) => ({ id: p.userId, label: p.jobTitle ? `${p.name} — ${p.jobTitle}` : p.name }))
  const vendorsToReview = (vendors ?? []).filter((v) => !['approved', 'approved_with_conditions'].includes(v.review_status)).length

  const assets = ((registerData ?? []) as RegisterAsset[]).sort(
    (a, b) => KIND_ORDER.indexOf(a.kind) - KIND_ORDER.indexOf(b.kind) || a.name.localeCompare(b.name),
  )
  const shown = nature ? assets.filter((a) => a.kind === nature) : assets
  const counts = KIND_ORDER.map((k) => ({ kind: k, n: assets.filter((a) => a.kind === k).length }))
  const unused = assets.filter((a) => !a.use_cases.length).length
  const bare = assets.filter((a) => !a.measures.length).length

  return (
    <Shell
      breadcrumb={[
        { href: '/admin/organizations', label: 'Organisations' },
        { href: `/admin/organizations/${id}`, label: organization.name },
        { label: 'Actifs d’IA' },
      ]}
      organization={{ id, section: 'actifs' }}
      title="Actifs d’IA et fournisseurs"
      subtitle="Ce que l’organisation emploie — systèmes, modèles, agents, jeux de données, leurs mesures techniques — et les tiers dont elle dépend."
      actions={
        <div className="flex flex-wrap items-center gap-2">
          <DeclareAssetModal
            organizationId={id}
            vendors={vendorChoices}
            people={peopleChoices}
            triggerClassName="rounded-md bg-night-900 px-3.5 py-2 text-sm font-medium text-white hover:bg-night-800"
          />
          <DeclareVendorModal
            organizationId={id}
            triggerClassName="rounded-md border border-ink-200 px-3.5 py-2 text-sm text-ink-700 hover:bg-ink-100"
          />
          <Link
            href={`/admin/organizations/${id}/impression/actifs`}
            className="rounded-md border border-ink-200 px-3.5 py-2 text-sm text-ink-700 hover:bg-ink-100"
          >
            Imprimer le registre
          </Link>
        </div>
      }
    >
      <div className="mb-5 flex flex-wrap items-center gap-3">
        <nav aria-label="Filtrer par nature" className="flex rounded-md border border-ink-200 bg-white p-0.5">
          {[{ kind: '', n: assets.length }, ...counts].map((c) => (
            <Link
              key={c.kind || 'tous'}
              href={c.kind ? `/admin/organizations/${id}/actifs?nature=${c.kind}` : `/admin/organizations/${id}/actifs`}
              scroll={false}
              aria-current={(nature ?? '') === c.kind ? 'page' : undefined}
              className={`rounded px-3 py-1.5 text-sm ${
                (nature ?? '') === c.kind ? 'bg-night-900 font-medium text-white' : 'text-ink-600 hover:bg-ink-100'
              }`}
            >
              {c.kind ? ASSET_KIND_LABELS[c.kind] ?? c.kind : 'Tous'} {c.n}
            </Link>
          ))}
        </nav>
        <p className="text-xs text-ink-500">
          {unused ? `${unused} actif${unused > 1 ? 's' : ''} sans cas d’usage · ` : ''}
          {bare ? `${bare} sans mesure technique` : 'chaque actif porte au moins une mesure'}
        </p>
      </div>

      <div className="grid gap-5 lg:grid-cols-3">
        <div className="lg:col-span-2">
          <Card title="Actifs" subtitle={`${shown.length} actif${shown.length > 1 ? 's' : ''}`}>
            {shown.length ? (
              <ul className="divide-y divide-ink-100">
                {shown.map((asset) => {
                  const inPlace = asset.measures.filter((m) => m.status === 'implemented' || m.status === 'verified').length
                  return (
                    <li key={asset.id} className="py-3">
                      <div className="flex flex-wrap items-start justify-between gap-3">
                        <div className="min-w-0">
                          <Link
                            href={`/admin/organizations/${id}/actifs/${asset.id}`}
                            className="text-sm font-medium text-ink-900 hover:underline"
                          >
                            {asset.name}
                          </Link>
                          <p className="text-xs text-ink-400">
                            {asset.business_ref} · {ASSET_KIND_LABELS[asset.kind] ?? asset.kind}
                            {asset.version ? ` · v${asset.version}` : ''}
                            {asset.vendor ? ` · ${asset.vendor.name}` : ''}
                            {asset.hosting_location ? ` · ${asset.hosting_location}` : ''}
                            {asset.owner ? ` · ${asset.owner}` : ''}
                          </p>
                          {asset.description ? (
                            <p className="mt-1 text-sm text-ink-600">{asset.description}</p>
                          ) : null}
                          <p className="mt-1.5 flex flex-wrap gap-1.5">
                            {asset.use_cases.length ? (
                              asset.use_cases.map((u) => (
                                <Link
                                  key={u.id}
                                  href={`/admin/use-cases/${u.id}`}
                                  className="rounded-full border border-ink-200 px-2 py-0.5 text-[11px] text-brand-600 hover:bg-ink-50"
                                  title={USE_CASE_STATUS_LABELS[u.status as UseCaseStatus] ?? u.status}
                                >
                                  {u.name}
                                </Link>
                              ))
                            ) : (
                              <span className="text-[11px] text-ink-400">Aucun cas d’usage ne l’emploie.</span>
                            )}
                          </p>
                        </div>
                        <div className="flex shrink-0 flex-col items-end gap-1.5">
                          {asset.contains_personal_data ? <Badge tone="warn">Données personnelles</Badge> : null}
                          <Badge tone={asset.measures.length ? (inPlace === asset.measures.length ? 'ok' : 'warn') : 'neutral'}>
                            {asset.measures.length
                              ? `${inPlace}/${asset.measures.length} mesure${asset.measures.length > 1 ? 's' : ''} en place`
                              : 'Aucune mesure technique'}
                          </Badge>
                        </div>
                      </div>
                      {asset.measures.length ? (
                        <ul className="mt-2 flex flex-wrap gap-1.5">
                          {asset.measures.map((m) => (
                            <li
                              key={m.id}
                              className={`rounded-full px-2 py-0.5 text-[11px] ${
                                m.status === 'verified' || m.status === 'implemented' ? 'bg-ok-600/10 text-ok-600' : 'bg-ink-100 text-ink-600'
                              }`}
                              title={m.name}
                            >
                              {m.code} · {ASSET_MEASURE_STATUS_LABELS[m.status] ?? m.status}
                            </li>
                          ))}
                        </ul>
                      ) : null}
                    </li>
                  )
                })}
              </ul>
            ) : (
              <Empty>
                Aucun actif. Inscrire le modèle, le système ou le jeu de données employé — l’administration
                peut aussi importer l’inventaire existant.
              </Empty>
            )}
          </Card>
        </div>

        <div className="flex flex-col gap-5">
          {/*
            Les fournisseurs vivent ici avec les actifs : un actif vient
            souvent d'un tiers, et la revue de ce tiers conditionne la
            production. La fiche se corrige d'un crayon, la revue se tient.
          */}
          <Card
            title="Fournisseurs"
            subtitle={vendors?.length ? `${vendors.length} tiers${vendorsToReview ? ` · ${vendorsToReview} sans revue approuvée` : ''}` : 'Aucun tiers déclaré'}
            tone={vendorsToReview ? 'warn' : 'neutral'}
          >
            {vendors?.length ? (
              <ul className="divide-y divide-ink-100">
                {vendors.map((v) => (
                  <li key={v.id} className="py-2.5 text-sm">
                    <div className="flex flex-wrap items-start justify-between gap-2">
                      <div className="min-w-0">
                        <span className="text-ink-900">{v.name}</span>
                        {v.is_model_provider ? <Badge tone="info">Modèle</Badge> : null}
                        <p className="text-xs text-ink-400">
                          {v.business_ref} · criticité {CRITICALITY_LABELS[v.criticality as Criticality]?.toLowerCase() ?? v.criticality}
                          {v.country_code ? ` · ${v.country_code}` : ''}
                          {v.next_review_at ? ` · revue le ${formatDate(v.next_review_at)}` : ''}
                        </p>
                      </div>
                      <div className="flex shrink-0 items-center gap-2">
                        <Badge tone={['approved', 'approved_with_conditions'].includes(v.review_status) ? 'ok' : 'warn'}>
                          {VENDOR_REVIEW_LABELS[v.review_status] ?? v.review_status}
                        </Badge>
                        <VendorLabelForm organizationId={id} vendor={v} />
                        <VendorReviewForm organizationId={id} vendorId={v.id} name={v.name} reviewStatus={v.review_status} nextReviewAt={v.next_review_at} />
                      </div>
                    </div>
                  </li>
                ))}
              </ul>
            ) : (
              <Empty>Aucun fournisseur. Tant qu’un tiers impliqué n’est pas déclaré, sa revue ne peut pas être close — et le gate PRODUCTION l’exige.</Empty>
            )}
          </Card>
          {/* L'import d'un inventaire releve de l'administration (0062) : voir l'administration de l'organisation. */}
          <Card title="Lire ce registre" subtitle="Ce qu’il dit, et ce qu’il ne dit pas.">
            <p className="text-sm leading-relaxed text-ink-600">
              Un actif n’a de gouvernance que par les cas d’usage qui l’emploient : c’est là que se
              posent la qualification, les risques et les décisions. Les mesures techniques, elles, se
              posent sur l’actif — et se prouvent là. Un actif sans mesure ni cas d’usage est un
              inventaire, pas encore une gouvernance.
            </p>
          </Card>
        </div>
      </div>
    </Shell>
  )
}

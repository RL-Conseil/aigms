import Link from 'next/link'
import { createClient } from '@/lib/supabase/server'
import { Shell } from '@/components/shell'
import { Badge, Card, Empty, Stat, StatStrip } from '@/components/ui'
import { InfoTip } from '@/components/info-tip'
import { SegmentedFilter } from '@/components/governance/segmented-filter'
import { AssetLabelForm } from '@/components/governance/asset-label-form'
import { VendorLabelForm } from '@/components/governance/registry-forms'
import { RegistryImportForm } from '@/components/governance/registry-import'
import { DeclareAssetModal, DeclareVendorModal } from '@/components/governance/registry-declare'
import { getViewerContext, isAdministrating } from '@/lib/auth/context'
import { organizationPeople } from '@/lib/governance/people'
import { ROLE_LABELS } from '@/lib/domain/roles'
import { ASSET_KIND_LABELS, VENDOR_REVIEW_LABELS, formatDate } from '@/lib/domain/governance'
import { CRITICALITY_LABELS, type Criticality } from '@/lib/domain/criticality'

/**
 * Actifs d'IA et fournisseurs, pour l'administration.
 *
 * Les registres se lisent par organisation ; l'import en lot est reserve a
 * l'administration. Cette page est l'endroit central : toutes les
 * organisations, un filtre, la fiche d'un crayon, l'ajout et l'import dans
 * l'organisation choisie. Les memes formulaires que sur les registres — une
 * seule maniere de corriger un actif.
 */

const FIELD =
  'w-full rounded-md border border-ink-200 bg-white px-3 py-2 text-sm outline-none focus:border-brand-500 focus:ring-2 focus:ring-brand-500/20'

export default async function AdminAssetsVendorsPage({
  searchParams,
}: {
  searchParams: Promise<{ vue?: string; org?: string; nature?: string; q?: string }>
}) {
  const { vue, org, nature, q } = await searchParams
  const viewer = await getViewerContext()
  if (!isAdministrating(viewer)) {
    return (
      <Shell title="Actifs d’IA et fournisseurs">
        <Card title="Accès réservé">
          <Empty>
            La gestion centrale des actifs et des fournisseurs relève de l’administration. Votre rôle —{' '}
            {viewer?.role ? ROLE_LABELS[viewer.role] : 'non attribué'} — lit les registres depuis chaque organisation.
          </Empty>
        </Card>
      </Shell>
    )
  }

  const view = vue === 'fournisseurs' ? 'fournisseurs' : 'actifs'
  const supabase = await createClient()
  const [{ data: organizations }, { data: assets }, { data: vendors }] = await Promise.all([
    supabase.from('organization').select('id, name, business_ref').order('name'),
    supabase
      .from('ai_asset')
      .select(
        'id, organization_id, business_ref, kind, name, description, version, hosting_location, contains_personal_data, owner_user_id, vendor_id, updated_at, vendor:vendor_id (name), owner:owner_user_id (full_name, email)',
      )
      .order('name'),
    supabase
      .from('vendor')
      .select(
        'id, organization_id, business_ref, name, is_model_provider, criticality, country_code, review_status, next_review_at, subprocessors, notes, updated_at',
      )
      .order('name'),
  ])

  const orgs = organizations ?? []
  const orgName = new Map(orgs.map((o) => [o.id, o.name]))
  const selectedOrg = orgs.find((o) => o.id === org) ?? null
  const needle = q?.trim().toLowerCase()
  const matches = (text: (string | null | undefined)[]) =>
    !needle || text.some((t) => t?.toLowerCase().includes(needle))

  const shownAssets = (assets ?? [])
    .filter((a) => !selectedOrg || a.organization_id === selectedOrg.id)
    .filter((a) => !nature || a.kind === nature)
    .filter((a) => matches([a.name, a.business_ref, a.description, a.version, (a.vendor as unknown as { name: string } | null)?.name]))
  const shownVendors = (vendors ?? [])
    .filter((v) => !selectedOrg || v.organization_id === selectedOrg.id)
    .filter((v) => matches([v.name, v.business_ref, v.country_code, v.subprocessors]))

  // Les formulaires de correction ont besoin des personnes et des fournisseurs
  // de l'organisation de l'actif : lus une fois par organisation presente.
  const orgIds = [...new Set(shownAssets.map((a) => a.organization_id))]
  const peopleByOrg = new Map(
    await Promise.all(
      orgIds.map(async (oid) => {
        const people = await organizationPeople(oid)
        return [oid, people.map((p) => ({ id: p.userId, label: p.jobTitle ? `${p.name} — ${p.jobTitle}` : p.name }))] as const
      }),
    ),
  )
  const vendorsByOrg = new Map<string, { id: string; name: string }[]>()
  for (const v of vendors ?? []) {
    const list = vendorsByOrg.get(v.organization_id) ?? []
    list.push({ id: v.id, name: v.name })
    vendorsByOrg.set(v.organization_id, list)
  }

  // Declarer dans l'organisation choisie : ses personnes, meme sans actif encore.
  const selectedPeople = selectedOrg
    ? (peopleByOrg.get(selectedOrg.id) ??
      (await organizationPeople(selectedOrg.id)).map((p) => ({ id: p.userId, label: p.jobTitle ? `${p.name} — ${p.jobTitle}` : p.name })))
    : []

  const base = '/admin/actifs-fournisseurs'
  const current = { vue: view, org: selectedOrg?.id, nature: nature || undefined, q: q || undefined }
  const person = (value: unknown) => {
    const p = value as { full_name: string | null; email: string } | null
    return p ? p.full_name?.trim() || p.email : null
  }

  return (
    <Shell
      title="Actifs d’IA et fournisseurs"
      subtitle="Toutes les organisations. La fiche d’un crayon ; l’ajout et l’import dans l’organisation choisie."
      actions={
        <div className="flex flex-wrap items-center gap-3">
          <nav aria-label="Actifs ou fournisseurs" className="flex rounded-md border border-ink-200 bg-white p-0.5">
            {(['actifs', 'fournisseurs'] as const).map((key) => (
              <Link
                key={key}
                href={`${base}?vue=${key}${selectedOrg ? `&org=${selectedOrg.id}` : ''}`}
                aria-current={view === key ? 'page' : undefined}
                className={`rounded px-3 py-1.5 text-sm ${view === key ? 'bg-night-900 font-medium text-white' : 'text-ink-600 hover:bg-ink-100'}`}
              >
                {key === 'actifs' ? 'Actifs d’IA' : 'Fournisseurs'}
              </Link>
            ))}
          </nav>
          <InfoTip label="À quoi sert cette page" title="Un endroit central, les mêmes fiches">
            <div className="flex flex-col gap-3 text-sm leading-relaxed text-ink-600">
              <p>
                Les registres d’actifs et de fournisseurs se lisent et se tiennent par organisation. Ici, l’administration
                les voit <strong className="font-medium text-ink-800">tous</strong>, filtre, et corrige une fiche avec le
                même formulaire que sur le registre — une seule manière de corriger.
              </p>
              <p>
                <strong className="font-medium text-ink-800">Ajouter et importer</strong> se font dans une organisation :
                la choisir dans le filtre fait apparaître les boutons. L’import en lot (CSV) est réservé à l’administration.
              </p>
            </div>
          </InfoTip>
        </div>
      }
    >
      <StatStrip>
        <Stat label="Organisations" value={orgs.length} />
        <Stat label="Actifs d’IA" value={(assets ?? []).length} />
        <Stat label="Fournisseurs" value={(vendors ?? []).length} />
        <Stat
          label="Fournisseurs sans revue approuvée"
          value={(vendors ?? []).filter((v) => !['approved', 'approved_with_conditions'].includes(v.review_status)).length}
          tone="warn"
        />
      </StatStrip>

      <div className="mt-5 grid gap-5 lg:grid-cols-4">
        <div className="space-y-5 lg:col-span-3">
          <Card title="Filtres">
            <form method="get" className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
              <input type="hidden" name="vue" value={view} />
              <div className="lg:col-span-2">
                <label htmlFor="org" className="mb-1 block text-xs font-medium text-ink-600">Organisation</label>
                <select id="org" name="org" defaultValue={selectedOrg?.id ?? ''} className={FIELD}>
                  <option value="">Toutes</option>
                  {orgs.map((o) => (
                    <option key={o.id} value={o.id}>{o.name}</option>
                  ))}
                </select>
              </div>
              <div className="lg:col-span-2">
                <label htmlFor="q" className="mb-1 block text-xs font-medium text-ink-600">Nom, référence, version, pays</label>
                <input id="q" name="q" type="text" defaultValue={q ?? ''} className={FIELD} />
              </div>
              <div className="flex items-center gap-3 sm:col-span-2 lg:col-span-4">
                <button type="submit" className="rounded-md bg-night-900 px-4 py-2 text-sm font-medium text-white hover:bg-night-800">Filtrer</button>
                {selectedOrg || nature || q ? <Link href={`${base}?vue=${view}`} className="text-sm text-ink-600 hover:underline">Tout afficher</Link> : null}
              </div>
            </form>
            {view === 'actifs' ? (
              <div className="mt-3">
                <SegmentedFilter
                  label="Filtrer par nature"
                  param="nature"
                  basePath={base}
                  current={current}
                  selected={nature}
                  options={[
                    { key: '', label: 'Toutes', count: (assets ?? []).filter((a) => !selectedOrg || a.organization_id === selectedOrg.id).length },
                    ...Object.entries(ASSET_KIND_LABELS).map(([k, label]) => ({
                      key: k,
                      label,
                      count: (assets ?? []).filter((a) => a.kind === k && (!selectedOrg || a.organization_id === selectedOrg.id)).length,
                    })),
                  ]}
                />
              </div>
            ) : null}
          </Card>

          {view === 'actifs' ? (
            <Card title="Actifs d’IA" subtitle={`${shownAssets.length} actif(s)`}>
              {shownAssets.length ? (
                <ul className="divide-y divide-ink-100">
                  {shownAssets.map((a) => (
                    <li key={a.id} className="flex flex-wrap items-start justify-between gap-3 py-3 first:pt-0 last:pb-0">
                      <div className="min-w-0">
                        <div className="flex flex-wrap items-center gap-2">
                          <Link href={`/admin/organizations/${a.organization_id}/actifs/${a.id}`} className="text-sm font-medium text-ink-900 hover:underline">
                            {a.name}
                          </Link>
                          <Badge>{ASSET_KIND_LABELS[a.kind] ?? a.kind}</Badge>
                          {a.contains_personal_data ? <Badge tone="warn">Données personnelles</Badge> : null}
                        </div>
                        <p className="text-xs text-ink-500">
                          {a.business_ref} · <Link href={`/admin/organizations/${a.organization_id}`} className="text-brand-600 hover:underline">{orgName.get(a.organization_id) ?? 'organisation'}</Link>
                          {a.version ? ` · v${a.version}` : ''}
                          {(a.vendor as unknown as { name: string } | null)?.name ? ` · ${(a.vendor as unknown as { name: string }).name}` : ''}
                          {a.hosting_location ? ` · ${a.hosting_location}` : ''}
                          {person(a.owner) ? ` · ${person(a.owner)}` : ' · sans responsable'}
                          {` · modifié le ${formatDate(a.updated_at)}`}
                        </p>
                      </div>
                      <AssetLabelForm
                        organizationId={a.organization_id}
                        asset={{
                          id: a.id, name: a.name, description: a.description, version: a.version, hosting_location: a.hosting_location,
                          contains_personal_data: a.contains_personal_data, owner_user_id: a.owner_user_id, vendor_id: a.vendor_id,
                        }}
                        people={peopleByOrg.get(a.organization_id) ?? []}
                        vendors={vendorsByOrg.get(a.organization_id) ?? []}
                      />
                    </li>
                  ))}
                </ul>
              ) : (
                <Empty>Aucun actif dans ce filtre.</Empty>
              )}
            </Card>
          ) : (
            <Card title="Fournisseurs" subtitle={`${shownVendors.length} fournisseur(s)`}>
              {shownVendors.length ? (
                <ul className="divide-y divide-ink-100">
                  {shownVendors.map((v) => (
                    <li key={v.id} className="flex flex-wrap items-start justify-between gap-3 py-3 first:pt-0 last:pb-0">
                      <div className="min-w-0">
                        <div className="flex flex-wrap items-center gap-2">
                          <Link href={`/admin/organizations/${v.organization_id}#fournisseurs`} className="text-sm font-medium text-ink-900 hover:underline">
                            {v.name}
                          </Link>
                          {v.is_model_provider ? <Badge tone="info">Fournisseur de modèle</Badge> : null}
                          <Badge tone={['approved', 'approved_with_conditions'].includes(v.review_status) ? 'ok' : 'warn'}>
                            {VENDOR_REVIEW_LABELS[v.review_status] ?? v.review_status}
                          </Badge>
                        </div>
                        <p className="text-xs text-ink-500">
                          {v.business_ref} · <Link href={`/admin/organizations/${v.organization_id}`} className="text-brand-600 hover:underline">{orgName.get(v.organization_id) ?? 'organisation'}</Link>
                          {` · criticité ${CRITICALITY_LABELS[v.criticality as Criticality]?.toLowerCase() ?? v.criticality}`}
                          {v.country_code ? ` · ${v.country_code}` : ''}
                          {v.next_review_at ? ` · revue le ${formatDate(v.next_review_at)}` : ''}
                        </p>
                      </div>
                      <VendorLabelForm organizationId={v.organization_id} vendor={{ id: v.id, name: v.name, country_code: v.country_code, subprocessors: v.subprocessors, notes: v.notes }} />
                    </li>
                  ))}
                </ul>
              ) : (
                <Empty>Aucun fournisseur dans ce filtre.</Empty>
              )}
            </Card>
          )}
        </div>

        <div className="space-y-5">
          <Card title="Ajouter" subtitle={selectedOrg ? `Dans ${selectedOrg.name}.` : 'Choisir une organisation dans le filtre.'}>
            {selectedOrg ? (
              <div className="flex flex-col gap-2">
                <DeclareAssetModal
                  organizationId={selectedOrg.id}
                  vendors={vendorsByOrg.get(selectedOrg.id) ?? []}
                  people={selectedPeople}
                  triggerClassName="rounded-md bg-night-900 px-4 py-2.5 text-center text-sm font-medium text-white hover:bg-night-800"
                />
                <DeclareVendorModal
                  organizationId={selectedOrg.id}
                  triggerClassName="rounded-md border border-ink-200 px-4 py-2.5 text-center text-sm text-ink-700 hover:bg-ink-100"
                />
              </div>
            ) : (
              <p className="text-xs text-ink-500">Un actif ou un fournisseur appartient à une organisation : elle se choisit d’abord.</p>
            )}
          </Card>
          <Card title={view === 'actifs' ? 'Importer les actifs d’IA' : 'Importer les fournisseurs'} subtitle="En lot, depuis un fichier CSV. Réservé à l’administration.">
            {selectedOrg ? (
              <RegistryImportForm organizationId={selectedOrg.id} what={view} />
            ) : (
              <p className="text-xs text-ink-500">Choisir une organisation dans le filtre pour importer.</p>
            )}
          </Card>
        </div>
      </div>
    </Shell>
  )
}

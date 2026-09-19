import Link from 'next/link'
import { notFound } from 'next/navigation'
import { createClient } from '@/lib/supabase/server'
import { Shell } from '@/components/shell'
import { Badge, Card, Empty, Field } from '@/components/ui'
import { AssetLabelForm } from '@/components/governance/asset-label-form'
import {
  ASSET_KIND_LABELS,
  ASSET_MEASURE_STATUS_LABELS,
  CONTROL_STATUS_LABELS,
  controlStatusTone,
  formatDate,
  USE_CASE_STATUS_LABELS,
  type UseCaseStatus,
} from '@/lib/domain/governance'
import type { RegisterAsset } from '../page'

/**
 * La fiche d'un actif : ce qu'il est, qui l'emploie, les mesures techniques
 * posees dessus et les preuves qui les demontrent, le fournisseur.
 */
export default async function AssetPage({ params }: { params: Promise<{ id: string; assetId: string }> }) {
  const { id, assetId } = await params
  const supabase = await createClient()
  const [{ data: organization }, { data: registerData }, { data: memberships }, { data: vendors }] = await Promise.all([
    supabase.from('organization').select('id, name').eq('id', id).maybeSingle(),
    supabase.rpc('asset_register', { p_organization_id: id }),
    supabase.from('membership').select('user:user_id (id, full_name, email, job_title)').eq('status', 'active'),
    supabase.from('vendor').select('id, name').eq('organization_id', id).order('name'),
  ])
  if (!organization) notFound()
  const asset = ((registerData ?? []) as RegisterAsset[]).find((a) => a.id === assetId)
  if (!asset) notFound()

  const { data: raw } = await supabase
    .from('ai_asset')
    .select('description, version, hosting_location, contains_personal_data, owner_user_id, vendor_id')
    .eq('id', assetId)
    .maybeSingle()

  // Les preuves des mesures posees sur l'actif : celles rattachees a leurs controles.
  const controlIds = asset.measures.map((m) => m.control_id)
  const { data: evidenceLinks } = controlIds.length
    ? await supabase
        .from('control_evidence')
        .select('control_id, evidence:evidence_id (id, business_ref, title, validation_status, valid_until)')
        .in('control_id', controlIds)
    : { data: null }
  const evidenceByControl = new Map<string, { id: string; business_ref: string; title: string; validation_status: string; valid_until: string | null }[]>()
  for (const l of evidenceLinks ?? []) {
    const e = l.evidence as unknown as { id: string; business_ref: string; title: string; validation_status: string; valid_until: string | null } | null
    if (!e) continue
    const list = evidenceByControl.get(l.control_id) ?? []
    list.push(e)
    evidenceByControl.set(l.control_id, list)
  }

  const people = (memberships ?? [])
    .map((m) => m.user as unknown as { id: string; full_name: string | null; email: string; job_title: string | null } | null)
    .filter((u): u is NonNullable<typeof u> => Boolean(u))
    .map((u) => ({ id: u.id, label: u.full_name ? `${u.full_name}${u.job_title ? ` — ${u.job_title}` : ''}` : u.email }))

  return (
    <Shell
      breadcrumb={[
        { href: '/admin/organizations', label: 'Organisations' },
        { href: `/admin/organizations/${id}`, label: organization.name },
        { href: `/admin/organizations/${id}/actifs`, label: 'Actifs d’IA' },
        { label: asset.name },
      ]}
      organization={{ id, section: 'actifs' }}
      title={asset.name}
      subtitle={`${asset.business_ref} · ${ASSET_KIND_LABELS[asset.kind] ?? asset.kind}${asset.version ? ` · v${asset.version}` : ''}`}
      titleAside={
        <AssetLabelForm
          organizationId={id}
          asset={{
            id: assetId,
            name: asset.name,
            description: raw?.description ?? null,
            version: raw?.version ?? null,
            hosting_location: raw?.hosting_location ?? null,
            contains_personal_data: raw?.contains_personal_data ?? false,
            owner_user_id: raw?.owner_user_id ?? null,
            vendor_id: raw?.vendor_id ?? null,
          }}
          people={people}
          vendors={vendors ?? []}
        />
      }
      actions={asset.contains_personal_data ? <Badge tone="warn">Données personnelles</Badge> : null}
    >
      <div className="grid gap-5 lg:grid-cols-3">
        <div className="space-y-5 lg:col-span-2">
          <Card title="Identité">
            <dl className="grid gap-4 sm:grid-cols-2">
              <Field label="Nature">{ASSET_KIND_LABELS[asset.kind] ?? asset.kind}</Field>
              <Field label="Version">{asset.version ?? '—'}</Field>
              <Field label="Hébergement">{asset.hosting_location ?? '—'}</Field>
              <Field label="Responsable">{asset.owner ?? '—'}</Field>
              <Field label="Fournisseur">
                {asset.vendor ? `${asset.vendor.name} · revue ${asset.vendor.review_status}` : '—'}
              </Field>
              <Field label="Données personnelles">{asset.contains_personal_data ? 'Oui' : 'Non'}</Field>
            </dl>
            {asset.description ? <p className="mt-4 text-sm leading-relaxed text-ink-600">{asset.description}</p> : null}
          </Card>

          <Card
            title="Mesures techniques posées sur cet actif"
            subtitle="Et les preuves qui les démontrent. Une mesure se pose depuis la fiche du cas d’usage (Contrôles affectés)."
          >
            {asset.measures.length ? (
              <ul className="divide-y divide-ink-100">
                {asset.measures.map((m) => (
                  <li key={m.id} className="py-3">
                    <div className="flex flex-wrap items-start justify-between gap-2">
                      <span className="text-sm text-ink-900">
                        {m.code} — {m.name}
                      </span>
                      <span className="flex items-center gap-1.5">
                        <Badge tone={m.status === 'verified' || m.status === 'implemented' ? 'ok' : 'neutral'}>
                          {ASSET_MEASURE_STATUS_LABELS[m.status] ?? m.status}
                          {m.verified_at ? ` le ${formatDate(m.verified_at)}` : ''}
                        </Badge>
                        <Badge tone={controlStatusTone(m.control_status)}>
                          Contrôle : {CONTROL_STATUS_LABELS[m.control_status] ?? m.control_status}
                        </Badge>
                      </span>
                    </div>
                    {m.note ? <p className="text-xs text-ink-600">{m.note}</p> : null}
                    <p className="mt-1 text-xs text-ink-500">
                      {evidenceByControl.get(m.control_id)?.length
                        ? evidenceByControl.get(m.control_id)!.map((e) => (
                            <Link
                              key={e.id}
                              href={`/admin/organizations/${id}/preuves?preuve=${e.id}`}
                              className={`mr-2 hover:underline ${e.validation_status === 'validated' ? 'text-ok-600' : 'text-ink-500'}`}
                            >
                              {e.business_ref} {e.title}
                            </Link>
                          ))
                        : 'Aucune preuve rattachée au contrôle.'}
                    </p>
                  </li>
                ))}
              </ul>
            ) : (
              <Empty>Aucune mesure technique posée. Elles se posent depuis les cas d’usage qui emploient l’actif.</Empty>
            )}
          </Card>
        </div>

        <div className="space-y-5">
          <Card title="Cas d’usage qui l’emploient" subtitle={`${asset.use_cases.length} cas d’usage`}>
            {asset.use_cases.length ? (
              <ul className="divide-y divide-ink-100">
                {asset.use_cases.map((u) => (
                  <li key={u.id} className="flex items-baseline justify-between gap-2 py-2 text-sm">
                    <Link href={`/admin/use-cases/${u.id}`} className="text-ink-900 hover:underline">
                      {u.name}
                      <span className="block text-xs text-ink-400">
                        {u.business_ref}
                        {u.relation && u.relation !== 'uses' ? ` · ${u.relation}` : ''}
                      </span>
                    </Link>
                    <Badge tone="info">{USE_CASE_STATUS_LABELS[u.status as UseCaseStatus] ?? u.status}</Badge>
                  </li>
                ))}
              </ul>
            ) : (
              <Empty>Aucun cas d’usage. L’actif se rattache depuis le fil conducteur d’un cas d’usage.</Empty>
            )}
          </Card>
        </div>
      </div>
    </Shell>
  )
}

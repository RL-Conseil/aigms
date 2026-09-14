import { notFound } from 'next/navigation'
import type { Metadata } from 'next'
import { createClient } from '@/lib/supabase/server'
import { PrintDocument } from '@/components/print/document'
import { documentIdentity } from '@/lib/governance/document-identity'
import { ACTIVITY_PROFILE_LABELS, type ActivityProfile } from '@/lib/domain/activity-profile'
import {
  AUTONOMY_LABELS,
  RISK_LEVEL_LABELS,
  type RiskLevel,
  USE_CASE_STATUS_LABELS,
  VENDOR_REVIEW_LABELS,
  formatDate,
  type UseCaseStatus,
} from '@/lib/domain/governance'

/**
 * Registre des usages d'IA, version remise.
 *
 * C'est la piece qu'on demande en premier : que fait cette organisation avec de
 * l'IA, sous la responsabilite de qui, a quel niveau d'autonomie, dans quel
 * etat de cycle de vie. Les tiers qui y concourent suivent, parce qu'un
 * registre qui tait ses fournisseurs n'en est pas un.
 *
 * Les usages retires figurent aussi : un registre qui n'inscrit que ce qui
 * tourne aujourd'hui ne permet pas de reconstituer ce qui tournait hier.
 */

export const metadata: Metadata = {
  title: 'Registre des usages d’IA',
  robots: { index: false, follow: false },
}

const CRITICALITY_LABELS: Record<string, string> = {
  low: 'Faible',
  moderate: 'Modérée',
  high: 'Élevée',
  critical: 'Critique',
}

export default async function PrintableRegistryPage({
  params,
}: {
  params: Promise<{ id: string }>
}) {
  const { id } = await params
  const supabase = await createClient()

  const [
    { data: organization },
    { data: useCases },
    { data: vendors },
    { data: risks },
    identity,
  ] = await Promise.all([
    supabase
      .from('organization')
      .select('id, name, sector, headcount, ai_activity_profile')
      .eq('id', id)
      .maybeSingle(),
    supabase
      .from('ai_use_case')
      .select(
        `id, business_ref, name, purpose, status, autonomy_level, criticality,
         next_review_at, involves_personal_data, involves_vulnerable_persons,
         owner:owner_user_id (full_name, email),
         accountable:accountable_user_id (full_name, email),
         activity:activity_id (name, process:process_id (name))`,
      )
      .eq('organization_id', id)
      .order('business_ref'),
    supabase
      .from('vendor')
      .select('id, business_ref, name, criticality, country_code, review_status, next_review_at, is_model_provider')
      .eq('organization_id', id)
      .order('name'),
    supabase
      .from('risk')
      .select('id, use_case_id, residual_level, status')
      .eq('organization_id', id),
    documentIdentity(id),
  ])

  if (!organization || !identity) notFound()

  const profile = (organization.ai_activity_profile ?? null) as ActivityProfile | null
  const rows = useCases ?? []

  const openRisksByUseCase = new Map<string, { level: string | null; count: number }>()
  for (const risk of risks ?? []) {
    if (!risk.use_case_id) continue
    if (['closed', 'accepted'].includes(risk.status ?? '')) continue
    const current = openRisksByUseCase.get(risk.use_case_id) ?? { level: null, count: 0 }
    current.count += 1
    const order = ['low', 'moderate', 'high', 'critical']
    if (
      risk.residual_level &&
      (current.level === null || order.indexOf(risk.residual_level) > order.indexOf(current.level))
    ) {
      current.level = risk.residual_level
    }
    openRisksByUseCase.set(risk.use_case_id, current)
  }

  const person = (value: unknown): string => {
    const p = value as { full_name: string | null; email: string } | null
    if (!p) return '—'
    return p.full_name?.trim() || p.email
  }

  const inProduction = rows.filter((r) => r.status === 'PRODUCTION').length
  const retired = rows.filter((r) => r.status === 'RETIRED').length

  return (
    <PrintDocument
      identity={identity}
      title="Registre des usages d’IA"
      subtitle="Ce que l’organisation met en œuvre, sous la responsabilité de qui, et dans quel état."
      backHref={`/admin/organizations/${id}`}
      backLabel="Retour à l’organisation"
    >
      <section className="doc-keep mb-7 rounded-md border border-ink-200 bg-ink-50 p-4">
        <dl className="grid grid-cols-2 gap-x-6 gap-y-2 text-[12px] sm:grid-cols-4">
          <div>
            <dt className="text-ink-500">Rôle vis-à-vis de l’IA</dt>
            <dd className="font-medium text-ink-900">
              {profile ? ACTIVITY_PROFILE_LABELS[profile] : 'Non renseigné'}
            </dd>
          </div>
          <div>
            <dt className="text-ink-500">Usages inscrits</dt>
            <dd className="font-medium text-ink-900">{rows.length}</dd>
          </div>
          <div>
            <dt className="text-ink-500">En production</dt>
            <dd className="font-medium text-ink-900">{inProduction}</dd>
          </div>
          <div>
            <dt className="text-ink-500">Retirés</dt>
            <dd className="font-medium text-ink-900">{retired}</dd>
          </div>
        </dl>
      </section>

      {/* ---------- Les usages ---------- */}
      <section className="mb-8">
        <h2 className="mb-2 border-b border-ink-200 pb-1.5 font-serif text-base font-semibold text-ink-900">
          Usages d’IA
        </h2>

        {rows.length ? (
          <table className="w-full border-collapse text-[11px] leading-snug">
            <thead>
              <tr className="border-b border-ink-200 text-left text-ink-500">
                <th className="w-[70px] py-1.5 pr-2 font-medium">Réf.</th>
                <th className="py-1.5 pr-2 font-medium">Usage et finalité</th>
                <th className="py-1.5 pr-2 font-medium">Responsables</th>
                <th className="w-[92px] py-1.5 pr-2 font-medium">Autonomie</th>
                <th className="w-[78px] py-1.5 pr-2 font-medium">Criticité</th>
                <th className="w-[96px] py-1.5 pr-2 font-medium">État</th>
                <th className="w-[84px] py-1.5 font-medium">Risques</th>
              </tr>
            </thead>
            <tbody>
              {rows.map((row) => {
                const activity = row.activity as unknown as {
                  name: string
                  process: { name: string } | null
                } | null
                const open = openRisksByUseCase.get(row.id)
                return (
                  <tr key={row.id} className="border-b border-ink-100 align-top">
                    <td className="py-2 pr-2 font-mono text-[10px] text-ink-500">
                      {row.business_ref}
                    </td>
                    <td className="py-2 pr-2">
                      <span className="font-medium text-ink-900">{row.name}</span>
                      <span className="block text-ink-600">{row.purpose}</span>
                      {activity ? (
                        <span className="block text-[10px] text-ink-400">
                          {activity.process?.name ?? '—'} › {activity.name}
                        </span>
                      ) : null}
                      {row.involves_personal_data || row.involves_vulnerable_persons ? (
                        <span className="block text-[10px] text-ink-500">
                          {[
                            row.involves_personal_data ? 'données personnelles' : null,
                            row.involves_vulnerable_persons ? 'personnes vulnérables' : null,
                          ]
                            .filter(Boolean)
                            .join(' · ')}
                        </span>
                      ) : null}
                    </td>
                    <td className="py-2 pr-2 text-ink-700">
                      <span className="block">{person(row.owner)}</span>
                      <span className="block text-[10px] text-ink-500">
                        Redevable : {person(row.accountable)}
                      </span>
                    </td>
                    <td className="py-2 pr-2 text-ink-700">
                      {AUTONOMY_LABELS[row.autonomy_level] ?? row.autonomy_level}
                    </td>
                    <td className="py-2 pr-2 text-ink-700">
                      {row.criticality
                        ? (CRITICALITY_LABELS[row.criticality] ?? row.criticality)
                        : 'Non qualifiée'}
                    </td>
                    <td className="py-2 pr-2 text-ink-700">
                      <span className="block">
                        {USE_CASE_STATUS_LABELS[row.status as UseCaseStatus] ?? row.status}
                      </span>
                      {row.next_review_at ? (
                        <span className="block text-[10px] text-ink-500">
                          Revue le {formatDate(row.next_review_at)}
                        </span>
                      ) : null}
                    </td>
                    <td className="py-2 text-ink-700">
                      {open
                        ? `${open.count} ouvert(s)${
                            open.level ? ` · ${RISK_LEVEL_LABELS[open.level as RiskLevel] ?? open.level}` : ''
                          }`
                        : 'Aucun'}
                    </td>
                  </tr>
                )
              })}
            </tbody>
          </table>
        ) : (
          <p className="py-4 text-[12px] text-ink-500">
            Aucun usage d’IA inscrit à ce jour. Un registre vide se déclare : il ne s’omet pas.
          </p>
        )}
      </section>

      {/* ---------- Les tiers ---------- */}
      <section>
        <h2 className="mb-2 border-b border-ink-200 pb-1.5 font-serif text-base font-semibold text-ink-900">
          Tiers concourant aux usages
        </h2>

        {vendors?.length ? (
          <table className="w-full border-collapse text-[11px] leading-snug">
            <thead>
              <tr className="border-b border-ink-200 text-left text-ink-500">
                <th className="w-[70px] py-1.5 pr-2 font-medium">Réf.</th>
                <th className="py-1.5 pr-2 font-medium">Fournisseur</th>
                <th className="w-[54px] py-1.5 pr-2 font-medium">Pays</th>
                <th className="w-[78px] py-1.5 pr-2 font-medium">Criticité</th>
                <th className="py-1.5 font-medium">Revue tiers</th>
              </tr>
            </thead>
            <tbody>
              {vendors.map((vendor) => (
                <tr key={vendor.id} className="border-b border-ink-100 align-top">
                  <td className="py-2 pr-2 font-mono text-[10px] text-ink-500">
                    {vendor.business_ref}
                  </td>
                  <td className="py-2 pr-2">
                    <span className="font-medium text-ink-900">{vendor.name}</span>
                    {vendor.is_model_provider ? (
                      <span className="block text-[10px] text-ink-500">Fournisseur de modèle</span>
                    ) : null}
                  </td>
                  <td className="py-2 pr-2 text-ink-700">{vendor.country_code ?? '—'}</td>
                  <td className="py-2 pr-2 text-ink-700">
                    {CRITICALITY_LABELS[vendor.criticality] ?? vendor.criticality}
                  </td>
                  <td className="py-2 text-ink-700">
                    <span className="block">
                      {VENDOR_REVIEW_LABELS[vendor.review_status] ?? vendor.review_status}
                    </span>
                    {vendor.next_review_at ? (
                      <span className="block text-[10px] text-ink-500">
                        Prochaine revue le {formatDate(vendor.next_review_at)}
                      </span>
                    ) : null}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        ) : (
          <p className="py-4 text-[12px] text-ink-500">
            Aucun tiers déclaré. Tant qu’un fournisseur impliqué n’est pas inscrit, sa revue ne peut
            pas être close — et le gate PRODUCTION l’exige.
          </p>
        )}
      </section>
    </PrintDocument>
  )
}

import { notFound } from 'next/navigation'
import type { Metadata } from 'next'
import { createClient } from '@/lib/supabase/server'
import { PrintDocument } from '@/components/print/document'
import { documentIdentity } from '@/lib/governance/document-identity'
import { ASSET_KIND_LABELS, ASSET_MEASURE_STATUS_LABELS } from '@/lib/domain/governance'
import type { RegisterAsset } from '@/lib/domain/assets'

export const metadata: Metadata = { title: 'Registre des actifs d’IA' }

/** Le registre des actifs, imprimable : l'inventaire qu'un auditeur demande en premier. */
export default async function PrintableAssetsPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params
  const supabase = await createClient()
  const [{ data: registerData }, identity] = await Promise.all([
    supabase.rpc('asset_register', { p_organization_id: id }),
    documentIdentity(id),
  ])
  if (!identity) notFound()
  const assets = (registerData ?? []) as RegisterAsset[]
  const kinds = ['ai_system', 'ai_agent', 'ai_model', 'dataset']

  return (
    <PrintDocument
      identity={identity}
      title="Registre des actifs d’IA"
      subtitle="Systèmes, modèles, agents et jeux de données employés, les usages qui s’en servent, les mesures techniques posées."
      backHref={`/admin/organizations/${id}/actifs`}
      backLabel="Retour au registre"
    >
      <section className="doc-keep mb-7 rounded-md border border-ink-200 bg-ink-50 p-4">
        <dl className="grid grid-cols-2 gap-x-6 gap-y-2 text-[12px] sm:grid-cols-5">
          <div>
            <dt className="text-ink-500">Actifs inscrits</dt>
            <dd className="font-medium text-ink-900">{assets.length}</dd>
          </div>
          {kinds.map((k) => (
            <div key={k}>
              <dt className="text-ink-500">{ASSET_KIND_LABELS[k] ?? k}</dt>
              <dd className="font-medium text-ink-900">{assets.filter((a) => a.kind === k).length}</dd>
            </div>
          ))}
        </dl>
      </section>

      {kinds.map((k) => {
        const rows = assets.filter((a) => a.kind === k)
        if (!rows.length) return null
        return (
          <section key={k} className="mb-8">
            <h2 className="mb-2 border-b border-ink-200 pb-1.5 font-serif text-base font-semibold text-ink-900">
              {ASSET_KIND_LABELS[k] ?? k}
            </h2>
            <table className="w-full border-collapse text-[11px] leading-snug">
              <thead>
                <tr className="border-b border-ink-200 text-left text-ink-500">
                  <th className="w-[76px] py-1.5 pr-2 font-medium">Réf.</th>
                  <th className="py-1.5 pr-2 font-medium">Actif</th>
                  <th className="py-1.5 pr-2 font-medium">Fournisseur · hébergement</th>
                  <th className="py-1.5 pr-2 font-medium">Cas d’usage</th>
                  <th className="py-1.5 pr-2 font-medium">Mesures techniques</th>
                  <th className="w-[60px] py-1.5 font-medium">Données perso.</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-ink-100">
                {rows.map((a) => (
                  <tr key={a.id} className="doc-keep align-top">
                    <td className="py-1.5 pr-2 font-mono text-[10px] text-ink-500">{a.business_ref}</td>
                    <td className="py-1.5 pr-2">
                      <span className="font-medium text-ink-900">{a.name}</span>
                      {a.version ? <span className="text-ink-500"> · v{a.version}</span> : null}
                      {a.description ? <span className="block text-ink-600">{a.description}</span> : null}
                      {a.owner ? <span className="block text-ink-500">Responsable : {a.owner}</span> : null}
                    </td>
                    <td className="py-1.5 pr-2 text-ink-700">
                      {a.vendor?.name ?? '—'}
                      {a.hosting_location ? <span className="block text-ink-500">{a.hosting_location}</span> : null}
                    </td>
                    <td className="py-1.5 pr-2 text-ink-700">
                      {a.use_cases.length ? a.use_cases.map((u) => `${u.business_ref} ${u.name}`).join(' ; ') : '—'}
                    </td>
                    <td className="py-1.5 pr-2 text-ink-700">
                      {a.measures.length
                        ? a.measures.map((m) => `${m.code} (${ASSET_MEASURE_STATUS_LABELS[m.status] ?? m.status})`).join(' ; ')
                        : '—'}
                    </td>
                    <td className="py-1.5 text-ink-700">{a.contains_personal_data ? 'Oui' : 'Non'}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </section>
        )
      })}
    </PrintDocument>
  )
}

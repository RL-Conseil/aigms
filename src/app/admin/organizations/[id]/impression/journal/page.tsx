import { notFound } from 'next/navigation'
import type { Metadata } from 'next'
import { createClient } from '@/lib/supabase/server'
import { PrintDocument } from '@/components/print/document'
import { documentIdentity } from '@/lib/governance/document-identity'
import { auditLogPage } from '@/lib/admin/audit-log'
import { AUDIT_ACTION_LABELS, AUDIT_ENTITY_LABELS, AUDIT_FAMILIES } from '@/lib/domain/audit'
import { formatDate, formatDateTime } from '@/lib/domain/governance'

/**
 * Journal d'audit, version remise.
 *
 * Ce qu'un auditeur emporte : qui a fait quoi, quand, sur quelle piece — et
 * les refus, avec leur motif. Les memes filtres que l'ecran ; au plus deux
 * mille lignes, resserrer la periode au-dela.
 */

export const metadata: Metadata = {
  title: 'Journal d’audit',
  robots: { index: false, follow: false },
}

const LIMIT = 2000

export default async function PrintableJournalPage({
  params,
  searchParams,
}: {
  params: Promise<{ id: string }>
  searchParams: Promise<{ cas?: string; famille?: string; depuis?: string; jusqua?: string; q?: string }>
}) {
  const { id } = await params
  const { cas, famille, depuis, jusqua, q } = await searchParams
  const supabase = await createClient()
  const clean = (v?: string) => (v && v.trim() ? v.trim() : undefined)

  const [{ data: organization, error }, { data: useCases }, identity] = await Promise.all([
    supabase.from('organization').select('id, name').eq('id', id).maybeSingle(),
    supabase.from('ai_use_case').select('id, business_ref, name').eq('organization_id', id),
    documentIdentity(id),
  ])
  if (error) throw new Error(`Lecture de l’organisation refusée : ${error.message}`)
  if (!organization || !identity) notFound()

  const family = AUDIT_FAMILIES.find((f) => f.key === famille)
  const useCase = (useCases ?? []).find((u) => u.id === cas)
  const useCaseName = new Map((useCases ?? []).map((u) => [u.id, `${u.business_ref} ${u.name}`]))
  const rows = await auditLogPage(
    { organizationId: id, useCaseId: useCase?.id, actions: family?.actions, since: clean(depuis), until: clean(jusqua), search: clean(q) },
    LIMIT,
  )

  const scope = [
    useCase ? `cas d’usage ${useCase.business_ref} — ${useCase.name}` : 'tous les cas d’usage',
    family ? `famille « ${family.label} »` : 'toutes les opérations',
    clean(depuis) ? `depuis le ${formatDate(depuis)}` : null,
    clean(jusqua) ? `jusqu’au ${formatDate(jusqua)}` : null,
    clean(q) ? `contenant « ${q} »` : null,
  ]
    .filter(Boolean)
    .join(' · ')

  return (
    <PrintDocument
      identity={identity}
      title="Journal d’audit"
      subtitle="Trace immuable des opérations : qui, quand, quoi — refus compris."
      backHref={`/admin/organizations/${id}/journal`}
      backLabel="Retour au journal"
    >
      <section className="doc-keep mb-6 rounded-md border border-ink-200 bg-ink-50 p-4 text-[12px]">
        <p><span className="text-ink-500">Périmètre : </span><span className="font-medium text-ink-900">{scope}</span></p>
        <p className="mt-1"><span className="text-ink-500">Entrées : </span><span className="font-medium text-ink-900">{rows.length}{rows.length >= LIMIT ? ' (limite atteinte — resserrer la période)' : ''}</span></p>
        <p className="mt-2 text-ink-500">
          Le journal est append-only : aucune entrée ne peut être modifiée ni supprimée, y compris par l’administration.
        </p>
      </section>

      {rows.length ? (
        <table className="w-full border-collapse text-[11px]">
          <thead>
            <tr className="border-b border-ink-300 text-left text-ink-500">
              <th className="py-1.5 pr-3 font-medium">Date et heure</th>
              <th className="py-1.5 pr-3 font-medium">Opération</th>
              <th className="py-1.5 pr-3 font-medium">Objet</th>
              <th className="py-1.5 pr-3 font-medium">Résumé</th>
              <th className="py-1.5 pr-3 font-medium">Cas d’usage</th>
              <th className="py-1.5 font-medium">Auteur</th>
            </tr>
          </thead>
          <tbody>
            {rows.map((r) => (
              <tr key={r.id} className="doc-keep border-b border-ink-100 align-top">
                <td className="whitespace-nowrap py-1.5 pr-3 tabular-nums text-ink-700">{formatDateTime(r.occurred_at)}</td>
                <td className="py-1.5 pr-3 text-ink-900">{AUDIT_ACTION_LABELS[r.action] ?? r.action}</td>
                <td className="py-1.5 pr-3 text-ink-700">
                  {AUDIT_ENTITY_LABELS[r.entity_type] ?? r.entity_type}
                  {r.entity_ref ? <span className="block font-mono text-[10px] text-ink-500">{r.entity_ref}</span> : null}
                </td>
                <td className="py-1.5 pr-3 text-ink-900">{r.summary ?? '—'}</td>
                <td className="py-1.5 pr-3 text-ink-700">
                  {r.use_case_id ? (useCaseName.get(r.use_case_id) ?? '—') : '—'}
                </td>
                <td className="py-1.5 text-ink-700">{r.actor_email ?? 'système'}</td>
              </tr>
            ))}
          </tbody>
        </table>
      ) : (
        <p className="text-sm text-ink-500">Aucune entrée dans ce périmètre.</p>
      )}
    </PrintDocument>
  )
}

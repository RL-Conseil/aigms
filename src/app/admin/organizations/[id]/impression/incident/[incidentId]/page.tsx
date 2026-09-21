import { notFound } from 'next/navigation'
import type { Metadata } from 'next'
import { createClient } from '@/lib/supabase/server'
import { PrintDocument } from '@/components/print/document'
import { documentIdentity } from '@/lib/governance/document-identity'
import { formatDate, formatDateTime, INCIDENT_STATUS_LABELS } from '@/lib/domain/governance'
import { INCIDENT_TRIGGER_LABELS } from '@/components/governance/operations-forms'

export const metadata: Metadata = { title: 'Ticket d’incident' }

type Ticket = {
  business_ref: string
  title: string
  description: string
  kind: string
  severity: string
  status: string
  detected_at: string
  trigger_source: string
  organization: { name: string; role: string | null } | null
  use_case: { business_ref: string; name: string; status: string; classification: { flags: string[]; role: string; framework: string } | null } | null
  asset: { business_ref: string; name: string; kind: string; version: string | null } | null
  fundamental_rights_impacted: boolean
  fundamental_rights_detail: string | null
  reported_by: string | null
  officer: string | null
  owner: string | null
  qualified_at: string | null
  qualified_by: string | null
  qualification_delay_hours: number | null
  containment_action: string | null
  contained_at: string | null
  root_cause: string | null
  is_recurrence: boolean
  stop: { recommended_by: string | null; recommended_at: string | null; validated_by: string | null; validated_at: string | null; executed_by: string | null; executed_at: string | null; note: string | null }
  capa: { business_ref: string; correction: string; cause_analysis: string; corrective_action: string; preventive_action: string | null; owner: string | null; due_date: string | null; status: string }[]
  closure: { closed_at: string | null; note: string | null; officer_validated_by: string | null; officer_validated_at: string | null; owner_approved_by: string | null; owner_approved_at: string | null }
  timeline: { at: string; action: string; summary: string | null; actor: string | null }[]
}

function Row({ label, value }: { label: string; value: React.ReactNode }) {
  return (
    <div className="grid grid-cols-[180px_1fr] gap-2 border-b border-ink-100 py-1 text-[12px]">
      <dt className="text-ink-500">{label}</dt>
      <dd className="text-ink-900">{value ?? '—'}</dd>
    </div>
  )
}

/** Le ticket imprimable : la structure du kit, section par section. */
export default async function PrintableIncidentPage({ params }: { params: Promise<{ id: string; incidentId: string }> }) {
  const { id, incidentId } = await params
  const supabase = await createClient()
  const [{ data }, identity] = await Promise.all([
    supabase.rpc('incident_ticket', { p_incident_id: incidentId }),
    documentIdentity(id),
  ])
  if (!data || !identity) notFound()
  const t = data as Ticket
  const at = (v: string | null) => (v ? formatDateTime(v) : '—')

  return (
    <PrintDocument
      identity={identity}
      title={`${t.business_ref} — ${t.title}`}
      subtitle={`Ticket d’incident IA · ${INCIDENT_STATUS_LABELS[t.status] ?? t.status} · sévérité ${t.severity}`}
      backHref={t.use_case ? `/admin/organizations/${id}/suivi?vue=incidents` : `/admin/organizations/${id}/suivi?vue=incidents`}
      backLabel="Retour au suivi"
    >
      <section className="doc-keep mb-6">
        <h2 className="mb-2 font-serif text-base font-semibold text-ink-900">1. Métadonnées</h2>
        <dl>
          <Row label="Identifiant" value={t.business_ref} />
          <Row label="Détection" value={at(t.detected_at)} />
          <Row label="Déclencheur" value={INCIDENT_TRIGGER_LABELS[t.trigger_source] ?? t.trigger_source} />
          <Row label="Système IA impacté" value={t.asset ? `${t.asset.business_ref} ${t.asset.name}${t.asset.version ? ` v${t.asset.version}` : ''}` : t.use_case ? `${t.use_case.business_ref} ${t.use_case.name}` : '—'} />
          <Row label="Cas d’usage" value={t.use_case ? `${t.use_case.business_ref} ${t.use_case.name} (${t.use_case.status})` : '—'} />
          <Row label="Rôle de l’organisation" value={t.organization?.role ?? '—'} />
        </dl>
      </section>
      <section className="doc-keep mb-6">
        <h2 className="mb-2 font-serif text-base font-semibold text-ink-900">2. Qualification et impact</h2>
        <dl>
          <Row label="Description" value={t.description} />
          <Row label="Nature · sévérité" value={`${t.kind} · ${t.severity}`} />
          <Row label="Classification réglementaire" value={t.use_case?.classification ? `${t.use_case.classification.framework} — ${t.use_case.classification.flags.join(', ') || 'aucune qualification'}` : '—'} />
          <Row label="Droits fondamentaux" value={t.fundamental_rights_impacted ? `Oui — ${t.fundamental_rights_detail ?? ''}` : 'Non'} />
          <Row label="Qualifié" value={t.qualified_at ? `${at(t.qualified_at)} par ${t.qualified_by ?? '—'} (${t.qualification_delay_hours} h après détection)` : 'Non qualifié'} />
        </dl>
      </section>
      <section className="doc-keep mb-6">
        <h2 className="mb-2 font-serif text-base font-semibold text-ink-900">3. Acteurs et statut</h2>
        <dl>
          <Row label="Rapporteur" value={t.reported_by} />
          <Row label="AI Governance Officer en charge" value={t.officer} />
          <Row label="Porteur (System Owner)" value={t.owner} />
          <Row label="Statut" value={INCIDENT_STATUS_LABELS[t.status] ?? t.status} />
        </dl>
      </section>
      <section className="doc-keep mb-6">
        <h2 className="mb-2 font-serif text-base font-semibold text-ink-900">4. Analyse et remédiation</h2>
        <dl>
          <Row label="Cause profonde" value={t.root_cause} />
          <Row label="Action conservatoire" value={t.containment_action ? `${t.containment_action}${t.contained_at ? ` — ${at(t.contained_at)}` : ''}` : '—'} />
          <Row label="Arrêt d’urgence" value={t.stop.recommended_at ? `Recommandé ${at(t.stop.recommended_at)} (${t.stop.recommended_by}) · validé ${at(t.stop.validated_at)} (${t.stop.validated_by ?? '—'}) · exécuté ${at(t.stop.executed_at)} (${t.stop.executed_by ?? '—'})${t.stop.note ? ` — ${t.stop.note}` : ''}` : 'Aucun'} />
          <Row label="Récurrence" value={t.is_recurrence ? 'Oui' : 'Non'} />
        </dl>
        {t.capa.length ? (
          <ol className="mt-2 list-decimal pl-5 text-[12px]">
            {t.capa.map((c) => (
              <li key={c.business_ref} className="mb-1">
                <strong>{c.business_ref}</strong> — {c.corrective_action}
                {c.preventive_action ? ` ; préventif : ${c.preventive_action}` : ''}
                {` (échéance : ${c.due_date ? formatDate(c.due_date) : '—'}, resp. : ${c.owner ?? '—'}, ${c.status})`}
              </li>
            ))}
          </ol>
        ) : null}
        <dl className="mt-2">
          <Row label="Clôture effective" value={at(t.closure.closed_at)} />
          <Row label="Validation AI Officer" value={t.closure.officer_validated_at ? `${t.closure.officer_validated_by} — ${at(t.closure.officer_validated_at)}` : '—'} />
          <Row label="Approbation System Owner" value={t.closure.owner_approved_at ? `${t.closure.owner_approved_by} — ${at(t.closure.owner_approved_at)}` : '—'} />
        </dl>
      </section>
      <section className="mb-6">
        <h2 className="mb-2 font-serif text-base font-semibold text-ink-900">5. Chronologie (journal d’audit)</h2>
        <ul className="text-[11px] text-ink-700">
          {t.timeline.map((e, i) => (
            <li key={i} className="border-b border-ink-100 py-0.5">{at(e.at)} · {e.summary ?? e.action} · {e.actor ?? 'système'}</li>
          ))}
        </ul>
      </section>
    </PrintDocument>
  )
}

import { notFound } from 'next/navigation'
import type { Metadata } from 'next'
import { createClient } from '@/lib/supabase/server'
import { PrintDocument } from '@/components/print/document'
import { documentIdentity } from '@/lib/governance/document-identity'
import {
  IMPACT_DOMAIN_LABELS,
  IMPACT_FAMILIES,
  IMPACT_LIKELIHOOD_LABELS,
  IMPACT_SEVERITY_LABELS,
  IMPACT_STATUS_LABELS,
  type ImpactStudy,
} from '@/lib/domain/impact'
import { CRITICALITY_LABELS, type Criticality } from '@/lib/domain/criticality'
import { CLASSIFICATION_FLAG_LABELS, ORGANIZATION_ROLE_LABELS } from '@/lib/domain/classification'
import { AUTONOMY_LABELS, formatDate } from '@/lib/domain/governance'

/** L'etude d'impact, version remise : la structure du modele ISO/IEC 42005 de l'organisation. */

export const metadata: Metadata = { title: 'Étude d’impact IA', robots: { index: false, follow: false } }

function Row({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <tr className="border-b border-ink-100 align-top">
      <th className="w-1/3 bg-ink-50 py-1.5 pr-3 text-left font-medium text-ink-600">{label}</th>
      <td className="py-1.5 text-ink-900">{children}</td>
    </tr>
  )
}

export default async function PrintableImpactStudyPage({ params }: { params: Promise<{ id: string; studyId: string }> }) {
  const { id, studyId } = await params
  const supabase = await createClient()
  const [{ data: organization }, { data }, identity] = await Promise.all([
    supabase.from('organization').select('id, name').eq('id', id).maybeSingle(),
    supabase.rpc('impact_study', { p_id: studyId }),
    documentIdentity(id),
  ])
  if (!organization || !data || !identity) notFound()
  const study = data as unknown as ImpactStudy
  if (study.organization_id !== id) notFound()
  const uc = study.use_case
  const flags = (uc.classification?.flags ?? []).map((f) => CLASSIFICATION_FLAG_LABELS[f] ?? f)
  const remediation = study.findings.filter((f) => f.is_adverse && f.mitigation?.trim())

  return (
    <PrintDocument
      identity={identity}
      title="Étude d’impact sur l’IA (ISO/IEC 42005)"
      subtitle={`${uc.name} — ${study.business_ref}`}
      backHref={`/admin/organizations/${id}/etudes-impact/${studyId}`}
      backLabel="Retour à l’étude"
    >
      <table className="doc-keep mb-6 w-full border-collapse text-[12px]">
        <tbody>
          <Row label="Nom du système d’IA">{uc.name} ({uc.business_ref})</Row>
          <Row label="Référence / date">{study.business_ref} — {formatDate(study.updated_at)} · {IMPACT_STATUS_LABELS[study.status] ?? study.status}</Row>
          <Row label="Responsable du projet">Porteur de l’IA : {uc.owner ?? '—'} · Responsable redevable : {uc.accountable ?? '—'}</Row>
          <Row label="Conduite par">{study.performed_by ?? '—'}</Row>
          <Row label="Statut du triage">
            Criticité : {uc.criticality ? CRITICALITY_LABELS[uc.criticality as Criticality] : 'non déterminée'} · {uc.required ? 'évaluation complète requise' : 'évaluation non exigée par les faits'}
            <br />Autonomie : {AUTONOMY_LABELS[uc.autonomy_level] ?? uc.autonomy_level}
            <br />Qualification : {uc.classification ? `${ORGANIZATION_ROLE_LABELS[uc.classification.organization_role] ?? uc.classification.organization_role}${flags.length ? ` — ${flags.join(', ')}` : ''}` : 'non posée'}
          </Row>
        </tbody>
      </table>

      <h2 className="mb-2 text-[15px] font-semibold text-ink-900">1. Cadrage et contexte du système d’IA</h2>
      <p className="mb-2 text-[12px] leading-relaxed text-ink-800">{study.scope_description}</p>
      <p className="mb-1 text-[12px] text-ink-700">Méthodologie : {study.methodology}{study.lifecycle_phase ? ` · phase : ${study.lifecycle_phase}` : ''}</p>
      {uc.data_description ? <p className="mb-1 text-[12px] text-ink-700">Données : {uc.data_description}</p> : null}
      {uc.assets.length ? <p className="mb-1 text-[12px] text-ink-700">Actifs employés : {uc.assets.map((a) => `${a.name}${a.version ? ` v${a.version}` : ''}`).join(', ')}</p> : null}

      <h3 className="mb-2 mt-4 text-[13px] font-semibold text-ink-900">1.1 Cartographie des parties prenantes</h3>
      {uc.users_description ? <p className="mb-1 text-[12px] text-ink-700">Utilisateurs directs : {uc.users_description}</p> : null}
      {uc.affected_persons ? <p className="mb-2 text-[12px] text-ink-700">Parties affectées : {uc.affected_persons}</p> : null}
      {study.stakeholders.length ? (
        <table className="doc-keep mb-6 w-full border-collapse text-[11px]">
          <thead><tr className="border-b border-ink-300 text-left text-ink-500"><th className="py-1 pr-3 font-medium">Partie prenante</th><th className="py-1 pr-3 font-medium">Population</th><th className="py-1 pr-3 font-medium">Vulnérable</th><th className="py-1 font-medium">Consultée</th></tr></thead>
          <tbody>
            {study.stakeholders.map((s) => (
              <tr key={s.id} className="border-b border-ink-100 align-top">
                <td className="py-1 pr-3 text-ink-900">{s.label}</td>
                <td className="py-1 pr-3 text-ink-700">{s.estimated_population ?? '—'}</td>
                <td className="py-1 pr-3 text-ink-700">{s.is_vulnerable_group ? 'Oui' : 'Non'}</td>
                <td className="py-1 text-ink-700">{s.consulted ? `Oui${s.consultation_method ? ` — ${s.consultation_method}` : ''}` : 'Non'}</td>
              </tr>
            ))}
          </tbody>
        </table>
      ) : <p className="mb-6 text-[12px] italic text-ink-500">Aucune partie prenante identifiée.</p>}

      <h2 className="mb-2 text-[15px] font-semibold text-ink-900">2. Analyse croisée des impacts (bénéfices vs préjudices)</h2>
      <table className="mb-6 w-full border-collapse text-[11px]">
        <thead><tr className="border-b border-ink-300 text-left text-ink-500"><th className="w-1/4 py-1 pr-3 font-medium">Domaine d’impact</th><th className="py-1 pr-3 font-medium">Bénéfices attendus</th><th className="py-1 font-medium">Risques / préjudices potentiels</th></tr></thead>
        <tbody>
          {IMPACT_FAMILIES.map((fam) => {
            const inFamily = study.findings.filter((f) => fam.domains.includes(f.domain))
            const line = (f: ImpactStudy['findings'][number]) =>
              `${IMPACT_DOMAIN_LABELS[f.domain] ?? f.domain} — ${f.description}${f.is_adverse ? ` (gravité ${IMPACT_SEVERITY_LABELS[f.severity]?.toLowerCase()}, ${IMPACT_LIKELIHOOD_LABELS[f.likelihood]?.toLowerCase()}${f.residual_severity ? ` ; résiduel ${IMPACT_SEVERITY_LABELS[f.residual_severity]?.toLowerCase()}` : ''})` : ''}`
            return (
              <tr key={fam.key} className="doc-keep border-b border-ink-100 align-top">
                <td className="bg-ink-50 py-1.5 pr-3 font-medium text-ink-800">{fam.label}</td>
                <td className="py-1.5 pr-3 text-ink-800">{inFamily.filter((f) => !f.is_adverse).map((f) => <p key={f.id}>{line(f)}</p>)}{inFamily.some((f) => !f.is_adverse) ? null : '—'}</td>
                <td className="py-1.5 text-ink-800">{inFamily.filter((f) => f.is_adverse).map((f) => <p key={f.id}>{line(f)}</p>)}{inFamily.some((f) => f.is_adverse) ? null : '—'}</td>
              </tr>
            )
          })}
        </tbody>
      </table>

      <h2 className="mb-2 text-[15px] font-semibold text-ink-900">3. Plan de gouvernance et remédiation</h2>
      {remediation.length ? (
        <table className="mb-6 w-full border-collapse text-[11px]">
          <thead><tr className="border-b border-ink-300 text-left text-ink-500"><th className="py-1 pr-3 font-medium">Risque / préjudice</th><th className="py-1 pr-3 font-medium">Mesure de réduction</th><th className="py-1 pr-3 font-medium">Responsable</th><th className="py-1 font-medium">Échéance</th></tr></thead>
          <tbody>
            {remediation.map((f) => (
              <tr key={f.id} className="doc-keep border-b border-ink-100 align-top">
                <td className="py-1.5 pr-3 text-ink-800">{IMPACT_DOMAIN_LABELS[f.domain] ?? f.domain}<br />{f.description}{f.linked_risk ? <><br />Risque {f.linked_risk.business_ref}</> : null}</td>
                <td className="py-1.5 pr-3 text-ink-800">{f.mitigation}{f.action ? <><br /><span className="text-ink-500">Action {f.action.business_ref} — {f.action.status}</span></> : null}</td>
                <td className="py-1.5 pr-3 text-ink-800">{f.owner ?? '—'}</td>
                <td className="py-1.5 text-ink-800">{f.mitigation_due_date ? formatDate(f.mitigation_due_date) : f.action?.due_date ? formatDate(f.action.due_date) : '—'}</td>
              </tr>
            ))}
          </tbody>
        </table>
      ) : <p className="mb-6 text-[12px] italic text-ink-500">Aucune mesure de réduction : aucun préjudice grave identifié, ou mesures à renseigner.</p>}

      <h2 className="mb-2 text-[15px] font-semibold text-ink-900">4. Conclusion</h2>
      <p className="mb-2 text-[12px] leading-relaxed text-ink-800">{study.conclusion ?? <em className="text-ink-500">Conclusion à rédiger à l’achèvement de l’étude.</em>}</p>
      <p className="text-[12px] text-ink-700">AIPD : {study.dpia_required ? `requise${study.dpia_reference ? ` — référence ${study.dpia_reference}` : ' — référence à fournir'}` : 'non requise'}.</p>
      <p className="text-[12px] text-ink-700">Achevée le : {study.completed_at ? formatDate(study.completed_at) : '—'} · Prochaine revue : {study.next_review_at ? formatDate(study.next_review_at) : '—'}</p>
      <p className="mt-2 text-[11px] text-ink-500">Conduite par {study.performed_by ?? '—'}{study.approved_by ? ` · approuvée par ${study.approved_by}` : ''}.</p>
    </PrintDocument>
  )
}

import { notFound } from 'next/navigation'
import type { Metadata } from 'next'
import { createClient } from '@/lib/supabase/server'
import { PrintDocument } from '@/components/print/document'
import { documentIdentity } from '@/lib/governance/document-identity'
import {
  ACTIVITY_PROFILE_LABELS,
  CRITICALITY_LABELS,
  REGIME_LABELS,
  type ActivityProfile,
  type EvidenceCriticality,
} from '@/lib/domain/activity-profile'

/**
 * Declaration d'Applicabilite, version remise.
 *
 * Meme lecture que l'ecran de travail — `app.statement_of_applicability` — mais
 * depouillee de tout ce qui ne se remet pas : filtres, formulaires de decision,
 * infobulles. Ce qui reste est ce qu'un auditeur attend : pour chaque exigence,
 * retenue ou exclue, sa justification, ce qui la couvre, et dans quel etat.
 *
 * Les exigences non statuees ne sont pas masquees. Une declaration
 * d'applicabilite incomplete qui se presente comme complete serait pire
 * qu'inutile.
 */

export const metadata: Metadata = {
  title: 'Déclaration d’Applicabilité',
  robots: { index: false, follow: false },
}

type SoaRow = {
  objective_code: string
  objective_title: string
  requirement_reference: string
  requirement_title: string
  internal_summary: string
  display_order: number
  control_count: number
  operating_count: number
  evidence_count: number
  controls: { code: string; name: string; status: string; is_mandatory: boolean; evidences: number }[]
  coverage: 'uncovered' | 'declared' | 'operating_without_evidence' | 'evidenced'
  expected_criticality: EvidenceCriticality | null
  evidence_regime: 'technical' | 'organisational' | 'exclusion' | 'unspecified'
  soa_status: 'selected' | 'excluded' | null
  soa_justification: string | null
  decided_by_name: string | null
}

const COVERAGE_LABELS: Record<SoaRow['coverage'], string> = {
  evidenced: 'Couverte et prouvée',
  operating_without_evidence: 'Opérante sans preuve',
  declared: 'Contrôle déclaré',
  uncovered: 'Non couverte',
}

export default async function PrintableSoaPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params
  const supabase = await createClient()

  const [{ data: organization, error }, { data: rows }, identity] = await Promise.all([
    supabase
      .from('organization')
      .select('id, name, ai_activity_profile')
      .eq('id', id)
      .maybeSingle(),
    supabase.rpc('statement_of_applicability', {
      p_organization_id: id,
      p_framework_code: 'ISO_IEC_42001',
      p_framework_version: '2023',
    }),
    documentIdentity(id),
  ])

  if (error) throw new Error(`Lecture de l’organisation refusée : ${error.message}`)
  if (!organization || !identity) notFound()

  const requirements = ((rows ?? []) as SoaRow[]).slice().sort((a, b) => a.display_order - b.display_order)
  const profile = (organization.ai_activity_profile ?? null) as ActivityProfile | null

  const selected = requirements.filter((r) => r.soa_status === 'selected').length
  const excluded = requirements.filter((r) => r.soa_status === 'excluded').length
  const undecided = requirements.filter((r) => r.soa_status === null).length

  // Regroupement par objectif : c'est l'ordre de l'Annexe A, et celui dans
  // lequel un auditeur parcourt le document.
  const objectives: { code: string; title: string; rows: SoaRow[] }[] = []
  for (const row of requirements) {
    const last = objectives.at(-1)
    if (last && last.code === row.objective_code) last.rows.push(row)
    else objectives.push({ code: row.objective_code, title: row.objective_title, rows: [row] })
  }

  return (
    <PrintDocument
      identity={identity}
      title="Déclaration d’Applicabilité"
      subtitle="ISO/IEC 42001:2023 — Annexe A"
      backHref={`/admin/organizations/${id}/declaration-applicabilite`}
      backLabel="Retour à la déclaration"
    >
      <section className="doc-keep mb-7 rounded-md border border-ink-200 bg-ink-50 p-4">
        <dl className="grid grid-cols-2 gap-x-6 gap-y-2 text-[12px] sm:grid-cols-4">
          <div>
            <dt className="text-ink-500">Rôle de l’organisation vis-à-vis de l’IA</dt>
            <dd className="font-medium text-ink-900">
              {profile ? ACTIVITY_PROFILE_LABELS[profile] : 'Non renseigné'}
            </dd>
          </div>
          <div>
            <dt className="text-ink-500">Exigences retenues</dt>
            <dd className="font-medium text-ink-900">{selected}</dd>
          </div>
          <div>
            <dt className="text-ink-500">Exigences exclues</dt>
            <dd className="font-medium text-ink-900">{excluded}</dd>
          </div>
          <div>
            <dt className="text-ink-500">Non statuées</dt>
            <dd className="font-medium text-ink-900">{undecided}</dd>
          </div>
        </dl>
        {undecided > 0 ? (
          <p className="mt-3 border-t border-ink-200 pt-3 text-[11px] leading-relaxed text-warn-600">
            {undecided} exigence(s) n’ont pas encore fait l’objet d’une décision d’applicabilité.
            Elles figurent ci-dessous comme telles : une déclaration incomplète qui se présenterait
            comme complète serait pire qu’inutile.
          </p>
        ) : null}
      </section>

      {objectives.map((objective) => (
        <section key={objective.code} className="mb-7">
          <h2 className="mb-2 border-b border-ink-200 pb-1.5 font-serif text-base font-semibold text-ink-900">
            {objective.code} — {objective.title}
          </h2>

          <table className="w-full border-collapse text-[11px] leading-snug">
            <thead>
              <tr className="border-b border-ink-200 text-left text-ink-500">
                <th className="w-[64px] py-1.5 pr-2 font-medium">Réf.</th>
                <th className="py-1.5 pr-2 font-medium">Exigence</th>
                <th className="w-[68px] py-1.5 pr-2 font-medium">Statut</th>
                <th className="py-1.5 pr-2 font-medium">Justification</th>
                <th className="py-1.5 font-medium">Couverture</th>
              </tr>
            </thead>
            <tbody>
              {objective.rows.map((row) => (
                <tr key={row.requirement_reference} className="border-b border-ink-100 align-top">
                  <td className="py-2 pr-2 font-mono text-[10px] text-ink-500">
                    {row.requirement_reference}
                  </td>
                  <td className="py-2 pr-2">
                    <span className="font-medium text-ink-900">{row.requirement_title}</span>
                    {row.expected_criticality ? (
                      <span className="block text-[10px] text-ink-500">
                        Preuve {CRITICALITY_LABELS[row.expected_criticality].toLowerCase()} ·{' '}
                        {REGIME_LABELS[row.evidence_regime]?.label ?? '—'}
                      </span>
                    ) : null}
                  </td>
                  <td className="py-2 pr-2">
                    {row.soa_status === 'selected' ? (
                      <span className="font-medium text-ink-900">Retenue</span>
                    ) : row.soa_status === 'excluded' ? (
                      <span className="font-medium text-ink-600">Exclue</span>
                    ) : (
                      <span className="font-medium text-warn-600">Non statuée</span>
                    )}
                  </td>
                  <td className="py-2 pr-2 text-ink-700">
                    {row.soa_justification ?? (
                      <span className="text-warn-600">Justification à produire.</span>
                    )}
                    {row.decided_by_name ? (
                      <span className="block text-[10px] text-ink-400">
                        Statué par {row.decided_by_name}
                      </span>
                    ) : null}
                  </td>
                  <td className="py-2 text-ink-700">
                    <span className="block">{COVERAGE_LABELS[row.coverage]}</span>
                    {row.controls.length ? (
                      <span className="block text-[10px] text-ink-500">
                        {row.controls.map((c) => c.code).join(', ')}
                      </span>
                    ) : null}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </section>
      ))}
    </PrintDocument>
  )
}

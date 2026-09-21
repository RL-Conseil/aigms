import { describe, expect, it } from 'vitest'
import { buildImpactStudyDocx } from '@/lib/impact/docx'
import type { ImpactStudy } from '@/lib/domain/impact'

const study: ImpactStudy = {
  id: '1', business_ref: 'AIIA-2026-0009', status: 'completed',
  scope_description: 'Scoring des candidatures reçues sur le portail carrière.', methodology: 'ISO/IEC 42005', lifecycle_phase: 'Pilote',
  dpia_required: true, dpia_reference: 'AIPD-RH-03', conclusion: 'Effets acceptables sous mesures.', completed_at: '2026-09-22T10:00:00Z',
  next_review_at: '2027-03-22', reopened_reason: null, created_at: '2026-09-01T10:00:00Z', updated_at: '2026-09-22T10:00:00Z',
  organization_id: 'o', performed_by: 'Alice Officer', approved_by: null,
  use_case: {
    id: 'u', business_ref: 'UC-2026-0002', name: 'Scoring de candidatures', purpose: 'Trier les CV.', status: 'PILOT', criticality: 'high',
    autonomy_level: 'L1', users_description: 'Recruteurs', affected_persons: 'Candidats', data_description: 'CV', involves_personal_data: true,
    involves_vulnerable_persons: false, owner: 'Bob', accountable: 'Carol', required: true,
    classification: { organization_role: 'deployer', flags: ['high_risk_potential'] }, assets: [{ name: 'Modèle RH', kind: 'ai_model', version: '2.1' }],
  },
  stakeholders: [{ id: 's1', label: 'Candidats', is_vulnerable_group: false, estimated_population: '3 000 / an', consulted: false, consultation_method: null }],
  findings: [
    { id: 'f1', domain: 'equality_non_discrimination', description: 'Écart de présélection entre groupes.', is_adverse: true, severity: 'severe', likelihood: 'likely',
      mitigation: 'Audit trimestriel des écarts.', residual_severity: 'limited', mitigation_due_date: '2026-12-01', stakeholder: 'Candidats', stakeholder_id: 's1',
      owner: 'Alice Officer', owner_user_id: 'a', linked_risk: { id: 'r', business_ref: 'RSK-2026-0006', title: 'Discrimination' }, linked_risk_id: 'r',
      action: { id: 'ac', business_ref: 'ACT-2026-0012', status: 'open', due_date: '2026-12-01' } },
    { id: 'f2', domain: 'employment_working_conditions', description: 'Gain de temps des recruteurs.', is_adverse: false, severity: 'limited', likelihood: 'likely',
      mitigation: null, residual_severity: null, mitigation_due_date: null, stakeholder: null, stakeholder_id: null, owner: null, owner_user_id: null,
      linked_risk: null, linked_risk_id: null, action: null },
  ],
  evidence: [], pending_action: null,
}

describe('Export .docx de l’étude d’impact', () => {
  it('produit un document Word au format du modèle', async () => {
    const bytes = await buildImpactStudyDocx(study, 'IzarLink Demo')
    // Un .docx est une archive zip : signature PK.
    expect(bytes.subarray(0, 2).toString('latin1')).toBe('PK')
    expect(bytes.length).toBeGreaterThan(2000)
    const { default: JSZip } = await import('jszip').catch(() => ({ default: null }))
    if (JSZip) {
      const zip = await JSZip.loadAsync(bytes)
      const xml = await zip.file('word/document.xml')!.async('string')
      for (const expected of ['Cadrage et contexte', 'Cartographie des parties prenantes', 'Analyse croisée', 'Plan de gouvernance', 'Audit trimestriel', 'AIPD-RH-03', 'Scoring de candidatures']) {
        expect(xml).toContain(expected)
      }
    }
  })
})

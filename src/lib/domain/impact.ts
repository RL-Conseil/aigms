/**
 * L'etude d'impact IA (ISO/IEC 42005) : effets du systeme sur les personnes,
 * les groupes et la societe. Distincte du registre des risques (qui regarde
 * l'organisation) et de l'AIPD (qui regarde les donnees personnelles, et que
 * l'etude peut appeler).
 *
 * Structuree comme le modele de l'organisation : cadrage, parties prenantes,
 * analyse croisee benefices / prejudices par domaine, plan de remediation.
 */

export const IMPACT_STATUS_LABELS: Record<string, string> = {
  draft: 'Brouillon',
  in_progress: 'En cours',
  completed: 'Achevée',
  reopened: 'Rouverte',
  superseded: 'Remplacée',
}

export const IMPACT_DOMAIN_LABELS: Record<string, string> = {
  fundamental_rights: 'Droits fondamentaux',
  health_safety: 'Santé et sécurité',
  equality_non_discrimination: 'Égalité et non-discrimination',
  privacy_data_protection: 'Vie privée et protection des données',
  human_dignity_autonomy: 'Dignité et autonomie humaines',
  access_to_services: 'Accès aux services essentiels',
  employment_working_conditions: 'Emploi et conditions de travail',
  consumer_protection: 'Protection des consommateurs',
  democratic_processes: 'Processus démocratiques',
  environment: 'Environnement et énergie',
  vulnerable_groups: 'Groupes vulnérables',
  society_at_large: 'Société dans son ensemble',
}

/**
 * Les quatre familles du modele de l'organisation, qui regroupent les douze
 * domaines de la norme : c'est ainsi que l'etude se lit et s'exporte.
 */
export const IMPACT_FAMILIES: { key: string; label: string; domains: string[] }[] = [
  { key: 'rights', label: 'Droits fondamentaux et éthique', domains: ['fundamental_rights', 'equality_non_discrimination', 'human_dignity_autonomy', 'vulnerable_groups', 'democratic_processes'] },
  { key: 'privacy', label: 'Vie privée et données (AIPD)', domains: ['privacy_data_protection'] },
  { key: 'environment', label: 'Environnement et énergie', domains: ['environment'] },
  { key: 'socio', label: 'Impacts socio-économiques', domains: ['employment_working_conditions', 'access_to_services', 'consumer_protection', 'health_safety', 'society_at_large'] },
]

export const IMPACT_SEVERITY_LABELS: Record<string, string> = {
  negligible: 'Négligeable',
  limited: 'Limitée',
  significant: 'Significative',
  severe: 'Grave',
}

export const IMPACT_LIKELIHOOD_LABELS: Record<string, string> = {
  unlikely: 'Peu probable',
  possible: 'Possible',
  likely: 'Probable',
  almost_certain: 'Quasi certaine',
}

export const LIFECYCLE_PHASES = ['Conception', 'Développement', 'Pilote', 'Déploiement', 'Exploitation', 'Retrait'] as const

export function severityTone(severity: string): 'ok' | 'warn' | 'stop' | 'neutral' {
  if (severity === 'severe') return 'stop'
  if (severity === 'significant') return 'warn'
  if (severity === 'negligible') return 'neutral'
  return 'ok'
}

export type ImpactStudyRow = {
  use_case_id: string
  business_ref: string
  name: string
  status: string
  criticality: string | null
  required: boolean
  study: {
    id: string
    business_ref: string
    status: string
    dpia_required: boolean
    completed_at: string | null
    next_review_at: string | null
    updated_at: string
    findings: number
    severe: number
  } | null
}

export type ImpactStakeholder = {
  id: string
  label: string
  is_vulnerable_group: boolean
  estimated_population: string | null
  consulted: boolean
  consultation_method: string | null
}

export type ImpactFinding = {
  id: string
  domain: string
  description: string
  is_adverse: boolean
  severity: string
  likelihood: string
  mitigation: string | null
  residual_severity: string | null
  mitigation_due_date: string | null
  stakeholder: string | null
  stakeholder_id: string | null
  owner: string | null
  owner_user_id: string | null
  linked_risk: { id: string; business_ref: string; title: string } | null
  linked_risk_id: string | null
  action: { id: string; business_ref: string; status: string; due_date: string | null } | null
}

export type ImpactStudy = {
  id: string
  business_ref: string
  status: string
  scope_description: string
  methodology: string
  lifecycle_phase: string | null
  dpia_required: boolean
  dpia_reference: string | null
  conclusion: string | null
  completed_at: string | null
  next_review_at: string | null
  reopened_reason: string | null
  created_at: string
  updated_at: string
  organization_id: string
  performed_by: string | null
  approved_by: string | null
  use_case: {
    id: string
    business_ref: string
    name: string
    purpose: string | null
    status: string
    criticality: string | null
    autonomy_level: string
    users_description: string | null
    affected_persons: string | null
    data_description: string | null
    involves_personal_data: boolean
    involves_vulnerable_persons: boolean
    owner: string | null
    accountable: string | null
    required: boolean
    classification: { organization_role: string; flags: string[] } | null
    assets: { name: string; kind: string; version: string | null }[]
  }
  stakeholders: ImpactStakeholder[]
  findings: ImpactFinding[]
  evidence: { id: string; business_ref: string; title: string; validation_status: string }[]
  pending_action: { id: string; business_ref: string; title: string } | null
}

/** Ce qui manque avant d'achever : l'etude se conclut sur des faits, pas sur un formulaire vide. */
export function studyGaps(study: ImpactStudy): string[] {
  const gaps: string[] = []
  if (!study.stakeholders.length) gaps.push('aucune partie prenante identifiée')
  if (!study.findings.length) gaps.push('aucun constat — ni bénéfice ni préjudice')
  const unmitigated = study.findings.filter((f) => f.is_adverse && ['significant', 'severe'].includes(f.severity) && !f.mitigation?.trim())
  if (unmitigated.length) gaps.push(`${unmitigated.length} préjudice(s) grave(s) sans mesure de réduction`)
  if (study.dpia_required && !study.dpia_reference?.trim()) gaps.push('AIPD requise sans référence')
  return gaps
}

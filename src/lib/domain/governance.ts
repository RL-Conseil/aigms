/**
 * Types et libelles du modele de gouvernance.
 *
 * Ce module ne contient aucune regle de decision : les gates, les transitions
 * autorisees et le moteur de reevaluation vivent dans la base, ou ils sont
 * testables et impossibles a contourner depuis le client. Ce qui suit sert
 * uniquement a presenter leurs resultats.
 */

export const USE_CASE_STATUSES = [
  'DRAFT',
  'TRIAGE',
  'ASSESSMENT',
  'REVIEW',
  'APPROVED',
  'CONDITIONAL_APPROVAL',
  'REJECTED',
  'PILOT',
  'PRODUCTION',
  'MONITORING',
  'RETIRED',
] as const

export type UseCaseStatus = (typeof USE_CASE_STATUSES)[number]

export const USE_CASE_STATUS_LABELS: Record<UseCaseStatus, string> = {
  DRAFT: 'Brouillon',
  TRIAGE: 'Triage',
  ASSESSMENT: 'Évaluation',
  REVIEW: 'Revue',
  APPROVED: 'Approuvé',
  CONDITIONAL_APPROVAL: 'Approuvé sous conditions',
  REJECTED: 'Refusé',
  PILOT: 'Pilote',
  PRODUCTION: 'Production',
  MONITORING: 'Surveillance',
  RETIRED: 'Retiré',
}

/** Étapes affichées dans le fil de vie d'un cas d'usage. */
export const LIFECYCLE_STEPS: UseCaseStatus[] = [
  'DRAFT',
  'TRIAGE',
  'ASSESSMENT',
  'REVIEW',
  'APPROVED',
  'PILOT',
  'PRODUCTION',
  'MONITORING',
]

export type GateCheck = {
  code: string
  label: string
  satisfied: boolean
  detail: string
}

export type GateResult = {
  use_case_id: string
  target_status: UseCaseStatus
  satisfied: boolean
  evaluated_at: string
  checks: GateCheck[]
}

export type TransitionResult = {
  transitioned: boolean
  from: UseCaseStatus
  to: UseCaseStatus
  reason: 'OK' | 'GATE_NOT_SATISFIED' | 'TRANSITION_NOT_ALLOWED' | 'ALREADY_IN_STATUS'
  message: string
  allowed_transitions?: UseCaseStatus[]
  gate: GateResult | null
}

export type ReassessmentVerdict =
  | 'NO_REASSESSMENT'
  | 'PARTIAL_REASSESSMENT'
  | 'FULL_REASSESSMENT'

export const VERDICT_LABELS: Record<ReassessmentVerdict, string> = {
  NO_REASSESSMENT: 'Aucune réévaluation',
  PARTIAL_REASSESSMENT: 'Réévaluation partielle',
  FULL_REASSESSMENT: 'Réévaluation complète',
}

export type RiskLevel = 'low' | 'moderate' | 'high' | 'critical'

export const RISK_LEVEL_LABELS: Record<RiskLevel, string> = {
  low: 'Faible',
  moderate: 'Modéré',
  high: 'Élevé',
  critical: 'Critique',
}

export const DECISION_TYPE_LABELS: Record<string, string> = {
  use_case_authorization: "Autorisation du cas d'usage",
  pilot_approval: 'Autorisation de pilote',
  go_production: 'GO production',
  risk_acceptance: 'Acceptation de risque',
  policy_exception: 'Exception de politique',
  significant_change: 'Changement significatif',
  suspension: 'Suspension',
  retirement: 'Retrait',
}

export const DECISION_STATUS_LABELS: Record<string, string> = {
  draft: 'Brouillon',
  submitted: 'Soumise',
  approved: 'Approuvée',
  approved_with_conditions: 'Approuvée sous conditions',
  rejected: 'Refusée',
  revoked: 'Révoquée',
  superseded: 'Remplacée',
}

export const AUTONOMY_LABELS: Record<string, string> = {
  L0: 'L0 — Conseil',
  L1: "L1 — Propose, l'humain décide",
  L2: 'L2 — Exécute après approbation',
  L3: 'L3 — Exécute dans des limites définies',
  L4: 'L4 — Fortement autonome',
}

/** Fraicheur d'une preuve, telle que calculee par app.evidence_freshness. */
export type EvidenceFreshness = 'fresh' | 'expiring' | 'expired' | 'unknown'

export const FRESHNESS_LABELS: Record<EvidenceFreshness, string> = {
  fresh: 'À jour',
  expiring: 'Bientôt échue',
  expired: 'Échue',
  unknown: 'Sans échéance',
}

/** Formate une date ISO pour l'affichage francais, ou un tiret si absente. */
export function formatDate(value: string | null | undefined): string {
  if (!value) return '—'
  return new Intl.DateTimeFormat('fr-FR', { dateStyle: 'medium' }).format(new Date(value))
}

export function formatDateTime(value: string | null | undefined): string {
  if (!value) return '—'
  return new Intl.DateTimeFormat('fr-FR', { dateStyle: 'medium', timeStyle: 'short' }).format(
    new Date(value),
  )
}

export const CONTROL_STATUS_LABELS: Record<string, string> = {
  proposed: 'Proposé',
  implemented: 'Mis en place',
  operating: 'Opérant',
  ineffective: 'Inefficace',
  retired: 'Retiré',
}

export const TREATMENT_STATUS_LABELS: Record<string, string> = {
  planned: 'Planifié',
  in_progress: 'En cours',
  implemented: 'Mis en œuvre',
  verified: 'Vérifié',
  abandoned: 'Abandonné',
}

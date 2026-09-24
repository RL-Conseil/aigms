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
  'SUSPENDED',
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
  SUSPENDED: 'Suspendu',
  RETIRED: 'Retiré',
}

/** Étapes affichées dans le fil de vie d'un cas d'usage. */
/**
 * Jalons obligatoires du cycle de vie.
 *
 * Chaque transition est evaluee par `app.evaluate_gate`, mais deux seulement
 * portent un point de passage substantiel : REVUE exige une pre-classification
 * et au moins un risque identifie ; PRODUCTION exige huit preconditions, dont
 * une decision d'autorisation en vigueur. Les distinguer visuellement evite de
 * decouvrir le refus au moment de le subir.
 */
export const GATED_STEPS: UseCaseStatus[] = ['REVIEW', 'PRODUCTION']

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

/** Comment un incident est arrive a la connaissance de l'organisation. */
export const INCIDENT_TRIGGER_LABELS: Record<string, string> = {
  monitoring_alert: 'Alerte automatique de monitoring',
  user_complaint: 'Plainte ou signalement d’un utilisateur',
  internal_audit: 'Audit interne',
  vendor_alert: 'Alerte du fournisseur',
  other: 'Autre',
}

/** Les trois réponses possibles à l'applicabilité d'un contrôle. */
export const APPLICABILITY_LABELS: Record<string, string> = {
  applicable: 'Applicable',
  not_applicable: 'Non applicable',
  to_determine: 'À déterminer',
}

export const CHANGE_STATUS_LABELS: Record<string, string> = {
  DRAFT: 'Brouillon',
  IMPACT_SCREENING: 'Qualifié',
  REVIEW: 'En revue',
  APPROVED: 'Approuvé',
  REJECTED: 'Rejeté',
  IMPLEMENTED: 'Mis en œuvre',
  VERIFIED: 'Vérifié',
  CANCELLED: 'Annulé',
}

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

/**
 * La nature d'une mesure : ou elle se pose, et ou elle se prouve. Technique
 * sur un actif ; organisationnelle sur l'organisation, le processus ou le cas
 * d'usage ; contractuelle chez un fournisseur.
 */
export const MEASURE_KIND_LABELS: Record<string, string> = {
  technical: 'Mesure technique',
  organizational: 'Mesure organisationnelle',
  contractual: 'Mesure contractuelle',
}

export const MEASURE_KIND_HINTS: Record<string, string> = {
  technical: 'Se pose sur un actif — modèle, système, agent, jeu de données — et se prouve là.',
  organizational: 'Se pose sur l’organisation, un processus ou le cas d’usage : politique, formation, revue, séparation des rôles.',
  contractual: 'Se pose chez un fournisseur : DPA, conditions d’usage, clauses de réversibilité.',
}

export const ASSET_MEASURE_STATUS_LABELS: Record<string, string> = {
  planned: 'Prévue',
  implemented: 'Mise en œuvre',
  verified: 'Vérifiée',
  not_applicable: 'Sans objet',
}

export const CONTROL_STATUS_LABELS: Record<string, string> = {
  proposed: 'Proposé',
  implemented: 'Mis en place',
  operating: 'Opérant',
  ineffective: 'Inefficace',
  retired: 'Retiré',
}

/**
 * Le ton d'un etat de controle, le meme partout ou il se lit : propose et mis
 * en place appellent encore une main (ambre), operant tient (vert),
 * inefficace alerte (rouge), retire s'efface.
 */
export function controlStatusTone(status: string): 'ok' | 'warn' | 'stop' | 'neutral' {
  if (status === 'operating') return 'ok'
  if (status === 'ineffective') return 'stop'
  if (status === 'retired') return 'neutral'
  return 'warn'
}

export const TREATMENT_STATUS_LABELS: Record<string, string> = {
  planned: 'Planifié',
  in_progress: 'En cours',
  implemented: 'Mis en œuvre',
  verified: 'Vérifié',
  abandoned: 'Abandonné',
}

export const RISK_STATUS_LABELS: Record<string, string> = {
  identified: 'Identifié',
  analysed: 'Analysé',
  treatment_planned: 'Traitement planifié',
  treatment_in_progress: 'Traitement en cours',
  mitigated: 'Traité',
  accepted: 'Accepté',
  closed: 'Clos',
}

export const ACTION_STATUS_LABELS: Record<string, string> = {
  open: 'Ouverte',
  in_progress: 'En cours',
  blocked: 'Bloquée',
  done: 'Close',
  cancelled: 'Annulée',
  overdue: 'Échue',
}

export const INCIDENT_STATUS_LABELS: Record<string, string> = {
  OPEN: 'Ouvert',
  CONTAINED: 'Circonscrit',
  INVESTIGATING: 'En investigation',
  ACTION_PLAN: 'Plan d’action',
  EFFECTIVENESS_REVIEW: 'Revue d’efficacité',
  CLOSED: 'Clos',
}

export const VENDOR_REVIEW_LABELS: Record<string, string> = {
  not_started: 'Revue non commencée',
  in_progress: 'Revue en cours',
  approved: 'Approuvé',
  approved_with_conditions: 'Approuvé sous conditions',
  rejected: 'Rejeté',
  expired: 'Revue échue',
}

export const ASSET_KIND_LABELS: Record<string, string> = {
  ai_system: 'Système d’IA',
  ai_model: 'Modèle',
  ai_agent: 'Agent',
  dataset: 'Jeu de données',
}

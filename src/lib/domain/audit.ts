/**
 * Le journal d'audit, lu en francais.
 *
 * Il consigne ce qu'aucun registre ne porte : les refus, les transitions, les
 * validations, avec leur auteur et leur heure — et il ne se reecrit pas. C'est
 * une lecture d'audit, pas une rubrique de travail.
 */

export const AUDIT_ACTION_LABELS: Record<string, string> = {
  create: 'Création',
  update: 'Modification',
  delete: 'Suppression',
  archive: 'Archivage',
  status_transition: 'Changement de statut',
  gate_evaluated: 'Jalon évalué',
  gate_blocked: 'Jalon refusé',
  decision_approved: 'Décision approuvée',
  decision_rejected: 'Décision refusée',
  risk_accepted: 'Risque accepté',
  evidence_validated: 'Preuve validée',
  reassessment_triggered: 'Réévaluation déclenchée',
  access_granted: 'Accès accordé',
  access_revoked: 'Accès retiré',
  login: 'Connexion',
  export: 'Export',
  read_sensitive: 'Lecture sensible',
}

/** Familles d'opérations, telles qu'on les filtre : ce qu'un auditeur cherche. */
export const AUDIT_FAMILIES: { key: string; label: string; actions: string[]; hint: string }[] = [
  { key: 'jalons', label: 'Jalons', actions: ['status_transition', 'gate_blocked', 'gate_evaluated'], hint: 'Transitions de statut et refus de gate, avec leurs préconditions.' },
  { key: 'decisions', label: 'Décisions', actions: ['decision_approved', 'decision_rejected'], hint: 'Approbations et refus.' },
  { key: 'risques', label: 'Risques', actions: ['risk_accepted'], hint: 'Acceptations nominatives.' },
  { key: 'preuves', label: 'Preuves', actions: ['evidence_validated'], hint: 'Validations de pièces.' },
  { key: 'reevaluations', label: 'Réévaluations', actions: ['reassessment_triggered'], hint: 'Ce qu’un changement a rouvert.' },
  { key: 'acces', label: 'Accès', actions: ['access_granted', 'access_revoked', 'login'], hint: 'Qui a reçu ou perdu un accès.' },
  { key: 'modifications', label: 'Modifications', actions: ['create', 'update', 'delete', 'archive'], hint: 'Créations, modifications et suppressions de toute pièce.' },
]

export const AUDIT_ENTITY_LABELS: Record<string, string> = {
  ai_use_case: 'Cas d’usage',
  risk: 'Risque',
  risk_treatment: 'Traitement de risque',
  governance_decision: 'Décision',
  decision_link: 'Lien de décision',
  evidence: 'Preuve',
  control: 'Contrôle',
  control_applicability: 'Applicabilité de contrôle',
  control_evidence: 'Preuve de contrôle',
  control_requirement_map: 'Correspondance de contrôle',
  action: 'Action',
  incident: 'Incident',
  capa: 'CAPA',
  change_request: 'Changement',
  reassessment: 'Réévaluation',
  impact_assessment: 'Évaluation d’impact',
  impact_finding: 'Constat d’impact',
  impact_stakeholder: 'Partie prenante',
  human_oversight_plan: 'Plan de supervision',
  regulatory_classification: 'Qualification',
  assessment: 'Évaluation',
  assessment_answer: 'Réponse d’évaluation',
  ai_asset: 'Actif d’IA',
  use_case_asset_link: 'Actif rattaché',
  use_case_vendor_link: 'Fournisseur rattaché',
  vendor: 'Fournisseur',
  process: 'Processus',
  activity: 'Activité',
  business_unit: 'Entité',
  organization: 'Organisation',
  membership: 'Compte',
  role_assignment: 'Rôle',
  soa_decision: 'Déclaration d’applicabilité',
  governance_review: 'Revue de gouvernance',
  tenant: 'Espace',
}

export type AuditEntry = {
  id: number
  occurred_at: string
  action: string
  entity_type: string
  entity_id: string | null
  entity_ref: string | null
  summary: string | null
  actor_email: string | null
  actor_role: string | null
  use_case_id: string | null
  metadata: Record<string, unknown> | null
}

import type { UseCaseStatus } from '@/lib/domain/governance'

/**
 * Transitions proposees dans l'interface.
 *
 * Cette table est un miroir de app.allowed_use_case_transitions, destine au
 * seul affichage. La base reste l'autorite : elle refuse toute transition non
 * autorisee, meme si cette table venait a diverger.
 */
export const UI_TRANSITIONS: Record<UseCaseStatus, UseCaseStatus[]> = {
  DRAFT: ['TRIAGE', 'RETIRED'],
  TRIAGE: ['ASSESSMENT', 'DRAFT', 'RETIRED'],
  ASSESSMENT: ['REVIEW', 'TRIAGE', 'RETIRED'],
  REVIEW: ['APPROVED', 'CONDITIONAL_APPROVAL', 'REJECTED', 'ASSESSMENT'],
  APPROVED: ['PILOT', 'PRODUCTION', 'RETIRED'],
  CONDITIONAL_APPROVAL: ['PILOT', 'RETIRED'],
  REJECTED: ['DRAFT', 'RETIRED'],
  PILOT: ['PRODUCTION', 'REVIEW', 'SUSPENDED', 'RETIRED'],
  PRODUCTION: ['MONITORING', 'REVIEW', 'SUSPENDED', 'RETIRED'],
  MONITORING: ['PRODUCTION', 'REVIEW', 'SUSPENDED', 'RETIRED'],
  SUSPENDED: ['PRODUCTION', 'REVIEW', 'RETIRED'],
  RETIRED: [],
}

/**
 * Les types de decision qui ont un sens depuis un jalon : ceux qui font
 * franchir le suivant, et ceux qui s'appliquent en service. L'acceptation de
 * risque se prend depuis le risque ; l'exception de politique, partout.
 */
export const DECISION_TYPES_BY_STATUS: Record<UseCaseStatus, string[]> = {
  DRAFT: ['retirement', 'policy_exception'],
  TRIAGE: ['retirement', 'policy_exception'],
  ASSESSMENT: ['retirement', 'policy_exception'],
  REVIEW: ['use_case_authorization', 'policy_exception', 'retirement'],
  APPROVED: ['pilot_approval', 'go_production', 'policy_exception', 'retirement'],
  CONDITIONAL_APPROVAL: ['pilot_approval', 'policy_exception', 'retirement'],
  REJECTED: ['use_case_authorization', 'retirement'],
  PILOT: ['go_production', 'suspension', 'significant_change', 'policy_exception', 'retirement'],
  PRODUCTION: ['suspension', 'significant_change', 'policy_exception', 'retirement'],
  MONITORING: ['suspension', 'significant_change', 'policy_exception', 'retirement'],
  SUSPENDED: ['go_production', 'significant_change', 'policy_exception', 'retirement'],
  RETIRED: [],
}

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
  PILOT: ['PRODUCTION', 'REVIEW', 'RETIRED'],
  PRODUCTION: ['MONITORING', 'REVIEW', 'RETIRED'],
  MONITORING: ['PRODUCTION', 'REVIEW', 'RETIRED'],
  RETIRED: [],
}

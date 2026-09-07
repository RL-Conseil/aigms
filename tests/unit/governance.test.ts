import { describe, expect, it } from 'vitest'
import {
  formatDate,
  LIFECYCLE_STEPS,
  USE_CASE_STATUSES,
  USE_CASE_STATUS_LABELS,
  VERDICT_LABELS,
} from '../../src/lib/domain/governance'

describe('Libelles du modele de gouvernance', () => {
  it('chaque statut du cycle de vie porte un libelle', () => {
    for (const status of USE_CASE_STATUSES) {
      expect(USE_CASE_STATUS_LABELS[status]).toBeTruthy()
    }
  })

  it('le fil de vie affiche ne contient que des statuts connus', () => {
    for (const step of LIFECYCLE_STEPS) {
      expect(USE_CASE_STATUSES).toContain(step)
    }
  })

  it('les trois verdicts de reevaluation sont couverts', () => {
    expect(Object.keys(VERDICT_LABELS)).toEqual([
      'NO_REASSESSMENT',
      'PARTIAL_REASSESSMENT',
      'FULL_REASSESSMENT',
    ])
  })

  it('une date absente est rendue par un tiret', () => {
    expect(formatDate(null)).toBe('—')
    expect(formatDate(undefined)).toBe('—')
  })

  it('une date est rendue au format francais', () => {
    expect(formatDate('2026-09-07')).toMatch(/2026/)
  })
})

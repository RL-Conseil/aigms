import { describe, expect, it } from 'vitest'
import {
  CAPABILITY_LABELS,
  CONNECTOR_CAPABILITIES,
  CONNECTOR_CATALOG,
  CONNECTOR_KINDS,
} from '../../src/lib/domain/connectors'

describe('Catalogue de connecteurs', () => {
  it('chaque type declare son role et une variable d environnement', () => {
    for (const kind of CONNECTOR_KINDS) {
      const entry = CONNECTOR_CATALOG[kind]
      expect(entry.label).toBeTruthy()
      expect(entry.role).toBeTruthy()
      expect(entry.suggestedEnvVar).toMatch(/^[A-Z][A-Z0-9_]{2,63}$/)
    }
  })

  it('les capacites proposees sont toutes connues', () => {
    for (const kind of CONNECTOR_KINDS) {
      for (const capability of CONNECTOR_CATALOG[kind].defaultCapabilities) {
        expect(CONNECTOR_CAPABILITIES).toContain(capability)
      }
    }
  })

  it('chaque capacite porte un libelle', () => {
    for (const capability of CONNECTOR_CAPABILITIES) {
      expect(CAPABILITY_LABELS[capability]).toBeTruthy()
    }
  })

  it("aucune variable suggeree ne ressemble a un secret", () => {
    for (const kind of CONNECTOR_KINDS) {
      const name = CONNECTOR_CATALOG[kind].suggestedEnvVar
      expect(name).not.toMatch(/^(sk|pk|ghp|gho|sbp|re|vcp|xox)[-_]/i)
      expect(name).toBe(name.toUpperCase())
    }
  })
})

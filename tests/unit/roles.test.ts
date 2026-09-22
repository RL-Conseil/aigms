import { describe, expect, it } from 'vitest'
import {
  APP_ROLES,
  ASSIGNABLE_ROLES,
  ROLE_DESCRIPTIONS,
  ROLE_LABELS,
} from '../../src/lib/domain/roles'

describe('Roles applicatifs', () => {
  it('chaque role porte un libelle et une description', () => {
    for (const role of APP_ROLES) {
      expect(ROLE_LABELS[role]).toBeTruthy()
      expect(ROLE_DESCRIPTIONS[role]).toBeTruthy()
    }
  })

  it("les roles attribuables sont un sous-ensemble des roles connus", () => {
    for (const role of ASSIGNABLE_ROLES) {
      expect(APP_ROLES).toContain(role)
    }
  })

  it("l'administration plateforme ne s'attribue pas depuis l'application, l'administrateur client si", () => {
    // Depuis 0091 : l'Administrateur client est l'officer chez le client, un
    // role a part entiere. platform_admin, lui, ouvre les acces et ne se
    // donne pas depuis un ecran.
    expect(ASSIGNABLE_ROLES).not.toContain('platform_admin')
    expect(ASSIGNABLE_ROLES).toContain('client_admin')
  })
})

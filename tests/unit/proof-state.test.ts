import { describe, expect, it } from 'vitest'
import { proofState, type ControlProof } from '@/lib/domain/proof'
import { evidenceFreshness } from '@/lib/domain/governance'

/**
 * L'etat de preuve d'un controle, tel que la ligne l'affiche.
 *
 * La regle doit dire la MEME chose que `app.control_is_held` : un controle
 * n'est tenu que par une preuve validee ET non echue. Une preuve validee mais
 * perimee ne tient rien, et c'est exactement le cas qu'un auditeur releve.
 */

const preuve = (o: Partial<ControlProof>): ControlProof => ({
  id: 'e', business_ref: 'PRV-1', title: 'Pièce', validation_status: 'validated', freshness: 'fresh', ...o,
})

describe('État de preuve d’un contrôle', () => {
  it('sans aucune pièce, rien ne le démontre', () => {
    expect(proofState([])).toBe('none')
  })

  it('une pièce validée et à jour le tient', () => {
    expect(proofState([preuve({})])).toBe('held')
  })

  it('une pièce déposée mais pas validée ne le tient pas', () => {
    expect(proofState([preuve({ validation_status: 'pending' })])).toBe('to_validate')
  })

  it('une pièce validée mais échue ne tient plus rien', () => {
    expect(proofState([preuve({ freshness: 'expired' })])).toBe('expired')
  })

  it('une pièce proche de l’échéance tient encore, mais se signale', () => {
    expect(proofState([preuve({ freshness: 'expiring' })])).toBe('expiring')
  })

  it('la meilleure pièce commande l’état', () => {
    expect(proofState([preuve({ id: 'a', freshness: 'expired' }), preuve({ id: 'b' })])).toBe('held')
  })
})

describe('Fraîcheur, même seuil que la base', () => {
  const jours = (n: number) => {
    const d = new Date()
    d.setUTCDate(d.getUTCDate() + n)
    return d.toISOString().slice(0, 10)
  }

  it('sans échéance, on ne sait pas', () => {
    expect(evidenceFreshness(null)).toBe('unknown')
  })
  it('hier, échue', () => {
    expect(evidenceFreshness(jours(-1))).toBe('expired')
  })
  it('aujourd’hui, pas encore échue', () => {
    expect(evidenceFreshness(jours(0))).toBe('expiring')
  })
  // Trente jours : le seuil de app.evidence_freshness (0009).
  it('dans 29 jours, bientôt échue', () => {
    expect(evidenceFreshness(jours(29))).toBe('expiring')
  })
  it('dans 31 jours, à jour', () => {
    expect(evidenceFreshness(jours(31))).toBe('fresh')
  })
})

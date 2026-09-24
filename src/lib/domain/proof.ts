import type { EvidenceFreshness } from '@/lib/domain/governance'

/**
 * L'etat d'un controle au regard de ses preuves.
 *
 * Module PUR, et il le reste : la ligne d'un controle est rendue par le
 * serveur, la pastille qui s'ouvre est un composant client. Les deux lisent
 * ces memes regles — les laisser dans le composant client donnait une erreur
 * serveur, que le test de frontiere a attrapee (ADR-0029).
 */

export type ControlProof = {
  id: string
  business_ref: string
  title: string
  validation_status: string
  freshness: EvidenceFreshness
}

export type ProofState = 'held' | 'expiring' | 'to_validate' | 'expired' | 'none'

export const PROOF_STATE: Record<ProofState, { glyph: string; label: string; className: string }> = {
  held: { glyph: '●', label: 'Démontré par une preuve validée', className: 'text-ok-600' },
  expiring: { glyph: '●', label: 'Preuve validée, mais proche de l’échéance', className: 'text-warn-600' },
  to_validate: { glyph: '◐', label: 'Preuve déposée, pas encore validée', className: 'text-warn-600' },
  expired: { glyph: '○', label: 'Preuve échue : plus rien ne le démontre', className: 'text-stop-600' },
  none: { glyph: '○', label: 'Aucune preuve', className: 'text-stop-600' },
}

/**
 * Deduit l'etat d'un controle de ses pieces.
 *
 * Meme exigence que `app.control_is_held` (0072) : un controle n'est tenu que
 * par une preuve VALIDEE et NON ECHUE. Une piece validee mais perimee ne tient
 * rien — c'est exactement ce qu'un auditeur releve.
 */
export function proofState(proofs: ControlProof[]): ProofState {
  const validated = proofs.filter((p) => p.validation_status === 'validated')
  const vivantes = validated.filter((p) => p.freshness !== 'expired')
  if (vivantes.some((p) => p.freshness !== 'expiring')) return 'held'
  if (vivantes.length) return 'expiring'
  if (proofs.some((p) => p.validation_status !== 'validated')) return 'to_validate'
  return validated.length ? 'expired' : 'none'
}

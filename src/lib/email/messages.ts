import type { AppRole } from '@/lib/domain/roles'
import { ROLE_DESCRIPTIONS, ROLE_LABELS } from '@/lib/domain/roles'

/**
 * Contenus des courriels systeme.
 *
 * Separes de l'envoi pour une raison simple : ce qu'une organisation ecrit a
 * ses utilisateurs se relit, se corrige et se teste sans toucher au transport.
 */

export function accountOpenedEmail({
  fullName,
  role,
  siteUrl,
  organizationName,
}: {
  fullName: string
  role: AppRole
  siteUrl: string
  organizationName?: string | null
}): { subject: string; text: string } {
  const scope = organizationName ? ` pour ${organizationName}` : ''

  return {
    subject: 'Votre accès à AIGMS est ouvert',
    text: [
      `Bonjour ${fullName},`,
      '',
      `Un accès à AIGMS — le registre des usages d'IA, des décisions qui les`,
      `autorisent et des preuves qui le démontrent — vient d'être ouvert à votre`,
      `nom${scope}.`,
      '',
      `Votre rôle : ${ROLE_LABELS[role]}.`,
      ROLE_DESCRIPTIONS[role],
      '',
      `Adresse de connexion : ${siteUrl}`,
      `Identifiant : cette adresse électronique.`,
      '',
      `Votre mot de passe provisoire vous est transmis séparément, par un autre`,
      `canal : il ne circule jamais par courriel.`,
      '',
      `Pour toute question — accès, rôle, mot de passe — répondez à ce message.`,
      '',
      'AIGMS',
    ].join('\n'),
  }
}

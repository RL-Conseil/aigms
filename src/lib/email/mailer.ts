import 'server-only'

/**
 * Courrier systeme.
 *
 * Un seul point d'envoi pour tout ce que la plateforme adresse a une personne :
 * ouverture d'acces aujourd'hui, rappels d'echeance demain. L'adresse
 * d'expedition et la cle vivent dans l'environnement, jamais dans le code.
 *
 * DEUX PRINCIPES, qui expliquent la forme de ce module :
 *
 *   1. **L'envoi est une commodite, jamais un point de passage.** Un compte
 *      declare l'est meme si le courriel ne part pas. La fonction ne leve donc
 *      aucune exception : elle rend un resultat que l'appelant presente. Faire
 *      echouer une declaration de compte parce qu'un fournisseur de courriel
 *      est indisponible serait une regression de gouvernance.
 *
 *   2. **Aucun secret ne transite par courriel.** Ni mot de passe, ni jeton de
 *      session. Ce que la plateforme envoie est une information, pas un moyen
 *      d'acces.
 */

const ENDPOINT = 'https://api.resend.com/emails'

export type MailResult =
  | { sent: true; id: string }
  | { sent: false; reason: 'not_configured' | 'refused' | 'unreachable'; detail?: string }

export type SystemEmail = {
  to: string
  subject: string
  /** Corps en texte brut. Il fait foi : le HTML n'en est que la mise en forme. */
  text: string
  /** Adresse a laquelle la personne repond, si elle differe de l'expediteur. */
  replyTo?: string
}

/** Adresse d'expedition du compte systeme, ou null si elle n'est pas posee. */
export function systemEmailSender(): string | null {
  const from = process.env.SYSTEM_EMAIL_FROM?.trim()
  return from ? from : null
}

export function isMailerConfigured(): boolean {
  return Boolean(process.env.RESEND_API_KEY?.trim() && systemEmailSender())
}

export async function sendSystemEmail(email: SystemEmail): Promise<MailResult> {
  const key = process.env.RESEND_API_KEY?.trim()
  const from = systemEmailSender()

  // En developpement local et en integration continue, aucune cle n'est posee :
  // le module se tait proprement plutot que d'echouer.
  if (!key || !from) return { sent: false, reason: 'not_configured' }

  try {
    const response = await fetch(ENDPOINT, {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${key}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        from,
        to: [email.to],
        subject: email.subject,
        text: email.text,
        ...(email.replyTo ? { reply_to: email.replyTo } : {}),
      }),
    })

    if (!response.ok) {
      const detail = await response.text().catch(() => '')
      return { sent: false, reason: 'refused', detail: detail.slice(0, 300) }
    }

    const payload = (await response.json()) as { id?: string }
    return { sent: true, id: payload.id ?? '' }
  } catch (error) {
    return {
      sent: false,
      reason: 'unreachable',
      detail: error instanceof Error ? error.message : undefined,
    }
  }
}

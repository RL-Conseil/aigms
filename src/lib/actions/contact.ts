'use server'

import { headers } from 'next/headers'
import { z } from 'zod'
import { createClient } from '@/lib/supabase/server'

/**
 * Depot d'une demande de rappel.
 *
 * Le formulaire est la seule surface publique d'AIGMS : il ecrit dans
 * `contact_request` avec le role anonyme, qui n'a que le droit d'inserer. La
 * validation ci-dessous double celle de la base, qui reste l'autorite.
 */

const PROFILES = ['direction', 'dsi_rssi_dpo', 'metier', 'conseil_msp_integrateur', 'autre'] as const

const schema = z.object({
  fullName: z.string().trim().min(2, 'Merci d’indiquer votre nom.').max(120),
  email: z.string().trim().email('Adresse électronique invalide.').max(254),
  organization: z.string().trim().min(2, 'Merci d’indiquer votre organisation.').max(160),
  phone: z.string().trim().max(40).optional().or(z.literal('')),
  profile: z.enum(PROFILES),
  message: z.string().trim().max(2000).optional().or(z.literal('')),
  // Champ leurre : rempli seulement par un automate.
  website: z.string().max(0).optional().or(z.literal('')),
})

export type ContactState =
  | { status: 'idle' }
  | { status: 'success' }
  | { status: 'error'; message: string; fieldErrors?: Record<string, string> }

export async function submitContactRequest(
  _previous: ContactState,
  formData: FormData,
): Promise<ContactState> {
  const parsed = schema.safeParse({
    fullName: formData.get('fullName'),
    email: formData.get('email'),
    organization: formData.get('organization'),
    phone: formData.get('phone') ?? '',
    profile: formData.get('profile') ?? 'autre',
    message: formData.get('message') ?? '',
    website: formData.get('website') ?? '',
  })

  if (!parsed.success) {
    const fieldErrors: Record<string, string> = {}
    for (const issue of parsed.error.issues) {
      const key = issue.path[0]
      if (typeof key === 'string' && !fieldErrors[key]) fieldErrors[key] = issue.message
    }
    // Le leurre rempli : on repond comme a un succes, sans rien ecrire.
    if (fieldErrors.website) return { status: 'success' }

    return {
      status: 'error',
      message: 'Merci de corriger les champs signalés.',
      fieldErrors,
    }
  }

  const { fullName, email, organization, phone, profile, message } = parsed.data

  const supabase = await createClient()
  const { error } = await supabase.from('contact_request').insert({
    full_name: fullName,
    email,
    organization,
    phone: phone || null,
    profile,
    message: message || null,
  })

  if (error) {
    // 23505 : l'index unique quotidien a deja enregistre cette adresse.
    if (error.code === '23505') {
      return {
        status: 'error',
        message:
          'Une demande a déjà été enregistrée aujourd’hui avec cette adresse. Nous revenons vers vous rapidement.',
      }
    }
    return {
      status: 'error',
      message: 'L’envoi a échoué. Merci de réessayer dans un instant.',
    }
  }

  await notifyByEmail({ fullName, email, organization, phone, profile, message })

  return { status: 'success' }
}

/**
 * Notification interne.
 *
 * Facultative par construction : sans cle d'API, la demande est enregistree en
 * base et l'absence de notification est journalisee cote serveur. Une panne du
 * service d'envoi ne doit jamais faire perdre une demande.
 */
async function notifyByEmail(request: {
  fullName: string
  email: string
  organization: string
  phone?: string
  profile: string
  message?: string
}): Promise<void> {
  const apiKey = process.env.RESEND_API_KEY
  const to = process.env.CONTACT_NOTIFICATION_EMAIL
  const from = process.env.CONTACT_NOTIFICATION_FROM

  if (!apiKey || !to || !from) {
    console.info(
      '[contact] Demande enregistrée sans notification : RESEND_API_KEY, CONTACT_NOTIFICATION_EMAIL ou CONTACT_NOTIFICATION_FROM absente.',
    )
    return
  }

  const origin = (await headers()).get('origin') ?? process.env.NEXT_PUBLIC_SITE_URL ?? ''

  const lines = [
    `Nom : ${request.fullName}`,
    `Organisation : ${request.organization}`,
    `Adresse : ${request.email}`,
    `Téléphone : ${request.phone || '—'}`,
    `Profil : ${request.profile}`,
    '',
    request.message || '(aucun message)',
    '',
    `Suivi : ${origin}/admin/contacts`,
  ]

  try {
    const response = await fetch('https://api.resend.com/emails', {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${apiKey}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        from,
        to: [to],
        reply_to: request.email,
        subject: `AIGMS — demande de rappel : ${request.organization}`,
        text: lines.join('\n'),
      }),
    })

    if (!response.ok) {
      console.error('[contact] Notification refusée par le service d’envoi :', response.status)
    }
  } catch (error) {
    console.error('[contact] Notification impossible :', error)
  }
}

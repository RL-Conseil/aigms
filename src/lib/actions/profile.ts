'use server'

import { revalidatePath } from 'next/cache'
import { z } from 'zod'
import { createClient } from '@/lib/supabase/server'

/**
 * Mise a jour de son propre profil.
 *
 * L'action ne verifie pas qui appelle : la politique `user_profile_update_self`
 * limite deja l'ecriture a sa propre ligne, et un trigger empeche l'attribution
 * du privilege plateforme. Dupliquer ces controles ici les ferait diverger.
 */

const profileSchema = z.object({
  fullName: z.string().trim().min(2, 'Nom trop court.').max(120),
  jobTitle: z.string().trim().max(120).optional().or(z.literal('')),
})

export type ProfileState = { ok: true; message: string } | { ok: false; message: string }

export async function updateProfile(
  _previous: ProfileState | null,
  formData: FormData,
): Promise<ProfileState> {
  const parsed = profileSchema.safeParse({
    fullName: formData.get('fullName'),
    jobTitle: formData.get('jobTitle') ?? '',
  })

  if (!parsed.success) {
    return { ok: false, message: parsed.error.issues[0]?.message ?? 'Formulaire incomplet.' }
  }

  const supabase = await createClient()
  const {
    data: { user },
  } = await supabase.auth.getUser()

  if (!user) return { ok: false, message: 'Session expirée.' }

  const { error } = await supabase
    .from('user_profile')
    .update({
      full_name: parsed.data.fullName,
      job_title: parsed.data.jobTitle || null,
    })
    .eq('id', user.id)

  if (error) {
    return { ok: false, message: `Enregistrement refusé : ${error.message}` }
  }

  revalidatePath('/admin/parametres')
  return { ok: true, message: 'Profil enregistré.' }
}

// -----------------------------------------------------------------------------
// Organisation courante
// -----------------------------------------------------------------------------
// Une personne peut se voir attribuer un role sur plusieurs organisations. Se
// placer sur l'une d'elles est un choix d'affichage — il n'ouvre aucun droit,
// la RLS reste souveraine — mais il suit la personne d'un poste a l'autre,
// d'ou son stockage sur le profil plutot que dans un temoin de navigation.
const currentOrganizationSchema = z.object({
  organizationId: z.string().uuid('Choisir une organisation.'),
})

export async function setCurrentOrganization(
  _previous: ProfileState | null,
  formData: FormData,
): Promise<ProfileState> {
  const parsed = currentOrganizationSchema.safeParse({
    organizationId: formData.get('organizationId'),
  })
  if (!parsed.success) {
    return { ok: false, message: parsed.error.issues[0]?.message ?? 'Formulaire incomplet.' }
  }

  const supabase = await createClient()
  const {
    data: { user },
  } = await supabase.auth.getUser()
  if (!user) return { ok: false, message: 'Session expirée.' }

  // La base refuse une organisation hors du perimetre gere
  // (app.guard_current_organization) : on presente son refus tel quel.
  const { data, error } = await supabase
    .from('user_profile')
    .update({ current_organization_id: parsed.data.organizationId })
    .eq('id', user.id)
    .select('id')

  if (error) {
    const raise = error.message.match(/^(?:.*?:\s)?([A-ZÀ-Ü][^\n]*)$/m)
    return { ok: false, message: raise?.[1] ?? error.message }
  }
  if (!data?.length) {
    return { ok: false, message: 'Modification refusée.' }
  }

  revalidatePath('/admin', 'layout')
  return { ok: true, message: 'Organisation courante enregistrée.' }
}

// -----------------------------------------------------------------------------
// Comment je veux etre prevenu
// -----------------------------------------------------------------------------
/**
 * La preference vit par personne : l'administration peut la poser a la
 * declaration du compte et la retirer ensuite, chacun la regle pour soi. La
 * politique RLS decide qui peut ecrire quelle ligne ; l'action ne la double
 * pas.
 */
const notificationSchema = z.object({
  userId: z.string().uuid(),
  emailEnabled: z.coerce.boolean(),
  immediateEnabled: z.coerce.boolean(),
  digest: z.enum(['none', 'daily', 'weekly']),
})

export async function saveNotificationPreference(
  _previous: ProfileState | null,
  formData: FormData,
): Promise<ProfileState> {
  const parsed = notificationSchema.safeParse({
    userId: formData.get('userId'),
    emailEnabled: formData.get('emailEnabled') === 'on',
    immediateEnabled: formData.get('immediateEnabled') === 'on',
    digest: formData.get('digest') ?? 'daily',
  })
  if (!parsed.success) {
    return { ok: false, message: parsed.error.issues[0]?.message ?? 'Formulaire incomplet.' }
  }

  const supabase = await createClient()
  const { error } = await supabase.from('notification_preference').upsert(
    {
      user_id: parsed.data.userId,
      email_enabled: parsed.data.emailEnabled,
      immediate_enabled: parsed.data.immediateEnabled,
      digest: parsed.data.digest,
    },
    { onConflict: 'user_id' },
  )

  if (error) {
    return {
      ok: false,
      message: error.message.includes('row-level security')
        ? 'Votre rôle ne permet pas de régler les notifications de cette personne.'
        : `Enregistrement refusé : ${error.message}`,
    }
  }

  revalidatePath('/admin/parametres')
  revalidatePath('/admin/comptes')
  return {
    ok: true,
    message: parsed.data.emailEnabled
      ? 'Notifications enregistrées.'
      : 'Notifications par courriel désactivées. Les alertes restent lisibles dans « Mes alertes ».',
  }
}

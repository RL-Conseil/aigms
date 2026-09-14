import 'server-only'

import { cache } from 'react'
import { createClient } from '@/lib/supabase/server'
import type { AppRole } from '@/lib/domain/roles'

/**
 * Contexte de la personne connectee : qui elle est, sur quel tenant, avec quel
 * role.
 *
 * Il sert uniquement a PRESENTER l'interface — quel menu afficher, quel bandeau,
 * quels boutons. Il ne decide d'aucun droit : la RLS et les fonctions serveur
 * restent seules juges, et une interface qui se tromperait n'ouvrirait rien.
 */

export type ViewerContext = {
  userId: string
  email: string
  fullName: string | null
  jobTitle: string | null
  isPlatformAdmin: boolean
  tenantId: string | null
  tenantName: string | null
  tenantSlug: string | null
  role: AppRole | null
  /**
   * Organisation sur laquelle la personne travaille. Nulle lorsqu'il y a un
   * choix a faire — plusieurs organisations gerees sans selection — ou rien a
   * montrer. C'est un choix d'affichage : il n'ouvre aucun droit.
   */
  currentOrganizationId: string | null
}

/**
 * `cache` memoise l'appel pour la duree du rendu : la mise en page, le bandeau
 * et la page elle-meme lisent le meme contexte sans multiplier les requetes.
 */
export const getViewerContext = cache(async (): Promise<ViewerContext | null> => {
  const supabase = await createClient()

  const {
    data: { user },
  } = await supabase.auth.getUser()

  if (!user) return null

  const [{ data: profile }, { data: membership }, { data: currentOrganization }] =
    await Promise.all([
    supabase
      .from('user_profile')
      .select('id, email, full_name, job_title, is_platform_admin')
      .eq('id', user.id)
      .maybeSingle(),
    supabase
      .from('membership')
      .select('role, tenant:tenant_id (id, name, slug)')
      .eq('user_id', user.id)
      .eq('status', 'active')
      .maybeSingle(),
    supabase.rpc('current_organization'),
  ])

  const tenant = membership?.tenant as unknown as
    | { id: string; name: string; slug: string }
    | null
    | undefined

  return {
    userId: user.id,
    email: profile?.email ?? user.email ?? '',
    fullName: profile?.full_name ?? null,
    jobTitle: profile?.job_title ?? null,
    isPlatformAdmin: profile?.is_platform_admin === true,
    tenantId: tenant?.id ?? null,
    tenantName: tenant?.name ?? null,
    tenantSlug: tenant?.slug ?? null,
    role: (membership?.role as AppRole | undefined) ?? null,
    currentOrganizationId: (currentOrganization as string | null) ?? null,
  }
})

/** Vrai lorsque la session est en administration de plateforme. */
export function isAdministrating(viewer: ViewerContext | null): boolean {
  return viewer?.isPlatformAdmin === true || viewer?.role === 'platform_admin'
}

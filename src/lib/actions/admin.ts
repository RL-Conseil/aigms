'use server'

/* eslint-disable no-restricted-imports -- Voir l'encadre ci-dessous : ce module
   est le seul point de l'application autorise a employer la cle service_role,
   et uniquement pour creer un compte d'authentification. */

import { revalidatePath } from 'next/cache'
import { z } from 'zod'
import { createClient } from '@/lib/supabase/server'
import { createAdminClient } from '@/lib/supabase/admin'
import { ASSIGNABLE_ROLES, type AppRole } from '@/lib/domain/roles'

/**
 * Actes d'administration : creer une organisation, declarer un compte,
 * attribuer un role.
 *
 * ------------------------------------------------------------------------
 * Pourquoi la cle service_role apparait ici, et nulle part ailleurs
 * ------------------------------------------------------------------------
 * Creer un compte d'authentification passe par l'API d'administration de
 * Supabase, qui n'accepte que cette cle. Aucune politique RLS ne peut s'y
 * substituer.
 *
 * Le contournement est donc borne :
 *   * chaque action verifie D'ABORD, avec le client soumis a la RLS, que
 *     l'appelant administre bien le tenant vise — un appel non habilite
 *     s'arrete avant que la cle ne soit lue ;
 *   * la cle ne sert qu'a `auth.admin.createUser`, jamais a lire ou ecrire
 *     une donnee metier : l'appartenance et le role passent par le client
 *     ordinaire, donc par la RLS ;
 *   * chaque acte est journalise en base par un trigger, donc quel que soit le
 *     chemin emprunte — l'application n'ecrit pas elle-meme dans le journal.
 *
 * Voir docs/adr/ADR-0008-account-provisioning.md.
 */

type Result = { ok: true; message: string } | { ok: false; message: string }

/**
 * Verifie que l'appelant administre le tenant, avec le client soumis a la RLS.
 * Retourne l'identifiant du tenant administre, ou null.
 */
async function requireAdministratedTenant(): Promise<
  { tenantId: string; userId: string } | null
> {
  const supabase = await createClient()

  const {
    data: { user },
  } = await supabase.auth.getUser()
  if (!user) return null

  const { data: membership } = await supabase
    .from('membership')
    .select('tenant_id, role')
    .eq('user_id', user.id)
    .eq('status', 'active')
    .eq('role', 'platform_admin')
    .maybeSingle()

  if (!membership?.tenant_id) return null

  return { tenantId: membership.tenant_id, userId: user.id }
}

// -----------------------------------------------------------------------------
// Creation d'organisation
// -----------------------------------------------------------------------------
const organizationSchema = z.object({
  name: z.string().trim().min(2, 'Nom trop court.').max(160),
  legalName: z.string().trim().max(160).optional().or(z.literal('')),
  sector: z.string().trim().max(120).optional().or(z.literal('')),
  countryCode: z
    .string()
    .trim()
    .length(2, 'Code pays sur deux lettres.')
    .optional()
    .or(z.literal('')),
  headcount: z.coerce.number().int().min(0).max(10_000_000).optional(),
  status: z.enum(['prospect', 'pilot', 'active', 'archived']),
})

export async function createOrganization(_previous: Result | null, formData: FormData): Promise<Result> {
  const admin = await requireAdministratedTenant()
  if (!admin) {
    return { ok: false, message: "Cette action relève de l'administration de la plateforme." }
  }

  const parsed = organizationSchema.safeParse({
    name: formData.get('name'),
    legalName: formData.get('legalName') ?? '',
    sector: formData.get('sector') ?? '',
    countryCode: formData.get('countryCode') ?? '',
    headcount: formData.get('headcount') || undefined,
    status: formData.get('status') ?? 'prospect',
  })

  if (!parsed.success) {
    return { ok: false, message: parsed.error.issues[0]?.message ?? 'Formulaire incomplet.' }
  }

  const supabase = await createClient()
  const { data, error } = await supabase
    .from('organization')
    .insert({
      tenant_id: admin.tenantId,
      name: parsed.data.name,
      legal_name: parsed.data.legalName || null,
      sector: parsed.data.sector || null,
      country_code: parsed.data.countryCode ? parsed.data.countryCode.toUpperCase() : null,
      headcount: parsed.data.headcount ?? null,
      status: parsed.data.status,
    })
    .select('id, business_ref, name')
    .single()

  if (error) {
    return { ok: false, message: `Création refusée : ${error.message}` }
  }


  revalidatePath('/admin')
  return { ok: true, message: `${data.name} (${data.business_ref}) créée.` }
}

// -----------------------------------------------------------------------------
// Declaration d'un compte et attribution d'un role
// -----------------------------------------------------------------------------
const accountSchema = z.object({
  email: z.string().trim().email('Adresse électronique invalide.').max(254),
  fullName: z.string().trim().min(2, 'Nom trop court.').max(120),
  jobTitle: z.string().trim().max(120).optional().or(z.literal('')),
  role: z.enum(ASSIGNABLE_ROLES as [AppRole, ...AppRole[]]),
  organizationId: z.string().uuid().optional().or(z.literal('')),
  password: z
    .string()
    .min(12, 'Le mot de passe provisoire doit compter au moins douze caractères.')
    .max(128),
})

export async function createAccount(_previous: Result | null, formData: FormData): Promise<Result> {
  const admin = await requireAdministratedTenant()
  if (!admin) {
    return { ok: false, message: "Cette action relève de l'administration de la plateforme." }
  }

  const parsed = accountSchema.safeParse({
    email: formData.get('email'),
    fullName: formData.get('fullName'),
    jobTitle: formData.get('jobTitle') ?? '',
    role: formData.get('role'),
    organizationId: formData.get('organizationId') ?? '',
    password: formData.get('password'),
  })

  if (!parsed.success) {
    return { ok: false, message: parsed.error.issues[0]?.message ?? 'Formulaire incomplet.' }
  }

  const { email, fullName, jobTitle, role, organizationId, password } = parsed.data

  // Seul usage de la cle service_role : la creation du compte d'authentification.
  const service = createAdminClient()
  const { data: created, error: createError } = await service.auth.admin.createUser({
    email,
    password,
    email_confirm: true,
    user_metadata: { full_name: fullName },
  })

  if (createError || !created.user) {
    const alreadyExists = createError?.message?.toLowerCase().includes('already')
    return {
      ok: false,
      message: alreadyExists
        ? 'Un compte existe déjà pour cette adresse.'
        : `Création du compte refusée : ${createError?.message ?? 'erreur inconnue'}`,
    }
  }

  // Tout le reste repasse par le client soumis a la RLS.
  const supabase = await createClient()

  if (jobTitle) {
    await supabase.from('user_profile').update({ job_title: jobTitle }).eq('id', created.user.id)
  }

  const { error: membershipError } = await supabase.from('membership').insert({
    tenant_id: admin.tenantId,
    user_id: created.user.id,
    role,
    invited_by: admin.userId,
  })

  if (membershipError) {
    return {
      ok: false,
      message: `Compte créé, mais rattachement refusé : ${membershipError.message}`,
    }
  }

  if (organizationId) {
    const { error: assignmentError } = await supabase.from('role_assignment').insert({
      tenant_id: admin.tenantId,
      organization_id: organizationId,
      user_id: created.user.id,
      role,
      granted_by: admin.userId,
    })

    if (assignmentError) {
      return {
        ok: false,
        message: `Compte rattaché, mais affectation à l’organisation refusée : ${assignmentError.message}`,
      }
    }
  }


  revalidatePath('/admin/comptes')
  return { ok: true, message: `Compte ${email} créé et rattaché.` }
}

// -----------------------------------------------------------------------------
// Modification du role d'un compte existant
// -----------------------------------------------------------------------------
const roleChangeSchema = z.object({
  userId: z.string().uuid(),
  role: z.enum(ASSIGNABLE_ROLES as [AppRole, ...AppRole[]]),
})

export async function changeAccountRole(_previous: Result | null, formData: FormData): Promise<Result> {
  const admin = await requireAdministratedTenant()
  if (!admin) {
    return { ok: false, message: "Cette action relève de l'administration de la plateforme." }
  }

  const parsed = roleChangeSchema.safeParse({
    userId: formData.get('userId'),
    role: formData.get('role'),
  })

  if (!parsed.success) {
    return { ok: false, message: 'Demande invalide.' }
  }

  const supabase = await createClient()
  const { error } = await supabase
    .from('membership')
    .update({ role: parsed.data.role })
    .eq('tenant_id', admin.tenantId)
    .eq('user_id', parsed.data.userId)

  if (error) {
    return { ok: false, message: `Modification refusée : ${error.message}` }
  }


  revalidatePath('/admin/comptes')
  return { ok: true, message: 'Rôle mis à jour.' }
}

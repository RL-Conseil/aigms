'use server'

/* eslint-disable no-restricted-imports -- Voir l'encadre ci-dessous : ce module
   est le seul point de l'application autorise a employer la cle service_role,
   et uniquement pour creer un compte d'authentification. */

import { revalidatePath } from 'next/cache'
import { z } from 'zod'
import { createClient } from '@/lib/supabase/server'
import { createAdminClient } from '@/lib/supabase/admin'
import { ASSIGNABLE_ROLES, type AppRole } from '@/lib/domain/roles'
import { accountOpenedEmail } from '@/lib/email/messages'
import { sendSystemEmail } from '@/lib/email/mailer'
import { publicEnv } from '@/lib/env'

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
// Identite de l'organisation
// -----------------------------------------------------------------------------
// Ces champs ne gouvernent rien : aucun gate ne les lit. Ils existent pour
// qu'un document sorti de l'outil — registre des usages, declaration
// d'applicabilite — puisse etre remis tel quel, avec l'identite de
// l'organisation en en-tete et sa mention de confidentialite en pied.
const identityShape = {
  addressLine1: z.string().trim().max(160).optional().or(z.literal('')),
  addressLine2: z.string().trim().max(160).optional().or(z.literal('')),
  postalCode: z.string().trim().max(20).optional().or(z.literal('')),
  city: z.string().trim().max(120).optional().or(z.literal('')),
  registrationNumber: z.string().trim().max(60).optional().or(z.literal('')),
  vatNumber: z.string().trim().max(40).optional().or(z.literal('')),
  website: z.string().trim().max(200).optional().or(z.literal('')),
  contactName: z.string().trim().max(120).optional().or(z.literal('')),
  contactEmail: z
    .string()
    .trim()
    .email('Adresse électronique invalide.')
    .max(254)
    .optional()
    .or(z.literal('')),
  contactPhone: z.string().trim().max(40).optional().or(z.literal('')),
  confidentialityLabel: z.string().trim().min(1).max(60),
  documentFooterNote: z.string().trim().max(240).optional().or(z.literal('')),
}

/** Les memes champs, lus depuis un FormData. */
function readIdentity(formData: FormData) {
  return {
    addressLine1: formData.get('addressLine1') ?? '',
    addressLine2: formData.get('addressLine2') ?? '',
    postalCode: formData.get('postalCode') ?? '',
    city: formData.get('city') ?? '',
    registrationNumber: formData.get('registrationNumber') ?? '',
    vatNumber: formData.get('vatNumber') ?? '',
    website: formData.get('website') ?? '',
    contactName: formData.get('contactName') ?? '',
    contactEmail: formData.get('contactEmail') ?? '',
    contactPhone: formData.get('contactPhone') ?? '',
    confidentialityLabel: (formData.get('confidentialityLabel') as string) || 'Confidentiel',
    documentFooterNote: formData.get('documentFooterNote') ?? '',
  }
}

/** Traduction vers les colonnes, vide valant NULL. */
function identityColumns(d: {
  addressLine1?: string
  addressLine2?: string
  postalCode?: string
  city?: string
  registrationNumber?: string
  vatNumber?: string
  website?: string
  contactName?: string
  contactEmail?: string
  contactPhone?: string
  confidentialityLabel: string
  documentFooterNote?: string
}) {
  return {
    address_line1: d.addressLine1 || null,
    address_line2: d.addressLine2 || null,
    postal_code: d.postalCode || null,
    city: d.city || null,
    registration_number: d.registrationNumber || null,
    vat_number: d.vatNumber || null,
    website: d.website || null,
    contact_name: d.contactName || null,
    contact_email: d.contactEmail || null,
    contact_phone: d.contactPhone || null,
    confidentiality_label: d.confidentialityLabel,
    document_footer_note: d.documentFooterNote || null,
  }
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
  ...identityShape,
  // Le profil commande les typologies de preuves attendues : il se renseigne a
  // la creation, quand la question se pose naturellement.
  activityProfile: z.enum([
    'infrastructure_host',
    'model_developer',
    'integrator_consultant',
    'business_user',
  ]),
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
    activityProfile: formData.get('activityProfile'),
    ...readIdentity(formData),
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
      ai_activity_profile: parsed.data.activityProfile,
      ...identityColumns(parsed.data),
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
  // Sans la cle sur cet environnement, l'action le dit — plutot que de laisser
  // Next afficher une erreur serveur anonyme.
  let service: ReturnType<typeof createAdminClient>
  try {
    service = createAdminClient()
  } catch {
    return {
      ok: false,
      message:
        'Déclaration impossible : la clé de service (SUPABASE_SERVICE_ROLE_KEY) n’est pas configurée sur cet environnement. Elle se pose dans les variables d’environnement du déploiement, jamais dans le code — voir docs/admin/COMPTES_ET_ANNUAIRE.md.',
    }
  }
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


  // Le courriel d'ouverture d'acces part APRES le rattachement, et son echec
  // n'annule rien : un compte declare l'est meme si le fournisseur de courriel
  // est indisponible. On le dit a l'administrateur plutot que de le taire —
  // c'est a lui de prevenir la personne autrement.
  let organizationName: string | null = null
  if (organizationId) {
    const { data: organization } = await supabase
      .from('organization')
      .select('name')
      .eq('id', organizationId)
      .maybeSingle()
    organizationName = organization?.name ?? null
  }

  const message = accountOpenedEmail({
    fullName,
    role,
    siteUrl: publicEnv().NEXT_PUBLIC_SITE_URL,
    organizationName,
  })
  const mail = await sendSystemEmail({ to: email, ...message })

  revalidatePath('/admin/comptes')
  return {
    ok: true,
    message: mail.sent
      ? `Compte ${email} créé et rattaché. Courriel d’ouverture d’accès envoyé — le mot de passe provisoire, lui, se transmet par un autre canal.`
      : `Compte ${email} créé et rattaché. Le courriel d’ouverture d’accès n’est pas parti (${mail.reason}) : prévenez la personne par un autre moyen.`,
  }
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

  // Les affectations aux organisations suivent : un role change pour la
  // personne, pas pour l'une de ses organisations seulement. Sinon la fiche
  // dirait un role et l'organisation en appliquerait un autre.
  const { error: assignmentError } = await supabase
    .from('role_assignment')
    .update({ role: parsed.data.role })
    .eq('tenant_id', admin.tenantId)
    .eq('user_id', parsed.data.userId)
    .is('valid_until', null)

  revalidatePath('/admin/comptes')
  return assignmentError
    ? { ok: false, message: `Rôle d’appartenance mis à jour, mais les affectations n’ont pas suivi : ${assignmentError.message}` }
    : { ok: true, message: 'Rôle mis à jour, appartenance et affectations.' }
}

// -----------------------------------------------------------------------------
// Completer l'identite d'une organisation deja creee
// -----------------------------------------------------------------------------
// Les organisations anterieures a la migration 0035 n'ont pas d'adresse, et une
// adresse demenage. Le meme ecran sert donc a completer comme a corriger.
const identityUpdateSchema = z.object({
  organizationId: z.string().uuid(),
  name: z.string().trim().min(2, 'Nom trop court.').max(160),
  legalName: z.string().trim().max(160).optional().or(z.literal('')),
  ...identityShape,
})

export async function updateOrganizationIdentity(
  _previous: Result | null,
  formData: FormData,
): Promise<Result> {
  const admin = await requireAdministratedTenant()
  if (!admin) {
    return { ok: false, message: "Cette action relève de l'administration de la plateforme." }
  }

  const parsed = identityUpdateSchema.safeParse({
    organizationId: formData.get('organizationId'),
    name: formData.get('name'),
    legalName: formData.get('legalName') ?? '',
    ...readIdentity(formData),
  })
  if (!parsed.success) {
    return { ok: false, message: parsed.error.issues[0]?.message ?? 'Formulaire incomplet.' }
  }

  const supabase = await createClient()
  const { data, error } = await supabase
    .from('organization')
    .update({
      name: parsed.data.name,
      legal_name: parsed.data.legalName || null,
      ...identityColumns(parsed.data),
    })
    .eq('id', parsed.data.organizationId)
    .select('id, name')

  if (error) return { ok: false, message: `Enregistrement refusé : ${error.message}` }
  if (!data?.length) return { ok: false, message: 'Votre rôle ne permet pas cette écriture.' }

  revalidatePath('/admin', 'layout')
  return {
    ok: true,
    message: 'Identité enregistrée. Le nom s’applique partout, l’en-tête aux documents imprimés.',
  }
}

// -----------------------------------------------------------------------------
// Le logo
// -----------------------------------------------------------------------------
// Le fichier va dans le bucket prive `branding`, sous <tenant>/<organisation>/.
// Le chemin n'est pas choisi par l'appelant : il est derive ici, et la base le
// verifie a nouveau (app.guard_organization_logo). Deux verrous plutot qu'un,
// parce qu'un chemin accepte tel quel laisserait pointer le logo d'un autre
// client.
const LOGO_TYPES = ['image/png', 'image/jpeg', 'image/svg+xml', 'image/webp']
const LOGO_MAX_BYTES = 2 * 1024 * 1024

export async function uploadOrganizationLogo(
  _previous: Result | null,
  formData: FormData,
): Promise<Result> {
  const admin = await requireAdministratedTenant()
  if (!admin) {
    return { ok: false, message: "Cette action relève de l'administration de la plateforme." }
  }

  const organizationId = formData.get('organizationId')
  const file = formData.get('logo')
  if (typeof organizationId !== 'string' || !organizationId) {
    return { ok: false, message: 'Organisation introuvable.' }
  }
  if (!(file instanceof File) || file.size === 0) {
    return { ok: false, message: 'Choisir un fichier image.' }
  }
  if (!LOGO_TYPES.includes(file.type)) {
    return { ok: false, message: 'Formats acceptés : PNG, JPEG, SVG ou WebP.' }
  }
  if (file.size > LOGO_MAX_BYTES) {
    return { ok: false, message: 'Le logo doit peser moins de 2 Mo.' }
  }

  const supabase = await createClient()
  const { data: organization } = await supabase
    .from('organization')
    .select('id, tenant_id, logo_path')
    .eq('id', organizationId)
    .maybeSingle()
  if (!organization) return { ok: false, message: 'Organisation introuvable.' }

  const extension =
    file.type === 'image/svg+xml'
      ? 'svg'
      : file.type === 'image/png'
        ? 'png'
        : file.type === 'image/webp'
          ? 'webp'
          : 'jpg'
  // Nom stable : deposer un nouveau logo remplace l'ancien plutot que
  // d'accumuler des fichiers orphelins dans le bucket.
  const path = `${organization.tenant_id}/${organization.id}/logo.${extension}`

  const { error: uploadError } = await supabase.storage
    .from('branding')
    .upload(path, file, { contentType: file.type, upsert: true })
  if (uploadError) {
    return { ok: false, message: `Dépôt refusé : ${uploadError.message}` }
  }

  // Un changement d'extension laisserait l'ancien fichier derriere lui.
  if (organization.logo_path && organization.logo_path !== path) {
    await supabase.storage.from('branding').remove([organization.logo_path])
  }

  const { error } = await supabase
    .from('organization')
    .update({ logo_path: path })
    .eq('id', organization.id)
  if (error) return { ok: false, message: `Enregistrement refusé : ${error.message}` }

  revalidatePath(`/admin/organizations/${organization.id}`)
  return { ok: true, message: 'Logo enregistré. Il figurera en en-tête des documents imprimés.' }
}

export async function removeOrganizationLogo(
  _previous: Result | null,
  formData: FormData,
): Promise<Result> {
  const admin = await requireAdministratedTenant()
  if (!admin) {
    return { ok: false, message: "Cette action relève de l'administration de la plateforme." }
  }

  const organizationId = formData.get('organizationId')
  if (typeof organizationId !== 'string' || !organizationId) {
    return { ok: false, message: 'Organisation introuvable.' }
  }

  const supabase = await createClient()
  const { data: organization } = await supabase
    .from('organization')
    .select('id, logo_path')
    .eq('id', organizationId)
    .maybeSingle()
  if (!organization?.logo_path) return { ok: false, message: 'Aucun logo à retirer.' }

  await supabase.storage.from('branding').remove([organization.logo_path])
  const { error } = await supabase
    .from('organization')
    .update({ logo_path: null })
    .eq('id', organization.id)
  if (error) return { ok: false, message: `Retrait refusé : ${error.message}` }

  revalidatePath(`/admin/organizations/${organization.id}`)
  return { ok: true, message: 'Logo retiré. Les documents reprendront l’en-tête par défaut.' }
}

// -----------------------------------------------------------------------------
// Marque du tenant (revente en marque blanche)
// -----------------------------------------------------------------------------
// AIGMS se revend. Un cabinet qui pilote un portefeuille veut que ses clients
// voient SA marque : c'est un reglage, pas un fork.
//
// A ne pas confondre avec le logo d'une ORGANISATION (0035), qui sert ses
// documents remis. L'un dit quel outil on utilise, l'autre de qui est la piece.
const brandingSchema = z.object({
  tenantId: z.string().uuid(),
  brandLabel: z.string().trim().min(1, 'La marque a besoin d’un nom.').max(60),
  brandTagline: z.string().trim().max(80).optional().or(z.literal('')),
})

export async function updateTenantBranding(
  _previous: Result | null,
  formData: FormData,
): Promise<Result> {
  const admin = await requireAdministratedTenant()
  if (!admin) {
    return { ok: false, message: "Cette action relève de l'administration de la plateforme." }
  }

  const parsed = brandingSchema.safeParse({
    tenantId: formData.get('tenantId'),
    brandLabel: formData.get('brandLabel'),
    brandTagline: formData.get('brandTagline') ?? '',
  })
  if (!parsed.success) {
    return { ok: false, message: parsed.error.issues[0]?.message ?? 'Formulaire incomplet.' }
  }

  const supabase = await createClient()
  const { data, error } = await supabase
    .from('tenant')
    .update({
      brand_label: parsed.data.brandLabel,
      // Vide vaut NULL : c'est ainsi que la mention de l'editeur disparait.
      brand_tagline: parsed.data.brandTagline || null,
    })
    .eq('id', parsed.data.tenantId)
    .select('id')

  if (error) return { ok: false, message: `Enregistrement refusé : ${error.message}` }
  if (!data?.length) return { ok: false, message: 'Votre rôle ne permet pas cette écriture.' }

  revalidatePath('/admin', 'layout')
  return { ok: true, message: 'Marque enregistrée. Elle s’applique à tous les écrans.' }
}

export async function uploadTenantLogo(
  _previous: Result | null,
  formData: FormData,
): Promise<Result> {
  const admin = await requireAdministratedTenant()
  if (!admin) {
    return { ok: false, message: "Cette action relève de l'administration de la plateforme." }
  }

  const file = formData.get('logo')
  if (!(file instanceof File) || file.size === 0) {
    return { ok: false, message: 'Choisir un fichier image.' }
  }
  if (!LOGO_TYPES.includes(file.type)) {
    return { ok: false, message: 'Formats acceptés : PNG, JPEG, SVG ou WebP.' }
  }
  if (file.size > LOGO_MAX_BYTES) {
    return { ok: false, message: 'Le logo doit peser moins de 2 Mo.' }
  }

  const supabase = await createClient()
  const { data: tenant } = await supabase
    .from('tenant')
    .select('id, logo_path')
    .eq('id', admin.tenantId)
    .maybeSingle()
  if (!tenant) return { ok: false, message: 'Tenant introuvable.' }

  const extension =
    file.type === 'image/svg+xml'
      ? 'svg'
      : file.type === 'image/png'
        ? 'png'
        : file.type === 'image/webp'
          ? 'webp'
          : 'jpg'
  const path = `${tenant.id}/plateforme/logo.${extension}`

  const { error: uploadError } = await supabase.storage
    .from('branding')
    .upload(path, file, { contentType: file.type, upsert: true })
  if (uploadError) return { ok: false, message: `Dépôt refusé : ${uploadError.message}` }

  if (tenant.logo_path && tenant.logo_path !== path) {
    await supabase.storage.from('branding').remove([tenant.logo_path])
  }

  const { error } = await supabase.from('tenant').update({ logo_path: path }).eq('id', tenant.id)
  if (error) return { ok: false, message: `Enregistrement refusé : ${error.message}` }

  revalidatePath('/admin', 'layout')
  return { ok: true, message: 'Logo enregistré. Il remplace la marque dans l’en-tête.' }
}

export async function removeTenantLogo(
  _previous: Result | null,
  _formData: FormData,
): Promise<Result> {
  const admin = await requireAdministratedTenant()
  if (!admin) {
    return { ok: false, message: "Cette action relève de l'administration de la plateforme." }
  }

  const supabase = await createClient()
  const { data: tenant } = await supabase
    .from('tenant')
    .select('id, logo_path')
    .eq('id', admin.tenantId)
    .maybeSingle()
  if (!tenant?.logo_path) return { ok: false, message: 'Aucun logo à retirer.' }

  await supabase.storage.from('branding').remove([tenant.logo_path])
  const { error } = await supabase.from('tenant').update({ logo_path: null }).eq('id', tenant.id)
  if (error) return { ok: false, message: `Retrait refusé : ${error.message}` }

  revalidatePath('/admin', 'layout')
  return { ok: true, message: 'Logo retiré. L’en-tête reprend la marque par défaut.' }
}

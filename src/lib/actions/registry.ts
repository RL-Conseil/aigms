'use server'

import { revalidatePath } from 'next/cache'
import { z } from 'zod'
import { createClient } from '@/lib/supabase/server'

/**
 * Saisie du registre : fournisseurs, actifs d'IA, supervision humaine,
 * evaluation d'impact.
 *
 * Ces quatre objets completent le dossier d'un cas d'usage. Deux vivent dans le
 * referentiel de l'organisation et se lisent hors contexte — un fournisseur, un
 * modele — les deux autres n'existent que par le cas d'usage qu'ils decrivent.
 * Le motif de saisie suit cette difference.
 *
 * Les regles restent en base : un plan de supervision approuve doit etre
 * complet, une supervision declaree non applicable doit etre justifiee, et
 * au-dela de L2 l'autonomie impose une autorite d'arret nominative. Ces
 * actions valident la forme et presentent le refus tel quel.
 */

export type FormState =
  | { ok: true; message: string }
  | { ok: false; message: string; fieldErrors?: Record<string, string> }

function firstIssues(error: z.ZodError): FormState {
  const fieldErrors: Record<string, string> = {}
  for (const issue of error.issues) {
    const key = issue.path[0]
    if (typeof key === 'string' && !fieldErrors[key]) fieldErrors[key] = issue.message
  }
  return { ok: false, message: 'Merci de corriger les champs signalés.', fieldErrors }
}

function explain(error: { message: string; code?: string }): string {
  if (error.code === '23505') return 'Cet élément existe déjà.'
  if (error.message.includes('row-level security')) {
    return 'Votre rôle ne permet pas cette écriture.'
  }
  if (error.code === '23514') {
    // Les contraintes portent des noms parlants : on les traduit plutot que
    // d'afficher « violates check constraint ».
    if (error.message.includes('oversight_approved_is_complete')) {
      return 'Un plan approuvé doit être complet : responsable redevable, déclencheurs d’intervention, autorité d’arrêt et approbateur.'
    }
    if (error.message.includes('oversight_na_is_justified')) {
      return 'Une supervision déclarée non applicable doit être justifiée.'
    }
    if (error.message.includes('oversight_high_autonomy_needs_stop_authority')) {
      return 'Au-delà de L2, l’autonomie impose une autorité d’arrêt nommée.'
    }
  }
  const raise = error.message.match(/^(?:.*?:\s)?([A-ZÀ-Ü][^\n]*)$/m)
  return raise?.[1] ?? error.message
}

async function tenantOf(organizationId: string) {
  const supabase = await createClient()
  const { data } = await supabase
    .from('organization')
    .select('tenant_id')
    .eq('id', organizationId)
    .maybeSingle()
  return data?.tenant_id ?? null
}

// =============================================================================
// Fournisseur
// =============================================================================
const vendorSchema = z.object({
  organizationId: z.string().uuid(),
  name: z.string().trim().min(2, 'Nom trop court.').max(160),
  criticality: z.enum(['low', 'moderate', 'high', 'critical']),
  countryCode: z.string().trim().length(2, 'Code pays sur deux lettres.').optional().or(z.literal('')),
  isModelProvider: z.coerce.boolean(),
  dpaSigned: z.coerce.boolean(),
  securityAssessed: z.coerce.boolean(),
  reversibilityDocumented: z.coerce.boolean(),
  subprocessors: z.string().trim().max(1000).optional().or(z.literal('')),
  notes: z.string().trim().max(2000).optional().or(z.literal('')),
})

export async function createVendor(
  _previous: FormState | null,
  formData: FormData,
): Promise<FormState> {
  const parsed = vendorSchema.safeParse({
    organizationId: formData.get('organizationId'),
    name: formData.get('name'),
    criticality: formData.get('criticality') ?? 'moderate',
    countryCode: formData.get('countryCode') ?? '',
    isModelProvider: formData.get('isModelProvider') === 'on',
    dpaSigned: formData.get('dpaSigned') === 'on',
    securityAssessed: formData.get('securityAssessed') === 'on',
    reversibilityDocumented: formData.get('reversibilityDocumented') === 'on',
    subprocessors: formData.get('subprocessors') ?? '',
    notes: formData.get('notes') ?? '',
  })
  if (!parsed.success) return firstIssues(parsed.error)

  const input = parsed.data
  const tenantId = await tenantOf(input.organizationId)
  if (!tenantId) return { ok: false, message: 'Organisation introuvable.' }

  const supabase = await createClient()
  const { error } = await supabase.from('vendor').insert({
    tenant_id: tenantId,
    organization_id: input.organizationId,
    name: input.name,
    criticality: input.criticality,
    country_code: input.countryCode ? input.countryCode.toUpperCase() : null,
    is_model_provider: input.isModelProvider,
    dpa_signed: input.dpaSigned,
    security_assessed: input.securityAssessed,
    reversibility_documented: input.reversibilityDocumented,
    subprocessors: input.subprocessors || null,
    notes: input.notes || null,
  })

  if (error) return { ok: false, message: explain(error) }

  revalidatePath('/admin/actifs-fournisseurs')
  revalidatePath(`/admin/organizations/${input.organizationId}`)
  return {
    ok: true,
    message: `${input.name} enregistré. La revue tiers reste à conduire : le gate PRODUCTION l’exige.`,
  }
}

// -----------------------------------------------------------------------------
// Revue tiers
// -----------------------------------------------------------------------------
// Le gate PRODUCTION exige une revue close pour chaque tiers implique. Elle se
// prononce donc separement de la fiche : ce n'est pas une propriete du
// fournisseur, c'est un acte.
const vendorReviewSchema = z.object({
  organizationId: z.string().uuid(),
  vendorId: z.string().uuid(),
  reviewStatus: z.enum([
    'not_started',
    'in_progress',
    'approved',
    'approved_with_conditions',
    'rejected',
    'expired',
  ]),
  nextReviewAt: z.string().trim().optional().or(z.literal('')),
  notes: z.string().trim().max(2000).optional().or(z.literal('')),
})

export async function reviewVendor(
  _previous: FormState | null,
  formData: FormData,
): Promise<FormState> {
  const parsed = vendorReviewSchema.safeParse({
    organizationId: formData.get('organizationId'),
    vendorId: formData.get('vendorId'),
    reviewStatus: formData.get('reviewStatus'),
    nextReviewAt: formData.get('nextReviewAt') ?? '',
    notes: formData.get('notes') ?? '',
  })
  if (!parsed.success) return firstIssues(parsed.error)

  const closed = ['approved', 'approved_with_conditions', 'rejected'].includes(
    parsed.data.reviewStatus,
  )

  const supabase = await createClient()
  const { data, error } = await supabase
    .from('vendor')
    .update({
      review_status: parsed.data.reviewStatus,
      reviewed_at: closed ? new Date().toISOString() : null,
      next_review_at: parsed.data.nextReviewAt || null,
      notes: parsed.data.notes || null,
    })
    .eq('id', parsed.data.vendorId)
    .select('id')

  if (error) return { ok: false, message: explain(error) }
  if (!data?.length) return { ok: false, message: 'Votre rôle ne permet pas cette écriture.' }

  revalidatePath(`/admin/organizations/${parsed.data.organizationId}`)
  return { ok: true, message: 'Revue tiers enregistrée.' }
}

// =============================================================================
// Actif d'IA
// =============================================================================
const assetSchema = z.object({
  organizationId: z.string().uuid(),
  kind: z.enum(['ai_system', 'ai_model', 'ai_agent', 'dataset']),
  name: z.string().trim().min(2, 'Nom trop court.').max(160),
  description: z.string().trim().max(2000).optional().or(z.literal('')),
  vendorId: z.string().uuid().optional().or(z.literal('')),
  version: z.string().trim().max(60).optional().or(z.literal('')),
  ownerUserId: z.string().uuid().optional().or(z.literal('')),
  containsPersonalData: z.coerce.boolean(),
  hostingLocation: z.string().trim().max(160).optional().or(z.literal('')),
})

export async function createAsset(
  _previous: FormState | null,
  formData: FormData,
): Promise<FormState> {
  const parsed = assetSchema.safeParse({
    organizationId: formData.get('organizationId'),
    kind: formData.get('kind') ?? 'ai_system',
    name: formData.get('name'),
    description: formData.get('description') ?? '',
    vendorId: formData.get('vendorId') ?? '',
    version: formData.get('version') ?? '',
    ownerUserId: formData.get('ownerUserId') ?? '',
    containsPersonalData: formData.get('containsPersonalData') === 'on',
    hostingLocation: formData.get('hostingLocation') ?? '',
  })
  if (!parsed.success) return firstIssues(parsed.error)

  const input = parsed.data
  const tenantId = await tenantOf(input.organizationId)
  if (!tenantId) return { ok: false, message: 'Organisation introuvable.' }

  const supabase = await createClient()
  const { error } = await supabase.from('ai_asset').insert({
    tenant_id: tenantId,
    organization_id: input.organizationId,
    kind: input.kind,
    name: input.name,
    description: input.description || null,
    vendor_id: input.vendorId || null,
    version: input.version || null,
    owner_user_id: input.ownerUserId || null,
    contains_personal_data: input.containsPersonalData,
    hosting_location: input.hostingLocation || null,
  })

  if (error) return { ok: false, message: explain(error) }

  revalidatePath(`/admin/organizations/${input.organizationId}`)
  revalidatePath('/admin/actifs-fournisseurs')
  return { ok: true, message: `${input.name} inscrit au registre des actifs.` }
}

// -----------------------------------------------------------------------------
// Rattachements au cas d'usage
// -----------------------------------------------------------------------------
const linkSchema = z.object({
  useCaseId: z.string().uuid(),
  targetId: z.string().uuid('Choisir un élément.'),
  relation: z.string().trim().max(60).optional().or(z.literal('')),
})

export async function linkAssetToUseCase(
  _previous: FormState | null,
  formData: FormData,
): Promise<FormState> {
  const parsed = linkSchema.safeParse({
    useCaseId: formData.get('useCaseId'),
    targetId: formData.get('assetId'),
    relation: formData.get('relation') ?? '',
  })
  if (!parsed.success) return firstIssues(parsed.error)

  const supabase = await createClient()
  const { data: useCase } = await supabase
    .from('ai_use_case')
    .select('tenant_id')
    .eq('id', parsed.data.useCaseId)
    .maybeSingle()
  if (!useCase) return { ok: false, message: 'Cas d’usage introuvable.' }

  // `relation` porte un defaut en base (« uses ») et n'accepte pas null : on
  // omet la colonne plutot que d'y pousser un vide, sans quoi le defaut ne
  // s'applique jamais.
  const { error } = await supabase.from('use_case_asset_link').insert({
    tenant_id: useCase.tenant_id,
    use_case_id: parsed.data.useCaseId,
    asset_id: parsed.data.targetId,
    ...(parsed.data.relation ? { relation: parsed.data.relation } : {}),
  })

  if (error) {
    if (error.code === '23505') return { ok: false, message: 'Cet actif est déjà rattaché.' }
    return { ok: false, message: explain(error) }
  }

  revalidatePath(`/admin/use-cases/${parsed.data.useCaseId}`)
  return { ok: true, message: 'Actif rattaché au cas d’usage.' }
}

export async function linkVendorToUseCase(
  _previous: FormState | null,
  formData: FormData,
): Promise<FormState> {
  const parsed = linkSchema.safeParse({
    useCaseId: formData.get('useCaseId'),
    targetId: formData.get('vendorId'),
  })
  if (!parsed.success) return firstIssues(parsed.error)

  const supabase = await createClient()
  const { data: useCase } = await supabase
    .from('ai_use_case')
    .select('tenant_id')
    .eq('id', parsed.data.useCaseId)
    .maybeSingle()
  if (!useCase) return { ok: false, message: 'Cas d’usage introuvable.' }

  const { error } = await supabase.from('use_case_vendor_link').insert({
    tenant_id: useCase.tenant_id,
    use_case_id: parsed.data.useCaseId,
    vendor_id: parsed.data.targetId,
  })

  if (error) {
    if (error.code === '23505') return { ok: false, message: 'Ce fournisseur est déjà rattaché.' }
    return { ok: false, message: explain(error) }
  }

  revalidatePath(`/admin/use-cases/${parsed.data.useCaseId}`)
  return {
    ok: true,
    message: 'Fournisseur rattaché. Sa revue tiers devra être close avant la mise en production.',
  }
}

// =============================================================================
// Supervision humaine
// =============================================================================
const oversightSchema = z.object({
  useCaseId: z.string().uuid(),
  status: z.enum(['draft', 'submitted', 'approved', 'not_applicable']),
  accountableUserId: z.string().uuid().optional().or(z.literal('')),
  stopAuthorityUserId: z.string().uuid().optional().or(z.literal('')),
  requiredCompetence: z.string().trim().max(1000).optional().or(z.literal('')),
  monitoringCadence: z.string().trim().max(200).optional().or(z.literal('')),
  interventionTriggers: z.string().trim().max(2000).optional().or(z.literal('')),
  overrideProcedure: z.string().trim().max(2000).optional().or(z.literal('')),
  stopProcedure: z.string().trim().max(2000).optional().or(z.literal('')),
  expectedEvidence: z.string().trim().max(2000).optional().or(z.literal('')),
  notApplicableRationale: z.string().trim().max(2000).optional().or(z.literal('')),
  nextReviewAt: z.string().trim().optional().or(z.literal('')),
  // Les controles qui portent chaque rubrique (0072).
  triggerControlId: z.string().uuid().optional().or(z.literal('')),
  overrideControlId: z.string().uuid().optional().or(z.literal('')),
  stopControlId: z.string().uuid().optional().or(z.literal('')),
  competenceControlId: z.string().uuid().optional().or(z.literal('')),
})
  // Un plan qui s'applique nomme ses declencheurs et ce qui le prouvera.
  .refine((d) => d.status === 'not_applicable' || (d.interventionTriggers ?? '').length >= 10, {
    path: ['interventionTriggers'],
    message: 'À quels signaux un humain reprend la main : sans eux, la supervision ne se démontre pas.',
  })
  .refine((d) => d.status === 'not_applicable' || (d.expectedEvidence ?? '').length >= 10, {
    path: ['expectedEvidence'],
    message: 'Dire ce qui prouvera la supervision : journal des interventions, échantillons revus, tableau de bord…',
  })

export async function saveOversightPlan(
  _previous: FormState | null,
  formData: FormData,
): Promise<FormState> {
  const parsed = oversightSchema.safeParse({
    useCaseId: formData.get('useCaseId'),
    status: formData.get('status') ?? 'draft',
    accountableUserId: formData.get('accountableUserId') ?? '',
    stopAuthorityUserId: formData.get('stopAuthorityUserId') ?? '',
    requiredCompetence: formData.get('requiredCompetence') ?? '',
    monitoringCadence: formData.get('monitoringCadence') ?? '',
    interventionTriggers: formData.get('interventionTriggers') ?? '',
    overrideProcedure: formData.get('overrideProcedure') ?? '',
    stopProcedure: formData.get('stopProcedure') ?? '',
    expectedEvidence: formData.get('expectedEvidence') ?? '',
    notApplicableRationale: formData.get('notApplicableRationale') ?? '',
    nextReviewAt: formData.get('nextReviewAt') ?? '',
    triggerControlId: formData.get('triggerControlId') ?? '',
    overrideControlId: formData.get('overrideControlId') ?? '',
    stopControlId: formData.get('stopControlId') ?? '',
    competenceControlId: formData.get('competenceControlId') ?? '',
  })
  if (!parsed.success) return firstIssues(parsed.error)

  const input = parsed.data
  const supabase = await createClient()
  const {
    data: { user },
  } = await supabase.auth.getUser()
  if (!user) return { ok: false, message: 'Session expirée.' }

  const { data: useCase } = await supabase
    .from('ai_use_case')
    .select('tenant_id, organization_id, autonomy_level')
    .eq('id', input.useCaseId)
    .maybeSingle()
  if (!useCase) return { ok: false, message: 'Cas d’usage introuvable.' }

  // L'approbation est nominative et datee, comme partout ailleurs : elle ne se
  // renseigne pas a la main.
  const approving = input.status === 'approved'

  const { error } = await supabase.from('human_oversight_plan').upsert(
    {
      tenant_id: useCase.tenant_id,
      organization_id: useCase.organization_id,
      use_case_id: input.useCaseId,
      autonomy_level: useCase.autonomy_level,
      status: input.status,
      accountable_user_id: input.accountableUserId || null,
      stop_authority_user_id: input.stopAuthorityUserId || null,
      required_competence: input.requiredCompetence || null,
      monitoring_cadence: input.monitoringCadence || null,
      intervention_triggers: input.interventionTriggers || null,
      override_procedure: input.overrideProcedure || null,
      stop_procedure: input.stopProcedure || null,
      expected_evidence: input.expectedEvidence || null,
      not_applicable_rationale: input.notApplicableRationale || null,
      next_review_at: input.nextReviewAt || null,
      approved_by: approving ? user.id : null,
      approved_at: approving ? new Date().toISOString() : null,
      trigger_control_id: input.triggerControlId || null,
      override_control_id: input.overrideControlId || null,
      stop_control_id: input.stopControlId || null,
      competence_control_id: input.competenceControlId || null,
    },
    { onConflict: 'use_case_id' },
  )

  if (error) return { ok: false, message: explain(error) }

  // Les procedures s'attachent : un document par procedure, depose au registre
  // des preuves et rattache au controle qui la porte — a valider.
  const notes: string[] = []
  for (const [field, controlId, label] of [
    ['overrideFile', input.overrideControlId, 'Procédure de reprise en main'],
    ['stopFile', input.stopControlId, 'Procédure d’arrêt'],
  ] as const) {
    const file = formData.get(field)
    if (!(file instanceof File) || file.size === 0) continue
    if (!controlId) {
      notes.push(`${label} : le document n’a pas été retenu — désigner d’abord le contrôle qui porte la procédure.`)
      continue
    }
    const problem = await depositProcedureFile(supabase, useCase.organization_id, useCase.tenant_id, user.id, controlId, file, label, input.useCaseId)
    notes.push(problem ? `${label} : ${problem}` : `${label} : document déposé au registre des preuves, rattaché au contrôle, à valider.`)
  }

  revalidatePath(`/admin/use-cases/${input.useCaseId}`)
  revalidatePath(`/admin/organizations/${useCase.organization_id}/preuves`)
  const designated = [input.triggerControlId, input.overrideControlId, input.stopControlId, input.competenceControlId].filter(Boolean).length
  return {
    ok: true,
    message:
      (approving ? 'Plan de supervision approuvé, en votre nom et daté.' : 'Plan de supervision enregistré.') +
      (designated ? ` ${designated} contrôle(s) désigné(s), rendus applicables au cas d’usage.` : '') +
      (notes.length ? ' ' + notes.join(' ') : ''),
  }
}

// =============================================================================
// Évaluation d'impact
// =============================================================================
const impactSchema = z.object({
  useCaseId: z.string().uuid(),
  scopeDescription: z
    .string()
    .trim()
    .min(30, 'Décrire les effets examinés : sur qui, et sous quel angle.')
    .max(2000),
  methodology: z.string().trim().max(120),
  lifecyclePhase: z.string().trim().max(120).optional().or(z.literal('')),
  status: z.enum(['draft', 'in_progress', 'completed', 'reopened']),
  dpiaRequired: z.coerce.boolean(),
  dpiaReference: z.string().trim().max(120).optional().or(z.literal('')),
  conclusion: z.string().trim().max(2000).optional().or(z.literal('')),
  nextReviewAt: z.string().trim().optional().or(z.literal('')),
})

export async function saveImpactAssessment(
  _previous: FormState | null,
  formData: FormData,
): Promise<FormState> {
  const parsed = impactSchema.safeParse({
    useCaseId: formData.get('useCaseId'),
    scopeDescription: formData.get('scopeDescription'),
    methodology: formData.get('methodology') || 'ISO/IEC 42005',
    lifecyclePhase: formData.get('lifecyclePhase') ?? '',
    status: formData.get('status') ?? 'in_progress',
    dpiaRequired: formData.get('dpiaRequired') === 'on',
    dpiaReference: formData.get('dpiaReference') ?? '',
    conclusion: formData.get('conclusion') ?? '',
    nextReviewAt: formData.get('nextReviewAt') ?? '',
  })
  if (!parsed.success) return firstIssues(parsed.error)

  const input = parsed.data
  const supabase = await createClient()
  const {
    data: { user },
  } = await supabase.auth.getUser()
  if (!user) return { ok: false, message: 'Session expirée.' }

  const { data: useCase } = await supabase
    .from('ai_use_case')
    .select('tenant_id, organization_id')
    .eq('id', input.useCaseId)
    .maybeSingle()
  if (!useCase) return { ok: false, message: 'Cas d’usage introuvable.' }

  const { error } = await supabase.from('impact_assessment').insert({
    tenant_id: useCase.tenant_id,
    organization_id: useCase.organization_id,
    use_case_id: input.useCaseId,
    scope_description: input.scopeDescription,
    methodology: input.methodology,
    lifecycle_phase: input.lifecyclePhase || null,
    status: input.status,
    dpia_required: input.dpiaRequired,
    dpia_reference: input.dpiaReference || null,
    conclusion: input.conclusion || null,
    next_review_at: input.nextReviewAt || null,
    performed_by: user.id,
    completed_at: input.status === 'completed' ? new Date().toISOString() : null,
  })

  if (error) return { ok: false, message: explain(error) }

  revalidatePath(`/admin/use-cases/${input.useCaseId}`)
  return {
    ok: true,
    message: input.dpiaRequired
      ? 'Évaluation enregistrée. L’AIPD reste due : sa référence se consigne ici.'
      : 'Évaluation d’impact enregistrée.',
  }
}

// -----------------------------------------------------------------------------
// Corriger la fiche d'un fournisseur
// -----------------------------------------------------------------------------
// Une faute de frappe sur une raison sociale n'a pas a passer par une revue
// tiers, et un fournisseur mal orthographie reste mal orthographie longtemps si
// le seul chemin pour le corriger est de le recreer.
//
// LA LIGNE DE PARTAGE : ce qui DECRIT se corrige, ce qui ATTESTE se prononce.
// Restent donc hors de cette action — et dans la revue tiers, ou ils sont dates
// et journalises : la criticite, le DPA signe, l'evaluation de securite, la
// reversibilite documentee, le resultat de la revue. Ils alimentent le gate
// PRODUCTION ; les corriger par un formulaire d'etiquette reviendrait a lever
// un gate sans acte.
const vendorLabelSchema = z.object({
  organizationId: z.string().uuid(),
  vendorId: z.string().uuid(),
  name: z.string().trim().min(2, 'Nom trop court.').max(200),
  countryCode: z
    .string()
    .trim()
    .regex(/^[A-Za-z]{2}$/, 'Code ISO à deux lettres.')
    .optional()
    .or(z.literal('')),
  subprocessors: z.string().trim().max(2000).optional().or(z.literal('')),
  notes: z.string().trim().max(2000).optional().or(z.literal('')),
})

export async function updateVendorLabels(
  _previous: FormState | null,
  formData: FormData,
): Promise<FormState> {
  const parsed = vendorLabelSchema.safeParse({
    organizationId: formData.get('organizationId'),
    vendorId: formData.get('vendorId'),
    name: formData.get('name'),
    countryCode: formData.get('countryCode') ?? '',
    subprocessors: formData.get('subprocessors') ?? '',
    notes: formData.get('notes') ?? '',
  })
  if (!parsed.success) return firstIssues(parsed.error)

  const input = parsed.data
  const supabase = await createClient()
  const { data, error } = await supabase
    .from('vendor')
    .update({
      name: input.name,
      country_code: input.countryCode ? input.countryCode.toUpperCase() : null,
      subprocessors: input.subprocessors || null,
      notes: input.notes || null,
    })
    .eq('id', input.vendorId)
    .select('id')

  if (error) return { ok: false, message: explain(error) }
  if (!data?.length) return { ok: false, message: 'Votre rôle ne permet pas cette écriture.' }

  revalidatePath(`/admin/organizations/${input.organizationId}`)
  revalidatePath('/admin/actifs-fournisseurs')
  return { ok: true, message: 'Fiche corrigée. La revue tiers, elle, reste ce qu’elle était.' }
}

// =============================================================================
// Détacher un actif d'un cas d'usage
// =============================================================================
// Le lien se retire ; l'actif reste au registre, avec ses mesures.
export async function unlinkAssetFromUseCase(formData: FormData): Promise<void> {
  const parsed = z
    .object({ useCaseId: z.string().uuid(), linkId: z.string().uuid() })
    .safeParse({ useCaseId: formData.get('useCaseId'), linkId: formData.get('linkId') })
  if (!parsed.success) return
  const supabase = await createClient()
  await supabase.from('use_case_asset_link').delete().eq('id', parsed.data.linkId)
  revalidatePath(`/admin/use-cases/${parsed.data.useCaseId}`)
}

// =============================================================================
// Corriger la fiche d'un actif
// =============================================================================
const assetLabelSchema = z.object({
  organizationId: z.string().uuid(),
  assetId: z.string().uuid(),
  name: z.string().trim().min(2, 'Nom trop court.').max(160),
  description: z.string().trim().max(2000).optional().or(z.literal('')),
  version: z.string().trim().max(60).optional().or(z.literal('')),
  hostingLocation: z.string().trim().max(160).optional().or(z.literal('')),
  containsPersonalData: z.coerce.boolean(),
  ownerUserId: z.string().uuid().optional().or(z.literal('')),
  vendorId: z.string().uuid().optional().or(z.literal('')),
})

export async function updateAssetLabels(_previous: FormState | null, formData: FormData): Promise<FormState> {
  const parsed = assetLabelSchema.safeParse({
    organizationId: formData.get('organizationId'),
    assetId: formData.get('assetId'),
    name: formData.get('name'),
    description: formData.get('description') ?? '',
    version: formData.get('version') ?? '',
    hostingLocation: formData.get('hostingLocation') ?? '',
    containsPersonalData: formData.get('containsPersonalData') === 'on',
    ownerUserId: formData.get('ownerUserId') ?? '',
    vendorId: formData.get('vendorId') ?? '',
  })
  if (!parsed.success) return firstIssues(parsed.error)
  const input = parsed.data
  const supabase = await createClient()
  const { data, error } = await supabase
    .from('ai_asset')
    .update({
      name: input.name,
      description: input.description || null,
      version: input.version || null,
      hosting_location: input.hostingLocation || null,
      contains_personal_data: input.containsPersonalData,
      owner_user_id: input.ownerUserId || null,
      vendor_id: input.vendorId || null,
    })
    .eq('id', input.assetId)
    .select('id')
  if (error) return { ok: false, message: explain(error) }
  if (!data?.length) return { ok: false, message: 'Votre rôle ne permet pas cette écriture.' }
  revalidatePath(`/admin/organizations/${input.organizationId}/actifs`)
  revalidatePath(`/admin/organizations/${input.organizationId}/actifs/${input.assetId}`)
  revalidatePath('/admin/actifs-fournisseurs')
  return { ok: true, message: 'Fiche de l’actif corrigée.' }
}

// =============================================================================
// Importer des actifs, des fournisseurs (CSV)
// =============================================================================
// L'application lit le fichier et nomme les colonnes ; la base rapproche par
// nom, cree ou met a jour, et rend compte ligne par ligne.
export type ImportState =
  | { ok: true; message: string; created: number; updated: number; issues: { line: number; message: string }[]; ignored: string[] }
  | { ok: false; message: string }

async function importRegistryCsv(
  formData: FormData,
  what: 'actifs' | 'fournisseurs',
): Promise<ImportState> {
  const organizationId = z.string().uuid().safeParse(formData.get('organizationId'))
  if (!organizationId.success) return { ok: false, message: 'Organisation inconnue.' }
  const file = formData.get('file')
  if (!(file instanceof File) || file.size === 0) return { ok: false, message: 'Choisir un fichier CSV.' }
  if (file.size > 2_000_000) return { ok: false, message: 'Fichier trop volumineux (2 Mo maximum).' }

  const { readRegistryCsv, ASSET_COLUMNS, VENDOR_COLUMNS } = await import('@/lib/registry/csv')
  const parsed = readRegistryCsv(await file.text(), what === 'actifs' ? ASSET_COLUMNS : VENDOR_COLUMNS)
  if (!parsed.rows.length) return { ok: false, message: 'Aucune ligne lue : vérifier l’en-tête et le séparateur.' }
  if (parsed.rows.length > 2000) return { ok: false, message: 'Au plus 2 000 lignes par import.' }

  const supabase = await createClient()
  const { data, error } = await supabase.rpc(what === 'actifs' ? 'import_ai_assets' : 'import_vendors', {
    p_organization_id: organizationId.data,
    p_rows: parsed.rows,
  })
  if (error) return { ok: false, message: explain(error) }
  const result = data as { created: number; updated: number; issues: { line: number; message: string }[] }

  revalidatePath(`/admin/organizations/${organizationId.data}`)
  revalidatePath(`/admin/organizations/${organizationId.data}/actifs`)
  revalidatePath(`/admin/organizations/${organizationId.data}/administration`)
  revalidatePath('/admin/actifs-fournisseurs')
  return {
    ok: true,
    message: `${result.created} créé(s), ${result.updated} mis à jour${result.issues.length ? `, ${result.issues.length} ligne(s) refusée(s)` : ''}.`,
    created: result.created,
    updated: result.updated,
    issues: result.issues,
    ignored: parsed.ignored,
  }
}

export async function importAssetsCsv(_previous: ImportState | null, formData: FormData): Promise<ImportState> {
  return importRegistryCsv(formData, 'actifs')
}

export async function importVendorsCsv(_previous: ImportState | null, formData: FormData): Promise<ImportState> {
  return importRegistryCsv(formData, 'fournisseurs')
}

// Un document de procedure : une preuve, rattachee au controle qui la porte.
async function depositProcedureFile(
  supabase: Awaited<ReturnType<typeof createClient>>,
  organizationId: string,
  tenantId: string,
  ownerId: string,
  controlId: string,
  file: File,
  label: string,
  useCaseId: string,
): Promise<string | null> {
  const { EVIDENCE_BUCKET, MAX_EVIDENCE_BYTES } = await import('@/lib/storage/evidence')
  if (file.size > MAX_EVIDENCE_BYTES) return 'fichier trop volumineux (25 Mo maximum).'
  const { createHash } = await import('node:crypto')
  const { data: useCase } = await supabase.from('ai_use_case').select('name').eq('id', useCaseId).maybeSingle()
  const evidenceId = crypto.randomUUID()
  const bytes = Buffer.from(await file.arrayBuffer())
  const contentHash = `sha256:${createHash('sha256').update(bytes).digest('hex')}`
  const safeName = file.name.normalize('NFKD').replace(/[^\w.-]+/g, '_').slice(0, 120) || 'procedure'
  const storagePath = `${tenantId}/${organizationId}/${evidenceId}/${safeName}`
  const { error: uploadError } = await supabase.storage
    .from(EVIDENCE_BUCKET)
    .upload(storagePath, bytes, { contentType: file.type || 'application/octet-stream', upsert: false })
  if (uploadError) return `dépôt refusé : ${uploadError.message}`
  const { error } = await supabase.from('evidence').insert({
    id: evidenceId,
    tenant_id: tenantId,
    organization_id: organizationId,
    title: `${label} — ${useCase?.name ?? 'cas d’usage'}`,
    evidence_type: 'document',
    source: 'Plan de supervision humaine (AIGMS)',
    storage_bucket: EVIDENCE_BUCKET,
    storage_path: storagePath,
    content_hash: contentHash,
    file_name: file.name,
    file_size_bytes: file.size,
    mime_type: file.type || 'application/octet-stream',
    owner_user_id: ownerId,
    validation_status: 'pending',
  })
  if (error) {
    await supabase.storage.from(EVIDENCE_BUCKET).remove([storagePath])
    return explain(error)
  }
  const { error: linkError } = await supabase.from('control_evidence').insert({
    tenant_id: tenantId,
    control_id: controlId,
    evidence_id: evidenceId,
    linked_by: ownerId,
  })
  return linkError ? `déposé, mais non rattaché au contrôle : ${explain(linkError)}` : null
}

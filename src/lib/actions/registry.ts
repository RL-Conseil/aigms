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
    },
    { onConflict: 'use_case_id' },
  )

  if (error) return { ok: false, message: explain(error) }

  revalidatePath(`/admin/use-cases/${input.useCaseId}`)
  return {
    ok: true,
    message: approving
      ? 'Plan de supervision approuvé, en votre nom et daté.'
      : 'Plan de supervision enregistré.',
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
  return { ok: true, message: 'Fiche corrigée. La revue tiers, elle, reste ce qu’elle était.' }
}

'use server'

import { revalidatePath } from 'next/cache'
import { z } from 'zod'
import { createClient } from '@/lib/supabase/server'

/**
 * Le suivi operationnel : actions, incidents, CAPA, demandes de changement.
 *
 * Les tables existaient depuis les migrations 0010, 0012 et 0013, avec leurs
 * regles ; il manquait le chemin pour y ecrire depuis l'application. Les
 * regles ne sont pas reimplementees ici, elles sont presentees quand la base
 * les oppose :
 *
 *   - une action close porte sa date de cloture ;
 *   - un incident circonscrit porte sa date de circonscription ;
 *   - un incident clos porte sa cause racine, et — s'il est significatif
 *     (S1, S2), une non-conformite ou une recurrence — une CAPA CLOSE
 *     (`app.guard_incident_closure`) ;
 *   - une CAPA close porte un test d'efficacite, son resultat, sa date et la
 *     personne qui l'a verifie (`capa_closure_requires_effectiveness`) ;
 *   - une demande de changement se qualifie par le moteur de reevaluation
 *     (`app.screen_change_request`), jamais a la main.
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

function explain(error: { message: string }): string {
  if (error.message.includes('row-level security')) return 'Votre rôle ne permet pas cette écriture.'
  if (error.message.includes('capa_closure_requires_effectiveness')) {
    return 'Une CAPA ne se clôt pas sans test d’efficacité : le test, son résultat, sa date et la personne qui l’a vérifié.'
  }
  if (error.message.includes('une CAPA close est requise')) {
    return 'Cet incident ne se clôt pas sans une CAPA close : il est significatif, une non-conformité ou une récurrence.'
  }
  const raise = error.message.match(/^(?:.*?:\s)?([A-ZÀ-Ü][^\n]*)$/m)
  return raise?.[1] ?? error.message
}

async function tenantOf(organizationId: string): Promise<string | null> {
  const supabase = await createClient()
  const { data } = await supabase
    .from('organization')
    .select('tenant_id')
    .eq('id', organizationId)
    .maybeSingle()
  return data?.tenant_id ?? null
}

async function currentUserId(): Promise<string | null> {
  const supabase = await createClient()
  const {
    data: { user },
  } = await supabase.auth.getUser()
  return user?.id ?? null
}

function revalidateOperations(organizationId: string, useCaseId?: string | null) {
  revalidatePath(`/admin/organizations/${organizationId}/suivi`)
  revalidatePath(`/admin/organizations/${organizationId}/processus`)
  revalidatePath('/admin/pilotage')
  if (useCaseId) revalidatePath(`/admin/use-cases/${useCaseId}`)
}

// =============================================================================
// Actions
// =============================================================================
const actionSchema = z.object({
  organizationId: z.string().uuid(),
  useCaseId: z.string().uuid().optional().or(z.literal('')),
  title: z.string().trim().min(5, 'Titre trop court.').max(200),
  description: z.string().trim().max(2000).optional().or(z.literal('')),
  ownerUserId: z.string().uuid().optional().or(z.literal('')),
  dueDate: z.string().trim().optional().or(z.literal('')),
  isBlocking: z.boolean(),
})

export async function createAction(
  _previous: FormState | null,
  formData: FormData,
): Promise<FormState> {
  const parsed = actionSchema.safeParse({
    organizationId: formData.get('organizationId'),
    useCaseId: formData.get('useCaseId') ?? '',
    title: formData.get('title'),
    description: formData.get('description') ?? '',
    ownerUserId: formData.get('ownerUserId') ?? '',
    dueDate: formData.get('dueDate') ?? '',
    isBlocking: formData.get('isBlocking') === 'on',
  })
  if (!parsed.success) return firstIssues(parsed.error)

  const input = parsed.data
  const tenantId = await tenantOf(input.organizationId)
  if (!tenantId) return { ok: false, message: 'Organisation introuvable.' }

  // Une action bloquante sans cas d'usage ne bloque rien : le gate lit les
  // actions du cas d'usage. On le dit plutot que de laisser croire.
  if (input.isBlocking && !input.useCaseId) {
    return {
      ok: false,
      message: 'Une action bloquante se rattache à un cas d’usage : c’est son gate PRODUCTION qu’elle retient.',
      fieldErrors: { isBlocking: 'Rattacher un cas d’usage, ou ne pas la marquer bloquante.' },
    }
  }

  const supabase = await createClient()
  const { error } = await supabase.from('action').insert({
    tenant_id: tenantId,
    organization_id: input.organizationId,
    use_case_id: input.useCaseId || null,
    title: input.title,
    description: input.description || null,
    owner_user_id: input.ownerUserId || null,
    due_date: input.dueDate || null,
    is_blocking: input.isBlocking,
    source: 'manual',
  })
  if (error) return { ok: false, message: explain(error) }

  revalidateOperations(input.organizationId, input.useCaseId)
  return {
    ok: true,
    message: input.isBlocking
      ? 'Action ouverte. Tant qu’elle n’est pas close, le gate PRODUCTION du cas d’usage la retient.'
      : 'Action ouverte.',
  }
}

const actionStatusSchema = z
  .object({
    organizationId: z.string().uuid(),
    actionId: z.string().uuid(),
    useCaseId: z.string().uuid().optional().or(z.literal('')),
    status: z.enum(['open', 'in_progress', 'blocked', 'done', 'cancelled']),
    closureNote: z.string().trim().max(1000).optional().or(z.literal('')),
  })
  .refine((v) => v.status !== 'done' || (v.closureNote ?? '').length >= 10, {
    message: 'Dire ce qui a été fait : c’est ce qu’un auditeur lira.',
    path: ['closureNote'],
  })

export async function updateActionStatus(
  _previous: FormState | null,
  formData: FormData,
): Promise<FormState> {
  const parsed = actionStatusSchema.safeParse({
    organizationId: formData.get('organizationId'),
    actionId: formData.get('actionId'),
    useCaseId: formData.get('useCaseId') ?? '',
    status: formData.get('status'),
    closureNote: formData.get('closureNote') ?? '',
  })
  if (!parsed.success) return firstIssues(parsed.error)

  const input = parsed.data
  const closing = input.status === 'done' || input.status === 'cancelled'
  const supabase = await createClient()
  const { data, error } = await supabase
    .from('action')
    .update({
      status: input.status,
      closed_at: closing ? new Date().toISOString() : null,
      closure_note: closing ? input.closureNote || null : null,
    })
    .eq('id', input.actionId)
    .select('id')
  if (error) return { ok: false, message: explain(error) }
  if (!data?.length) return { ok: false, message: 'Votre rôle ne permet pas cette écriture.' }

  revalidateOperations(input.organizationId, input.useCaseId)
  return {
    ok: true,
    message:
      input.status === 'done'
        ? 'Action close, datée et journalisée.'
        : input.status === 'cancelled'
          ? 'Action annulée.'
          : 'Statut mis à jour.',
  }
}

// =============================================================================
// Incidents
// =============================================================================
const INCIDENT_KINDS = ['incident', 'non_conformity', 'observation', 'near_miss'] as const

const incidentSchema = z.object({
  organizationId: z.string().uuid(),
  useCaseId: z.string().uuid().optional().or(z.literal('')),
  title: z.string().trim().min(5, 'Titre trop court.').max(200),
  description: z
    .string()
    .trim()
    .min(20, 'Décrire ce qui s’est passé : les faits, pas l’interprétation.')
    .max(4000),
  kind: z.enum(INCIDENT_KINDS),
  severity: z.enum(['S1', 'S2', 'S3', 'S4']),
  detectedAt: z.string().trim().optional().or(z.literal('')),
  ownerUserId: z.string().uuid().optional().or(z.literal('')),
  // Le ticket du kit : declencheur, actif impacte, droits fondamentaux.
  triggerSource: z.enum(['monitoring_alert', 'user_complaint', 'internal_audit', 'vendor_alert', 'other']).optional().default('other'),
  assetId: z.string().uuid().optional().or(z.literal('')),
  fundamentalRightsImpacted: z.boolean().optional().default(false),
  fundamentalRightsDetail: z.string().trim().max(1000).optional().or(z.literal('')),
  isRecurrence: z.boolean(),
})

export async function declareIncident(
  _previous: FormState | null,
  formData: FormData,
): Promise<FormState> {
  const parsed = incidentSchema.safeParse({
    organizationId: formData.get('organizationId'),
    useCaseId: formData.get('useCaseId') ?? '',
    title: formData.get('title'),
    description: formData.get('description'),
    kind: formData.get('kind') ?? 'incident',
    severity: formData.get('severity'),
    detectedAt: formData.get('detectedAt') ?? '',
    ownerUserId: formData.get('ownerUserId') ?? '',
    triggerSource: formData.get('triggerSource') ?? 'other',
    assetId: formData.get('assetId') ?? '',
    fundamentalRightsImpacted: formData.get('fundamentalRightsImpacted') === 'on',
    fundamentalRightsDetail: formData.get('fundamentalRightsDetail') ?? '',
    isRecurrence: formData.get('isRecurrence') === 'on',
  })
  if (!parsed.success) return firstIssues(parsed.error)

  const input = parsed.data
  const tenantId = await tenantOf(input.organizationId)
  if (!tenantId) return { ok: false, message: 'Organisation introuvable.' }
  const userId = await currentUserId()
  if (!userId) return { ok: false, message: 'Session expirée.' }

  const supabase = await createClient()
  const { error } = await supabase.from('incident').insert({
    tenant_id: tenantId,
    organization_id: input.organizationId,
    use_case_id: input.useCaseId || null,
    title: input.title,
    description: input.description,
    kind: input.kind,
    severity: input.severity,
    detected_at: input.detectedAt ? new Date(input.detectedAt).toISOString() : new Date().toISOString(),
    reported_by: userId,
    owner_user_id: input.ownerUserId || null,
    trigger_source: input.triggerSource,
    asset_id: input.assetId || null,
    fundamental_rights_impacted: input.fundamentalRightsImpacted,
    fundamental_rights_detail: input.fundamentalRightsDetail || null,
    is_recurrence: input.isRecurrence,
    status: 'OPEN',
  })
  if (error) return { ok: false, message: explain(error) }

  revalidateOperations(input.organizationId, input.useCaseId)
  const significant =
    input.severity === 'S1' || input.severity === 'S2' || input.kind === 'non_conformity' || input.isRecurrence
  return {
    ok: true,
    message: significant
      ? 'Incident déclaré. Sa clôture exigera une CAPA close : il est significatif.'
      : 'Incident déclaré.',
  }
}

const INCIDENT_STATUSES = [
  'OPEN',
  'CONTAINED',
  'INVESTIGATING',
  'ACTION_PLAN',
  'EFFECTIVENESS_REVIEW',
  'CLOSED',
] as const

const incidentProgressSchema = z
  .object({
    organizationId: z.string().uuid(),
    incidentId: z.string().uuid(),
    useCaseId: z.string().uuid().optional().or(z.literal('')),
    status: z.enum(INCIDENT_STATUSES),
    containmentAction: z.string().trim().max(2000).optional().or(z.literal('')),
    rootCause: z.string().trim().max(4000).optional().or(z.literal('')),
    closureNote: z.string().trim().max(2000).optional().or(z.literal('')),
  })
  .refine((v) => v.status === 'OPEN' || (v.containmentAction ?? '').length >= 10, {
    message: 'Dire ce qui a été fait pour circonscrire.',
    path: ['containmentAction'],
  })
  .refine((v) => v.status !== 'CLOSED' || (v.rootCause ?? '').length >= 20, {
    message: 'Un incident ne se clôt pas sans cause racine documentée.',
    path: ['rootCause'],
  })

export async function progressIncident(
  _previous: FormState | null,
  formData: FormData,
): Promise<FormState> {
  const parsed = incidentProgressSchema.safeParse({
    organizationId: formData.get('organizationId'),
    incidentId: formData.get('incidentId'),
    useCaseId: formData.get('useCaseId') ?? '',
    status: formData.get('status'),
    containmentAction: formData.get('containmentAction') ?? '',
    rootCause: formData.get('rootCause') ?? '',
    closureNote: formData.get('closureNote') ?? '',
  })
  if (!parsed.success) return firstIssues(parsed.error)

  const input = parsed.data
  const supabase = await createClient()

  const { data: current } = await supabase
    .from('incident')
    .select('contained_at')
    .eq('id', input.incidentId)
    .maybeSingle()
  if (!current) return { ok: false, message: 'Incident introuvable.' }

  const now = new Date().toISOString()
  const { data, error } = await supabase
    .from('incident')
    .update({
      status: input.status,
      containment_action: input.containmentAction || null,
      // La date de circonscription se pose une fois, au premier passage.
      contained_at:
        input.status === 'OPEN' ? current.contained_at : (current.contained_at ?? now),
      root_cause: input.rootCause || null,
      closed_at: input.status === 'CLOSED' ? now : null,
      closure_note: input.status === 'CLOSED' ? input.closureNote || null : null,
    })
    .eq('id', input.incidentId)
    .select('id')
  if (error) return { ok: false, message: explain(error) }
  if (!data?.length) return { ok: false, message: 'Votre rôle ne permet pas cette écriture.' }

  revalidateOperations(input.organizationId, input.useCaseId)
  return {
    ok: true,
    message: input.status === 'CLOSED' ? 'Incident clos, cause racine consignée.' : 'Incident mis à jour.',
  }
}

// =============================================================================
// CAPA
// =============================================================================
// Une CAPA appartient a un incident. Elle se cree en brouillon, avance, puis
// se clot sur un test d'efficacite verifie nominativement — c'est la base qui
// l'exige, et c'est ce qui distingue une action corrective d'une promesse.
const capaSchema = z.object({
  organizationId: z.string().uuid(),
  incidentId: z.string().uuid(),
  capaId: z.string().uuid().optional().or(z.literal('')),
  useCaseId: z.string().uuid().optional().or(z.literal('')),
  correction: z.string().trim().min(10, 'La correction immédiate : ce qui a été fait tout de suite.').max(2000),
  causeAnalysis: z.string().trim().min(20, 'L’analyse de cause : pourquoi c’est arrivé.').max(4000),
  correctiveAction: z.string().trim().min(10, 'L’action corrective : ce qui empêche que ça se reproduise.').max(2000),
  preventiveAction: z.string().trim().max(2000).optional().or(z.literal('')),
  ownerUserId: z.string().uuid().optional().or(z.literal('')),
  dueDate: z.string().trim().optional().or(z.literal('')),
  status: z.enum(['draft', 'in_progress', 'implemented', 'effectiveness_tested', 'ineffective']),
})

export async function saveCapa(_previous: FormState | null, formData: FormData): Promise<FormState> {
  const parsed = capaSchema.safeParse({
    organizationId: formData.get('organizationId'),
    incidentId: formData.get('incidentId'),
    capaId: formData.get('capaId') ?? '',
    useCaseId: formData.get('useCaseId') ?? '',
    correction: formData.get('correction'),
    causeAnalysis: formData.get('causeAnalysis'),
    correctiveAction: formData.get('correctiveAction'),
    preventiveAction: formData.get('preventiveAction') ?? '',
    ownerUserId: formData.get('ownerUserId') ?? '',
    dueDate: formData.get('dueDate') ?? '',
    status: formData.get('status') ?? 'draft',
  })
  if (!parsed.success) return firstIssues(parsed.error)

  const input = parsed.data
  const tenantId = await tenantOf(input.organizationId)
  if (!tenantId) return { ok: false, message: 'Organisation introuvable.' }

  const supabase = await createClient()
  const values = {
    correction: input.correction,
    cause_analysis: input.causeAnalysis,
    corrective_action: input.correctiveAction,
    preventive_action: input.preventiveAction || null,
    owner_user_id: input.ownerUserId || null,
    due_date: input.dueDate || null,
    status: input.status,
  }

  const { data, error } = input.capaId
    ? await supabase.from('capa').update(values).eq('id', input.capaId).select('id')
    : await supabase
        .from('capa')
        .insert({ tenant_id: tenantId, incident_id: input.incidentId, ...values })
        .select('id')
  if (error) return { ok: false, message: explain(error) }
  if (!data?.length) return { ok: false, message: 'Votre rôle ne permet pas cette écriture.' }

  revalidateOperations(input.organizationId, input.useCaseId)
  return { ok: true, message: input.capaId ? 'CAPA mise à jour.' : 'CAPA ouverte sur cet incident.' }
}

const closeCapaSchema = z.object({
  organizationId: z.string().uuid(),
  capaId: z.string().uuid(),
  useCaseId: z.string().uuid().optional().or(z.literal('')),
  effectivenessTest: z.string().trim().min(10, 'Décrire le test conduit.').max(2000),
  effectivenessResult: z.string().trim().min(10, 'Dire ce que le test a montré.').max(2000),
  effective: z.boolean(),
})

export async function closeCapa(_previous: FormState | null, formData: FormData): Promise<FormState> {
  const parsed = closeCapaSchema.safeParse({
    organizationId: formData.get('organizationId'),
    capaId: formData.get('capaId'),
    useCaseId: formData.get('useCaseId') ?? '',
    effectivenessTest: formData.get('effectivenessTest'),
    effectivenessResult: formData.get('effectivenessResult'),
    effective: formData.get('effective') === 'on',
  })
  if (!parsed.success) return firstIssues(parsed.error)

  const input = parsed.data
  const userId = await currentUserId()
  if (!userId) return { ok: false, message: 'Session expirée.' }

  const now = new Date().toISOString()
  const supabase = await createClient()
  const { data, error } = await supabase
    .from('capa')
    .update({
      effectiveness_test: input.effectivenessTest,
      effectiveness_result: input.effectivenessResult,
      effectiveness_tested_at: now,
      // La verification est nominative : c'est la personne connectee, jamais un
      // nom choisi dans une liste.
      effectiveness_verified_by: userId,
      status: input.effective ? 'closed' : 'ineffective',
      closed_at: input.effective ? now : null,
    })
    .eq('id', input.capaId)
    .select('id')
  if (error) return { ok: false, message: explain(error) }
  if (!data?.length) return { ok: false, message: 'Votre rôle ne permet pas cette écriture.' }

  revalidateOperations(input.organizationId, input.useCaseId)
  return {
    ok: true,
    message: input.effective
      ? 'CAPA close : efficacité vérifiée en votre nom. L’incident peut maintenant se clore.'
      : 'CAPA jugée inefficace : elle reste ouverte, à reprendre.',
  }
}

// =============================================================================
// Demandes de changement
// =============================================================================
const CHANGE_TYPES = [
  'MODEL',
  'DATASET',
  'PURPOSE',
  'VENDOR',
  'AUTONOMY',
  'POPULATION',
  'TERRITORY',
  'SECURITY',
  'DEPLOYMENT',
] as const

const changeSchema = z
  .object({
    organizationId: z.string().uuid(),
    useCaseId: z.string().uuid(),
    title: z.string().trim().min(5, 'Titre trop court.').max(200),
    description: z.string().trim().min(20, 'Décrire le changement envisagé.').max(4000),
    changeTypes: z.array(z.enum(CHANGE_TYPES)).min(1, 'Choisir au moins une nature de changement.'),
    increasesAutonomy: z.boolean(),
    newAutonomyLevel: z.enum(['L0', 'L1', 'L2', 'L3', 'L4']).optional().or(z.literal('')),
    changesPurpose: z.boolean(),
    newPopulationAffected: z.boolean(),
    newTerritory: z.boolean(),
    changesPersonalData: z.boolean(),
    changesVendor: z.boolean(),
    changesModel: z.boolean(),
    changesDataset: z.boolean(),
    securityRelevant: z.boolean(),
    plannedAt: z.string().trim().optional().or(z.literal('')),
  })
  .refine((v) => !v.increasesAutonomy || Boolean(v.newAutonomyLevel), {
    message: 'Indiquer le niveau d’autonomie visé.',
    path: ['newAutonomyLevel'],
  })

export async function submitChangeRequest(
  _previous: FormState | null,
  formData: FormData,
): Promise<FormState> {
  const parsed = changeSchema.safeParse({
    organizationId: formData.get('organizationId'),
    useCaseId: formData.get('useCaseId'),
    title: formData.get('title'),
    description: formData.get('description'),
    changeTypes: formData.getAll('changeTypes'),
    increasesAutonomy: formData.get('increasesAutonomy') === 'on',
    newAutonomyLevel: formData.get('newAutonomyLevel') ?? '',
    changesPurpose: formData.get('changesPurpose') === 'on',
    newPopulationAffected: formData.get('newPopulationAffected') === 'on',
    newTerritory: formData.get('newTerritory') === 'on',
    changesPersonalData: formData.get('changesPersonalData') === 'on',
    changesVendor: formData.get('changesVendor') === 'on',
    changesModel: formData.get('changesModel') === 'on',
    changesDataset: formData.get('changesDataset') === 'on',
    securityRelevant: formData.get('securityRelevant') === 'on',
    plannedAt: formData.get('plannedAt') ?? '',
  })
  if (!parsed.success) return firstIssues(parsed.error)

  const input = parsed.data
  const tenantId = await tenantOf(input.organizationId)
  if (!tenantId) return { ok: false, message: 'Organisation introuvable.' }
  const userId = await currentUserId()
  if (!userId) return { ok: false, message: 'Session expirée.' }

  const supabase = await createClient()
  const { data: created, error } = await supabase
    .from('change_request')
    .insert({
      tenant_id: tenantId,
      organization_id: input.organizationId,
      use_case_id: input.useCaseId,
      title: input.title,
      description: input.description,
      change_types: input.changeTypes,
      increases_autonomy: input.increasesAutonomy,
      new_autonomy_level: input.increasesAutonomy ? input.newAutonomyLevel || null : null,
      changes_purpose: input.changesPurpose,
      new_population_affected: input.newPopulationAffected,
      new_territory: input.newTerritory,
      changes_personal_data: input.changesPersonalData,
      changes_vendor: input.changesVendor,
      changes_model: input.changesModel,
      changes_dataset: input.changesDataset,
      security_relevant: input.securityRelevant,
      status: 'DRAFT',
      requested_by: userId,
      planned_at: input.plannedAt || null,
    })
    .select('id')
    .single()
  if (error) return { ok: false, message: explain(error) }

  // La qualification est l'affaire du moteur : il lit les faits declares et
  // dit ce qu'il faut reevaluer. Elle est tentee tout de suite ; si le role
  // ne le permet pas, la demande reste en brouillon, a qualifier par un role
  // de gouvernance.
  const { data: screening, error: screeningError } = await supabase.rpc('screen_change_request', {
    p_change_request_id: created.id,
  })

  revalidateOperations(input.organizationId, input.useCaseId)

  if (screeningError) {
    return {
      ok: true,
      message: 'Demande enregistrée en brouillon. Un rôle de gouvernance la qualifiera.',
    }
  }
  const result = screening as { verdict: string; scope: string[]; note?: string }
  return {
    ok: true,
    message: `Demande qualifiée : ${result.note ?? result.verdict}${
      result.scope?.length ? ` — périmètre rouvert : ${result.scope.join(', ')}` : ''
    }`,
  }
}

// =============================================================================
// Retenir des propositions d'actions
// =============================================================================
// L'assistant a derive des ecarts ; l'utilisateur a coche, confirme ou change
// le responsable, l'echeance, le caractere bloquant. Chaque action retenue
// porte sa source (controle, risque, gate, incident…) et sa provenance dans sa
// description : on saura d'ou elle vient.
const ACTION_SOURCES = ['decision', 'risk', 'impact_finding', 'incident', 'audit_finding', 'control', 'change_request', 'management_review', 'manual'] as const

const retainActionsSchema = z.object({
  organizationId: z.string().uuid(),
  useCaseId: z.string().uuid(),
  selections: z
    .array(
      z.object({
        title: z.string().trim().min(5).max(200),
        description: z.string().trim().max(2000).optional().or(z.literal('')),
        source: z.enum(ACTION_SOURCES),
        sourceId: z.string().uuid().nullable(),
        ownerUserId: z.string().uuid().nullable(),
        dueDate: z.string().trim().optional().or(z.literal('')),
        isBlocking: z.boolean(),
        reason: z.string().trim().max(500),
      }),
    )
    .min(1, 'Cocher au moins une proposition.'),
})

export async function retainSuggestedActions(
  _previous: FormState | null,
  formData: FormData,
): Promise<FormState> {
  let selections: unknown
  try {
    selections = JSON.parse(String(formData.get('selections') ?? '[]'))
  } catch {
    return { ok: false, message: 'Sélection illisible.' }
  }
  const parsed = retainActionsSchema.safeParse({
    organizationId: formData.get('organizationId'),
    useCaseId: formData.get('useCaseId'),
    selections,
  })
  if (!parsed.success) return firstIssues(parsed.error)

  const tenantId = await tenantOf(parsed.data.organizationId)
  if (!tenantId) return { ok: false, message: 'Organisation introuvable.' }
  const userId = await currentUserId()
  if (!userId) return { ok: false, message: 'Session expirée.' }

  const supabase = await createClient()
  const { data: profile } = await supabase.from('user_profile').select('email').eq('id', userId).maybeSingle()

  const rows = parsed.data.selections.map((s) => ({
    tenant_id: tenantId,
    organization_id: parsed.data.organizationId,
    use_case_id: parsed.data.useCaseId,
    title: s.title,
    description:
      `${s.description || ''}${s.description ? '\n\n' : ''}` +
      `Proposé par l’assistant, retenu par ${profile?.email ?? 'l’utilisateur'} : ${s.reason}`,
    source: s.source,
    source_id: s.sourceId,
    owner_user_id: s.ownerUserId,
    due_date: s.dueDate || null,
    is_blocking: s.isBlocking,
  }))

  const { error, count } = await supabase.from('action').insert(rows, { count: 'exact' })
  if (error) return { ok: false, message: explain(error) }

  revalidateOperations(parsed.data.organizationId, parsed.data.useCaseId)
  return {
    ok: true,
    message: `${count ?? rows.length} action(s) ouverte(s)${rows.some((r) => r.is_blocking) ? ', dont des bloquantes que le gate PRODUCTION attendra' : ''}.`,
  }
}

// =============================================================================
// Le ticket d'incident : qualifier, arrêter, signer
// =============================================================================
// Trois actes nominatifs et dates, que la base signe au nom de qui les pose
// (0069) : la qualification sous 24 h, l'arret d'urgence — recommande par
// l'officer, valide par le Porteur, execute —, la double signature de cloture.
const qualifySchema = z.object({
  organizationId: z.string().uuid(),
  incidentId: z.string().uuid(),
  kind: z.enum(INCIDENT_KINDS),
  severity: z.enum(['S1', 'S2', 'S3', 'S4']),
  fundamentalRightsImpacted: z.boolean(),
  fundamentalRightsDetail: z.string().trim().max(1000).optional().or(z.literal('')),
  officerUserId: z.string().uuid().optional().or(z.literal('')),
})

export async function qualifyIncident(_previous: FormState | null, formData: FormData): Promise<FormState> {
  const parsed = qualifySchema.safeParse({
    organizationId: formData.get('organizationId'),
    incidentId: formData.get('incidentId'),
    kind: formData.get('kind'),
    severity: formData.get('severity'),
    fundamentalRightsImpacted: formData.get('fundamentalRightsImpacted') === 'on',
    fundamentalRightsDetail: formData.get('fundamentalRightsDetail') ?? '',
    officerUserId: formData.get('officerUserId') ?? '',
  })
  if (!parsed.success) return firstIssues(parsed.error)
  const input = parsed.data
  const supabase = await createClient()
  const { data, error } = await supabase
    .from('incident')
    .update({
      kind: input.kind,
      severity: input.severity,
      fundamental_rights_impacted: input.fundamentalRightsImpacted,
      fundamental_rights_detail: input.fundamentalRightsDetail || null,
      qualified_at: new Date().toISOString(),
      ...(input.officerUserId ? { officer_user_id: input.officerUserId } : {}),
    })
    .eq('id', input.incidentId)
    .select('id, use_case_id')
    .maybeSingle()
  if (error) return { ok: false, message: explain(error) }
  if (!data) return { ok: false, message: 'Votre rôle ne permet pas cette écriture.' }
  revalidate(input.organizationId, data.use_case_id)
  return { ok: true, message: 'Incident qualifié, en votre nom et daté.' }
}

const stepSchema = z.object({
  organizationId: z.string().uuid(),
  incidentId: z.string().uuid(),
  step: z.enum(['recommend', 'validate', 'execute', 'officer_sign', 'owner_sign']),
  note: z.string().trim().max(1000).optional().or(z.literal('')),
})

export async function incidentStep(_previous: FormState | null, formData: FormData): Promise<FormState> {
  const parsed = stepSchema.safeParse({
    organizationId: formData.get('organizationId'),
    incidentId: formData.get('incidentId'),
    step: formData.get('step'),
    note: formData.get('note') ?? '',
  })
  if (!parsed.success) return firstIssues(parsed.error)
  const input = parsed.data
  const now = new Date().toISOString()
  const patch: Record<string, unknown> =
    input.step === 'recommend'
      ? { stop_recommended_at: now, stop_note: input.note || null }
      : input.step === 'validate'
        ? { stop_validated_at: now }
        : input.step === 'execute'
          ? { stop_executed_at: now, status: 'CONTAINED', contained_at: now, containment_action: input.note || 'Arrêt d’urgence exécuté (kill-switch).' }
          : input.step === 'officer_sign'
            ? { closure_officer_at: now }
            : { closure_owner_at: now }
  const supabase = await createClient()
  const { data, error } = await supabase
    .from('incident')
    .update(patch)
    .eq('id', input.incidentId)
    .select('id, use_case_id, closure_officer_at, closure_owner_at')
    .maybeSingle()
  if (error) return { ok: false, message: explain(error) }
  if (!data) return { ok: false, message: 'Votre rôle ne permet pas cette écriture.' }
  revalidate(input.organizationId, data.use_case_id)
  const messages: Record<typeof input.step, string> = {
    recommend: 'Arrêt d’urgence recommandé, en votre nom. Le Porteur est averti : il valide.',
    validate: 'Arrêt validé. Une décision de suspension est soumise si le cas d’usage est en service ; l’exécution technique reste à tracer.',
    execute: 'Arrêt exécuté et tracé : l’incident est contenu.',
    officer_sign: data.closure_owner_at ? 'Validation posée. Les deux signatures sont là : l’incident peut être clos.' : 'Validation posée. Le Porteur est averti : son approbation clôt le ticket.',
    owner_sign: data.closure_officer_at ? 'Approbation posée. Les deux signatures sont là : l’incident peut être clos.' : 'Approbation posée. L’AI Governance Officer est averti : sa validation clôt le ticket.',
  }
  return { ok: true, message: messages[input.step] }
}

function revalidate(organizationId: string, useCaseId: string | null) {
  revalidatePath(`/admin/organizations/${organizationId}/suivi`)
  if (useCaseId) revalidatePath(`/admin/use-cases/${useCaseId}`)
}

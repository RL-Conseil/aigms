'use server'

import { revalidatePath } from 'next/cache'
import { z } from 'zod'
import { createClient } from '@/lib/supabase/server'

/**
 * Saisie du dispositif de maitrise.
 *
 * Quatre ecritures, et elles se tiennent : un controle existe dans le
 * referentiel de l'organisation, il est declare applicable ou non a un cas
 * d'usage, il repond a des exigences normatives, et il peut etre designe comme
 * la mesure qui traite un risque.
 *
 * Aucune de ces quatre n'existait : tout ce qui se lisait — couverture, graphe,
 * chemin du risque, Declaration d'Applicabilite — reposait sur des controles
 * qu'on ne pouvait pas creer. Les regles, elles, etaient deja en base : ces
 * actions valident la FORME et laissent la base repondre.
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
  if (error.code === '23505') return 'Ce code de contrôle existe déjà sur cette organisation.'
  if (error.message.includes('row-level security')) {
    return 'Votre rôle ne permet pas cette écriture.'
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
// Le contrôle
// =============================================================================
const CONTROL_STATUSES = ['proposed', 'implemented', 'operating', 'ineffective', 'retired'] as const

const controlSchema = z.object({
  organizationId: z.string().uuid(),
  code: z
    .string()
    .trim()
    .min(2, 'Code trop court.')
    .max(24)
    .regex(/^[A-Za-z0-9.\-_]+$/, 'Lettres, chiffres, point, tiret ou souligné.'),
  name: z.string().trim().min(3, 'Intitulé trop court.').max(200),
  objective: z
    .string()
    .trim()
    .min(
      20,
      'Dire ce que le contrôle garantit, pas ce qu’il fait : c’est l’objectif qu’un auditeur lit.',
    )
    .max(1000),
  status: z.enum(CONTROL_STATUSES),
  isMandatory: z.coerce.boolean(),
  ownerUserId: z.string().uuid().optional().or(z.literal('')),
  frequency: z.string().trim().max(60).optional().or(z.literal('')),
  testProcedure: z.string().trim().max(1000).optional().or(z.literal('')),
  lastTestedAt: z.string().trim().optional().or(z.literal('')),
  nextTestAt: z.string().trim().optional().or(z.literal('')),
})

export async function createControl(
  _previous: FormState | null,
  formData: FormData,
): Promise<FormState> {
  const parsed = controlSchema.safeParse({
    organizationId: formData.get('organizationId'),
    code: formData.get('code'),
    name: formData.get('name'),
    objective: formData.get('objective'),
    status: formData.get('status') ?? 'proposed',
    isMandatory: formData.get('isMandatory') === 'on',
    ownerUserId: formData.get('ownerUserId') ?? '',
    frequency: formData.get('frequency') ?? '',
    testProcedure: formData.get('testProcedure') ?? '',
    lastTestedAt: formData.get('lastTestedAt') ?? '',
    nextTestAt: formData.get('nextTestAt') ?? '',
  })
  if (!parsed.success) return firstIssues(parsed.error)

  const input = parsed.data
  const tenantId = await tenantOf(input.organizationId)
  if (!tenantId) return { ok: false, message: 'Organisation introuvable.' }

  const supabase = await createClient()
  const { error } = await supabase.from('control').insert({
    tenant_id: tenantId,
    organization_id: input.organizationId,
    code: input.code.toUpperCase(),
    name: input.name,
    objective: input.objective,
    status: input.status,
    is_mandatory: input.isMandatory,
    owner_user_id: input.ownerUserId || null,
    frequency: input.frequency || null,
    test_procedure: input.testProcedure || null,
    last_tested_at: input.lastTestedAt || null,
    next_test_at: input.nextTestAt || null,
  })

  if (error) return { ok: false, message: explain(error) }

  revalidatePath(`/admin/organizations/${input.organizationId}/controles`)
  revalidatePath(`/admin/organizations/${input.organizationId}/preuves`)
  return { ok: true, message: `Contrôle ${input.code.toUpperCase()} créé.` }
}

// -----------------------------------------------------------------------------
// Son état d'exploitation
// -----------------------------------------------------------------------------
// Separe de la creation : un controle se cree une fois et change d'etat
// souvent. « Operant » n'est pas une case a cocher en passant — c'est la
// declaration qui le fait compter dans le taux de couverture.
const controlStateSchema = z.object({
  organizationId: z.string().uuid(),
  controlId: z.string().uuid(),
  status: z.enum(CONTROL_STATUSES),
  lastTestedAt: z.string().trim().optional().or(z.literal('')),
  nextTestAt: z.string().trim().optional().or(z.literal('')),
})

export async function setControlState(
  _previous: FormState | null,
  formData: FormData,
): Promise<FormState> {
  const parsed = controlStateSchema.safeParse({
    organizationId: formData.get('organizationId'),
    controlId: formData.get('controlId'),
    status: formData.get('status'),
    lastTestedAt: formData.get('lastTestedAt') ?? '',
    nextTestAt: formData.get('nextTestAt') ?? '',
  })
  if (!parsed.success) return firstIssues(parsed.error)

  const supabase = await createClient()
  const { data, error } = await supabase
    .from('control')
    .update({
      status: parsed.data.status,
      last_tested_at: parsed.data.lastTestedAt || null,
      next_test_at: parsed.data.nextTestAt || null,
    })
    .eq('id', parsed.data.controlId)
    .select('id')

  if (error) return { ok: false, message: explain(error) }
  if (!data?.length) return { ok: false, message: 'Votre rôle ne permet pas cette écriture.' }

  revalidatePath(`/admin/organizations/${parsed.data.organizationId}/controles`)
  revalidatePath(`/admin/organizations/${parsed.data.organizationId}/preuves`)
  return { ok: true, message: 'État du contrôle enregistré.' }
}

// =============================================================================
// L'applicabilité à un cas d'usage
// =============================================================================
const applicabilitySchema = z
  .object({
    useCaseId: z.string().uuid(),
    controlId: z.string().uuid('Choisir un contrôle.'),
    status: z.enum(['applicable', 'not_applicable', 'to_determine']),
    justification: z.string().trim().max(1000).optional().or(z.literal('')),
  })
  // La base porte deja `control_na_requires_justification` ; on le dit avant
  // l'envoi plutot que de laisser la contrainte parler a la place du formulaire.
  .refine((v) => v.status !== 'not_applicable' || (v.justification ?? '').length >= 20, {
    message: 'Une exclusion se motive : dire pourquoi ce contrôle n’a pas d’objet ici.',
    path: ['justification'],
  })

export async function setControlApplicability(
  _previous: FormState | null,
  formData: FormData,
): Promise<FormState> {
  const parsed = applicabilitySchema.safeParse({
    useCaseId: formData.get('useCaseId'),
    controlId: formData.get('controlId'),
    status: formData.get('status') ?? 'to_determine',
    justification: formData.get('justification') ?? '',
  })
  if (!parsed.success) return firstIssues(parsed.error)

  const supabase = await createClient()
  const {
    data: { user },
  } = await supabase.auth.getUser()
  if (!user) return { ok: false, message: 'Session expirée.' }

  const { data: useCase } = await supabase
    .from('ai_use_case')
    .select('tenant_id, organization_id')
    .eq('id', parsed.data.useCaseId)
    .maybeSingle()
  if (!useCase) return { ok: false, message: 'Cas d’usage introuvable.' }

  const { error } = await supabase.from('control_applicability').upsert(
    {
      tenant_id: useCase.tenant_id,
      control_id: parsed.data.controlId,
      use_case_id: parsed.data.useCaseId,
      status: parsed.data.status,
      justification: parsed.data.justification || null,
      decided_by: user.id,
      decided_at: new Date().toISOString(),
    },
    { onConflict: 'control_id,use_case_id' },
  )

  if (error) return { ok: false, message: explain(error) }

  revalidatePath(`/admin/use-cases/${parsed.data.useCaseId}`)
  revalidatePath(`/admin/organizations/${useCase.organization_id}/declaration-applicabilite`)
  return { ok: true, message: 'Applicabilité statuée, en votre nom et datée.' }
}

// =============================================================================
// La correspondance à une exigence normative
// =============================================================================
const mappingSchema = z.object({
  organizationId: z.string().uuid(),
  controlId: z.string().uuid(),
  requirementId: z.string().uuid('Choisir une exigence.'),
  coverageNote: z.string().trim().max(500).optional().or(z.literal('')),
})

export async function mapControlToRequirement(
  _previous: FormState | null,
  formData: FormData,
): Promise<FormState> {
  const parsed = mappingSchema.safeParse({
    organizationId: formData.get('organizationId'),
    controlId: formData.get('controlId'),
    requirementId: formData.get('requirementId'),
    coverageNote: formData.get('coverageNote') ?? '',
  })
  if (!parsed.success) return firstIssues(parsed.error)

  const supabase = await createClient()
  const {
    data: { user },
  } = await supabase.auth.getUser()
  if (!user) return { ok: false, message: 'Session expirée.' }

  const tenantId = await tenantOf(parsed.data.organizationId)
  if (!tenantId) return { ok: false, message: 'Organisation introuvable.' }

  const { error } = await supabase.from('control_requirement_map').insert({
    tenant_id: tenantId,
    control_id: parsed.data.controlId,
    requirement_id: parsed.data.requirementId,
    coverage_note: parsed.data.coverageNote || null,
    mapped_by: user.id,
  })

  if (error) {
    if (error.code === '23505') {
      return { ok: false, message: 'Ce contrôle répond déjà à cette exigence.' }
    }
    return { ok: false, message: explain(error) }
  }

  revalidatePath(`/admin/organizations/${parsed.data.organizationId}/controles`)
  revalidatePath(`/admin/organizations/${parsed.data.organizationId}/declaration-applicabilite`)
  return { ok: true, message: 'Correspondance enregistrée.' }
}

// =============================================================================
// Le traitement d'un risque
// =============================================================================
// `control_id` est le lien decide en ADR-0010 : c'est lui, et lui seul, qui
// relie un risque a la mesure censee le reduire. Sans cette saisie, la regle
// etait verrouillee en base mais inatteignable.
const treatmentSchema = z.object({
  riskId: z.string().uuid(),
  useCaseId: z.string().uuid(),
  strategy: z.enum(['avoid', 'reduce', 'transfer', 'accept']),
  description: z
    .string()
    .trim()
    .min(20, 'Décrire ce qui sera fait : un traitement en trois mots ne se vérifie pas.')
    .max(2000),
  ownerUserId: z.string().uuid().optional().or(z.literal('')),
  dueDate: z.string().trim().optional().or(z.literal('')),
  controlId: z.string().uuid().optional().or(z.literal('')),
})

export async function createRiskTreatment(
  _previous: FormState | null,
  formData: FormData,
): Promise<FormState> {
  const parsed = treatmentSchema.safeParse({
    riskId: formData.get('riskId'),
    useCaseId: formData.get('useCaseId'),
    strategy: formData.get('strategy') ?? 'reduce',
    description: formData.get('description'),
    ownerUserId: formData.get('ownerUserId') ?? '',
    dueDate: formData.get('dueDate') ?? '',
    controlId: formData.get('controlId') ?? '',
  })
  if (!parsed.success) return firstIssues(parsed.error)

  const supabase = await createClient()
  const { data: risk } = await supabase
    .from('risk')
    .select('tenant_id')
    .eq('id', parsed.data.riskId)
    .maybeSingle()
  if (!risk) return { ok: false, message: 'Risque introuvable.' }

  const { error } = await supabase.from('risk_treatment').insert({
    tenant_id: risk.tenant_id,
    risk_id: parsed.data.riskId,
    strategy: parsed.data.strategy,
    description: parsed.data.description,
    owner_user_id: parsed.data.ownerUserId || null,
    due_date: parsed.data.dueDate || null,
    control_id: parsed.data.controlId || null,
  })

  if (error) return { ok: false, message: explain(error) }

  revalidatePath(`/admin/use-cases/${parsed.data.useCaseId}`)
  return {
    ok: true,
    message: parsed.data.controlId
      ? 'Traitement enregistré, avec le contrôle qui le met en œuvre.'
      : 'Traitement enregistré. Tant qu’aucun contrôle ne le met en œuvre, le chemin du risque s’arrête à l’intention.',
  }
}

// =============================================================================
// Ajouter un contrôle depuis un référentiel
// =============================================================================
// Un contrôle-type publié — de l'éditeur ou du cabinet — devient le contrôle
// opérationnel de l'organisation : code, nom, objectif, fréquence repris, lien
// conservé, et les correspondances ISO 42001 rattachées d'emblée. C'est la base
// qui le fait (`app.instantiate_catalog_control`) et qui refuse ce qui doit
// l'être : version non publiée, référentiel d'un autre tenant, doublon.
const instantiateSchema = z.object({
  organizationId: z.string().uuid(),
  catalogControlId: z.string().uuid({ message: 'Choisir un contrôle-type.' }),
  code: z.string().trim().max(40).optional().or(z.literal('')),
  ownerUserId: z.string().uuid().optional().or(z.literal('')),
})

export async function instantiateCatalogControl(
  _previous: FormState | null,
  formData: FormData,
): Promise<FormState> {
  const parsed = instantiateSchema.safeParse({
    organizationId: formData.get('organizationId'),
    catalogControlId: formData.get('catalogControlId'),
    code: formData.get('code') ?? '',
    ownerUserId: formData.get('ownerUserId') ?? '',
  })
  if (!parsed.success) return firstIssues(parsed.error)

  const supabase = await createClient()
  const { data, error } = await supabase.rpc('instantiate_catalog_control', {
    p_organization_id: parsed.data.organizationId,
    p_catalog_control_id: parsed.data.catalogControlId,
    p_code: parsed.data.code || undefined,
    p_owner_user_id: parsed.data.ownerUserId || undefined,
  })
  if (error) return { ok: false, message: explain(error) }

  const result = data as {
    code: string
    mapped_requirements: number
    unmapped_references: string[]
  }
  revalidatePath(`/admin/organizations/${parsed.data.organizationId}/controles`)
  revalidatePath(`/admin/organizations/${parsed.data.organizationId}/declaration-applicabilite`)
  return {
    ok: true,
    message:
      `${result.code} ajouté, à l’état « proposé ». ` +
      (result.mapped_requirements
        ? `${result.mapped_requirements} exigence(s) ISO 42001 rattachée(s).`
        : 'Aucune exigence rattachée automatiquement.') +
      (result.unmapped_references.length
        ? ` Références hors AIGMS, à garder en tête : ${result.unmapped_references.join(' ; ')}.`
        : ''),
  }
}

// =============================================================================
// Retenir des propositions de l'assistant
// =============================================================================
// L'assistant a propose ; l'utilisateur a coche. Pour chaque controle-type
// retenu : l'ajouter a la liste operationnelle s'il n'y est pas (lien conserve,
// exigences rattachees), puis le declarer applicable au cas d'usage — en
// portant le motif de la proposition dans la justification, precede de sa
// provenance. Rien de tout cela ne s'ecrit sans ce clic.
const retainSchema = z.object({
  organizationId: z.string().uuid(),
  useCaseId: z.string().uuid(),
  selections: z
    .array(
      z.object({
        catalogControlId: z.string().uuid(),
        controlId: z.string().uuid().nullable(),
        reason: z.string().trim().max(500),
      }),
    )
    .min(1, 'Cocher au moins une proposition.'),
})

export async function retainSuggestedControls(
  _previous: FormState | null,
  formData: FormData,
): Promise<FormState> {
  let selections: unknown
  try {
    selections = JSON.parse(String(formData.get('selections') ?? '[]'))
  } catch {
    return { ok: false, message: 'Sélection illisible.' }
  }
  const parsed = retainSchema.safeParse({
    organizationId: formData.get('organizationId'),
    useCaseId: formData.get('useCaseId'),
    selections,
  })
  if (!parsed.success) return firstIssues(parsed.error)

  const supabase = await createClient()
  const {
    data: { user },
  } = await supabase.auth.getUser()
  if (!user) return { ok: false, message: 'Session expirée.' }

  const { data: useCase } = await supabase
    .from('ai_use_case')
    .select('tenant_id')
    .eq('id', parsed.data.useCaseId)
    .maybeSingle()
  if (!useCase) return { ok: false, message: 'Cas d’usage introuvable.' }

  let added = 0
  let affected = 0
  const refusals: string[] = []

  for (const s of parsed.data.selections) {
    let controlId = s.controlId
    if (!controlId) {
      const { data, error } = await supabase.rpc('instantiate_catalog_control', {
        p_organization_id: parsed.data.organizationId,
        p_catalog_control_id: s.catalogControlId,
      })
      if (error) {
        refusals.push(explain(error))
        continue
      }
      controlId = (data as { control_id: string }).control_id
      added += 1
    }
    const { error } = await supabase.from('control_applicability').upsert(
      {
        tenant_id: useCase.tenant_id,
        control_id: controlId,
        use_case_id: parsed.data.useCaseId,
        status: 'applicable',
        justification: `Proposé par l’assistant, retenu par ${user.email ?? 'l’utilisateur'} : ${s.reason}`,
        decided_by: user.id,
        decided_at: new Date().toISOString(),
      },
      { onConflict: 'control_id,use_case_id' },
    )
    if (error) refusals.push(explain(error))
    else affected += 1
  }

  revalidatePath(`/admin/use-cases/${parsed.data.useCaseId}`)
  revalidatePath(`/admin/organizations/${parsed.data.organizationId}/controles`)
  revalidatePath(`/admin/organizations/${parsed.data.organizationId}/declaration-applicabilite`)

  if (!affected) return { ok: false, message: refusals[0] ?? 'Aucune proposition retenue.' }
  return {
    ok: true,
    message:
      `${affected} contrôle(s) déclaré(s) applicable(s)` +
      (added ? `, dont ${added} ajouté(s) à la liste opérationnelle depuis le référentiel` : '') +
      (refusals.length ? `. ${refusals.length} refus : ${refusals[0]}` : '.'),
  }
}

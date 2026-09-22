'use server'

import { revalidatePath } from 'next/cache'
import { redirect } from 'next/navigation'
import { z } from 'zod'
import { createClient } from '@/lib/supabase/server'
import type { ImpactStudy } from '@/lib/domain/impact'

/**
 * L'etude d'impact IA se conduit sur sa propre page : cadrage, parties
 * prenantes, constats par domaine, remediation, achevement. La base ouvre
 * les actions (constat grave, preuve a deposer) ; ici on valide la forme.
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
  const raise = error.message.match(/^(?:.*?:\s)?([A-ZÀ-Ü][^\n]*)$/m)
  return raise?.[1] ?? error.message
}

const optional = z.string().trim().max(2000).optional().or(z.literal(''))

async function studyPaths(supabase: Awaited<ReturnType<typeof createClient>>, studyId: string) {
  const { data } = await supabase.from('impact_assessment').select('organization_id, use_case_id').eq('id', studyId).maybeSingle()
  if (!data) return null
  return {
    ...data,
    revalidate: () => {
      revalidatePath(`/admin/organizations/${data.organization_id}/etudes-impact`)
      revalidatePath(`/admin/organizations/${data.organization_id}/etudes-impact/${studyId}`)
      revalidatePath(`/admin/use-cases/${data.use_case_id}`)
    },
  }
}

// -----------------------------------------------------------------------------
// Ouvrir une etude : depuis la page des etudes, cas d'usage choisi
// -----------------------------------------------------------------------------
export async function openImpactStudy(_previous: FormState | null, formData: FormData): Promise<FormState> {
  const parsed = z.object({ useCaseId: z.string().uuid('Choisir un cas d’usage.') }).safeParse({ useCaseId: formData.get('useCaseId') })
  if (!parsed.success) return firstIssues(parsed.error)
  const supabase = await createClient()
  const {
    data: { user },
  } = await supabase.auth.getUser()
  if (!user) return { ok: false, message: 'Session expirée.' }

  const { data: useCase } = await supabase
    .from('ai_use_case')
    .select('tenant_id, organization_id, name, purpose')
    .eq('id', parsed.data.useCaseId)
    .maybeSingle()
  if (!useCase) return { ok: false, message: 'Cas d’usage introuvable.' }

  // Une etude en cours existe : on y va, on n'en ouvre pas une seconde.
  const { data: existing } = await supabase
    .from('impact_assessment')
    .select('id')
    .eq('use_case_id', parsed.data.useCaseId)
    .in('status', ['draft', 'in_progress', 'reopened'])
    .order('created_at', { ascending: false })
    .limit(1)
    .maybeSingle()
  if (existing) redirect(`/admin/organizations/${useCase.organization_id}/etudes-impact/${existing.id}`)

  // Des donnees personnelles en jeu — fiche ou actif rattache (0080) : l'AIPD
  // se pre-coche, l'officer la confirme ou la decoche en le disant.
  const { data: personalData } = await supabase.rpc('use_case_personal_data', { p_use_case_id: parsed.data.useCaseId })

  const { data: created, error } = await supabase
    .from('impact_assessment')
    .insert({
      tenant_id: useCase.tenant_id,
      organization_id: useCase.organization_id,
      use_case_id: parsed.data.useCaseId,
      dpia_required: Boolean(personalData),
      scope_description: useCase.purpose?.trim() || `Étude d’impact de « ${useCase.name} » : effets sur les personnes, les groupes et la société.`,
      methodology: 'ISO/IEC 42005',
      status: 'in_progress',
      performed_by: user.id,
    })
    .select('id')
    .single()
  if (error) return { ok: false, message: explain(error) }
  revalidatePath(`/admin/organizations/${useCase.organization_id}/etudes-impact`)
  redirect(`/admin/organizations/${useCase.organization_id}/etudes-impact/${created.id}`)
}

// -----------------------------------------------------------------------------
// Cadrage
// -----------------------------------------------------------------------------
const scopeSchema = z.object({
  studyId: z.string().uuid(),
  scopeDescription: z.string().trim().min(20, 'Décrire le périmètre en quelques phrases.').max(4000),
  methodology: z.string().trim().min(2).max(120),
  lifecyclePhase: z.string().trim().max(60).optional().or(z.literal('')),
  dpiaRequired: z.coerce.boolean(),
  dpiaReference: z.string().trim().max(120).optional().or(z.literal('')),
  nextReviewAt: z.string().trim().optional().or(z.literal('')),
})

export async function saveImpactScope(_previous: FormState | null, formData: FormData): Promise<FormState> {
  const parsed = scopeSchema.safeParse({
    studyId: formData.get('studyId'),
    scopeDescription: formData.get('scopeDescription'),
    methodology: formData.get('methodology') || 'ISO/IEC 42005',
    lifecyclePhase: formData.get('lifecyclePhase') ?? '',
    dpiaRequired: formData.get('dpiaRequired') === 'on',
    dpiaReference: formData.get('dpiaReference') ?? '',
    nextReviewAt: formData.get('nextReviewAt') ?? '',
  })
  if (!parsed.success) return firstIssues(parsed.error)
  const d = parsed.data
  const supabase = await createClient()
  const paths = await studyPaths(supabase, d.studyId)
  if (!paths) return { ok: false, message: 'Étude introuvable.' }
  const { error } = await supabase
    .from('impact_assessment')
    .update({
      scope_description: d.scopeDescription,
      methodology: d.methodology,
      lifecycle_phase: d.lifecyclePhase || null,
      dpia_required: d.dpiaRequired,
      dpia_reference: d.dpiaReference || null,
      next_review_at: d.nextReviewAt || null,
    })
    .eq('id', d.studyId)
  if (error) return { ok: false, message: explain(error) }
  paths.revalidate()
  return { ok: true, message: 'Cadrage enregistré.' }
}

// -----------------------------------------------------------------------------
// Parties prenantes
// -----------------------------------------------------------------------------
const stakeholderSchema = z.object({
  studyId: z.string().uuid(),
  label: z.string().trim().min(2, 'Nommer le groupe.').max(160),
  isVulnerableGroup: z.coerce.boolean(),
  estimatedPopulation: z.string().trim().max(120).optional().or(z.literal('')),
  consulted: z.coerce.boolean(),
  consultationMethod: z.string().trim().max(300).optional().or(z.literal('')),
})

export async function addStakeholder(_previous: FormState | null, formData: FormData): Promise<FormState> {
  const parsed = stakeholderSchema.safeParse({
    studyId: formData.get('studyId'),
    label: formData.get('label'),
    isVulnerableGroup: formData.get('isVulnerableGroup') === 'on',
    estimatedPopulation: formData.get('estimatedPopulation') ?? '',
    consulted: formData.get('consulted') === 'on',
    consultationMethod: formData.get('consultationMethod') ?? '',
  })
  if (!parsed.success) return firstIssues(parsed.error)
  const d = parsed.data
  const supabase = await createClient()
  const { data: study } = await supabase.from('impact_assessment').select('tenant_id').eq('id', d.studyId).maybeSingle()
  if (!study) return { ok: false, message: 'Étude introuvable.' }
  const { error } = await supabase.from('impact_stakeholder').insert({
    tenant_id: study.tenant_id,
    impact_assessment_id: d.studyId,
    label: d.label,
    is_vulnerable_group: d.isVulnerableGroup,
    estimated_population: d.estimatedPopulation || null,
    consulted: d.consulted,
    consultation_method: d.consultationMethod || null,
  })
  if (error) return { ok: false, message: explain(error) }
  ;(await studyPaths(supabase, d.studyId))?.revalidate()
  return { ok: true, message: `Partie prenante « ${d.label} » ajoutée.` }
}

export async function removeStakeholder(studyId: string, stakeholderId: string): Promise<FormState> {
  const supabase = await createClient()
  const { error } = await supabase.from('impact_stakeholder').delete().eq('id', stakeholderId).eq('impact_assessment_id', studyId)
  if (error) return { ok: false, message: explain(error) }
  ;(await studyPaths(supabase, studyId))?.revalidate()
  return { ok: true, message: 'Partie prenante retirée.' }
}

// -----------------------------------------------------------------------------
// Constats : benefice ou prejudice, par domaine
// -----------------------------------------------------------------------------
const findingSchema = z
  .object({
    studyId: z.string().uuid(),
    findingId: z.string().uuid().optional().or(z.literal('')),
    domain: z.string().min(1, 'Choisir un domaine.'),
    isAdverse: z.enum(['adverse', 'benefit']),
    description: z.string().trim().min(10, 'Décrire l’effet en une phrase au moins.').max(2000),
    severity: z.enum(['negligible', 'limited', 'significant', 'severe']),
    likelihood: z.enum(['unlikely', 'possible', 'likely', 'almost_certain']),
    stakeholderId: z.string().uuid().optional().or(z.literal('')),
    mitigation: optional,
    residualSeverity: z.enum(['negligible', 'limited', 'significant', 'severe']).optional().or(z.literal('')),
    ownerUserId: z.string().uuid().optional().or(z.literal('')),
    mitigationDueDate: z.string().trim().optional().or(z.literal('')),
    linkedRiskId: z.string().uuid().optional().or(z.literal('')),
  })
  .superRefine((d, ctx) => {
    if (d.isAdverse === 'adverse' && ['significant', 'severe'].includes(d.severity) && !d.mitigation?.trim()) {
      ctx.addIssue({ code: 'custom', path: ['mitigation'], message: 'Un préjudice significatif ou grave porte une mesure de réduction.' })
    }
    if (d.mitigation?.trim() && d.isAdverse === 'adverse' && ['significant', 'severe'].includes(d.severity) && !d.ownerUserId) {
      ctx.addIssue({ code: 'custom', path: ['ownerUserId'], message: 'La mesure se confie à quelqu’un : elle ouvre une action.' })
    }
  })

export async function saveFinding(_previous: FormState | null, formData: FormData): Promise<FormState> {
  const parsed = findingSchema.safeParse({
    studyId: formData.get('studyId'),
    findingId: formData.get('findingId') ?? '',
    domain: formData.get('domain'),
    isAdverse: formData.get('isAdverse') ?? 'adverse',
    description: formData.get('description'),
    severity: formData.get('severity') ?? 'limited',
    likelihood: formData.get('likelihood') ?? 'possible',
    stakeholderId: formData.get('stakeholderId') ?? '',
    mitigation: formData.get('mitigation') ?? '',
    residualSeverity: formData.get('residualSeverity') ?? '',
    ownerUserId: formData.get('ownerUserId') ?? '',
    mitigationDueDate: formData.get('mitigationDueDate') ?? '',
    linkedRiskId: formData.get('linkedRiskId') ?? '',
  })
  if (!parsed.success) return firstIssues(parsed.error)
  const d = parsed.data
  const supabase = await createClient()
  const { data: study } = await supabase.from('impact_assessment').select('tenant_id').eq('id', d.studyId).maybeSingle()
  if (!study) return { ok: false, message: 'Étude introuvable.' }

  const row = {
    domain: d.domain as never,
    is_adverse: d.isAdverse === 'adverse',
    description: d.description,
    severity: d.severity,
    likelihood: d.likelihood,
    stakeholder_id: d.stakeholderId || null,
    mitigation: d.mitigation || null,
    residual_severity: d.residualSeverity || null,
    owner_user_id: d.ownerUserId || null,
    mitigation_due_date: d.mitigationDueDate || null,
    linked_risk_id: d.linkedRiskId || null,
  }
  const { error } = d.findingId
    ? await supabase.from('impact_finding').update(row).eq('id', d.findingId).eq('impact_assessment_id', d.studyId)
    : await supabase.from('impact_finding').insert({ tenant_id: study.tenant_id, impact_assessment_id: d.studyId, ...row })
  if (error) return { ok: false, message: explain(error) }
  ;(await studyPaths(supabase, d.studyId))?.revalidate()
  const opensAction = row.is_adverse && ['significant', 'severe'].includes(d.severity) && row.mitigation
  return {
    ok: true,
    message: opensAction
      ? 'Constat enregistré. La mesure de réduction est une action, confiée et datée.'
      : 'Constat enregistré.',
  }
}

export async function removeFinding(studyId: string, findingId: string): Promise<FormState> {
  const supabase = await createClient()
  const { error } = await supabase.from('impact_finding').delete().eq('id', findingId).eq('impact_assessment_id', studyId)
  if (error) return { ok: false, message: explain(error) }
  ;(await studyPaths(supabase, studyId))?.revalidate()
  return { ok: true, message: 'Constat retiré.' }
}

// -----------------------------------------------------------------------------
// Achever, rouvrir
// -----------------------------------------------------------------------------
const completeSchema = z.object({
  studyId: z.string().uuid(),
  conclusion: z.string().trim().min(20, 'Conclure en quelques phrases : ce que l’étude retient.').max(4000),
  nextReviewAt: z.string().trim().optional().or(z.literal('')),
})

export async function completeImpactStudy(_previous: FormState | null, formData: FormData): Promise<FormState> {
  const parsed = completeSchema.safeParse({
    studyId: formData.get('studyId'),
    conclusion: formData.get('conclusion'),
    nextReviewAt: formData.get('nextReviewAt') ?? '',
  })
  if (!parsed.success) return firstIssues(parsed.error)
  const d = parsed.data
  const supabase = await createClient()
  const paths = await studyPaths(supabase, d.studyId)
  if (!paths) return { ok: false, message: 'Étude introuvable.' }
  const { error } = await supabase
    .from('impact_assessment')
    .update({
      status: 'completed',
      conclusion: d.conclusion,
      completed_at: new Date().toISOString(),
      next_review_at: d.nextReviewAt || null,
    })
    .eq('id', d.studyId)
  if (error) return { ok: false, message: explain(error) }
  paths.revalidate()
  return { ok: true, message: 'Étude achevée. L’action « déposer la preuve » est ouverte : l’export d’un clic la solde.' }
}

const reopenSchema = z.object({
  studyId: z.string().uuid(),
  reason: z.string().trim().min(10, 'Dire pourquoi l’étude est rouverte.').max(1000),
})

export async function reopenImpactStudy(_previous: FormState | null, formData: FormData): Promise<FormState> {
  const parsed = reopenSchema.safeParse({ studyId: formData.get('studyId'), reason: formData.get('reason') })
  if (!parsed.success) return firstIssues(parsed.error)
  const d = parsed.data
  const supabase = await createClient()
  const paths = await studyPaths(supabase, d.studyId)
  if (!paths) return { ok: false, message: 'Étude introuvable.' }
  const { error } = await supabase
    .from('impact_assessment')
    .update({ status: 'reopened', reopened_reason: d.reason })
    .eq('id', d.studyId)
  if (error) return { ok: false, message: explain(error) }
  paths.revalidate()
  return { ok: true, message: 'Étude rouverte. Elle se ré-achève sur une conclusion mise à jour.' }
}

// -----------------------------------------------------------------------------
// L'export comme preuve : le document genere se depose d'un clic
// -----------------------------------------------------------------------------
export async function depositImpactStudyExport(studyId: string): Promise<FormState> {
  const supabase = await createClient()
  const {
    data: { user },
  } = await supabase.auth.getUser()
  if (!user) return { ok: false, message: 'Session expirée.' }

  const { data, error: readError } = await supabase.rpc('impact_study', { p_id: studyId })
  if (readError || !data) return { ok: false, message: 'Étude introuvable.' }
  const study = data as unknown as ImpactStudy
  if (study.status !== 'completed') return { ok: false, message: 'L’étude se dépose une fois achevée.' }

  const { data: organization } = await supabase
    .from('organization')
    .select('tenant_id, name')
    .eq('id', study.organization_id)
    .maybeSingle()
  if (!organization) return { ok: false, message: 'Organisation introuvable.' }

  const { buildImpactStudyDocx } = await import('@/lib/impact/docx')
  const { EVIDENCE_BUCKET } = await import('@/lib/storage/evidence')
  const { createHash } = await import('node:crypto')
  const bytes = await buildImpactStudyDocx(study, organization.name)
  const evidenceId = crypto.randomUUID()
  const fileName = `${study.business_ref}-etude-impact.docx`
  const storagePath = `${organization.tenant_id}/${study.organization_id}/${evidenceId}/${fileName}`
  const mime = 'application/vnd.openxmlformats-officedocument.wordprocessingml.document'

  const { error: uploadError } = await supabase.storage
    .from(EVIDENCE_BUCKET)
    .upload(storagePath, bytes, { contentType: mime, upsert: false })
  if (uploadError) return { ok: false, message: `Dépôt refusé : ${uploadError.message}` }

  const { error } = await supabase.from('evidence').insert({
    id: evidenceId,
    tenant_id: organization.tenant_id,
    organization_id: study.organization_id,
    title: `Étude d’impact IA — ${study.use_case.name} (${study.business_ref})`,
    evidence_type: 'document',
    source: `Étude d’impact ${study.business_ref} (AIGMS)`,
    valid_until: study.next_review_at,
    storage_bucket: EVIDENCE_BUCKET,
    storage_path: storagePath,
    content_hash: `sha256:${createHash('sha256').update(bytes).digest('hex')}`,
    file_name: fileName,
    file_size_bytes: bytes.length,
    mime_type: mime,
    owner_user_id: user.id,
    validation_status: 'pending',
  })
  if (error) {
    await supabase.storage.from(EVIDENCE_BUCKET).remove([storagePath])
    return { ok: false, message: explain(error) }
  }

  // Le depot solde l'action que l'achevement avait ouverte.
  if (study.pending_action) {
    await supabase
      .from('action')
      .update({
        status: 'done',
        closed_at: new Date().toISOString(),
        closure_note: `Étude d’impact ${study.business_ref} déposée au registre des preuves (${evidenceId}).`,
      })
      .eq('id', study.pending_action.id)
  }

  ;(await studyPaths(supabase, studyId))?.revalidate()
  revalidatePath(`/admin/organizations/${study.organization_id}/preuves`)
  return { ok: true, message: 'Étude déposée au registre des preuves, à valider. L’action qui la demandait est close.' }
}

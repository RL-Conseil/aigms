'use server'

import { revalidatePath } from 'next/cache'
import { z } from 'zod'
import { createClient } from '@/lib/supabase/server'

/**
 * Registre de decisions.
 *
 * La page d'accueil commerciale en fait le differenciateur du produit : « une
 * gouvernance credible ne documente pas seulement les risques, elle documente
 * qui a decide quoi, pourquoi et sous quelles conditions ». Le socle serveur
 * etait pose depuis la migration 0010 ; il manquait le chemin pour y ecrire.
 *
 * QUATRE REGLES vivent en base, et aucune n'est reimplementee ici :
 *
 *   1. aucune approbation sans approbateur nomme, justification, enonce et
 *      date d'effet (`decision_approval_requires_human`) ;
 *   2. separation des roles — l'auteur d'une mise en production, d'une
 *      acceptation de risque ou d'une exception ne peut pas l'approuver
 *      (`app.guard_decision_approval`) ;
 *   3. les decisions a effet durable portent une date de revue
 *      (`decision_review_date_required`) ;
 *   4. une approbation sous conditions enonce ses conditions.
 *
 * Ces actions valident la forme et presentent le refus tel quel. Reproduire les
 * regles ici les ferait diverger — et c'est le serveur qui fait foi.
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
  if (error.message.includes('row-level security')) {
    return 'Votre rôle ne permet pas cette écriture.'
  }
  if (error.message.includes('decision_approval_requires_human')) {
    return 'Une décision approuvée exige un approbateur, une justification, un énoncé et une date d’effet.'
  }
  if (error.message.includes('decision_conditional_requires_conditions')) {
    return 'Une approbation sous conditions énonce ses conditions.'
  }
  if (error.message.includes('decision_review_date_required')) {
    return 'Une mise en production, une acceptation de risque ou une exception portent une date de revue.'
  }
  if (error.message.includes('decision_rejection_requires_rationale')) {
    return 'Un rejet se motive.'
  }
  const raise = error.message.match(/^(?:.*?:\s)?([A-ZÀ-Ü][^\n]*)$/m)
  return raise?.[1] ?? error.message
}

const DECISION_TYPES = [
  'use_case_authorization',
  'pilot_approval',
  'go_production',
  'risk_acceptance',
  'policy_exception',
  'significant_change',
  'suspension',
  'retirement',
] as const

// =============================================================================
// Soumettre une décision
// =============================================================================
const submitSchema = z.object({
  organizationId: z.string().uuid(),
  useCaseId: z.string().uuid().optional().or(z.literal('')),
  decisionType: z.enum(DECISION_TYPES),
  subject: z.string().trim().min(5, 'Objet trop court.').max(200),
  context: z.string().trim().max(2000).optional().or(z.literal('')),
  optionsConsidered: z.string().trim().max(2000).optional().or(z.literal('')),
  decisionStatement: z
    .string()
    .trim()
    .min(20, 'Énoncer ce qui est décidé, pas ce qui est demandé.')
    .max(2000),
  conditions: z.string().trim().max(2000).optional().or(z.literal('')),
  rationale: z
    .string()
    .trim()
    .min(20, 'La justification est ce qu’un auditeur lit en premier.')
    .max(2000),
  effectiveFrom: z.string().trim().optional().or(z.literal('')),
  reviewDueAt: z.string().trim().optional().or(z.literal('')),
})

export async function submitDecision(
  _previous: FormState | null,
  formData: FormData,
): Promise<FormState> {
  const parsed = submitSchema.safeParse({
    organizationId: formData.get('organizationId'),
    useCaseId: formData.get('useCaseId') ?? '',
    decisionType: formData.get('decisionType'),
    subject: formData.get('subject'),
    context: formData.get('context') ?? '',
    optionsConsidered: formData.get('optionsConsidered') ?? '',
    decisionStatement: formData.get('decisionStatement'),
    conditions: formData.get('conditions') ?? '',
    rationale: formData.get('rationale'),
    effectiveFrom: formData.get('effectiveFrom') ?? '',
    reviewDueAt: formData.get('reviewDueAt') ?? '',
  })
  if (!parsed.success) return firstIssues(parsed.error)

  const input = parsed.data
  const supabase = await createClient()
  const {
    data: { user },
  } = await supabase.auth.getUser()
  if (!user) return { ok: false, message: 'Session expirée.' }

  const { data: organization } = await supabase
    .from('organization')
    .select('tenant_id')
    .eq('id', input.organizationId)
    .maybeSingle()
  if (!organization) return { ok: false, message: 'Organisation introuvable.' }

  // Une decision naît SOUMISE, jamais approuvee : l'approbation est un second
  // acte, porte par quelqu'un d'autre sur les types les plus engageants.
  const { error } = await supabase.from('governance_decision').insert({
    tenant_id: organization.tenant_id,
    organization_id: input.organizationId,
    use_case_id: input.useCaseId || null,
    decision_type: input.decisionType,
    subject: input.subject,
    context: input.context || null,
    options_considered: input.optionsConsidered || null,
    decision_statement: input.decisionStatement,
    conditions: input.conditions || null,
    rationale: input.rationale,
    effective_from: input.effectiveFrom || null,
    review_due_at: input.reviewDueAt || null,
    status: 'submitted',
    submitted_by: user.id,
    submitted_at: new Date().toISOString(),
  })

  if (error) return { ok: false, message: explain(error) }

  revalidatePath(`/admin/organizations/${input.organizationId}/decisions`)
  if (input.useCaseId) revalidatePath(`/admin/use-cases/${input.useCaseId}`)
  return {
    ok: true,
    message: 'Décision soumise. Elle attend une approbation — qui ne peut pas être la vôtre sur les décisions les plus engageantes.',
  }
}

// =============================================================================
// Se prononcer
// =============================================================================
const rulingSchema = z
  .object({
    organizationId: z.string().uuid(),
    decisionId: z.string().uuid(),
    useCaseId: z.string().uuid().optional().or(z.literal('')),
    verdict: z.enum(['approved', 'approved_with_conditions', 'rejected']),
    conditions: z.string().trim().max(2000).optional().or(z.literal('')),
    rationale: z.string().trim().min(20, 'Le verdict se motive.').max(2000),
    effectiveFrom: z.string().trim().optional().or(z.literal('')),
    reviewDueAt: z.string().trim().optional().or(z.literal('')),
  })
  .refine((v) => v.verdict !== 'approved_with_conditions' || (v.conditions ?? '').length >= 10, {
    message: 'Une approbation sous conditions énonce ses conditions.',
    path: ['conditions'],
  })

export async function ruleOnDecision(
  _previous: FormState | null,
  formData: FormData,
): Promise<FormState> {
  const parsed = rulingSchema.safeParse({
    organizationId: formData.get('organizationId'),
    decisionId: formData.get('decisionId'),
    useCaseId: formData.get('useCaseId') ?? '',
    verdict: formData.get('verdict'),
    conditions: formData.get('conditions') ?? '',
    rationale: formData.get('rationale'),
    effectiveFrom: formData.get('effectiveFrom') ?? '',
    reviewDueAt: formData.get('reviewDueAt') ?? '',
  })
  if (!parsed.success) return firstIssues(parsed.error)

  const input = parsed.data
  const supabase = await createClient()
  const {
    data: { user },
  } = await supabase.auth.getUser()
  if (!user) return { ok: false, message: 'Session expirée.' }

  const approving = input.verdict !== 'rejected'

  const { data, error } = await supabase
    .from('governance_decision')
    .update({
      status: input.verdict,
      rationale: input.rationale,
      conditions: input.conditions || null,
      approver_user_id: approving ? user.id : null,
      approved_at: approving ? new Date().toISOString() : null,
      effective_from: approving ? input.effectiveFrom || null : null,
      review_due_at: input.reviewDueAt || null,
    })
    .eq('id', input.decisionId)
    .select('id')

  if (error) {
    // La separation des roles est prononcee par la base, avec son message.
    if (error.message.includes('Séparation des rôles')) {
      return {
        ok: false,
        message:
          'Séparation des rôles : l’auteur d’une mise en production, d’une acceptation de risque ou d’une exception ne peut pas l’approuver. Une autre personne doit se prononcer.',
      }
    }
    return { ok: false, message: explain(error) }
  }
  if (!data?.length) return { ok: false, message: 'Votre rôle ne permet pas cette écriture.' }

  revalidatePath(`/admin/organizations/${input.organizationId}/decisions`)
  if (input.useCaseId) revalidatePath(`/admin/use-cases/${input.useCaseId}`)
  return {
    ok: true,
    message: approving
      ? 'Décision approuvée en votre nom, datée et journalisée.'
      : 'Décision rejetée, avec son motif.',
  }
}

// =============================================================================
// Ce sur quoi elle se fonde
// =============================================================================
// Une decision reconstituable est une decision rattachee : risque, controle,
// preuve, evaluation d'impact. Sans ces liens, le registre dit QUI a decide,
// pas SUR QUOI.
const linkSchema = z.object({
  organizationId: z.string().uuid(),
  decisionId: z.string().uuid(),
  targetType: z.enum([
    'risk',
    'control',
    'evidence',
    'impact_assessment',
    'change_request',
    'incident',
    'use_case',
  ]),
  targetId: z.string().uuid('Choisir un élément.'),
  note: z.string().trim().max(500).optional().or(z.literal('')),
})

export async function linkDecisionEvidence(
  _previous: FormState | null,
  formData: FormData,
): Promise<FormState> {
  const parsed = linkSchema.safeParse({
    organizationId: formData.get('organizationId'),
    decisionId: formData.get('decisionId'),
    targetType: formData.get('targetType'),
    targetId: formData.get('targetId'),
    note: formData.get('note') ?? '',
  })
  if (!parsed.success) return firstIssues(parsed.error)

  const supabase = await createClient()
  const { data: organization } = await supabase
    .from('organization')
    .select('tenant_id')
    .eq('id', parsed.data.organizationId)
    .maybeSingle()
  if (!organization) return { ok: false, message: 'Organisation introuvable.' }

  const { error } = await supabase.from('decision_link').insert({
    tenant_id: organization.tenant_id,
    decision_id: parsed.data.decisionId,
    target_type: parsed.data.targetType,
    target_id: parsed.data.targetId,
    note: parsed.data.note || null,
  })

  if (error) {
    if (error.code === '23505') return { ok: false, message: 'Cet élément est déjà rattaché.' }
    return { ok: false, message: explain(error) }
  }

  revalidatePath(`/admin/organizations/${parsed.data.organizationId}/decisions`)
  return { ok: true, message: 'Élément probant rattaché à la décision.' }
}

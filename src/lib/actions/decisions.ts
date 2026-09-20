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
/** Les decisions qui portent un changement sur le systeme. */
const CHANGE_DECISIONS = ['significant_change', 'suspension', 'retirement'] as const
const CHANGE_TYPES = ['MODEL', 'DATASET', 'PURPOSE', 'VENDOR', 'AUTONOMY', 'POPULATION', 'TERRITORY', 'SECURITY', 'DEPLOYMENT'] as const

const submitSchema = z.object({
  organizationId: z.string().uuid(),
  useCaseId: z.string().uuid().optional().or(z.literal('')),
  expectedApproverUserId: z.string().uuid().optional().or(z.literal('')),
  decisionType: z.enum(DECISION_TYPES),
  subject: z.string().trim().min(5, 'Objet trop court.').max(200),
  // Le contexte est exige : une decision sans contexte ne se relit pas.
  context: z.string().trim().min(20, 'Le contexte est exigé : ce qui amène à décider, en une ou deux phrases.').max(2000),
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
  // Ce qui change — pour une decision de changement significatif, de
  // suspension ou de retrait : le changement est cree, lie, et qualifie.
  // Les pieces sur lesquelles la decision se fonde, des la soumission.
  evidenceIds: z.array(z.string().uuid()).optional().default([]),
  changeTypes: z.array(z.enum(CHANGE_TYPES)).optional().default([]),
  increasesAutonomy: z.boolean().optional().default(false),
  newAutonomyLevel: z.enum(['L0', 'L1', 'L2', 'L3', 'L4']).optional().or(z.literal('')),
  changesPurpose: z.boolean().optional().default(false),
  newPopulationAffected: z.boolean().optional().default(false),
  newTerritory: z.boolean().optional().default(false),
  changesPersonalData: z.boolean().optional().default(false),
  changesVendor: z.boolean().optional().default(false),
  changesModel: z.boolean().optional().default(false),
  changesDataset: z.boolean().optional().default(false),
  securityRelevant: z.boolean().optional().default(false),
})

export async function submitDecision(
  _previous: FormState | null,
  formData: FormData,
): Promise<FormState> {
  const parsed = submitSchema.safeParse({
    organizationId: formData.get('organizationId'),
    useCaseId: formData.get('useCaseId') ?? '',
    expectedApproverUserId: formData.get('expectedApproverUserId') ?? '',
    decisionType: formData.get('decisionType'),
    subject: formData.get('subject'),
    context: formData.get('context') ?? '',
    optionsConsidered: formData.get('optionsConsidered') ?? '',
    decisionStatement: formData.get('decisionStatement'),
    conditions: formData.get('conditions') ?? '',
    rationale: formData.get('rationale'),
    effectiveFrom: formData.get('effectiveFrom') ?? '',
    reviewDueAt: formData.get('reviewDueAt') ?? '',
    evidenceIds: formData.getAll('evidenceIds'),
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

  // Une decision de jalon ne se soumet pas sur un jalon ferme : on ne fait pas
  // voter sur ce qui sera refuse. Le gate dit ce qui manque, precondition par
  // precondition (0065).
  const MILESTONES: Record<string, string> = {
    use_case_authorization: 'APPROVED',
    pilot_approval: 'PILOT',
    go_production: 'PRODUCTION',
    suspension: 'SUSPENDED',
    retirement: 'RETIRED',
  }
  const milestone = MILESTONES[input.decisionType]
  if (milestone && input.useCaseId) {
    const { data: gate } = await supabase.rpc('evaluate_gate', { p_use_case_id: input.useCaseId, p_target: milestone })
    const g = gate as { satisfied: boolean; checks: { label: string; satisfied: boolean }[] } | null
    if (g && !g.satisfied) {
      const missing = g.checks.filter((c) => !c.satisfied).map((c) => c.label)
      return {
        ok: false,
        message: `Le jalon n’est pas prêt : ${missing.join(' ; ')}. La décision se soumettra quand les préconditions seront réunies.`,
      }
    }
  }
  // Une mise en production s'appuie sur au moins une preuve validee.
  if (input.decisionType === 'go_production' && !input.evidenceIds.length) {
    return {
      ok: false,
      message: 'Une mise en production s’appuie sur au moins une preuve validée : rattachez-la à la décision.',
      fieldErrors: { evidenceIds: 'Au moins une preuve validée.' },
    }
  }

  // Une decision naît SOUMISE, jamais approuvee : l'approbation est un second
  // acte, porte par quelqu'un d'autre sur les types les plus engageants.
  const { data: decision, error } = await supabase
    .from('governance_decision')
    .insert({
      tenant_id: organization.tenant_id,
      organization_id: input.organizationId,
      use_case_id: input.useCaseId || null,
      expected_approver_user_id: input.expectedApproverUserId || null,
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
    .select('id')
    .single()

  if (error) {
    if (error.message.includes('appelée à se prononcer')) {
      return {
        ok: false,
        message:
          'Sur ce type de décision, vous ne pouvez pas vous désigner vous-même : une autre personne doit se prononcer.',
        fieldErrors: { expectedApproverUserId: 'Choisir quelqu’un d’autre.' },
      }
    }
    return { ok: false, message: explain(error) }
  }

  // Les pieces rattachees des la soumission : c'est sur elles qu'on se
  // prononcera, et c'est ce qu'un auditeur lira.
  if (input.evidenceIds.length) {
    await supabase.from('decision_link').insert(
      input.evidenceIds.map((evidenceId) => ({
        tenant_id: organization.tenant_id,
        decision_id: decision.id,
        target_type: 'evidence' as const,
        target_id: evidenceId,
        note: 'Rattachée à la soumission.',
      })),
    )
  }

  // Une decision de changement significatif, de suspension ou de retrait
  // porte un CHANGEMENT : il est cree, lie a la decision — pour qu'aucune
  // seconde decision ne s'ouvre d'elle-meme (0063) — puis qualifie par le
  // moteur de reevaluation. On declare une fois.
  let changeNote = ''
  if ((CHANGE_DECISIONS as readonly string[]).includes(input.decisionType) && input.useCaseId) {
    const kinds =
      input.changeTypes.length ? input.changeTypes : (['DEPLOYMENT'] as (typeof CHANGE_TYPES)[number][])
    const { data: change, error: changeError } = await supabase
      .from('change_request')
      .insert({
        tenant_id: organization.tenant_id,
        organization_id: input.organizationId,
        use_case_id: input.useCaseId,
        title: input.subject,
        description: input.decisionStatement,
        change_types: kinds,
        increases_autonomy: input.increasesAutonomy,
        new_autonomy_level: input.increasesAutonomy ? input.newAutonomyLevel || null : null,
        changes_purpose: input.changesPurpose,
        new_population_affected: input.newPopulationAffected,
        new_territory: input.newTerritory,
        changes_personal_data: input.changesPersonalData,
        changes_vendor: input.changesVendor,
        changes_model: input.changesModel,
        changes_dataset: input.changesDataset,
        security_relevant: input.securityRelevant || input.decisionType !== 'significant_change',
        status: 'DRAFT',
        requested_by: user.id,
        planned_at: input.effectiveFrom || null,
      })
      .select('id, business_ref')
      .single()
    if (changeError) {
      changeNote = ` Le changement qu’elle porte n’a pas pu être créé : ${explain(changeError)}`
    } else {
      await supabase.from('decision_link').insert({
        tenant_id: organization.tenant_id,
        decision_id: decision.id,
        target_type: 'change_request',
        target_id: change.id,
        note: 'Le changement que cette décision porte.',
      })
      const { data: screening } = await supabase.rpc('screen_change_request', { p_change_request_id: change.id })
      const verdict = (screening as { verdict?: string } | null)?.verdict
      changeNote = ` Le changement ${change.business_ref} est créé et lié${
        verdict
          ? ` ; la réévaluation conclut : ${
              verdict === 'FULL_REASSESSMENT' ? 'complète' : verdict === 'PARTIAL_REASSESSMENT' ? 'partielle' : 'aucune'
            }.`
          : '.'
      }`
    }
  }

  revalidatePath(`/admin/organizations/${input.organizationId}/decisions`)
  if (input.useCaseId) revalidatePath(`/admin/use-cases/${input.useCaseId}`)
  return {
    ok: true,
    message:
      (milestone
        ? 'Décision soumise. Approuvée, elle franchira le jalon qu’elle porte — à sa date d’effet.'
        : 'Décision soumise. Elle attend une approbation — qui ne peut pas être la vôtre sur les décisions les plus engageantes.') +
      changeNote,
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

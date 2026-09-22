'use server'

import { revalidatePath } from 'next/cache'
import { redirect } from 'next/navigation'
import { z } from 'zod'
import { createClient } from '@/lib/supabase/server'
import { factsFromGrid } from '@/lib/domain/criticality'

/**
 * Saisie des objets de gouvernance.
 *
 * Ces actions valident la FORME de l'entree et delegent le reste. Les regles
 * — cotation d'un risque, complétude d'une classification, acceptation
 * nominative, transitions — vivent en base et s'appliquent quel que soit le
 * chemin. Une erreur renvoyee par Postgres est donc une reponse metier, pas un
 * incident : on la presente telle quelle plutot que de la masquer.
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

/** Traduit une erreur Postgres en message lisible, sans en inventer le sens. */
function explain(error: { message: string; code?: string }): string {
  if (error.code === '23505') return 'Cet élément existe déjà.'
  if (error.message.includes('row-level security')) {
    return "Votre rôle ne permet pas cette écriture."
  }
  // Les messages de nos triggers et contraintes sont ecrits pour etre lus.
  const raise = error.message.match(/^(?:.*?:\s)?([A-ZÀ-Ü][^\n]*)$/m)
  return raise?.[1] ?? error.message
}

// =============================================================================
// Cartographie : processus et activités
// =============================================================================
const processSchema = z.object({
  organizationId: z.string().uuid(),
  name: z.string().trim().min(2, 'Nom trop court.').max(160),
  code: z.string().trim().max(16).optional().or(z.literal('')),
  category: z.enum(['management', 'core', 'support']),
  description: z.string().trim().max(1000).optional().or(z.literal('')),
})

export async function createProcess(_previous: FormState | null, formData: FormData): Promise<FormState> {
  const parsed = processSchema.safeParse({
    organizationId: formData.get('organizationId'),
    name: formData.get('name'),
    code: formData.get('code') ?? '',
    category: formData.get('category') ?? 'core',
    description: formData.get('description') ?? '',
  })
  if (!parsed.success) return firstIssues(parsed.error)

  const supabase = await createClient()
  const { data: organization } = await supabase
    .from('organization')
    .select('tenant_id')
    .eq('id', parsed.data.organizationId)
    .maybeSingle()

  if (!organization) return { ok: false, message: 'Organisation introuvable.' }

  const { error } = await supabase.from('process').insert({
    tenant_id: organization.tenant_id,
    organization_id: parsed.data.organizationId,
    name: parsed.data.name,
    code: parsed.data.code || null,
    category: parsed.data.category,
    description: parsed.data.description || null,
  })

  if (error) return { ok: false, message: explain(error) }

  revalidatePath(`/admin/organizations/${parsed.data.organizationId}/processus`)
  return { ok: true, message: `Processus « ${parsed.data.name} » créé.` }
}

const activitySchema = z.object({
  organizationId: z.string().uuid(),
  processId: z.string().uuid(),
  name: z.string().trim().min(2, 'Nom trop court.').max(160),
  description: z.string().trim().max(1000).optional().or(z.literal('')),
})

export async function createActivity(_previous: FormState | null, formData: FormData): Promise<FormState> {
  const parsed = activitySchema.safeParse({
    organizationId: formData.get('organizationId'),
    processId: formData.get('processId'),
    name: formData.get('name'),
    description: formData.get('description') ?? '',
  })
  if (!parsed.success) return firstIssues(parsed.error)

  const supabase = await createClient()
  const { data: organization } = await supabase
    .from('organization')
    .select('tenant_id')
    .eq('id', parsed.data.organizationId)
    .maybeSingle()

  if (!organization) return { ok: false, message: 'Organisation introuvable.' }

  const { error } = await supabase.from('activity').insert({
    tenant_id: organization.tenant_id,
    organization_id: parsed.data.organizationId,
    process_id: parsed.data.processId,
    name: parsed.data.name,
    description: parsed.data.description || null,
  })

  if (error) return { ok: false, message: explain(error) }

  revalidatePath(`/admin/organizations/${parsed.data.organizationId}/processus`)
  return { ok: true, message: `Activité « ${parsed.data.name} » créée.` }
}

// =============================================================================
// Intake d'un cas d'usage
// =============================================================================
const useCaseSchema = z.object({
  organizationId: z.string().uuid(),
  activityId: z.string().uuid().optional().or(z.literal('')),
  name: z.string().trim().min(3, 'Nom trop court.').max(200),
  purpose: z.string().trim().min(20, 'Décrivez la finalité en une ou deux phrases.').max(2000),
  expectedBenefit: z.string().trim().max(1000).optional().or(z.literal('')),
  ownerUserId: z.string().uuid({ message: 'Désignez un propriétaire.' }),
  accountableUserId: z.string().uuid({ message: 'Désignez un responsable redevable.' }),
  usersDescription: z.string().trim().max(1000).optional().or(z.literal('')),
  affectedPersons: z.string().trim().max(1000).optional().or(z.literal('')),
  dataDescription: z.string().trim().max(2000).optional().or(z.literal('')),
  involvesPersonalData: z.coerce.boolean(),
  involvesVulnerablePersons: z.coerce.boolean(),
  autonomyLevel: z.enum(['L0', 'L1', 'L2', 'L3', 'L4']),
  decisionImpact: z.string().trim().max(1000).optional().or(z.literal('')),
})

export async function createUseCase(_previous: FormState | null, formData: FormData): Promise<FormState> {
  const parsed = useCaseSchema.safeParse({
    organizationId: formData.get('organizationId'),
    activityId: formData.get('activityId') ?? '',
    name: formData.get('name'),
    purpose: formData.get('purpose'),
    expectedBenefit: formData.get('expectedBenefit') ?? '',
    ownerUserId: formData.get('ownerUserId'),
    accountableUserId: formData.get('accountableUserId'),
    usersDescription: formData.get('usersDescription') ?? '',
    affectedPersons: formData.get('affectedPersons') ?? '',
    dataDescription: formData.get('dataDescription') ?? '',
    involvesPersonalData: formData.get('involvesPersonalData') === 'on',
    involvesVulnerablePersons: formData.get('involvesVulnerablePersons') === 'on',
    autonomyLevel: formData.get('autonomyLevel') ?? 'L0',
    decisionImpact: formData.get('decisionImpact') ?? '',
  })
  if (!parsed.success) return firstIssues(parsed.error)

  const d = parsed.data
  const supabase = await createClient()

  const { data: organization } = await supabase
    .from('organization')
    .select('tenant_id')
    .eq('id', d.organizationId)
    .maybeSingle()
  if (!organization) return { ok: false, message: 'Organisation introuvable.' }

  const { data: created, error } = await supabase
    .from('ai_use_case')
    .insert({
      tenant_id: organization.tenant_id,
      organization_id: d.organizationId,
      activity_id: d.activityId || null,
      name: d.name,
      purpose: d.purpose,
      expected_benefit: d.expectedBenefit || null,
      owner_user_id: d.ownerUserId,
      accountable_user_id: d.accountableUserId,
      users_description: d.usersDescription || null,
      affected_persons: d.affectedPersons || null,
      data_description: d.dataDescription || null,
      involves_personal_data: d.involvesPersonalData,
      involves_vulnerable_persons: d.involvesVulnerablePersons,
      autonomy_level: d.autonomyLevel,
      decision_impact: d.decisionImpact || null,
    })
    .select('id')
    .single()

  if (error) return { ok: false, message: explain(error) }

  redirect(`/admin/use-cases/${created.id}`)
}

// =============================================================================
// Triage
// =============================================================================
const triageSchema = z.object({
  useCaseId: z.string().uuid(),
  criticality: z.enum(['low', 'moderate', 'high', 'critical']),
  decisionImpact: z.string().trim().max(1000).optional().or(z.literal('')),
  nextReviewAt: z.string().trim().optional().or(z.literal('')),
  rationale: z.string().trim().min(10, 'Justifiez la criticité retenue.').max(2000),
  grid: z.record(z.string(), z.string()),
})

export async function saveTriage(_previous: FormState | null, formData: FormData): Promise<FormState> {
  // La grille : quatre reponses, chacune un champ `grid.<question>`.
  const grid: Record<string, string> = {}
  for (const [key, value] of formData.entries()) {
    if (key.startsWith('grid.') && typeof value === 'string' && value) grid[key.slice(5)] = value
  }
  const parsed = triageSchema.safeParse({
    useCaseId: formData.get('useCaseId'),
    criticality: formData.get('criticality'),
    decisionImpact: formData.get('decisionImpact') ?? '',
    nextReviewAt: formData.get('nextReviewAt') ?? '',
    rationale: formData.get('rationale'),
    grid,
  })
  if (!parsed.success) return firstIssues(parsed.error)

  const d = parsed.data
  const supabase = await createClient()

  const { data: useCase } = await supabase
    .from('ai_use_case')
    .select('tenant_id, organization_id, criticality, involves_personal_data, involves_sensitive_data, involves_vulnerable_persons')
    .eq('id', d.useCaseId)
    .maybeSingle()
  if (!useCase) return { ok: false, message: 'Cas d’usage introuvable.' }

  // La grille CONSTATE des faits : la fiche les porte, et les regles les
  // lisent (0082). On ne decoche jamais — une case peut etre vraie pour
  // d'autres raisons ; « Modifier la fiche » sert a cela.
  const facts = factsFromGrid(d.grid)
  const raised: string[] = []
  const lowered: string[] = []
  const note = (label: string, next: boolean | undefined, current: boolean) => {
    if (next === undefined || next === current) return
    ;(next ? raised : lowered).push(label)
  }
  note('données sensibles', facts.sensitiveData, useCase.involves_sensitive_data)
  note('données personnelles', facts.personalData, useCase.involves_personal_data)
  note('personnes vulnérables', facts.vulnerablePersons, useCase.involves_vulnerable_persons)

  const {
    data: { user },
  } = await supabase.auth.getUser()

  const { error } = await supabase
    .from('ai_use_case')
    .update({
      criticality: d.criticality,
      involves_personal_data: facts.personalData ?? useCase.involves_personal_data,
      involves_sensitive_data: facts.sensitiveData ?? useCase.involves_sensitive_data,
      involves_vulnerable_persons: facts.vulnerablePersons ?? useCase.involves_vulnerable_persons,
      criticality_rationale: d.rationale,
      criticality_grid: d.grid,
      criticality_set_at: new Date().toISOString(),
      criticality_set_by: user?.id ?? null,
      decision_impact: d.decisionImpact || null,
      next_review_at: d.nextReviewAt || null,
    })
    .eq('id', d.useCaseId)

  if (error) return { ok: false, message: explain(error) }

  // Le triage est une evaluation : il laisse une trace, avec sa justification.
  const { error: assessmentError } = await supabase.from('assessment').insert({
    tenant_id: useCase.tenant_id,
    organization_id: useCase.organization_id,
    use_case_id: d.useCaseId,
    kind: 'triage',
    status: 'completed',
    completed_at: new Date().toISOString(),
  })

  if (assessmentError) return { ok: false, message: explain(assessmentError) }

  revalidatePath(`/admin/use-cases/${d.useCaseId}`)
  const base = useCase.criticality
    ? 'Criticité révisée.'
    : 'Criticité enregistrée. Le cas d’usage peut passer en évaluation.'
  const said = [
    raised.length
      ? `inscrit ${raised.join(', ')} — l’évaluation d’impact devient exigée${
          facts.sensitiveData ? ', avec l’AIPD (article 9 du RGPD)' : ''
        }, et les contrôles correspondants se proposent`
      : null,
    lowered.length ? `retire ${lowered.join(', ')} — ce qui en découlait cesse de s’appliquer` : null,
  ].filter(Boolean)

  return {
    ok: true,
    message: said.length ? `${base} La grille ${said.join(' ; elle ')}.` : base,
  }
}

// =============================================================================
// Pré-classification réglementaire
// =============================================================================
const CLASSIFICATION_FLAGS = [
  'out_of_scope',
  'to_confirm',
  'prohibited_practice_suspected',
  'high_risk_potential',
  'transparency_obligations',
  'gpai_dependency',
  'privacy_impact',
  'security_impact',
] as const

const classificationSchema = z.object({
  useCaseId: z.string().uuid(),
  organizationRole: z.enum(['provider', 'deployer', 'importer', 'distributor', 'other', 'undetermined']),
  flags: z.array(z.enum(CLASSIFICATION_FLAGS)).min(1, 'Retenez au moins une qualification.'),
  rationale: z.string().trim().min(30, 'La justification doit pouvoir être relue par un juriste.').max(4000),
  legalReviewLevel: z.enum(['none', 'internal_review', 'external_counsel_required']),
  legalReviewCompleted: z.coerce.boolean(),
  frameworkVersion: z.string().trim().min(1).max(40),
  nextReviewAt: z.string().trim().optional().or(z.literal('')),
})

export async function saveClassification(
  _previous: FormState | null,
  formData: FormData,
): Promise<FormState> {
  const parsed = classificationSchema.safeParse({
    useCaseId: formData.get('useCaseId'),
    organizationRole: formData.get('organizationRole') ?? 'undetermined',
    flags: formData.getAll('flags'),
    rationale: formData.get('rationale'),
    legalReviewLevel: formData.get('legalReviewLevel') ?? 'internal_review',
    legalReviewCompleted: formData.get('legalReviewCompleted') === 'on',
    frameworkVersion: formData.get('frameworkVersion') ?? '2024/1689',
    nextReviewAt: formData.get('nextReviewAt') ?? '',
  })
  if (!parsed.success) return firstIssues(parsed.error)

  const d = parsed.data
  const supabase = await createClient()

  const {
    data: { user },
  } = await supabase.auth.getUser()

  const { data: useCase } = await supabase
    .from('ai_use_case')
    .select('tenant_id, organization_id, involves_personal_data, involves_sensitive_data')
    .eq('id', d.useCaseId)
    .maybeSingle()
  if (!useCase) return { ok: false, message: 'Cas d’usage introuvable.' }

  // Une classification remplace la precedente sans l'effacer : l'index unique
  // partiel n'admet qu'une seule courante, l'historique reste consultable.
  const { error: supersedeError } = await supabase
    .from('regulatory_classification')
    .update({ is_current: false })
    .eq('use_case_id', d.useCaseId)
    .eq('is_current', true)

  if (supersedeError) return { ok: false, message: explain(supersedeError) }

  const { error } = await supabase.from('regulatory_classification').insert({
    tenant_id: useCase.tenant_id,
    organization_id: useCase.organization_id,
    use_case_id: d.useCaseId,
    framework_code: 'EU_AI_ACT',
    framework_version: d.frameworkVersion,
    organization_role: d.organizationRole,
    flags: d.flags,
    rationale: d.rationale,
    legal_review_level: d.legalReviewLevel,
    legal_review_completed: d.legalReviewCompleted,
    legal_reviewer_id: d.legalReviewCompleted ? (user?.id ?? null) : null,
    legal_review_at: d.legalReviewCompleted ? new Date().toISOString() : null,
    classified_by: user?.id ?? null,
    next_review_at: d.nextReviewAt || null,
    is_current: true,
  })

  if (error) return { ok: false, message: explain(error) }

  // « Impact sur la vie privée » constate des données personnelles : la fiche
  // le porte, et l'évaluation d'impact en découle (0082). On ne décoche pas.
  const privacy = d.flags.includes('privacy_impact')
  const raisesPrivacy = privacy && !useCase.involves_personal_data && !useCase.involves_sensitive_data
  if (raisesPrivacy) {
    await supabase.from('ai_use_case').update({ involves_personal_data: true }).eq('id', d.useCaseId)
  }

  // Ce que les qualifications retenues engagent, dit au moment du geste.
  const engaged: string[] = []
  if (d.flags.includes('prohibited_practice_suspected')) engaged.push('« pratique interdite suspectée » bloque le passage en Revue et en Production')
  if (d.flags.includes('to_confirm')) engaged.push('« à confirmer » bloque les jalons tant qu’elle est cochée')
  if (d.flags.includes('high_risk_potential')) engaged.push('« haut risque potentiel » rend l’évaluation d’impact exigée et resserre la cadence de revue')
  if (raisesPrivacy) engaged.push('« impact sur la vie privée » inscrit des données personnelles sur la fiche et rend l’évaluation d’impact exigée')
  else if (privacy) engaged.push('« impact sur la vie privée » propose les contrôles de catégories particulières')
  if (d.flags.includes('security_impact')) engaged.push('« impact sur la sécurité » propose trois contrôles de sécurité')
  if (d.flags.includes('transparency_obligations')) engaged.push('« obligations de transparence » propose l’information des personnes (article 50)')
  if (d.flags.includes('out_of_scope')) engaged.push('« hors périmètre » ne lève aucune exigence : la gouvernance interne reste due')

  revalidatePath(`/admin/use-cases/${d.useCaseId}`)
  return {
    ok: true,
    message: engaged.length
      ? `Qualification enregistrée — cadrage, non avis juridique. Ce qu’elle engage : ${engaged.join(' ; ')}.`
      : 'Qualification enregistrée. Elle vaut cadrage, non avis juridique : la revue reste requise selon le niveau retenu.',
  }
}

// =============================================================================
// Risques
// =============================================================================
const RISK_CATEGORIES = [
  'fundamental_rights', 'safety', 'security', 'privacy', 'bias_discrimination',
  'transparency', 'accuracy_robustness', 'operational', 'financial',
  'reputational', 'legal_compliance', 'environmental', 'third_party',
] as const

const riskSchema = z.object({
  useCaseId: z.string().uuid(),
  title: z.string().trim().min(5, 'Titre trop court.').max(200),
  scenario: z.string().trim().min(30, 'Décrivez le scénario : ce qui arrive, à qui, et comment.').max(2000),
  category: z.enum(RISK_CATEGORIES),
  inherentLikelihood: z.coerce.number().int().min(1).max(5),
  inherentImpact: z.coerce.number().int().min(1).max(5),
  ownerUserId: z.string().uuid({ message: 'Désignez un responsable du risque.' }),
  nextReviewAt: z.string().trim().optional().or(z.literal('')),
  // Facultatif : le controle qui traitera le risque, si on le sait deja. Il
  // ouvre un traitement « planifie », porte par le responsable du risque.
  controlId: z.string().uuid().optional().or(z.literal('')),
})

export async function createRisk(_previous: FormState | null, formData: FormData): Promise<FormState> {
  const parsed = riskSchema.safeParse({
    useCaseId: formData.get('useCaseId'),
    title: formData.get('title'),
    scenario: formData.get('scenario'),
    category: formData.get('category'),
    inherentLikelihood: formData.get('inherentLikelihood'),
    inherentImpact: formData.get('inherentImpact'),
    ownerUserId: formData.get('ownerUserId'),
    nextReviewAt: formData.get('nextReviewAt') ?? '',
    controlId: formData.get('controlId') ?? '',
  })
  if (!parsed.success) return firstIssues(parsed.error)

  const d = parsed.data
  const supabase = await createClient()

  const { data: useCase } = await supabase
    .from('ai_use_case')
    .select('tenant_id, organization_id')
    .eq('id', d.useCaseId)
    .maybeSingle()
  if (!useCase) return { ok: false, message: 'Cas d’usage introuvable.' }

  const { data: risk, error } = await supabase
    .from('risk')
    .insert({
      tenant_id: useCase.tenant_id,
      organization_id: useCase.organization_id,
      use_case_id: d.useCaseId,
      title: d.title,
      scenario: d.scenario,
      category: d.category,
      // Le niveau est calcule par la base : le saisir serait le laisser diverger.
      inherent_likelihood: d.inherentLikelihood,
      inherent_impact: d.inherentImpact,
      owner_user_id: d.ownerUserId,
      status: 'identified',
      next_review_at: d.nextReviewAt || null,
    })
    .select('id')
    .single()

  if (error) return { ok: false, message: explain(error) }

  // Un controle designe des l'identification ouvre le traitement : planifie,
  // strategie « reduire », porte par le responsable du risque. Le recoter
  // restera a faire une fois le controle operant.
  if (d.controlId) {
    const { data: control } = await supabase
      .from('control')
      .select('code, name')
      .eq('id', d.controlId)
      .maybeSingle()
    const { error: treatmentError } = await supabase.from('risk_treatment').insert({
      tenant_id: useCase.tenant_id,
      risk_id: risk.id,
      strategy: 'reduce',
      description: `Mise en œuvre du contrôle ${control?.code ?? ''} — ${control?.name ?? ''}, désigné à l’identification du risque.`,
      owner_user_id: d.ownerUserId,
      control_id: d.controlId,
    })
    if (treatmentError) {
      revalidatePath(`/admin/use-cases/${d.useCaseId}`)
      return { ok: false, message: `Risque enregistré, mais le traitement n’a pas été ouvert : ${explain(treatmentError)}` }
    }
  }

  revalidatePath(`/admin/use-cases/${d.useCaseId}`)
  return {
    ok: true,
    message: d.controlId
      ? 'Risque enregistré et coté ; un traitement est ouvert sur le contrôle désigné.'
      : 'Risque enregistré et coté.',
  }
}

const acceptRiskSchema = z.object({
  riskId: z.string().uuid(),
  useCaseId: z.string().uuid(),
  rationale: z.string().trim().min(30, "Une acceptation se justifie : dites pourquoi le risque est tenable.").max(2000),
  reviewAt: z.string().trim().min(1, 'Une acceptation porte une date de revue.'),
})

export async function acceptRisk(_previous: FormState | null, formData: FormData): Promise<FormState> {
  const parsed = acceptRiskSchema.safeParse({
    riskId: formData.get('riskId'),
    useCaseId: formData.get('useCaseId'),
    rationale: formData.get('rationale'),
    reviewAt: formData.get('reviewAt'),
  })
  if (!parsed.success) return firstIssues(parsed.error)

  const supabase = await createClient()
  const {
    data: { user },
  } = await supabase.auth.getUser()

  if (!user) return { ok: false, message: 'Session expirée.' }

  // La contrainte risk_acceptance_requires_human refuserait une acceptation
  // sans approbateur, justification et date de revue. On les fournit ensemble.
  const { error } = await supabase
    .from('risk')
    .update({
      status: 'accepted',
      accepted_by: user.id,
      accepted_at: new Date().toISOString(),
      acceptance_rationale: parsed.data.rationale,
      acceptance_review_at: parsed.data.reviewAt,
    })
    .eq('id', parsed.data.riskId)

  if (error) return { ok: false, message: explain(error) }

  revalidatePath(`/admin/use-cases/${parsed.data.useCaseId}`)
  // Eleve ou critique : la base a ouvert une decision d'acceptation, que
  // quelqu'un d'autre doit approuver pour que le risque compte comme solde.
  const { data: level } = await supabase
    .from('risk')
    .select('inherent_level, residual_level')
    .eq('id', parsed.data.riskId)
    .maybeSingle()
  const severe = ['high', 'critical'].includes((level?.residual_level ?? level?.inherent_level) as string)
  return {
    ok: true,
    message: severe
      ? 'Risque accepté, sous votre responsabilité. Une décision « acceptation de risque » est soumise : elle doit être approuvée par quelqu’un d’autre pour que le risque compte comme soldé au gate de production.'
      : 'Risque accepté, sous votre responsabilité et avec une date de revue.',
  }
}

// =============================================================================
// Rôle de l'organisation vis-à-vis de l'IA
// =============================================================================
// Ce n'est pas une categorie descriptive : il commande les typologies de
// preuves attendues, leur criticite, et donc le regime de preuve exige par la
// Declaration d'Applicabilite. Le changer requalifie tout le dossier — d'ou le
// fait qu'il se modifie ici, sur la fiche du client, et non enfoui dans un
// ecran d'administration.
const activityProfileSchema = z.object({
  organizationId: z.string().uuid(),
  activityProfile: z.enum([
    'infrastructure_host',
    'model_developer',
    'integrator_consultant',
    'business_user',
  ]),
})

export async function setActivityProfile(
  _previous: FormState | null,
  formData: FormData,
): Promise<FormState> {
  const parsed = activityProfileSchema.safeParse({
    organizationId: formData.get('organizationId'),
    activityProfile: formData.get('activityProfile'),
  })
  if (!parsed.success) return firstIssues(parsed.error)

  const supabase = await createClient()
  // `select` apres `update` n'est pas decoratif : une ecriture ecartee par la
  // RLS ne leve aucune erreur, elle ne touche aucune ligne. Sans relire ce qui
  // est revenu, l'ecran annoncerait un enregistrement qui n'a pas eu lieu.
  const { data, error } = await supabase
    .from('organization')
    .update({ ai_activity_profile: parsed.data.activityProfile })
    .eq('id', parsed.data.organizationId)
    .select('id')

  if (error) return { ok: false, message: explain(error) }
  if (!data?.length) {
    return {
      ok: false,
      message: 'Votre rôle ne permet pas de modifier le rôle de cette organisation.',
    }
  }

  revalidatePath(`/admin/organizations/${parsed.data.organizationId}`)
  revalidatePath(`/admin/organizations/${parsed.data.organizationId}/preuves`)
  revalidatePath(`/admin/organizations/${parsed.data.organizationId}/declaration-applicabilite`)
  return {
    ok: true,
    message:
      'Rôle enregistré. Les typologies de preuves attendues et le régime exigé par la Déclaration d’Applicabilité sont recalculés.',
  }
}

// =============================================================================
// Corriger la fiche d'un cas d'usage
// =============================================================================
// Un cas d'usage se declare une fois et se relit pendant des annees. Entre les
// deux, une finalite se reformule, un proprietaire change de poste, la
// description des donnees s'affine. Rien de cela n'est une decision de
// gouvernance ; tout cela restait pourtant fige depuis l'intake.
//
// LA LIGNE DE PARTAGE : ce qui DECRIT se corrige ici, ce qui QUALIFIE passe par
// l'acte qui lui est propre. Restent donc dehors — et dans leur ecran, date et
// justifie : la criticite (pre-classification), le niveau d'autonomie et la
// classification reglementaire, les donnees personnelles et les personnes
// vulnerables (ils declenchent l'evaluation d'impact et pesent sur le gate
// REVUE), le statut (transition motivee). Les corriger par un formulaire
// d'etiquette reviendrait a reclasser un systeme sans le dire.
const useCaseLabelSchema = z.object({
  useCaseId: z.string().uuid(),
  name: z.string().trim().min(3, 'Nom trop court.').max(200),
  purpose: z.string().trim().min(20, 'Décrivez la finalité en une ou deux phrases.').max(2000),
  expectedBenefit: z.string().trim().max(1000).optional().or(z.literal('')),
  ownerUserId: z.string().uuid({ message: 'Désignez un propriétaire.' }),
  accountableUserId: z.string().uuid({ message: 'Désignez un responsable redevable.' }),
  usersDescription: z.string().trim().max(1000).optional().or(z.literal('')),
  affectedPersons: z.string().trim().max(1000).optional().or(z.literal('')),
  dataDescription: z.string().trim().max(2000).optional().or(z.literal('')),
  decisionImpact: z.string().trim().max(1000).optional().or(z.literal('')),
})

export async function updateUseCaseLabels(
  _previous: FormState | null,
  formData: FormData,
): Promise<FormState> {
  const parsed = useCaseLabelSchema.safeParse({
    useCaseId: formData.get('useCaseId'),
    name: formData.get('name'),
    purpose: formData.get('purpose'),
    expectedBenefit: formData.get('expectedBenefit') ?? '',
    ownerUserId: formData.get('ownerUserId'),
    accountableUserId: formData.get('accountableUserId'),
    usersDescription: formData.get('usersDescription') ?? '',
    affectedPersons: formData.get('affectedPersons') ?? '',
    dataDescription: formData.get('dataDescription') ?? '',
    decisionImpact: formData.get('decisionImpact') ?? '',
  })
  if (!parsed.success) return firstIssues(parsed.error)

  const d = parsed.data
  const supabase = await createClient()
  const { data, error } = await supabase
    .from('ai_use_case')
    .update({
      name: d.name,
      purpose: d.purpose,
      expected_benefit: d.expectedBenefit || null,
      owner_user_id: d.ownerUserId,
      accountable_user_id: d.accountableUserId,
      users_description: d.usersDescription || null,
      affected_persons: d.affectedPersons || null,
      data_description: d.dataDescription || null,
      decision_impact: d.decisionImpact || null,
    })
    .eq('id', d.useCaseId)
    .select('id')

  if (error) return { ok: false, message: explain(error) }
  if (!data?.length) return { ok: false, message: 'Votre rôle ne permet pas cette écriture.' }

  revalidatePath(`/admin/use-cases/${d.useCaseId}`)
  return {
    ok: true,
    message: 'Fiche corrigée. La qualification et le statut restent ce qu’ils étaient.',
  }
}

// =============================================================================
// Rattacher un cas d'usage existant a une activite
// =============================================================================
// Un cas d'usage declare depuis la vue d'ensemble n'est rattache a aucune
// activite : il flotte. Le « + » de la carte sert d'abord a le poser au bon
// endroit — declarer un nouveau cas d'usage est l'autre geste, pas le meme.
//
// Le rattachement decrit ; il ne qualifie rien. Il n'en est pas moins
// journalise (migration 0033).
const attachSchema = z.object({
  organizationId: z.string().uuid(),
  activityId: z.string().uuid(),
  useCaseId: z.string().uuid({ message: 'Choisir un cas d’usage.' }),
})

export async function attachUseCaseToActivity(
  _previous: FormState | null,
  formData: FormData,
): Promise<FormState> {
  const parsed = attachSchema.safeParse({
    organizationId: formData.get('organizationId'),
    activityId: formData.get('activityId'),
    useCaseId: formData.get('useCaseId'),
  })
  if (!parsed.success) return firstIssues(parsed.error)

  const supabase = await createClient()
  const { data, error } = await supabase
    .from('ai_use_case')
    .update({ activity_id: parsed.data.activityId })
    .eq('id', parsed.data.useCaseId)
    .eq('organization_id', parsed.data.organizationId)
    .select('id, name')

  if (error) return { ok: false, message: explain(error) }
  if (!data?.length) return { ok: false, message: 'Votre rôle ne permet pas cette écriture.' }

  revalidatePath(`/admin/organizations/${parsed.data.organizationId}/processus`)
  revalidatePath(`/admin/use-cases/${parsed.data.useCaseId}`)
  return { ok: true, message: `« ${data[0]!.name} » rattaché à cette activité.` }
}

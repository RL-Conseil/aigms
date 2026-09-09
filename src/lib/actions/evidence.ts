'use server'

import { createHash } from 'node:crypto'
import { revalidatePath } from 'next/cache'
import { z } from 'zod'
import { createClient } from '@/lib/supabase/server'
import { EVIDENCE_BUCKET, MAX_EVIDENCE_BYTES } from '@/lib/storage/evidence'

/**
 * Depot et validation des preuves.
 *
 * Le fichier part vers le stockage AVANT la ligne de preuve, parce que c'est le
 * seul ordre qui ne peut pas produire une preuve qui reference un objet absent.
 * L'ordre inverse — ligne d'abord — laisserait, au moindre echec de televersement,
 * une preuve qui pretend exister sans rien derriere.
 *
 * Si l'insertion echoue ensuite, l'objet televerse est retire : un fichier
 * orphelin dans un compartiment de preuves est une donnee client qui traine
 * sans titulaire, pas un simple dechet technique.
 *
 * Le chemin est DERIVE ici et verifie en base (`app.guard_evidence_file`). Les
 * deux, parce qu'une regle d'isolation qui ne vit que dans l'application
 * disparait des qu'on appelle PostgREST directement.
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
  const raise = error.message.match(/^(?:.*?:\s)?([A-ZÀ-Ü][^\n]*)$/m)
  return raise?.[1] ?? error.message
}

/**
 * Nom de fichier sur : on conserve ce qui se lit, on neutralise le reste.
 * Le nom d'origine reste stocke dans `file_name` — c'est lui qui s'affiche.
 */
function safeFileName(name: string): string {
  const cleaned = name
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .replace(/[^a-zA-Z0-9._-]+/g, '-')
    .replace(/^-+|-+$/g, '')
    .slice(0, 120)
  return cleaned || 'document'
}

const uploadSchema = z.object({
  organizationId: z.string().uuid(),
  title: z.string().trim().min(3, 'Titre trop court.').max(200),
  evidenceType: z.enum([
    'document',
    'screenshot',
    'log_extract',
    'attestation',
    'test_result',
    'configuration',
    'declarative',
  ]),
  source: z.string().trim().min(2, 'Indiquer d’où vient cette preuve.').max(160),
  version: z.string().trim().max(40).optional().or(z.literal('')),
  validUntil: z.string().trim().optional().or(z.literal('')),
  externalUrl: z.string().trim().url('Adresse invalide.').max(500).optional().or(z.literal('')),
  controlId: z.string().uuid().optional().or(z.literal('')),
  typologyId: z.string().uuid().optional().or(z.literal('')),
})

export async function uploadEvidence(
  _previous: FormState | null,
  formData: FormData,
): Promise<FormState> {
  const parsed = uploadSchema.safeParse({
    organizationId: formData.get('organizationId'),
    title: formData.get('title'),
    evidenceType: formData.get('evidenceType') ?? 'document',
    source: formData.get('source'),
    version: formData.get('version') ?? '',
    validUntil: formData.get('validUntil') ?? '',
    externalUrl: formData.get('externalUrl') ?? '',
    controlId: formData.get('controlId') ?? '',
    typologyId: formData.get('typologyId') ?? '',
  })
  if (!parsed.success) return firstIssues(parsed.error)

  const input = parsed.data
  const file = formData.get('file')
  const hasFile = file instanceof File && file.size > 0

  if (!hasFile && !input.externalUrl && input.evidenceType !== 'declarative') {
    return {
      ok: false,
      message:
        'Une preuve doit être atteignable : déposer un fichier, donner un lien, ou la déclarer comme « déclarative ».',
      fieldErrors: { file: 'Fichier ou lien attendu.' },
    }
  }

  if (hasFile && file.size > MAX_EVIDENCE_BYTES) {
    return {
      ok: false,
      message: 'Fichier trop volumineux (25 Mo maximum).',
      fieldErrors: { file: 'Fichier trop volumineux.' },
    }
  }

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

  const evidenceId = crypto.randomUUID()
  let storagePath: string | null = null
  let contentHash: string | null = null

  if (hasFile) {
    const bytes = Buffer.from(await file.arrayBuffer())
    contentHash = `sha256:${createHash('sha256').update(bytes).digest('hex')}`
    storagePath = `${organization.tenant_id}/${input.organizationId}/${evidenceId}/${safeFileName(file.name)}`

    const { error: uploadError } = await supabase.storage
      .from(EVIDENCE_BUCKET)
      .upload(storagePath, bytes, {
        contentType: file.type || 'application/octet-stream',
        upsert: false,
      })

    if (uploadError) {
      return { ok: false, message: `Dépôt refusé : ${uploadError.message}` }
    }
  }

  const { error } = await supabase.from('evidence').insert({
    id: evidenceId,
    tenant_id: organization.tenant_id,
    organization_id: input.organizationId,
    title: input.title,
    evidence_type: input.evidenceType,
    source: input.source,
    version: input.version || null,
    valid_until: input.validUntil || null,
    external_url: input.externalUrl || null,
    storage_bucket: storagePath ? EVIDENCE_BUCKET : null,
    storage_path: storagePath,
    content_hash: contentHash,
    file_name: hasFile ? file.name : null,
    file_size_bytes: hasFile ? file.size : null,
    mime_type: hasFile ? file.type || 'application/octet-stream' : null,
    typology_id: input.typologyId || null,
    owner_user_id: user.id,
    validation_status: 'pending',
  })

  if (error) {
    // La ligne n'existe pas : l'objet ne doit pas rester.
    if (storagePath) await supabase.storage.from(EVIDENCE_BUCKET).remove([storagePath])
    return { ok: false, message: explain(error) }
  }

  if (input.controlId) {
    const { error: linkError } = await supabase.from('control_evidence').insert({
      tenant_id: organization.tenant_id,
      control_id: input.controlId,
      evidence_id: evidenceId,
      linked_by: user.id,
    })
    if (linkError) {
      revalidatePath(`/admin/organizations/${input.organizationId}/preuves`)
      return {
        ok: false,
        message: `Preuve déposée, mais le rattachement au contrôle a échoué : ${explain(linkError)}`,
      }
    }
  }

  revalidatePath(`/admin/organizations/${input.organizationId}/preuves`)
  revalidatePath(`/admin/organizations/${input.organizationId}/declaration-applicabilite`)
  return {
    ok: true,
    message: `Preuve « ${input.title} » déposée. Elle reste à valider — un dépôt n’est pas une validation.`,
  }
}

// -----------------------------------------------------------------------------
// Validation
// -----------------------------------------------------------------------------
const reviewSchema = z.object({
  organizationId: z.string().uuid(),
  evidenceId: z.string().uuid(),
  verdict: z.enum(['validated', 'rejected']),
})

export async function reviewEvidence(
  _previous: FormState | null,
  formData: FormData,
): Promise<FormState> {
  const parsed = reviewSchema.safeParse({
    organizationId: formData.get('organizationId'),
    evidenceId: formData.get('evidenceId'),
    verdict: formData.get('verdict'),
  })
  if (!parsed.success) return firstIssues(parsed.error)

  const supabase = await createClient()
  const {
    data: { user },
  } = await supabase.auth.getUser()
  if (!user) return { ok: false, message: 'Session expirée.' }

  // `validated_by` porte l'identite de l'appelant : la base refuse toute autre
  // valeur (app.guard_evidence_file), et c'est bien la l'interet.
  const { error } = await supabase
    .from('evidence')
    .update({
      validation_status: parsed.data.verdict,
      validated_by: user.id,
      validated_at: new Date().toISOString(),
    })
    .eq('id', parsed.data.evidenceId)

  if (error) return { ok: false, message: explain(error) }

  revalidatePath(`/admin/organizations/${parsed.data.organizationId}/preuves`)
  revalidatePath(`/admin/organizations/${parsed.data.organizationId}/declaration-applicabilite`)
  return {
    ok: true,
    message:
      parsed.data.verdict === 'validated'
        ? 'Preuve validée en votre nom, et journalisée.'
        : 'Preuve rejetée.',
  }
}

// -----------------------------------------------------------------------------
// Rattachement a un controle
// -----------------------------------------------------------------------------
const attachSchema = z.object({
  organizationId: z.string().uuid(),
  evidenceId: z.string().uuid(),
  controlId: z.string().uuid('Choisir un contrôle.'),
})

export async function attachEvidence(
  _previous: FormState | null,
  formData: FormData,
): Promise<FormState> {
  const parsed = attachSchema.safeParse({
    organizationId: formData.get('organizationId'),
    evidenceId: formData.get('evidenceId'),
    controlId: formData.get('controlId'),
  })
  if (!parsed.success) return firstIssues(parsed.error)

  const supabase = await createClient()
  const {
    data: { user },
  } = await supabase.auth.getUser()
  if (!user) return { ok: false, message: 'Session expirée.' }

  const { data: organization } = await supabase
    .from('organization')
    .select('tenant_id')
    .eq('id', parsed.data.organizationId)
    .maybeSingle()
  if (!organization) return { ok: false, message: 'Organisation introuvable.' }

  const { error } = await supabase.from('control_evidence').insert({
    tenant_id: organization.tenant_id,
    control_id: parsed.data.controlId,
    evidence_id: parsed.data.evidenceId,
    linked_by: user.id,
  })

  if (error) {
    if (error.code === '23505') {
      return { ok: false, message: 'Cette preuve est déjà rattachée à ce contrôle.' }
    }
    return { ok: false, message: explain(error) }
  }

  revalidatePath(`/admin/organizations/${parsed.data.organizationId}/preuves`)
  revalidatePath(`/admin/organizations/${parsed.data.organizationId}/declaration-applicabilite`)
  return { ok: true, message: 'Preuve rattachée au contrôle.' }
}

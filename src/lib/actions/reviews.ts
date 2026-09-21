'use server'

import { revalidatePath } from 'next/cache'
import { z } from 'zod'
import { createClient } from '@/lib/supabase/server'

/**
 * La revue de gouvernance : planifiee a la cadence, tenue avec presents,
 * compte rendu et decisions. La base genere l'ordre du jour, depose la preuve
 * et propose la prochaine date ; ici on valide la forme.
 */
export type FormState =
  | { ok: true; message: string; reviewId?: string }
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

const planSchema = z.object({
  organizationId: z.string().uuid(),
  kind: z.enum(['committee', 'direction']),
  scheduledOn: z.string().trim().min(1, 'Une date.'),
  chairedBy: z.string().uuid().optional().or(z.literal('')),
  attendees: z.string().trim().max(2000).optional().or(z.literal('')),
})

export async function planReview(_previous: FormState | null, formData: FormData): Promise<FormState> {
  const parsed = planSchema.safeParse({
    organizationId: formData.get('organizationId'),
    kind: formData.get('kind') ?? 'committee',
    scheduledOn: formData.get('scheduledOn'),
    chairedBy: formData.get('chairedBy') ?? '',
    attendees: formData.get('attendees') ?? '',
  })
  if (!parsed.success) return firstIssues(parsed.error)
  const input = parsed.data
  const supabase = await createClient()
  const { data: organization } = await supabase.from('organization').select('tenant_id').eq('id', input.organizationId).maybeSingle()
  if (!organization) return { ok: false, message: 'Organisation introuvable.' }
  const { data, error } = await supabase
    .from('governance_review')
    .insert({
      tenant_id: organization.tenant_id,
      organization_id: input.organizationId,
      kind: input.kind,
      scheduled_on: input.scheduledOn,
      chaired_by: input.chairedBy || null,
      attendees: lines(input.attendees),
      expected_attendees: lines(input.attendees),
    })
    .select('id, business_ref')
    .single()
  if (error) return { ok: false, message: explain(error) }
  revalidatePath(`/admin/organizations/${input.organizationId}/revues`)
  revalidatePath('/admin/pilotage')
  return { ok: true, message: `${data.business_ref} planifiée : l’ordre du jour est prêt, les participants sont avertis.`, reviewId: data.id }
}

const holdSchema = z.object({
  organizationId: z.string().uuid(),
  reviewId: z.string().uuid(),
  heldAt: z.string().trim().optional().or(z.literal('')),
  attendees: z.string().trim().min(2, 'Qui était présent.').max(2000),
  minutes: z.string().trim().min(40, 'Le compte rendu est la preuve : ce qui a été examiné, ce qui a été dit.').max(20000),
  decisionsTaken: z.string().trim().max(5000).optional().or(z.literal('')),
  nextReviewOn: z.string().trim().optional().or(z.literal('')),
})

export async function holdReview(_previous: FormState | null, formData: FormData): Promise<FormState> {
  const parsed = holdSchema.safeParse({
    organizationId: formData.get('organizationId'),
    reviewId: formData.get('reviewId'),
    heldAt: formData.get('heldAt') ?? '',
    attendees: formData.get('attendees'),
    minutes: formData.get('minutes'),
    decisionsTaken: formData.get('decisionsTaken') ?? '',
    nextReviewOn: formData.get('nextReviewOn') ?? '',
  })
  if (!parsed.success) return firstIssues(parsed.error)
  const input = parsed.data
  const supabase = await createClient()
  const { data, error } = await supabase
    .from('governance_review')
    .update({
      status: 'held',
      held_at: input.heldAt ? new Date(input.heldAt).toISOString() : new Date().toISOString(),
      attendees: lines(input.attendees),
      minutes: input.minutes,
      decisions_taken: input.decisionsTaken || null,
      next_review_on: input.nextReviewOn || null,
    })
    .eq('id', input.reviewId)
    .select('id, next_review_on, evidence_id')
    .maybeSingle()
  if (error) return { ok: false, message: explain(error) }
  if (!data) return { ok: false, message: 'Votre rôle ne permet pas cette écriture.' }

  // Une piece jointe — le compte rendu signe — rejoint la preuve ouverte.
  const file = formData.get('file')
  let fileNote = ''
  if (file instanceof File && file.size > 0 && data.evidence_id) {
    const problem = await attachMinutesFile(supabase, data.evidence_id, input.organizationId, file)
    fileNote = problem ? ` La pièce jointe n’a pas été retenue : ${problem}` : ' La pièce jointe est rattachée à la preuve.'
  }

  revalidatePath(`/admin/organizations/${input.organizationId}/revues`)
  revalidatePath(`/admin/organizations/${input.organizationId}/revues/${input.reviewId}`)
  revalidatePath(`/admin/organizations/${input.organizationId}/preuves`)
  revalidatePath('/admin/pilotage')
  return {
    ok: true,
    message: `Revue tenue. Le compte rendu est déposé au registre des preuves, à valider${data.next_review_on ? ` ; prochaine revue proposée le ${data.next_review_on}` : ''}.${fileNote}`,
  }
}

const cancelSchema = z.object({
  organizationId: z.string().uuid(),
  reviewId: z.string().uuid(),
  reason: z.string().trim().min(10, 'Une revue s’annule pour une raison : dire laquelle.').max(1000),
})

export async function cancelReview(_previous: FormState | null, formData: FormData): Promise<FormState> {
  const parsed = cancelSchema.safeParse({
    organizationId: formData.get('organizationId'),
    reviewId: formData.get('reviewId'),
    reason: formData.get('reason'),
  })
  if (!parsed.success) return firstIssues(parsed.error)
  const supabase = await createClient()
  const { data, error } = await supabase
    .from('governance_review')
    .update({ status: 'cancelled', cancellation_reason: parsed.data.reason })
    .eq('id', parsed.data.reviewId)
    .eq('status', 'planned')
    .select('id')
    .maybeSingle()
  if (error) return { ok: false, message: explain(error) }
  if (!data) return { ok: false, message: 'Cette revue n’est plus planifiée.' }
  revalidatePath(`/admin/organizations/${parsed.data.organizationId}/revues`)
  revalidatePath(`/admin/organizations/${parsed.data.organizationId}/revues/${parsed.data.reviewId}`)
  return { ok: true, message: 'Revue annulée, avec son motif — il se lit sur la fiche et s’imprime.' }
}

// Le compte rendu peut etre une piece : le document signe, le PDF de la
// reunion. Elle se depose avec la revue et rejoint la preuve que la base a
// ouverte — le fichier, son empreinte, son nom.
async function attachMinutesFile(
  supabase: Awaited<ReturnType<typeof createClient>>,
  evidenceId: string,
  organizationId: string,
  file: File,
): Promise<string | null> {
  const { EVIDENCE_BUCKET, MAX_EVIDENCE_BYTES } = await import('@/lib/storage/evidence')
  if (file.size > MAX_EVIDENCE_BYTES) return 'Fichier trop volumineux (25 Mo maximum).'
  const { createHash } = await import('node:crypto')
  const { data: organization } = await supabase.from('organization').select('tenant_id').eq('id', organizationId).maybeSingle()
  if (!organization) return 'Organisation introuvable.'
  const bytes = Buffer.from(await file.arrayBuffer())
  const contentHash = `sha256:${createHash('sha256').update(bytes).digest('hex')}`
  const safeName = file.name.normalize('NFKD').replace(/[^\w.-]+/g, '_').slice(0, 120) || 'compte-rendu'
  const storagePath = `${organization.tenant_id}/${organizationId}/${evidenceId}/${safeName}`
  const { error: uploadError } = await supabase.storage
    .from(EVIDENCE_BUCKET)
    .upload(storagePath, bytes, { contentType: file.type || 'application/octet-stream', upsert: false })
  if (uploadError) return `Dépôt du fichier refusé : ${uploadError.message}`
  const { error } = await supabase
    .from('evidence')
    .update({
      evidence_type: 'document',
      storage_bucket: EVIDENCE_BUCKET,
      storage_path: storagePath,
      content_hash: contentHash,
      file_name: file.name,
      file_size_bytes: file.size,
      mime_type: file.type || 'application/octet-stream',
    })
    .eq('id', evidenceId)
  if (error) {
    await supabase.storage.from(EVIDENCE_BUCKET).remove([storagePath])
    return explain(error)
  }
  return null
}

function lines(value: string | undefined): string[] | null {
  const items = (value ?? '').split(/\r?\n|;/).map((l) => l.trim()).filter(Boolean)
  return items.length ? items : null
}

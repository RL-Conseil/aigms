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
  revalidatePath(`/admin/organizations/${input.organizationId}/revues`)
  revalidatePath(`/admin/organizations/${input.organizationId}/revues/${input.reviewId}`)
  revalidatePath(`/admin/organizations/${input.organizationId}/preuves`)
  revalidatePath('/admin/pilotage')
  return {
    ok: true,
    message: `Revue tenue. Le compte rendu est déposé au registre des preuves, à valider${data.next_review_on ? ` ; prochaine revue proposée le ${data.next_review_on}` : ''}.`,
  }
}

export async function cancelReview(formData: FormData): Promise<void> {
  const parsed = z.object({ organizationId: z.string().uuid(), reviewId: z.string().uuid() }).safeParse({
    organizationId: formData.get('organizationId'),
    reviewId: formData.get('reviewId'),
  })
  if (!parsed.success) return
  const supabase = await createClient()
  await supabase.from('governance_review').update({ status: 'cancelled' }).eq('id', parsed.data.reviewId).eq('status', 'planned')
  revalidatePath(`/admin/organizations/${parsed.data.organizationId}/revues`)
}

function lines(value: string | undefined): string[] | null {
  const items = (value ?? '').split(/\r?\n|;/).map((l) => l.trim()).filter(Boolean)
  return items.length ? items : null
}

'use server'

import { revalidatePath } from 'next/cache'
import { z } from 'zod'
import { createClient } from '@/lib/supabase/server'

/**
 * Avec quoi l'organisation tient ses controles.
 *
 * Une ligne par famille d'outillage du referentiel, le produit employe. Ce
 * n'est pas un inventaire du SI : pas d'instances, pas de dependances. Le
 * referentiel propose une typologie ; l'officer retient ce qui vaut pour SON
 * controle, et le controle-type n'est jamais modifie.
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
  if (error.message.includes('duplicate key')) return 'Cette famille porte déjà un produit : le corriger plutôt que l’ajouter.'
  const raise = error.message.match(/^(?:.*?:\s)?([A-ZÀ-Ü][^\n]*)$/m)
  return raise?.[1] ?? error.message
}

const toolingSchema = z.object({
  organizationId: z.string().uuid(),
  toolingId: z.string().uuid().optional().or(z.literal('')),
  toolCode: z.string().trim().min(2).max(64),
  product: z.string().trim().min(2, 'Nommer le produit employé.').max(160),
  vendorId: z.string().uuid().optional().or(z.literal('')),
  connectorId: z.string().uuid().optional().or(z.literal('')),
  note: z.string().trim().max(1000).optional().or(z.literal('')),
})

function paths(organizationId: string) {
  revalidatePath(`/admin/organizations/${organizationId}/outillage`)
  revalidatePath(`/admin/organizations/${organizationId}/controles`)
}

export async function saveTooling(_previous: FormState | null, formData: FormData): Promise<FormState> {
  const parsed = toolingSchema.safeParse({
    organizationId: formData.get('organizationId'),
    toolingId: formData.get('toolingId') ?? '',
    toolCode: formData.get('toolCode'),
    product: formData.get('product'),
    vendorId: formData.get('vendorId') ?? '',
    connectorId: formData.get('connectorId') ?? '',
    note: formData.get('note') ?? '',
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

  const row = {
    tenant_id: organization.tenant_id,
    organization_id: d.organizationId,
    tool_code: d.toolCode,
    product: d.product,
    vendor_id: d.vendorId || null,
    connector_id: d.connectorId || null,
    note: d.note || null,
  }

  const { error } = d.toolingId
    ? await supabase.from('organization_tooling').update(row).eq('id', d.toolingId)
    : await supabase.from('organization_tooling').insert(row)
  if (error) return { ok: false, message: explain(error) }

  paths(d.organizationId)
  return {
    ok: true,
    message: d.connectorId
      ? `${d.product} enregistré. Son connecteur pourra en lire les preuves.`
      : `${d.product} enregistré. Aucun connecteur : les preuves s’y déposent à la main pour l’instant.`,
  }
}

export async function removeTooling(organizationId: string, toolingId: string): Promise<FormState> {
  const supabase = await createClient()
  const { error } = await supabase.from('organization_tooling').delete().eq('id', toolingId)
  if (error) return { ok: false, message: explain(error) }
  paths(organizationId)
  return { ok: true, message: 'Outil retiré de la carte.' }
}

// -----------------------------------------------------------------------------
// Ce qu'un controle retient
// -----------------------------------------------------------------------------
const retainSchema = z.object({
  organizationId: z.string().uuid(),
  controlId: z.string().uuid(),
  toolingIds: z.array(z.string().uuid()),
  rationale: z.string().trim().max(1000).optional().or(z.literal('')),
})

export async function retainTooling(_previous: FormState | null, formData: FormData): Promise<FormState> {
  const parsed = retainSchema.safeParse({
    organizationId: formData.get('organizationId'),
    controlId: formData.get('controlId'),
    toolingIds: formData.getAll('toolingIds').filter((v): v is string => typeof v === 'string' && v.length > 0),
    rationale: formData.get('rationale') ?? '',
  })
  if (!parsed.success) return firstIssues(parsed.error)
  const d = parsed.data

  const supabase = await createClient()
  const { data: control } = await supabase
    .from('control')
    .select('tenant_id')
    .eq('id', d.controlId)
    .maybeSingle()
  if (!control) return { ok: false, message: 'Contrôle introuvable.' }

  // Ce que l'officer retient remplace ce qu'il retenait : la carte d'un
  // controle se lit d'un coup, elle ne s'empile pas.
  const { error: clearError } = await supabase.from('control_tooling').delete().eq('control_id', d.controlId)
  if (clearError) return { ok: false, message: explain(clearError) }

  if (d.toolingIds.length) {
    const { error } = await supabase.from('control_tooling').insert(
      d.toolingIds.map((toolingId) => ({
        tenant_id: control.tenant_id,
        control_id: d.controlId,
        tooling_id: toolingId,
        rationale: d.rationale || null,
      })),
    )
    if (error) return { ok: false, message: explain(error) }
  }

  paths(d.organizationId)
  return {
    ok: true,
    message: d.toolingIds.length
      ? `Ce contrôle se tient avec ${d.toolingIds.length} outil(s).`
      : 'Aucun outil retenu : ce contrôle se tient à la main.',
  }
}

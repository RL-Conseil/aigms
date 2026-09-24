'use server'

import { revalidatePath } from 'next/cache'
import { z } from 'zod'
import { createClient } from '@/lib/supabase/server'

/**
 * Avec quoi un actif d'IA a ete construit, entraine, valide ou exploite.
 *
 * ISO/IEC 42001 A.4.4 « Tooling resources » demande de le documenter PAR
 * SYSTEME, et l'annexe IV de l'AI Act le reprend dans la documentation
 * technique. C'est l'inverse du lien pose en 0094 : celui-la disait « cet
 * outil est un actif », celui-ci dit « cet actif a ete fait avec ces outils ».
 */
export type FormState =
  | { ok: true; message: string }
  | { ok: false; message: string; fieldErrors?: Record<string, string> }

const TOOLING_PHASES = ['design', 'data', 'training', 'validation', 'deployment', 'operation'] as const

const schema = z.object({
  organizationId: z.string().uuid(),
  assetId: z.string().uuid(),
  toolingId: z.string().uuid('Choisir un outil déclaré.'),
  phase: z.enum(TOOLING_PHASES).default('operation'),
  note: z.string().trim().max(500).optional().or(z.literal('')),
})

function explain(error: { message: string }): string {
  if (error.message.includes('row-level security')) return 'Votre rôle ne permet pas cette écriture.'
  if (error.message.includes('duplicate key')) return 'Cet outil est déjà rattaché à cet actif pour cette phase.'
  const raise = error.message.match(/^(?:.*?:\s)?([A-ZÀ-Ü][^\n]*)$/m)
  return raise?.[1] ?? error.message
}

function paths(organizationId: string, assetId: string) {
  revalidatePath(`/admin/organizations/${organizationId}/actifs/${assetId}`)
  revalidatePath(`/admin/organizations/${organizationId}/actifs`)
}

export async function attachAssetTooling(
  _previous: FormState | null,
  formData: FormData,
): Promise<FormState> {
  const parsed = schema.safeParse({
    organizationId: formData.get('organizationId'),
    assetId: formData.get('assetId'),
    toolingId: formData.get('toolingId'),
    phase: formData.get('phase') || 'operation',
    note: formData.get('note') ?? '',
  })
  if (!parsed.success) {
    const fieldErrors: Record<string, string> = {}
    for (const issue of parsed.error.issues) {
      const key = issue.path[0]
      if (typeof key === 'string' && !fieldErrors[key]) fieldErrors[key] = issue.message
    }
    return { ok: false, message: 'Merci de corriger les champs signalés.', fieldErrors }
  }
  const d = parsed.data

  const supabase = await createClient()
  // `tenant_id` est posé par le garde, qui le lit sur l'actif : l'écran n'a pas
  // à le connaître, et ne peut donc pas le faire diverger.
  const { error } = await supabase.from('asset_tooling').insert({
    tenant_id: '00000000-0000-0000-0000-000000000000',
    asset_id: d.assetId,
    tooling_id: d.toolingId,
    phase: d.phase,
    note: d.note || null,
  })
  if (error) return { ok: false, message: explain(error) }

  paths(d.organizationId, d.assetId)
  return { ok: true, message: 'Outil rattaché à l’actif.' }
}

export async function detachAssetTooling(
  organizationId: string,
  assetId: string,
  id: string,
): Promise<FormState> {
  const supabase = await createClient()
  const { error } = await supabase.from('asset_tooling').delete().eq('id', id)
  if (error) return { ok: false, message: explain(error) }
  paths(organizationId, assetId)
  return { ok: true, message: 'Rattachement retiré.' }
}

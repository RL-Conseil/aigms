'use server'

import { revalidatePath } from 'next/cache'
import { z } from 'zod'
import { createClient } from '@/lib/supabase/server'

/**
 * Decision de Declaration d'Applicabilite.
 *
 * La regle d'or d'ISO/IEC 42001 : aucune exigence de l'Annexe A ne reste sans
 * reponse. Elle est SELECTIONNEE ou EXCLUE, et les deux appellent une
 * justification ecrite — l'exclusion plus encore que la selection, puisque
 * c'est elle qu'un auditeur vient contester.
 *
 * La contrainte vit en base (`justification not null`, non vide) : ce fichier
 * ne fait que valider la forme et presenter le refus.
 */

export type FormState =
  | { ok: true; message: string }
  | { ok: false; message: string; fieldErrors?: Record<string, string> }

const schema = z.object({
  organizationId: z.string().uuid(),
  requirementId: z.string().uuid(),
  status: z.enum(['selected', 'excluded']),
  justification: z
    .string()
    .trim()
    .min(
      30,
      'Une justification tenant en une ligne ne se défend pas devant un auditeur : dire pourquoi, pas seulement que.',
    )
    .max(2000),
})

function explain(error: { message: string; code?: string }): string {
  if (error.message.includes('row-level security')) {
    return 'Votre rôle ne permet pas de porter une décision d’applicabilité.'
  }
  const raise = error.message.match(/^(?:.*?:\s)?([A-ZÀ-Ü][^\n]*)$/m)
  return raise?.[1] ?? error.message
}

export async function decideApplicability(
  _previous: FormState | null,
  formData: FormData,
): Promise<FormState> {
  const parsed = schema.safeParse({
    organizationId: formData.get('organizationId'),
    requirementId: formData.get('requirementId'),
    status: formData.get('status'),
    justification: formData.get('justification'),
  })

  if (!parsed.success) {
    const issue = parsed.error.issues[0]
    return {
      ok: false,
      message: issue?.message ?? 'Formulaire incomplet.',
      fieldErrors: { justification: issue?.message ?? '' },
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
    .eq('id', parsed.data.organizationId)
    .maybeSingle()
  if (!organization) return { ok: false, message: 'Organisation introuvable.' }

  const { error } = await supabase.from('soa_decision').upsert(
    {
      tenant_id: organization.tenant_id,
      organization_id: parsed.data.organizationId,
      requirement_id: parsed.data.requirementId,
      status: parsed.data.status,
      justification: parsed.data.justification,
      decided_by: user.id,
    },
    { onConflict: 'organization_id,requirement_id' },
  )

  if (error) return { ok: false, message: explain(error) }

  revalidatePath(`/admin/organizations/${parsed.data.organizationId}/declaration-applicabilite`)
  return {
    ok: true,
    message:
      parsed.data.status === 'selected'
        ? 'Exigence sélectionnée, justification enregistrée en votre nom.'
        : 'Exclusion enregistrée en votre nom. Elle sera lue par un auditeur.',
  }
}

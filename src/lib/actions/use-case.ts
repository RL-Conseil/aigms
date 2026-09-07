'use server'

import { revalidatePath } from 'next/cache'
import { z } from 'zod'
import { createClient } from '@/lib/supabase/server'
import {
  USE_CASE_STATUSES,
  type TransitionResult,
  type UseCaseStatus,
} from '@/lib/domain/governance'

/**
 * Server Actions du cycle de vie.
 *
 * Elles ne decident rien : elles valident la forme de l'entree puis appellent
 * la fonction serveur qui porte la regle. Le resultat, succes ou refus motive,
 * est renvoye tel quel a l'interface.
 */

const transitionSchema = z.object({
  useCaseId: z.string().uuid(),
  target: z.enum(USE_CASE_STATUSES),
  rationale: z.string().trim().max(2000).optional(),
})

export type ActionState =
  | { ok: true; result: TransitionResult }
  | { ok: false; message: string }

export async function transitionUseCase(
  _previous: ActionState | null,
  formData: FormData,
): Promise<ActionState> {
  const parsed = transitionSchema.safeParse({
    useCaseId: formData.get('useCaseId'),
    target: formData.get('target'),
    rationale: formData.get('rationale') ?? undefined,
  })

  if (!parsed.success) {
    return { ok: false, message: 'Demande de transition invalide.' }
  }

  const supabase = await createClient()
  const { data, error } = await supabase.rpc('transition_use_case', {
    p_use_case_id: parsed.data.useCaseId,
    p_target: parsed.data.target satisfies UseCaseStatus,
    p_rationale: parsed.data.rationale ?? null,
  })

  if (error) {
    // Habilitation insuffisante ou cas d'usage introuvable : la base leve.
    return { ok: false, message: error.message }
  }

  revalidatePath(`/use-cases/${parsed.data.useCaseId}`)
  revalidatePath('/dashboard')

  return { ok: true, result: data as TransitionResult }
}

const screenSchema = z.object({ changeRequestId: z.string().uuid() })

export type ScreenState =
  | { ok: true; verdict: string; scope: string[]; message: string }
  | { ok: false; message: string }

export async function screenChangeRequest(
  _previous: ScreenState | null,
  formData: FormData,
): Promise<ScreenState> {
  const parsed = screenSchema.safeParse({ changeRequestId: formData.get('changeRequestId') })

  if (!parsed.success) {
    return { ok: false, message: 'Demande de changement invalide.' }
  }

  const supabase = await createClient()
  const { data, error } = await supabase.rpc('screen_change_request', {
    p_change_request_id: parsed.data.changeRequestId,
  })

  if (error) {
    return { ok: false, message: error.message }
  }

  const result = data as { verdict: string; scope: string[]; note: string }

  revalidatePath('/dashboard')

  return { ok: true, verdict: result.verdict, scope: result.scope, message: result.note }
}

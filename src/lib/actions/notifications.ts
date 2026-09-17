'use server'

import { revalidatePath } from 'next/cache'
import { z } from 'zod'
import { createClient } from '@/lib/supabase/server'

/**
 * Marquer une alerte lue. L'ecriture ne touche que `read_at` : la politique
 * n'accorde rien d'autre, et un declencheur refuse le reste.
 */
export async function markNotificationRead(formData: FormData): Promise<void> {
  const id = z.string().uuid().safeParse(formData.get('id'))
  if (!id.success) return
  const supabase = await createClient()
  await supabase
    .from('notification')
    .update({ read_at: new Date().toISOString() })
    .eq('id', id.data)
    .is('read_at', null)
  revalidatePath('/admin/alertes')
}

export async function markAllNotificationsRead(): Promise<void> {
  const supabase = await createClient()
  const {
    data: { user },
  } = await supabase.auth.getUser()
  if (!user) return
  await supabase
    .from('notification')
    .update({ read_at: new Date().toISOString() })
    .eq('recipient_user_id', user.id)
    .is('read_at', null)
    .lte('due_at', new Date().toISOString())
  revalidatePath('/admin/alertes')
}

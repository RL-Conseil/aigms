/* eslint-disable no-restricted-imports -- Cette route n'est appelée que par la
   tâche planifiée, avec un secret partagé : elle n'a pas de session, donc pas
   de RLS applicable. Les fonctions qu'elle appelle sont refusées à tout rôle
   authentifié et réservées à la clé de service. */
import { NextResponse } from 'next/server'
import { createAdminClient } from '@/lib/supabase/admin'
import { publicEnv } from '@/lib/env'
import { isMailerConfigured, sendSystemEmail } from '@/lib/email/mailer'
import { digestEmail, immediateEmail, type Digest } from '@/lib/email/notifications'

/**
 * L'envoi des alertes par courriel.
 *
 * Appelee par une tache planifiee (Vercel Cron), jamais par un navigateur :
 * elle porte un secret partage, et elle lit la base avec la cle de service —
 * les fonctions qu'elle appelle sont refusees a tout role authentifie.
 *
 * Deux temps a chaque passage :
 *   1. ce qui ne peut pas attendre part tout de suite, une fois ;
 *   2. la synthese part a la cadence de chacun.
 *
 * L'envoi est une commodite : une alerte qui n'a pas pu partir reste lisible
 * dans « Mes alertes », et repartira au passage suivant.
 */

export const dynamic = 'force-dynamic'
export const maxDuration = 60

function authorized(request: Request): boolean {
  const secret = process.env.CRON_SECRET?.trim()
  if (!secret) return false
  const header = request.headers.get('authorization') ?? ''
  return header === `Bearer ${secret}`
}

export async function GET(request: Request) {
  if (!authorized(request)) return new NextResponse('Non autorisé.', { status: 401 })
  if (!isMailerConfigured()) {
    return NextResponse.json({ sent: 0, skipped: 'courrier non configuré' }, { status: 200 })
  }

  const siteUrl = publicEnv().NEXT_PUBLIC_SITE_URL
  const supabase = createAdminClient()
  const report = { immediate: 0, digests: 0, failures: [] as string[] }

  // 1. Ce qui ne peut pas attendre.
  const { data: urgent, error: urgentError } = await supabase.rpc('notifications_to_email')
  if (urgentError) return NextResponse.json({ error: urgentError.message }, { status: 500 })

  const sentIds: string[] = []
  for (const row of (urgent ?? []) as {
    notification_id: string
    email: string
    kind: string
    title: string
    body: string | null
    href: string | null
    organization_name: string | null
  }[]) {
    const mail = immediateEmail(row, siteUrl)
    const result = await sendSystemEmail({ to: row.email, ...mail })
    if (result.sent) {
      sentIds.push(row.notification_id)
      report.immediate += 1
    } else {
      report.failures.push(`${row.email} : ${result.reason}`)
    }
  }
  if (sentIds.length) await supabase.rpc('mark_notifications_emailed', { p_ids: sentIds })

  // 2. La synthese, a la cadence de chacun.
  const { data: recipients, error: digestError } = await supabase.rpc('digest_recipients')
  if (digestError) return NextResponse.json({ ...report, error: digestError.message }, { status: 500 })

  for (const person of (recipients ?? []) as { user_id: string; email: string; payload: Digest }[]) {
    const mail = digestEmail(person.payload, siteUrl)
    if (!mail) continue
    const result = await sendSystemEmail({ to: person.email, ...mail })
    if (result.sent) {
      await supabase.rpc('mark_digest_sent', { p_user_id: person.user_id })
      report.digests += 1
    } else {
      report.failures.push(`${person.email} : ${result.reason}`)
    }
  }

  return NextResponse.json(report)
}

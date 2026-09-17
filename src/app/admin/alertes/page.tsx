import Link from 'next/link'
import { Shell } from '@/components/shell'
import { Badge, Card, Empty } from '@/components/ui'
import { formatDateTime } from '@/lib/domain/governance'
import {
  listNotifications,
  NOTIFICATION_KIND_LABELS,
  REMINDER_KINDS,
} from '@/lib/governance/notifications'
import { markAllNotificationsRead, markNotificationRead } from '@/lib/actions/notifications'

/**
 * Mes alertes.
 *
 * Ce que la plateforme a a me dire, a moi : les risques dont je reponds, les
 * actions qui me sont confiees, les revues et dates d'effet qui arrivent.
 * Chaque alerte conduit a l'endroit ou l'on agit — la rubrique de la fiche
 * concernee — et se marque lue d'un geste. Rien ici n'est un fait de
 * gouvernance : le journal, lui, trace les actes.
 */
export default async function AlertsPage() {
  const notifications = await listNotifications(100)
  const unread = notifications.filter((n) => !n.read_at)
  const read = notifications.filter((n) => n.read_at)

  const Item = ({ n }: { n: (typeof notifications)[number] }) => (
    <li className={`flex items-start justify-between gap-4 py-3 ${n.read_at ? 'opacity-70' : ''}`}>
      <div className="min-w-0">
        <div className="flex flex-wrap items-center gap-2">
          <Badge tone={REMINDER_KINDS.has(n.kind) ? 'warn' : 'info'}>
            {NOTIFICATION_KIND_LABELS[n.kind] ?? n.kind}
          </Badge>
          {n.href ? (
            <Link href={n.href} className="text-sm font-medium text-ink-900 hover:underline">
              {n.title}
            </Link>
          ) : (
            <span className="text-sm font-medium text-ink-900">{n.title}</span>
          )}
        </div>
        {n.body ? <p className="mt-1 text-sm text-ink-600">{n.body}</p> : null}
        <p className="mt-1 text-xs text-ink-400">
          {REMINDER_KINDS.has(n.kind) ? 'Rappel du ' : 'Le '}
          {formatDateTime(n.due_at)}
          {n.read_at ? ` · lue le ${formatDateTime(n.read_at)}` : ''}
        </p>
      </div>
      {!n.read_at ? (
        <form action={markNotificationRead}>
          <input type="hidden" name="id" value={n.id} />
          <button
            type="submit"
            className="shrink-0 rounded-md border border-ink-200 px-3 py-1.5 text-xs text-ink-700 hover:bg-ink-100"
          >
            Marquer lue
          </button>
        </form>
      ) : null}
    </li>
  )

  return (
    <Shell
      breadcrumb={[{ label: 'Mes alertes' }]}
      title="Mes alertes"
      subtitle="Ce qui vous concerne nommément : responsabilités, échéances, décisions à suivre."
      actions={
        unread.length ? (
          <form action={markAllNotificationsRead}>
            <button
              type="submit"
              className="rounded-md border border-ink-200 px-3.5 py-2 text-sm text-ink-700 hover:bg-ink-100"
            >
              Tout marquer lu
            </button>
          </form>
        ) : null
      }
    >
      <div className="max-w-3xl space-y-5">
        <Card
          title="À lire"
          subtitle={unread.length ? `${unread.length} alerte(s) non lue(s)` : 'Rien de nouveau'}
          tone={unread.some((n) => REMINDER_KINDS.has(n.kind)) ? 'warn' : 'neutral'}
        >
          {unread.length ? (
            <ul className="divide-y divide-ink-100">
              {unread.map((n) => (
                <Item key={n.id} n={n} />
              ))}
            </ul>
          ) : (
            <Empty>
              Aucune alerte en attente. Vous serez averti quand un risque, une action, une revue
              ou une décision vous engagera — et rappelé aux dates prévues.
            </Empty>
          )}
        </Card>

        {read.length ? (
          <Card title="Déjà lues" subtitle="Les plus récentes">
            <ul className="divide-y divide-ink-100">
              {read.slice(0, 30).map((n) => (
                <Item key={n.id} n={n} />
              ))}
            </ul>
          </Card>
        ) : null}
      </div>
    </Shell>
  )
}

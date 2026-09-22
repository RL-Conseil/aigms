import 'server-only'

import { NOTIFICATION_KIND_LABELS } from '@/lib/governance/notifications'

/**
 * Ce que la plateforme ecrit quand elle previent par courriel.
 *
 * Le texte fait foi : il se lit dans n'importe quel client de messagerie, et
 * il porte les liens qui conduisent la ou l'on agit. Rien de confidentiel n'y
 * transite — un intitule, une echeance, un lien.
 */

export type DigestAlert = { kind: string; title: string; href: string | null }
export type DigestAction = {
  id: string
  business_ref: string
  title: string
  due_date: string | null
  blocking: boolean
  href: string
}
export type DigestIncident = {
  id: string
  business_ref: string
  title: string
  status: string
  severity: string
  href: string
}
export type DigestOrganization = {
  id: string
  name: string
  actions_open: number
  actions_overdue: number
  actions: DigestAction[]
  incidents: DigestIncident[]
  alerts: DigestAlert[]
  follow_up_href: string
}
export type Digest = { generated_at: string; organizations: DigestOrganization[] }

const dateFr = (value: string | null) =>
  value ? new Intl.DateTimeFormat('fr-FR', { dateStyle: 'medium' }).format(new Date(value)) : 'sans échéance'

function link(siteUrl: string, href: string | null): string {
  if (!href) return siteUrl
  return href.startsWith('http') ? href : `${siteUrl.replace(/\/$/, '')}${href}`
}

/** Une alerte qui ne peut pas attendre la synthese. */
export function immediateEmail(
  notification: { kind: string; title: string; body: string | null; href: string | null; organization_name: string | null },
  siteUrl: string,
): { subject: string; text: string } {
  const label = NOTIFICATION_KIND_LABELS[notification.kind] ?? 'Alerte'
  return {
    subject: `[AIGMS] ${label} — ${notification.title}`,
    text: [
      notification.organization_name ? `${notification.organization_name}` : null,
      '',
      notification.title,
      notification.body ?? '',
      '',
      `Y accéder : ${link(siteUrl, notification.href)}`,
      '',
      '— AIGMS. Vous recevez ce message parce que cette alerte vous est adressée nommément.',
      `Régler vos notifications : ${link(siteUrl, '/admin/parametres')}`,
    ]
      .filter((line) => line !== null)
      .join('\n'),
  }
}

/** La synthese : ce qui reste a faire avancer, par organisation. */
export function digestEmail(digest: Digest, siteUrl: string): { subject: string; text: string } | null {
  const orgs = digest.organizations.filter(
    (o) => o.actions.length || o.incidents.length || o.alerts.length,
  )
  if (!orgs.length) return null

  const totalActions = orgs.reduce((n, o) => n + o.actions_open, 0)
  const totalOverdue = orgs.reduce((n, o) => n + o.actions_overdue, 0)
  const totalIncidents = orgs.reduce((n, o) => n + o.incidents.length, 0)

  const lines: string[] = [
    'Ce qui attend une main de votre part.',
    '',
    `${totalActions} action(s) ouverte(s)${totalOverdue ? `, dont ${totalOverdue} échue(s)` : ''} · ${totalIncidents} incident(s) à faire avancer.`,
    '',
  ]

  for (const org of orgs) {
    lines.push(`— ${org.name} —`, '')
    if (org.actions.length) {
      lines.push('Actions :')
      for (const a of org.actions) {
        lines.push(
          `  • ${a.business_ref} ${a.title}${a.blocking ? ' [bloquante]' : ''} — ${dateFr(a.due_date)}`,
          `    ${link(siteUrl, a.href)}`,
        )
      }
      lines.push('')
    }
    if (org.incidents.length) {
      lines.push('Incidents :')
      for (const i of org.incidents) {
        lines.push(`  • ${i.business_ref} ${i.title} — ${i.severity}, ${i.status}`, `    ${link(siteUrl, i.href)}`)
      }
      lines.push('')
    }
    if (org.alerts.length) {
      lines.push('Autres alertes :')
      for (const alert of org.alerts.slice(0, 10)) {
        lines.push(`  • ${NOTIFICATION_KIND_LABELS[alert.kind] ?? alert.kind} — ${alert.title}`)
      }
      lines.push('')
    }
    lines.push(`Suivi d’actions et d’incidents : ${link(siteUrl, org.follow_up_href)}`, '')
  }

  lines.push(
    '— AIGMS. Vous recevez cette synthèse parce que votre compte l’a demandée.',
    `La régler ou l’arrêter : ${link(siteUrl, '/admin/parametres')}`,
  )

  return {
    subject: `[AIGMS] Synthèse — ${totalActions} action(s)${totalOverdue ? `, ${totalOverdue} échue(s)` : ''}${totalIncidents ? ` · ${totalIncidents} incident(s)` : ''}`,
    text: lines.join('\n'),
  }
}

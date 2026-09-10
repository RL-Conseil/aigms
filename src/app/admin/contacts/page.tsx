import { createClient } from '@/lib/supabase/server'
import { Shell } from '@/components/shell'
import { Badge, Card, Empty } from '@/components/ui'
import { formatDateTime } from '@/lib/domain/governance'

/**
 * Suivi des demandes de rappel.
 *
 * La lecture est reservee a l'administration plateforme par la RLS : un compte
 * sans ce privilege obtient une liste vide, ce que la page dit explicitement
 * plutot que d'afficher un tableau vide sans explication.
 */

const PROFILE_LABELS: Record<string, string> = {
  direction: 'Direction générale',
  dsi_rssi_dpo: 'DSI, RSSI ou DPO',
  metier: 'Direction métier',
  conseil_msp_integrateur: 'Cabinet, MSP ou intégrateur',
  autre: 'Autre',
}

const STATUS_LABELS: Record<string, string> = {
  new: 'Nouvelle',
  contacted: 'Contactée',
  qualified: 'Qualifiée',
  archived: 'Archivée',
  spam: 'Indésirable',
}

export default async function ContactsPage() {
  const supabase = await createClient()

  const [{ data: requests }, { data: profile }] = await Promise.all([
    supabase
      .from('contact_request')
      .select('id, full_name, email, organization, phone, profile, message, status, created_at')
      .order('created_at', { ascending: false }),
    supabase.from('user_profile').select('is_platform_admin').maybeSingle(),
  ])

  const isPlatformAdmin = profile?.is_platform_admin === true

  return (
    <Shell
      title="Demandes de rappel"
      subtitle="Archive — la collecte est reprise par le site commercial."
      actions={
        requests?.length ? <Badge tone="info">{requests.length} demande(s)</Badge> : undefined
      }
    >
      <Card title="Demandes reçues">
        {!isPlatformAdmin ? (
          <Empty>
            Le suivi des demandes est réservé à l’administration de la plateforme. Votre compte n’a
            pas ce privilège.
          </Empty>
        ) : requests?.length ? (
          <ul className="divide-y divide-ink-100">
            {requests.map((request) => (
              <li key={request.id} className="py-4">
                <div className="flex flex-wrap items-start justify-between gap-3">
                  <div className="min-w-0">
                    <p className="text-sm font-medium text-ink-900">
                      {request.full_name} — {request.organization}
                    </p>
                    <p className="text-xs text-ink-400">
                      <a href={`mailto:${request.email}`} className="hover:underline">
                        {request.email}
                      </a>
                      {request.phone ? ` · ${request.phone}` : ''} ·{' '}
                      {PROFILE_LABELS[request.profile] ?? request.profile} ·{' '}
                      {formatDateTime(request.created_at)}
                    </p>
                    {request.message ? (
                      <p className="mt-2 max-w-3xl text-sm leading-relaxed text-ink-600">
                        {request.message}
                      </p>
                    ) : null}
                  </div>
                  <Badge
                    tone={
                      request.status === 'new'
                        ? 'warn'
                        : request.status === 'qualified'
                          ? 'ok'
                          : 'neutral'
                    }
                  >
                    {STATUS_LABELS[request.status] ?? request.status}
                  </Badge>
                </div>
              </li>
            ))}
          </ul>
        ) : (
          <Empty>Aucune demande pour le moment.</Empty>
        )}
      </Card>
    </Shell>
  )
}

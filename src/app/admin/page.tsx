import Link from 'next/link'
import { createClient } from '@/lib/supabase/server'
import { Shell } from '@/components/shell'
import { Badge, Card, Empty } from '@/components/ui'
import { formatDate } from '@/lib/domain/governance'

/**
 * Vue consultant : le portefeuille d'organisations gouvernees.
 * Aucun filtre par tenant n'est ecrit ici — la RLS s'en charge.
 */
export default async function PortfolioPage() {
  const supabase = await createClient()

  const { data: organizations, error } = await supabase
    .from('organization')
    .select('id, business_ref, name, sector, status, headcount, created_at')
    .order('name')

  if (error) {
    throw new Error(`Lecture du portefeuille impossible : ${error.message}`)
  }

  const { data: useCases } = await supabase
    .from('ai_use_case')
    .select('id, organization_id, status')

  const countsByOrg = new Map<string, { total: number; production: number }>()
  for (const uc of useCases ?? []) {
    const entry = countsByOrg.get(uc.organization_id) ?? { total: 0, production: 0 }
    entry.total += 1
    if (uc.status === 'PRODUCTION' || uc.status === 'MONITORING') entry.production += 1
    countsByOrg.set(uc.organization_id, entry)
  }

  return (
    <Shell
      title="Portefeuille"
      subtitle="Organisations dont la gouvernance de l'IA est pilotée depuis ce compte."
    >
      <Card title="Organisations" subtitle={`${organizations?.length ?? 0} organisation(s)`}>
        {organizations?.length ? (
          <ul className="divide-y divide-ink-100">
            {organizations.map((org) => {
              const counts = countsByOrg.get(org.id) ?? { total: 0, production: 0 }
              return (
                <li key={org.id} className="flex items-center justify-between gap-4 py-3">
                  <div className="min-w-0">
                    <Link
                      href={`/admin/organizations/${org.id}`}
                      className="text-sm font-medium text-brand-600 hover:underline"
                    >
                      {org.name}
                    </Link>
                    <p className="text-xs text-ink-400">
                      {org.business_ref} · {org.sector ?? 'Secteur non renseigné'} ·{' '}
                      {org.headcount ? `${org.headcount} personnes` : 'Effectif non renseigné'} ·
                      depuis le {formatDate(org.created_at)}
                    </p>
                  </div>
                  <div className="flex shrink-0 items-center gap-2">
                    <Badge tone="info">{counts.total} cas d&apos;usage</Badge>
                    <Badge tone={counts.production > 0 ? 'ok' : 'neutral'}>
                      {counts.production} en service
                    </Badge>
                    <Badge>{org.status}</Badge>
                  </div>
                </li>
              )
            })}
          </ul>
        ) : (
          <Empty>Aucune organisation accessible depuis ce compte.</Empty>
        )}
      </Card>
    </Shell>
  )
}

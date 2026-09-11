import Link from 'next/link'
import { createClient } from '@/lib/supabase/server'
import { Shell } from '@/components/shell'
import { Badge, Card, Empty } from '@/components/ui'
import { formatDate } from '@/lib/domain/governance'
import { getViewerContext, isAdministrating } from '@/lib/auth/context'
import { AttentionSummary } from '@/components/governance/attention'
import { attentionByOrganization } from '@/lib/governance/attention'

/**
 * Les organisations dont la gouvernance de l'IA est suivie depuis ce compte.
 *
 * Le sous-titre suit le role : administrer des organisations et en gouverner
 * les usages sont deux metiers, et l'ecran ne raconte pas la meme chose a l'un
 * et a l'autre. Aucun filtre par tenant n'est ecrit ici — la RLS s'en charge.
 */
export default async function PortfolioPage() {
  const supabase = await createClient()
  const administrating = isAdministrating(await getViewerContext())

  const { data: organizations, error } = await supabase
    .from('organization')
    .select('id, business_ref, name, sector, status, headcount, created_at')
    .order('name')


  if (error) {
    throw new Error(`Lecture des organisations impossible : ${error.message}`)
  }

  const { data: useCases } = await supabase
    .from('ai_use_case')
    .select('id, organization_id, status')

  // Ce qui appelle une action, organisation par organisation : une liste de
  // clients sans cet indice oblige a les ouvrir un par un pour savoir lequel
  // demande du travail.
  const attention = administrating ? [] : await attentionByOrganization()
  const attentionByOrg = new Map(attention.map((row) => [row.organization_id, row]))

  const countsByOrg = new Map<string, { total: number; production: number }>()
  for (const uc of useCases ?? []) {
    const entry = countsByOrg.get(uc.organization_id) ?? { total: 0, production: 0 }
    entry.total += 1
    if (uc.status === 'PRODUCTION' || uc.status === 'MONITORING') entry.production += 1
    countsByOrg.set(uc.organization_id, entry)
  }

  return (
    <Shell
      title="Organisations"
      subtitle={
        administrating
          ? 'Les organisations déclarées sur la plateforme.'
          : 'Les organisations dont vous pilotez la gouvernance de l’IA.'
      }
      actions={
        administrating ? (
          <Link
            href="/admin/organisations/nouvelle"
            className="rounded-md bg-night-900 px-4 py-2.5 text-sm font-medium text-white hover:bg-night-800"
          >
            Nouvelle organisation
          </Link>
        ) : undefined
      }
    >
      <Card title="Liste" subtitle={`${organizations?.length ?? 0} organisation(s)`}>
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
                    {attentionByOrg.has(org.id) ? (
                      <p className="mt-1">
                        <AttentionSummary attention={attentionByOrg.get(org.id)!} />
                      </p>
                    ) : null}
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
          <Empty>
            {administrating
              ? 'Aucune organisation. Commencez par en créer une : elle accueillera ensuite ses comptes et ses cas d’usage.'
              : 'Aucune organisation accessible depuis ce compte.'}
          </Empty>
        )}
      </Card>
    </Shell>
  )
}

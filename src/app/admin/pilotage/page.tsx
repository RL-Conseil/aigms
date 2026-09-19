import { createClient } from '@/lib/supabase/server'
import { Shell } from '@/components/shell'
import { Card, Empty } from '@/components/ui'
import { getViewerContext, isAdministrating } from '@/lib/auth/context'
import { attentionByOrganization } from '@/lib/governance/attention'
import { AttentionByOrganization, AttentionChart } from '@/components/governance/attention-chart'
import { OrganizationRoleCard } from '@/components/governance/organization-role-card'
import { GovernanceHealth, type Health } from '@/components/governance/governance-health'
import { formatDate } from '@/lib/domain/governance'
import { OrganizationFilter } from '@/components/governance/organization-filter'

/**
 * Tableau de bord OPERATE : ce qui appelle une action de l'AI Governance
 * Officer. Chaque bloc repond a une question de pilotage, pas a une entite du
 * modele de donnees.
 */
export default async function DashboardPage({
  searchParams,
}: {
  searchParams: Promise<{ organisation?: string }>
}) {
  const { organisation } = await searchParams
  const viewer = await getViewerContext()

  // L'administration ouvre les acces, elle ne pilote pas. Un tableau de bord
  // vide serait plus deroutant qu'un refus explicite.
  if (isAdministrating(viewer)) {
    return (
      <Shell title="Pilotage">
        <Card title="Hors de votre périmètre">
          <Empty>
            Le pilotage de la gouvernance revient aux rôles que vous attribuez : AI Governance
            Officer, responsable du risque, porteur du système. L’administration de la plateforme
            ouvre les accès et n’instruit aucun dossier.
          </Empty>
        </Card>
      </Shell>
    )
  }

  const supabase = await createClient()

  const { data: blockedGates } = await supabase
    .from('audit_log')
    .select('id, occurred_at, entity_ref, summary')
    .eq('action', 'gate_blocked')
    .order('occurred_at', { ascending: false })
    .limit(5)

  // Le nom de l'organisation accompagne chaque ligne : un retard anonyme oblige
  // a ouvrir la fiche pour savoir de quel client il s'agit.
  const attention = await attentionByOrganization()
  const organizations = attention.map((row) => ({
    id: row.organization_id,
    name: row.organization_name,
    total: row.total,
  }))
  const nameOf = new Map(organizations.map((o) => [o.id, o.name]))

  // Sans choix explicite, on arrive sur l'organisation courante — celle que
  // l'on ouvre en arrivant partout ailleurs. « toutes » demande le portefeuille.
  const scoped =
    organisation === 'toutes'
      ? undefined
      : organisation && nameOf.has(organisation)
        ? organisation
        : viewer?.currentOrganizationId && nameOf.has(viewer.currentOrganizationId)
          ? viewer.currentOrganizationId
          : undefined

  // L'indice de sante porte sur UNE organisation : agrege sur plusieurs clients
  // il n'aurait pas de sens, leurs perimetres n'etant pas comparables.
  const { data: healthData } = scoped
    ? await supabase.rpc('governance_health', { p_organization_id: scoped, p_activity_id: null })
    : { data: null }
  const health = healthData as Health | null

  return (
    <Shell
      activeNav="pilotage"
      title="Pilotage"
      subtitle={
        scoped
          ? `Ce qui appelle une action chez ${nameOf.get(scoped)}.`
          : 'Ce qui appelle une décision, une preuve ou une action cette semaine.'
      }
      actions={
        <OrganizationFilter
          organizations={organizations}
          selected={scoped}
          basePath="/admin/pilotage"
        />
      }
    >
      {/*
        Les chiffres suivent le filtre : un compteur qui resterait global sous
        une vue restreinte ferait douter de tout l'ecran.
      */}
      {/*
        Un tableau de bord synthetique repond a « ou porter l'effort ». Le
        graphique le dit d'un coup d'oeil, l'indice de sante donne le niveau, et
        les listes ne viennent qu'apres — repliees.
      */}
      <div className="mb-5 grid gap-5 lg:grid-cols-2">
        <Card
          title="Ce qui appelle une action"
          subtitle={scoped ? 'Chaque libellé ouvre la liste où l’on agit.' : 'Sur tout le portefeuille — la ventilation dessous dit chez qui.'}
        >
          <AttentionChart
            rows={scoped ? attention.filter((a) => a.organization_id === scoped) : attention}
            organizationId={scoped}
          />
        </Card>

        <Card
          title="Santé de la gouvernance"
          subtitle={
            scoped
              ? nameOf.get(scoped)
              : 'Choisissez une organisation pour obtenir son indice'
          }
        >
          {scoped && health ? (
            <GovernanceHealth health={health} />
          ) : (
            <Empty>
              L’indice porte sur une organisation : il n’a pas de sens agrégé sur plusieurs
              clients, dont les périmètres n’ont rien de comparable.
            </Empty>
          )}
        </Card>
      </div>

      <div className="grid gap-5 lg:grid-cols-2">
        {!scoped ? (
          <Card title="Chez qui" subtitle="Par organisation, du plus chargé au moins chargé. Chaque compteur ouvre sa liste.">
            <AttentionByOrganization rows={attention} />
          </Card>
        ) : (
          <OrganizationRoleCard organizationId={scoped} />
        )}

        <Card
          title="Gates refusés récemment"
          subtitle="Les refus sont tracés au même titre que les autorisations."
        >
          {blockedGates?.length ? (
            <ul className="divide-y divide-ink-100">
              {blockedGates.map((entry) => (
                <li key={entry.id} className="py-2.5">
                  <p className="text-sm text-ink-900">{entry.summary}</p>
                  <p className="text-xs text-ink-400">
                    {entry.entity_ref} · {formatDate(entry.occurred_at)}
                  </p>
                </li>
              ))}
            </ul>
          ) : (
            <Empty>Aucun refus enregistré.</Empty>
          )}
        </Card>
      </div>
    </Shell>
  )
}


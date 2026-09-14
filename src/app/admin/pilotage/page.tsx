import Link from 'next/link'
import { createClient } from '@/lib/supabase/server'
import { Shell } from '@/components/shell'
import { Badge, Card, Empty, Stat, StatStrip } from '@/components/ui'
import { Disclosure } from '@/components/forms'
import { getViewerContext, isAdministrating } from '@/lib/auth/context'
import { attentionByOrganization } from '@/lib/governance/attention'
import { AttentionChart } from '@/components/governance/attention-chart'
import { GovernanceHealth, type Health } from '@/components/governance/governance-health'
import {
  ACTION_STATUS_LABELS,
  DECISION_STATUS_LABELS,
  DECISION_TYPE_LABELS,
  formatDate,
  FRESHNESS_LABELS,
  INCIDENT_STATUS_LABELS,
  RISK_LEVEL_LABELS,
  RISK_STATUS_LABELS,
  USE_CASE_STATUS_LABELS,
  type EvidenceFreshness,
  type RiskLevel,
  type UseCaseStatus,
} from '@/lib/domain/governance'
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
  const today = new Date().toISOString().slice(0, 10)

  const [
    { data: dueReviews },
    { data: highRisks },
    { data: pendingDecisions },
    { data: evidence },
    { data: overdueActions },
    { data: incidents },
    { data: blockedGates },
  ] = await Promise.all([
    supabase
      .from('ai_use_case')
      .select('id, business_ref, name, status, next_review_at, organization_id')
      .not('next_review_at', 'is', null)
      .lte('next_review_at', today)
      .order('next_review_at'),
    supabase
      .from('risk')
      .select('id, business_ref, title, residual_level, inherent_level, status, use_case_id, next_review_at, organization_id')
      .in('status', ['identified', 'analysed', 'treatment_planned', 'treatment_in_progress'])
      .order('business_ref'),
    supabase
      .from('governance_decision')
      .select('id, business_ref, subject, decision_type, status, review_due_at, use_case_id, organization_id')
      .or(`status.in.(draft,submitted),review_due_at.lte.${today}`)
      .order('review_due_at', { nullsFirst: false }),
    supabase
      .from('evidence_with_freshness')
      .select('id, business_ref, title, valid_until, freshness_status, validation_status, organization_id')
      .in('freshness_status', ['expired', 'expiring'])
      .order('valid_until'),
    supabase
      .from('action')
      .select('id, business_ref, title, due_date, status, is_blocking, use_case_id, organization_id')
      .not('status', 'in', '(done,cancelled)')
      .not('due_date', 'is', null)
      .lte('due_date', today)
      .order('due_date'),
    supabase
      .from('incident')
      .select('id, business_ref, title, severity, status, detected_at, organization_id')
      .not('status', 'eq', 'CLOSED')
      .order('detected_at', { ascending: false }),
    supabase
      .from('audit_log')
      .select('id, occurred_at, entity_ref, summary')
      .eq('action', 'gate_blocked')
      .order('occurred_at', { ascending: false })
      .limit(5),
  ])

  // Le nom de l'organisation accompagne chaque ligne : un retard anonyme oblige
  // a ouvrir la fiche pour savoir de quel client il s'agit.
  const attention = await attentionByOrganization()
  const organizations = attention.map((row) => ({
    id: row.organization_id,
    name: row.organization_name,
    total: row.total,
  }))
  const nameOf = new Map(organizations.map((o) => [o.id, o.name]))
  const scoped = organisation && nameOf.has(organisation) ? organisation : undefined
  const keep = <T extends { organization_id: string }>(rows: T[] | null) =>
    (rows ?? []).filter((row) => !scoped || row.organization_id === scoped)

  const criticalRisks = keep(highRisks).filter((r) =>
    ['high', 'critical'].includes((r.residual_level ?? r.inherent_level) as string),
  )
  const decisions = keep(pendingDecisions)
  const staleEvidence = keep(evidence)
  const actions = keep(overdueActions)
  const reviews = keep(dueReviews)
  const openIncidents = keep(incidents)

  // L'indice de sante porte sur UNE organisation : agrege sur plusieurs clients
  // il n'aurait pas de sens, leurs perimetres n'etant pas comparables.
  const { data: healthData } = scoped
    ? await supabase.rpc('governance_health', { p_organization_id: scoped, p_activity_id: null })
    : { data: null }
  const health = healthData as Health | null

  /** Nom du client, affiche seulement lorsque plusieurs sont en vue. */
  const client = (organizationId: string) =>
    scoped || organizations.length < 2 ? null : (nameOf.get(organizationId) ?? null)

  return (
    <Shell
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
        <Card title="Ce qui appelle une action" subtitle="Par nature, sur le périmètre affiché">
          <AttentionChart rows={scoped ? attention.filter((a) => a.organization_id === scoped) : attention} />
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

      <StatStrip>
        <Stat label="Actions échues" value={actions.length} tone="stop" />
        <Stat label="Incidents ouverts" value={openIncidents.length} tone="stop" />
        <Stat label="Risques élevés ouverts" value={criticalRisks.length} tone="stop" />
        <Stat label="Revues dues" value={reviews.length} tone="warn" />
        <Stat label="Décisions à traiter" value={decisions.length} tone="warn" />
        <Stat label="Preuves à renouveler" value={staleEvidence.length} tone="warn" />
      </StatStrip>

      <div className="grid gap-5 lg:grid-cols-2">
        <Disclosure
          title="Risques élevés sans traitement abouti"
          summary={`${criticalRisks.length} élément(s)`}
          tone={criticalRisks.length ? 'todo' : 'done'}
          defaultOpen={criticalRisks.length > 0 && criticalRisks.length <= 5}
        >
          {criticalRisks.length ? (
            <ul className="divide-y divide-ink-100">
              {criticalRisks.map((risk) => (
                <li key={risk.id} className="flex items-start justify-between gap-3 py-2.5">
                  <div className="min-w-0">
                    <Link
                      href={`/admin/use-cases/${risk.use_case_id}`}
                      className="text-sm text-brand-600 hover:underline"
                    >
                      {risk.title}
                    </Link>
                    <p className="text-xs text-ink-400">
                      {risk.business_ref} · {RISK_STATUS_LABELS[risk.status] ?? risk.status}
                      {client(risk.organization_id) ? ` · ${client(risk.organization_id)}` : ''}
                    </p>
                  </div>
                  <Badge tone="stop">
                    {RISK_LEVEL_LABELS[(risk.residual_level ?? risk.inherent_level) as RiskLevel]}
                  </Badge>
                </li>
              ))}
            </ul>
          ) : (
            <Empty>Aucun risque élevé en attente de traitement.</Empty>
          )}
        </Disclosure>

        <Disclosure
          title="Décisions à instruire ou à revoir"
          summary={`${decisions.length} élément(s)`}
          tone={decisions.length ? 'todo' : 'done'}
          defaultOpen={decisions.length > 0 && decisions.length <= 5}
        >
          {decisions.length ? (
            <ul className="divide-y divide-ink-100">
              {decisions.map((d) => (
                <li key={d.id} className="flex items-start justify-between gap-3 py-2.5">
                  <div className="min-w-0">
                    <Link
                      href={`/admin/use-cases/${d.use_case_id}`}
                      className="text-sm text-brand-600 hover:underline"
                    >
                      {d.subject}
                    </Link>
                    <p className="text-xs text-ink-400">
                      {d.business_ref} · {DECISION_TYPE_LABELS[d.decision_type] ?? d.decision_type}
                      {d.review_due_at ? ` · revue le ${formatDate(d.review_due_at)}` : ''}
                      {client(d.organization_id) ? ` · ${client(d.organization_id)}` : ''}
                    </p>
                  </div>
                  <Badge tone="warn">{DECISION_STATUS_LABELS[d.status] ?? d.status}</Badge>
                </li>
              ))}
            </ul>
          ) : (
            <Empty>Aucune décision en attente.</Empty>
          )}
        </Disclosure>

        <Disclosure
          title="Preuves échues ou proches de l'échéance"
          summary={`${staleEvidence.length} élément(s)`}
          tone={staleEvidence.length ? 'todo' : 'done'}
          defaultOpen={staleEvidence.length > 0 && staleEvidence.length <= 5}
        >
          {staleEvidence.length ? (
            <ul className="divide-y divide-ink-100">
              {staleEvidence.map((e) => (
                <li key={e.id} className="flex items-start justify-between gap-3 py-2.5">
                  <div className="min-w-0">
                    <p className="text-sm text-ink-900">{e.title}</p>
                    <p className="text-xs text-ink-400">
                      {e.business_ref} · valide jusqu&apos;au {formatDate(e.valid_until)}
                      {client(e.organization_id) ? ` · ${client(e.organization_id)}` : ''}
                    </p>
                  </div>
                  <Badge tone={e.freshness_status === 'expired' ? 'stop' : 'warn'}>
                    {FRESHNESS_LABELS[e.freshness_status as EvidenceFreshness]}
                  </Badge>
                </li>
              ))}
            </ul>
          ) : (
            <Empty>Toutes les preuves sont à jour.</Empty>
          )}
        </Disclosure>

        <Disclosure
          title="Actions échues"
          summary={`${actions.length} élément(s)`}
          tone={actions.length ? 'todo' : 'done'}
          defaultOpen={actions.length > 0 && actions.length <= 5}
        >
          {actions.length ? (
            <ul className="divide-y divide-ink-100">
              {actions.map((a) => (
                <li key={a.id} className="flex items-start justify-between gap-3 py-2.5">
                  <div className="min-w-0">
                    <Link
                      href={`/admin/use-cases/${a.use_case_id}`}
                      className="text-sm text-brand-600 hover:underline"
                    >
                      {a.title}
                    </Link>
                    <p className="text-xs text-ink-400">
                      {a.business_ref} · échéance {formatDate(a.due_date)}
                    </p>
                  </div>
                  {a.is_blocking ? (
                    <Badge tone="stop">Bloquante</Badge>
                  ) : (
                    <Badge>{ACTION_STATUS_LABELS[a.status] ?? a.status}</Badge>
                  )}
                </li>
              ))}
            </ul>
          ) : (
            <Empty>Aucune action échue.</Empty>
          )}
        </Disclosure>

        <Disclosure
          title="Revues de cas d'usage dues"
          summary={`${reviews.length} élément(s)`}
          tone={reviews.length ? 'todo' : 'done'}
          defaultOpen={reviews.length > 0 && reviews.length <= 5}
        >
          {reviews.length ? (
            <ul className="divide-y divide-ink-100">
              {reviews.map((uc) => (
                <li key={uc.id} className="flex items-start justify-between gap-3 py-2.5">
                  <div className="min-w-0">
                    <Link
                      href={`/admin/use-cases/${uc.id}`}
                      className="text-sm text-brand-600 hover:underline"
                    >
                      {uc.name}
                    </Link>
                    <p className="text-xs text-ink-400">
                      {uc.business_ref} · revue prévue le {formatDate(uc.next_review_at)}
                      {client(uc.organization_id) ? ` · ${client(uc.organization_id)}` : ''}
                    </p>
                  </div>
                  <Badge>{USE_CASE_STATUS_LABELS[uc.status as UseCaseStatus]}</Badge>
                </li>
              ))}
            </ul>
          ) : (
            <Empty>Aucune revue échue.</Empty>
          )}
        </Disclosure>

        <Disclosure
          title="Incidents ouverts"
          summary={`${openIncidents.length} élément(s)`}
          tone={openIncidents.length ? 'todo' : 'done'}
          defaultOpen={openIncidents.length > 0 && openIncidents.length <= 5}
        >
          {openIncidents.length ? (
            <ul className="divide-y divide-ink-100">
              {openIncidents.map((i) => (
                <li key={i.id} className="flex items-start justify-between gap-3 py-2.5">
                  <div className="min-w-0">
                    <p className="text-sm text-ink-900">{i.title}</p>
                    <p className="text-xs text-ink-400">
                      {i.business_ref} · détecté le {formatDate(i.detected_at)} ·{' '}
                      {INCIDENT_STATUS_LABELS[i.status] ?? i.status}
                      {client(i.organization_id) ? ` · ${client(i.organization_id)}` : ''}
                    </p>
                  </div>
                  <Badge tone={i.severity === 'S1' || i.severity === 'S2' ? 'stop' : 'warn'}>
                    {i.severity}
                  </Badge>
                </li>
              ))}
            </ul>
          ) : (
            <Empty>Aucun incident ouvert.</Empty>
          )}
        </Disclosure>

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


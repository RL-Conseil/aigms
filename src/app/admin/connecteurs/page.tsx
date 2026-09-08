import { createClient } from '@/lib/supabase/server'
import { Shell } from '@/components/shell'
import { Badge, Card, Empty } from '@/components/ui'
import { ConnectorActions, ConnectorForm } from '@/components/admin/connector-forms'
import { getViewerContext, isAdministrating } from '@/lib/auth/context'
import { ROLE_LABELS } from '@/lib/domain/roles'
import { formatDateTime } from '@/lib/domain/governance'
import {
  CAPABILITY_LABELS,
  CONNECTOR_CATALOG,
  CONNECTOR_HEALTH_LABELS,
  CONNECTOR_STATUS_LABELS,
  type ConnectorCapability,
  type ConnectorKind,
} from '@/lib/domain/connectors'

/**
 * Connecteurs de gouvernance.
 *
 * AIGMS ne remplace pas les plateformes specialisees : il lit chez elles des
 * metadonnees, des statuts et des preuves. Cette page rend cette promesse
 * verifiable — chaque connecteur declare ce qu'il lit, d'ou, avec quelles
 * habilitations et a quelle frequence.
 */
export default async function ConnectorsPage() {
  const viewer = await getViewerContext()

  if (!isAdministrating(viewer)) {
    return (
      <Shell title="Connecteurs">
        <Card title="Accès réservé">
          <Empty>
            La configuration des connecteurs relève de l’administration de la plateforme. Votre
            rôle — {viewer?.role ? ROLE_LABELS[viewer.role] : 'non attribué'} — ne l’inclut pas.
          </Empty>
        </Card>
      </Shell>
    )
  }

  const supabase = await createClient()
  const [{ data: connectors }, { data: runs }] = await Promise.all([
    supabase
      .from('governance_connector')
      .select(
        'id, business_ref, kind, display_name, description, source_of_truth, capabilities, base_url, credential_env_var, is_read_only, sync_frequency, status, health, last_tested_at, last_error',
      )
      .order('created_at'),
    supabase
      .from('connector_sync_run')
      .select('id, connector_id, started_at, outcome, message')
      .order('started_at', { ascending: false })
      .limit(10),
  ])

  return (
    <Shell
      title="Connecteurs"
      subtitle="Ce qu’AIGMS lit chez les plateformes spécialisées, et rien de plus."
      actions={connectors?.length ? <Badge tone="info">{connectors.length} connecteur(s)</Badge> : undefined}
    >
      <div className="mb-5 rounded-lg border border-ink-200 bg-white px-5 py-4">
        <p className="text-sm leading-relaxed text-ink-600">
          <strong className="font-semibold text-ink-900">Lecture seule et moindre privilège.</strong>{' '}
          Un connecteur importe des métadonnées, des statuts et des preuves ; il ne prend pas la main
          sur le système d’en face. Aucun secret n’est stocké ici : la base ne retient que le{' '}
          <em>nom</em> de la variable d’environnement qui le porte.
        </p>
      </div>

      <div className="grid gap-5 lg:grid-cols-5">
        <div className="lg:col-span-3">
          <Card title="Connecteurs déclarés">
            {connectors?.length ? (
              <ul className="divide-y divide-ink-100">
                {connectors.map((connector) => {
                  const entry = CONNECTOR_CATALOG[connector.kind as ConnectorKind]
                  const lastRun = runs?.find((r) => r.connector_id === connector.id)

                  return (
                    <li key={connector.id} className="py-4">
                      <div className="flex flex-wrap items-start justify-between gap-3">
                        <div className="min-w-0">
                          <p className="text-sm font-medium text-ink-900">
                            {connector.display_name}
                          </p>
                          <p className="text-xs text-ink-400">
                            {connector.business_ref} · {entry?.label ?? connector.kind} · source :{' '}
                            {connector.source_of_truth} · {connector.sync_frequency}
                          </p>

                          <div className="mt-2 flex flex-wrap gap-1.5">
                            {(connector.capabilities as ConnectorCapability[]).map((capability) => (
                              <span
                                key={capability}
                                className="rounded bg-ink-100 px-2 py-0.5 text-xs text-ink-600"
                              >
                                {CAPABILITY_LABELS[capability] ?? capability}
                              </span>
                            ))}
                            {connector.is_read_only ? (
                              <span className="rounded bg-emerald-50 px-2 py-0.5 text-xs text-emerald-800">
                                Lecture seule
                              </span>
                            ) : (
                              <span className="rounded bg-rose-50 px-2 py-0.5 text-xs text-rose-800">
                                Écriture autorisée
                              </span>
                            )}
                          </div>

                          <p className="mt-2 font-mono text-xs text-ink-500">
                            {connector.base_url ?? 'URL non renseignée'} ·{' '}
                            {connector.credential_env_var ?? 'variable non déclarée'}
                          </p>

                          {connector.last_error ? (
                            <p className="mt-1.5 text-xs text-rose-700">{connector.last_error}</p>
                          ) : null}
                          {lastRun ? (
                            <p className="mt-1 text-xs text-ink-400">
                              Dernier test : {formatDateTime(lastRun.started_at)}
                            </p>
                          ) : null}
                        </div>

                        <div className="flex shrink-0 flex-col items-end gap-2">
                          <div className="flex gap-2">
                            <Badge
                              tone={
                                connector.health === 'healthy'
                                  ? 'ok'
                                  : connector.health === 'error'
                                    ? 'stop'
                                    : 'neutral'
                              }
                            >
                              {CONNECTOR_HEALTH_LABELS[connector.health] ?? connector.health}
                            </Badge>
                            <Badge tone={connector.status === 'active' ? 'ok' : 'neutral'}>
                              {CONNECTOR_STATUS_LABELS[connector.status] ?? connector.status}
                            </Badge>
                          </div>
                          <ConnectorActions connectorId={connector.id} status={connector.status} />
                        </div>
                      </div>
                    </li>
                  )
                })}
              </ul>
            ) : (
              <Empty>
                Aucun connecteur. Déclarez-en un pour rapprocher AIGMS de vos plateformes
                existantes — la collecte reste manuelle en attendant.
              </Empty>
            )}
          </Card>
        </div>

        <div className="lg:col-span-2">
          <Card
            title="Déclarer un connecteur"
            subtitle="Le contrat d’intégration : source, capacités, habilitations, fréquence."
          >
            <ConnectorForm />
          </Card>
        </div>
      </div>
    </Shell>
  )
}

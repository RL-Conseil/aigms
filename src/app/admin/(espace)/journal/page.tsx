import Link from 'next/link'
import { Shell } from '@/components/shell'
import { Badge, Card, Empty } from '@/components/ui'
import { InfoTip } from '@/components/info-tip'
import { getViewerContext, isAdministrating } from '@/lib/auth/context'
import { ROLE_LABELS, type AppRole } from '@/lib/domain/roles'
import { formatDateTime } from '@/lib/domain/governance'
import { auditLogFacets, auditLogPage, changedKeys, parseFilters, type AuditRow } from '@/lib/admin/audit-log'
import { AuditEntry } from '@/components/admin/audit-entry'

/**
 * Journal d'audit de la plateforme.
 *
 * Tout ce qui s'ecrit dans AIGMS laisse une ligne ici, posee par des
 * declencheurs en base — aucune action serveur n'ecrit dans le journal
 * elle-meme, donc aucun chemin ne l'evite. Cet ecran le lit : filtre, montre
 * l'avant/apres de chaque ligne, et l'exporte tel quel en JSON.
 *
 * L'export est un acte sensible ; il laisse lui aussi sa ligne.
 */

const PAGE = 200

const ACTION_LABELS: Record<string, string> = {
  create: 'Création',
  update: 'Modification',
  delete: 'Suppression',
  archive: 'Archivage',
  status_transition: 'Transition',
  gate_evaluated: 'Gate évalué',
  gate_blocked: 'Gate refusé',
  decision_approved: 'Décision approuvée',
  decision_rejected: 'Décision rejetée',
  risk_accepted: 'Risque accepté',
  evidence_validated: 'Preuve validée',
  reassessment_triggered: 'Réévaluation déclenchée',
  access_granted: 'Accès ouvert',
  access_revoked: 'Accès retiré',
  login: 'Connexion',
  export: 'Export',
  read_sensitive: 'Lecture sensible',
}

const FIELD =
  'w-full rounded-md border border-ink-200 bg-white px-3 py-2 text-sm outline-none focus:border-brand-500 focus:ring-2 focus:ring-brand-500/20'

export default async function AuditJournalPage({
  searchParams,
}: {
  searchParams: Promise<Record<string, string | undefined>>
}) {
  const params = await searchParams
  const viewer = await getViewerContext()

  if (!isAdministrating(viewer)) {
    return (
      <Shell title="Journal d’audit">
        <Card title="Accès réservé">
          <Empty>
            Le journal de toute la plateforme relève de l’administration. Votre rôle —{' '}
            {viewer?.role ? ROLE_LABELS[viewer.role] : 'non attribué'} — lit le journal de chaque
            cas d’usage depuis sa fiche.
          </Empty>
        </Card>
      </Shell>
    )
  }

  const filters = parseFilters(params)
  const page = Math.max(0, Number(params.page ?? '0') || 0)
  const [rows, facets] = await Promise.all([
    auditLogPage(filters, PAGE + 1, page * PAGE),
    auditLogFacets(),
  ])
  const hasMore = rows.length > PAGE
  const shown = rows.slice(0, PAGE)

  const query = new URLSearchParams()
  for (const [k, v] of Object.entries(params)) if (v && k !== 'page') query.set(k, v)
  const exportHref = `/admin/journal/export${query.toString() ? `?${query}` : ''}`
  const pageHref = (n: number) => {
    const q = new URLSearchParams(query)
    if (n > 0) q.set('page', String(n))
    return `/admin/journal${q.toString() ? `?${q}` : ''}`
  }

  const filtering = Object.values(filters).some(Boolean)

  return (
    <Shell
      title="Journal d’audit"
      subtitle="Tout ce qui s’est écrit sur la plateforme, par qui, quand, avec l’avant et l’après."
      actions={
        <div className="flex items-center gap-3">
          <Badge tone="info">{facets.total} entrée(s)</Badge>
          <a
            href={exportHref}
            className="rounded-md bg-night-900 px-4 py-2.5 text-sm font-medium text-white hover:bg-night-800"
          >
            Exporter en JSON{filtering ? ' (filtré)' : ''}
          </a>
          <InfoTip label="Comment ce journal est produit" title="Posé par la base, pas par l’écran">
            <div className="flex flex-col gap-3 text-sm leading-relaxed text-ink-600">
              <p>
                Chaque ligne est écrite par un déclencheur en base, sur chaque insertion,
                modification et suppression de chaque table métier — et de la configuration :
                organisations, comptes, rôles, marque, référentiels. Aucune action de l’application
                n’écrit dans le journal elle-même ; aucun chemin ne l’évite, pas même une clé de
                service.
              </p>
              <p>
                <strong className="font-medium text-ink-800">Avant / après.</strong> Une
                modification porte l’état complet de la ligne avant et après ; l’écran n’affiche que
                les champs qui ont changé, l’export porte tout.
              </p>
              <p>
                <strong className="font-medium text-ink-800">Immuable.</strong> Le journal ne se
                modifie ni ne se purge depuis l’application. Une fonction de couverture, vérifiée
                par un test, refuse qu’une table métier perde son déclencheur.
              </p>
              <p>
                <strong className="font-medium text-ink-800">L’export est un acte.</strong> Il laisse
                sa propre ligne : qui, quand, quels filtres, combien d’entrées. Au plus 5 000 par
                fichier — resserrer la période au-delà.
              </p>
            </div>
          </InfoTip>
        </div>
      }
    >
      <Card title="Filtres">
        <form method="get" className="grid gap-3 sm:grid-cols-3 lg:grid-cols-6">
          <div>
            <label htmlFor="depuis" className="mb-1 block text-xs font-medium text-ink-600">Depuis</label>
            <input id="depuis" name="depuis" type="date" defaultValue={filters.since ?? ''} className={FIELD} />
          </div>
          <div>
            <label htmlFor="jusqua" className="mb-1 block text-xs font-medium text-ink-600">Jusqu’au</label>
            <input id="jusqua" name="jusqua" type="date" defaultValue={filters.until ?? ''} className={FIELD} />
          </div>
          <div>
            <label htmlFor="action" className="mb-1 block text-xs font-medium text-ink-600">Action</label>
            <select id="action" name="action" defaultValue={filters.action ?? ''} className={FIELD}>
              <option value="">Toutes</option>
              {facets.actions.map((a) => (
                <option key={a} value={a}>{ACTION_LABELS[a] ?? a}</option>
              ))}
            </select>
          </div>
          <div>
            <label htmlFor="type" className="mb-1 block text-xs font-medium text-ink-600">Objet</label>
            <select id="type" name="type" defaultValue={filters.entityType ?? ''} className={FIELD}>
              <option value="">Tous</option>
              {facets.entityTypes.map((t) => (
                <option key={t} value={t}>{t}</option>
              ))}
            </select>
          </div>
          <div>
            <label htmlFor="acteur" className="mb-1 block text-xs font-medium text-ink-600">Acteur</label>
            <input id="acteur" name="acteur" type="text" list="acteurs" defaultValue={filters.actor ?? ''} placeholder="adresse" className={FIELD} />
            <datalist id="acteurs">
              {facets.actors.map((a) => (
                <option key={a} value={a} />
              ))}
            </datalist>
          </div>
          <div>
            <label htmlFor="q" className="mb-1 block text-xs font-medium text-ink-600">Résumé ou référence</label>
            <input id="q" name="q" type="text" defaultValue={filters.search ?? ''} placeholder="EVD-2026, gate…" className={FIELD} />
          </div>
          <div className="flex items-center gap-3 sm:col-span-3 lg:col-span-6">
            <button type="submit" className="rounded-md bg-night-900 px-4 py-2 text-sm font-medium text-white hover:bg-night-800">
              Filtrer
            </button>
            {filtering ? (
              <Link href="/admin/journal" className="text-sm text-ink-600 hover:underline">
                Tout afficher
              </Link>
            ) : null}
          </div>
        </form>
      </Card>

      <div className="mt-5">
        <Card
          title="Entrées"
          subtitle={`${shown.length}${hasMore ? '+' : ''} affichée(s), des plus récentes aux plus anciennes`}
        >
          {shown.length ? (
            <ol className="divide-y divide-ink-100">
              {shown.map((row) => (
                <AuditEntry
                  key={row.id}
                  row={row}
                  actionLabel={ACTION_LABELS[row.action] ?? row.action}
                  roleLabel={row.actor_role ? (ROLE_LABELS[row.actor_role as AppRole] ?? row.actor_role) : null}
                  when={formatDateTime(row.occurred_at)}
                  changed={changedKeys(row)}
                />
              ))}
            </ol>
          ) : (
            <Empty>Aucune entrée dans ce filtre.</Empty>
          )}

          {page > 0 || hasMore ? (
            <nav aria-label="Pages du journal" className="mt-4 flex items-center justify-between border-t border-ink-100 pt-3 text-sm">
              {page > 0 ? (
                <Link href={pageHref(page - 1)} className="text-brand-600 hover:underline">← Plus récentes</Link>
              ) : <span />}
              {hasMore ? (
                <Link href={pageHref(page + 1)} className="text-brand-600 hover:underline">Plus anciennes →</Link>
              ) : <span />}
            </nav>
          ) : null}
        </Card>
      </div>
    </Shell>
  )
}

export type { AuditRow }

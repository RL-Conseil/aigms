import Link from 'next/link'
import { notFound } from 'next/navigation'
import { createClient } from '@/lib/supabase/server'
import { Shell } from '@/components/shell'
import { Badge, Card, Empty } from '@/components/ui'
import { InfoTip } from '@/components/info-tip'
import { SegmentedFilter } from '@/components/governance/segmented-filter'
import { AuditEntry } from '@/components/admin/audit-entry'
import { auditLogPage, changedKeys } from '@/lib/admin/audit-log'
import { AUDIT_ACTION_LABELS, AUDIT_FAMILIES } from '@/lib/domain/audit'
import { ROLE_LABELS, type AppRole } from '@/lib/domain/roles'
import { formatDateTime } from '@/lib/domain/governance'

/**
 * Journal d'audit d'une organisation.
 *
 * Les registres consignent les actes aboutis — decisions, preuves. Le journal
 * consigne ce qu'aucun registre ne porte : les refus (un jalon bloque, avec
 * son motif), les transitions, les validations, avec leur auteur et leur
 * heure — et il ne se reecrit pas. C'est ce qu'un auditeur demande pour
 * reconstituer un dossier ; c'est ce que lit le role Auditeur.
 *
 * C'est une lecture, pas une rubrique de travail : il a quitte la fiche du
 * cas d'usage, ou l'on agit, pour cette page, ou l'on relit — filtree par cas
 * d'usage d'un clic depuis la fiche.
 */

const PAGE = 100
const FIELD =
  'w-full rounded-md border border-ink-200 bg-white px-3 py-2 text-sm outline-none focus:border-brand-500 focus:ring-2 focus:ring-brand-500/20'

export default async function OrganizationJournalPage({
  params,
  searchParams,
}: {
  params: Promise<{ id: string }>
  searchParams: Promise<{ cas?: string; famille?: string; depuis?: string; jusqua?: string; q?: string; page?: string }>
}) {
  const { id } = await params
  const { cas, famille, depuis, jusqua, q, page: pageParam } = await searchParams
  const supabase = await createClient()

  const [{ data: organization }, { data: useCases }] = await Promise.all([
    supabase.from('organization').select('id, name').eq('id', id).maybeSingle(),
    supabase.from('ai_use_case').select('id, business_ref, name').eq('organization_id', id).order('business_ref'),
  ])
  if (!organization) notFound()

  const family = AUDIT_FAMILIES.find((f) => f.key === famille)
  const useCase = (useCases ?? []).find((u) => u.id === cas)
  const page = Math.max(0, Number(pageParam ?? '0') || 0)
  const clean = (v?: string) => (v && v.trim() ? v.trim() : undefined)

  const rows = await auditLogPage(
    {
      organizationId: id,
      useCaseId: useCase?.id,
      actions: family?.actions,
      since: clean(depuis),
      until: clean(jusqua),
      search: clean(q),
    },
    PAGE + 1,
    page * PAGE,
  )
  const hasMore = rows.length > PAGE
  const shown = rows.slice(0, PAGE)

  const base = `/admin/organizations/${id}/journal`
  const current = { cas: useCase?.id, famille: family?.key, depuis: clean(depuis), jusqua: clean(jusqua), q: clean(q) }
  const query = new URLSearchParams()
  for (const [k, v] of Object.entries(current)) if (v) query.set(k, v)
  const pageHref = (n: number) => {
    const p = new URLSearchParams(query)
    if (n > 0) p.set('page', String(n))
    return `${base}${p.toString() ? `?${p}` : ''}`
  }
  const printHref = `/admin/organizations/${id}/impression/journal${query.toString() ? `?${query}` : ''}`
  const filtering = Object.values(current).some(Boolean)

  return (
    <Shell
      breadcrumb={[
        { href: '/admin/organizations', label: 'Organisations' },
        { href: `/admin/organizations/${id}`, label: organization.name },
      ]}
      organization={{ id, section: 'apercu' }}
      title="Journal d’audit"
      subtitle="Ce qui s’est passé, par qui, quand — refus compris. Une trace qui ne se réécrit pas."
      actions={
        <div className="flex flex-wrap items-center gap-3">
          <Link
            href={printHref}
            className="rounded-md border border-ink-200 px-3.5 py-2 text-sm text-ink-700 hover:bg-ink-100"
          >
            Imprimer{filtering ? ' la sélection' : ' le journal'}
          </Link>
          <InfoTip label="À quoi sert le journal" title="Ce que les registres ne portent pas">
            <div className="flex flex-col gap-3 text-sm leading-relaxed text-ink-600">
              <p>
                Les registres de décisions et de preuves consignent les actes{' '}
                <strong className="font-medium text-ink-800">aboutis</strong>. Le journal consigne
                le reste : un jalon <strong className="font-medium text-ink-800">refusé</strong> et
                ses préconditions manquantes, une transition, une validation, une acceptation de
                risque — avec l’auteur et l’heure.
              </p>
              <p>
                Il est <strong className="font-medium text-ink-800">append-only</strong> : un
                déclencheur en base rejette toute modification ou suppression, y compris par
                l’administration. C’est ce qui permet de reconstituer un dossier après coup, et
                c’est ce que lit l’Auditeur (ISO/IEC 42001 §9.2, journalisation de l’AI Act).
              </p>
              <p>
                Il se lit ici par organisation, filtré par cas d’usage et par famille
                d’opérations. Chaque ligne se déplie sur les champs qui ont changé.
              </p>
            </div>
          </InfoTip>
        </div>
      }
    >
      <div className="mb-5 flex flex-wrap items-center gap-3">
        <SegmentedFilter
          label="Famille d’opérations"
          param="famille"
          basePath={base}
          current={current}
          selected={family?.key}
          options={[{ key: '', label: 'Tout' }, ...AUDIT_FAMILIES.map((f) => ({ key: f.key, label: f.label, hint: f.hint }))]}
        />
      </div>

      <Card title="Filtres">
        <form method="get" className="grid gap-3 sm:grid-cols-2 lg:grid-cols-5">
          {family ? <input type="hidden" name="famille" value={family.key} /> : null}
          <div className="lg:col-span-2">
            <label htmlFor="cas" className="mb-1 block text-xs font-medium text-ink-600">Cas d’usage</label>
            <select id="cas" name="cas" defaultValue={useCase?.id ?? ''} className={FIELD}>
              <option value="">Tous</option>
              {(useCases ?? []).map((u) => (
                <option key={u.id} value={u.id}>{u.business_ref} — {u.name}</option>
              ))}
            </select>
          </div>
          <div>
            <label htmlFor="depuis" className="mb-1 block text-xs font-medium text-ink-600">Depuis</label>
            <input id="depuis" name="depuis" type="date" defaultValue={clean(depuis) ?? ''} className={FIELD} />
          </div>
          <div>
            <label htmlFor="jusqua" className="mb-1 block text-xs font-medium text-ink-600">Jusqu’au</label>
            <input id="jusqua" name="jusqua" type="date" defaultValue={clean(jusqua) ?? ''} className={FIELD} />
          </div>
          <div>
            <label htmlFor="q" className="mb-1 block text-xs font-medium text-ink-600">Résumé ou référence</label>
            <input id="q" name="q" type="text" defaultValue={clean(q) ?? ''} placeholder="RSK-2026, gate…" className={FIELD} />
          </div>
          <div className="flex items-center gap-3 sm:col-span-2 lg:col-span-5">
            <button type="submit" className="rounded-md bg-night-900 px-4 py-2 text-sm font-medium text-white hover:bg-night-800">
              Filtrer
            </button>
            {filtering ? (
              <Link href={base} className="text-sm text-ink-600 hover:underline">Tout afficher</Link>
            ) : null}
          </div>
        </form>
      </Card>

      <div className="mt-5">
        <Card
          title={useCase ? `Journal — ${useCase.business_ref} ${useCase.name}` : 'Entrées'}
          subtitle={`${shown.length}${hasMore ? '+' : ''} affichée(s), des plus récentes aux plus anciennes`}
          action={useCase ? <Badge>{useCase.business_ref}</Badge> : null}
        >
          {shown.length ? (
            <ol className="divide-y divide-ink-100">
              {shown.map((row) => (
                <AuditEntry
                  key={row.id}
                  row={row}
                  actionLabel={AUDIT_ACTION_LABELS[row.action] ?? row.action}
                  roleLabel={row.actor_role ? (ROLE_LABELS[row.actor_role as AppRole] ?? row.actor_role) : null}
                  when={formatDateTime(row.occurred_at)}
                  changed={changedKeys(row)}
                />
              ))}
            </ol>
          ) : (
            <Empty>Aucune entrée dans ce filtre — ou aucune accessible depuis ce compte.</Empty>
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

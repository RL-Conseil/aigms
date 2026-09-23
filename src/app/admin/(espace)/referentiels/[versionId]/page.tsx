import Link from 'next/link'
import { notFound } from 'next/navigation'
import { createClient } from '@/lib/supabase/server'
import { Shell } from '@/components/shell'
import { Badge, Card, Empty } from '@/components/ui'
import { SegmentedFilter } from '@/components/governance/segmented-filter'
import { getViewerContext, isAdministrating } from '@/lib/auth/context'
import { ROLE_LABELS } from '@/lib/domain/roles'
import { formatDateTime } from '@/lib/domain/governance'

/**
 * Une version d'un referentiel, contrôle par contrôle.
 *
 * L'administration voit ce qu'elle a importe — ou ce que l'editeur a livre —
 * avant de le publier, et apres : un referentiel publie est gele, cette page
 * le lit tel qu'il sera instancie chez les organisations.
 */

/** Les codes de référentiel normatif, lisibles. */
function frameworkLabel(code: string): string {
  return { ISO_IEC_42001: 'ISO/IEC 42001', AI_ACT: 'AI Act', NIST_AI_RMF: 'NIST AI RMF' }[code] ?? code.replace(/_/g, ' ')
}

const STATUS_LABELS: Record<string, string> = {
  draft: 'Brouillon',
  frozen: 'Importée',
  published: 'Publiée',
  superseded: 'Remplacée',
}

const APPLICABILITY_LABELS: Record<string, string> = {
  mandatory: 'Obligatoire',
  conditional: 'Conditionnel',
  optional: 'Facultatif',
}

export default async function CatalogVersionPage({
  params,
  searchParams,
}: {
  params: Promise<{ versionId: string }>
  searchParams: Promise<{ domaine?: string; enrichis?: string }>
}) {
  const { versionId } = await params
  const { domaine, enrichis } = await searchParams
  const viewer = await getViewerContext()

  if (!isAdministrating(viewer)) {
    return (
      <Shell title="Référentiel de contrôles">
        <Card title="Accès réservé">
          <Empty>
            La lecture des référentiels relève de l’administration. Votre rôle —{' '}
            {viewer?.role ? ROLE_LABELS[viewer.role] : 'non attribué'} — en instancie les contrôles
            depuis la liste des contrôles opérationnels de chaque organisation.
          </Empty>
        </Card>
      </Shell>
    )
  }

  const supabase = await createClient()
  const [{ data: version }, { data: domains }, { data: controls }, { data: toolLinks }] = await Promise.all([
    supabase
      .from('catalog_version')
      .select(
        'id, version, status, description, declared_control_count, source_filename, imported_at, published_at, framework:framework_id (code, name, tenant_id)',
      )
      .eq('id', versionId)
      .maybeSingle(),
    supabase
      .from('catalog_domain')
      .select('id, code, name, control_count, display_order')
      .eq('version_id', versionId)
      .order('display_order'),
    supabase
      .from('catalog_control')
      .select(
        'id, control_code, title, objective, control_type, applicability, owner_role, review_frequency, expected_evidence, assessment_questions, framework_mappings, domain_id, phase',
      )
      .eq('version_id', versionId)
      .order('control_code'),
    // La couche outillage : avec quoi chaque controle-type se tient.
    supabase
      .from('catalog_tool_control')
      .select('control_code, framework_code, tool:tool_id (code, acronym, automation)'),
  ])

  if (!version) notFound()

  const framework = version.framework as unknown as { code: string; name: string; tenant_id: string | null }
  const toolsByControl = new Map<string, { code: string; acronym: string | null; automation: string | null }[]>()
  for (const link of toolLinks ?? []) {
    if (link.framework_code !== framework.code) continue
    const tool = link.tool as unknown as { code: string; acronym: string | null; automation: string | null } | null
    if (!tool) continue
    const list = toolsByControl.get(link.control_code) ?? []
    list.push(tool)
    toolsByControl.set(link.control_code, list)
  }
  const domainById = new Map((domains ?? []).map((d) => [d.id, d]))
  const rows = (controls ?? []).map((c) => ({
    ...c,
    domain: domainById.get(c.domain_id),
    enriched: Boolean(c.objective),
    evidence: (c.expected_evidence as string[]) ?? [],
    questions: (c.assessment_questions as string[]) ?? [],
    mappings: (c.framework_mappings as { framework: string; reference: string }[]) ?? [],
    applicabilityDefault: (c.applicability as { default?: string })?.default ?? null,
  }))
  const shown = rows.filter(
    (r) => (!domaine || r.domain?.code === domaine) && (enrichis !== 'oui' || r.enriched),
  )
  const enrichedCount = rows.filter((r) => r.enriched).length
  const base = `/admin/referentiels/${versionId}`

  return (
    <Shell
      breadcrumb={[
        { href: '/admin/referentiels', label: 'Référentiels de contrôles' },
        { label: `${framework.name} v${version.version}` },
      ]}
      title={`${framework.name} — version ${version.version}`}
      subtitle={version.description ?? undefined}
      actions={
        <div className="flex flex-wrap items-center gap-3">
          <Badge tone={framework.tenant_id === null ? 'info' : 'neutral'}>
            {framework.tenant_id === null ? 'Référentiel de l’éditeur' : 'Référentiel du cabinet'}
          </Badge>
          <Badge tone={version.status === 'published' ? 'ok' : 'warn'}>
            {STATUS_LABELS[version.status] ?? version.status}
          </Badge>
          <Link
            href="/admin/referentiels"
            className="rounded-md border border-ink-200 px-3.5 py-2 text-sm text-ink-700 hover:bg-ink-100"
          >
            Retour aux référentiels
          </Link>
        </div>
      }
    >
      <p className="mb-5 text-xs text-ink-500">
        {rows.length} contrôle(s) · {enrichedCount} avec objectif, preuves attendues et correspondances ·
        source {version.source_filename ?? '—'}
        {version.published_at ? ` · publiée le ${formatDateTime(version.published_at)}` : ''}
      </p>

      <div className="mb-5 flex flex-wrap gap-3">
        <SegmentedFilter
          label="Filtrer par domaine"
          param="domaine"
          basePath={base}
          current={{ enrichis }}
          selected={domaine}
          options={[
            { key: '', label: 'Tous', count: rows.length },
            ...(domains ?? []).map((d) => ({
              key: d.code,
              label: d.code,
              hint: d.name,
              count: rows.filter((r) => r.domain?.code === d.code).length,
            })),
          ]}
        />
        <SegmentedFilter
          label="Filtrer par enrichissement"
          param="enrichis"
          basePath={base}
          current={{ domaine }}
          selected={enrichis}
          options={[
            { key: '', label: 'Tous' },
            { key: 'oui', label: 'Enrichis', count: enrichedCount },
          ]}
        />
      </div>

      <Card title="Contrôles-types" subtitle={`${shown.length} contrôle(s)`}>
        {shown.length ? (
          <ul className="divide-y divide-ink-100">
            {shown.map((c) => (
              <li key={c.id} className="py-3 first:pt-0 last:pb-0">
                <div className="flex flex-wrap items-start justify-between gap-2">
                  <div className="min-w-0">
                    <p className="text-sm font-medium text-ink-900">
                      <span className="mr-2 font-mono text-xs text-ink-400">{c.control_code}</span>
                      {c.title}
                    </p>
                    <p className="text-xs text-ink-500">
                      {c.domain?.code} · {c.domain?.name}
                      {c.applicabilityDefault ? ` · ${APPLICABILITY_LABELS[c.applicabilityDefault] ?? c.applicabilityDefault}` : ''}
                      {c.owner_role ? ` · ${c.owner_role}` : ''}
                      {c.review_frequency ? ` · revue ${c.review_frequency}` : ''}
                      {c.phase ? ` · ${c.phase}` : ''}
                    </p>
                  </div>
                  {!c.enriched ? <Badge>Titre seul</Badge> : null}
                </div>
                {c.objective ? (
                  <p className="mt-1.5 text-sm leading-relaxed text-ink-700">{c.objective}</p>
                ) : null}
                {toolsByControl.get(c.control_code)?.length ? (
                  <p className="mt-1 text-xs text-ink-500">
                    Se tient avec :{' '}
                    {toolsByControl.get(c.control_code)!.map((t) => `${t.acronym ?? t.code}${t.automation === 'Automatique' ? ' (auto)' : ''}`).join(', ')}
                  </p>
                ) : null}
                {c.evidence.length || c.mappings.length ? (
                  <p className="mt-1.5 text-xs text-ink-500">
                    {c.evidence.length ? `Preuves attendues : ${c.evidence.join(' ; ')}` : ''}
                    {c.evidence.length && c.mappings.length ? ' · ' : ''}
                    {c.mappings.length
                      ? `Correspondances : ${c.mappings.map((m) => `${frameworkLabel(m.framework)} ${m.reference}`).join(', ')}`
                      : ''}
                  </p>
                ) : null}
              </li>
            ))}
          </ul>
        ) : (
          <Empty>Aucun contrôle dans ce filtre.</Empty>
        )}
      </Card>
    </Shell>
  )
}

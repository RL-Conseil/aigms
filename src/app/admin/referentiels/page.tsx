import Link from 'next/link'
import { createClient } from '@/lib/supabase/server'
import { Shell } from '@/components/shell'
import { Badge, Card, Empty } from '@/components/ui'
import { CatalogPublishForm, CatalogUploadForm } from '@/components/admin/catalog-forms'
import { InfoTip } from '@/components/info-tip'
import { getViewerContext, isAdministrating } from '@/lib/auth/context'
import { ROLE_LABELS } from '@/lib/domain/roles'
import { formatDateTime } from '@/lib/domain/governance'

/**
 * Referentiels de controles.
 *
 * Une bibliotheque de controles-types, importee depuis un paquet versionne,
 * dont les roles de gouvernance instancient des controles chez leurs clients.
 * A ne pas confondre avec les referentiels normatifs — ISO, AI Act — qui vivent
 * dans `framework` et `requirement`.
 */

const VERSION_STATUS_LABELS: Record<string, string> = {
  draft: 'Brouillon',
  frozen: 'Importé',
  published: 'Publié',
  superseded: 'Remplacé',
}

const JOB_STATUS_LABELS: Record<string, string> = {
  UPLOADED: 'Déposé',
  VALIDATED: 'Validé',
  REVIEWED: 'Relu',
  IMPORTED: 'Importé',
  PUBLISHED: 'Publié',
  REJECTED: 'Refusé',
}

export default async function CatalogPage() {
  const viewer = await getViewerContext()

  if (!isAdministrating(viewer)) {
    return (
      <Shell title="Référentiels de contrôles">
        <Card title="Accès réservé">
          <Empty>
            L’import d’un référentiel relève de l’administration de la plateforme. Votre rôle —{' '}
            {viewer?.role ? ROLE_LABELS[viewer.role] : 'non attribué'} — ne l’inclut pas. Le
            catalogue publié reste consultable depuis les écrans de gouvernance.
          </Empty>
        </Card>
      </Shell>
    )
  }

  const supabase = await createClient()

  const [{ data: versions }, { data: jobs }, { data: domains }] = await Promise.all([
    supabase
      .from('catalog_version')
      .select(
        'id, version, status, declared_control_count, source_filename, source_sha256, imported_at, published_at, framework:framework_id (code, name, tenant_id)',
      )
      .order('imported_at', { ascending: false, nullsFirst: false }),
    supabase
      .from('catalog_import_job')
      .select('id, status, source_filename, source_sha256, uploaded_at, imported_control_count, rejected_reason')
      .order('uploaded_at', { ascending: false })
      .limit(8),
    supabase
      .from('catalog_domain')
      .select('code, name, control_count, version_id, display_order')
      .order('display_order'),
  ])

  const currentVersion = versions?.find((v) => v.status === 'published') ?? versions?.[0]
  const currentDomains = domains?.filter((d) => d.version_id === currentVersion?.id) ?? []

  return (
    <Shell
      title="Référentiels de contrôles"
      subtitle="La bibliothèque de contrôles-types dont vos organisations instancient leurs contrôles."
    >
      <div className="grid gap-5 lg:grid-cols-5">
        <div className="flex flex-col gap-5 lg:col-span-3">
          <Card title="Versions">
            {versions?.length ? (
              <ul className="divide-y divide-ink-100">
                {versions.map((version) => {
                  const framework = version.framework as unknown as {
                    code: string
                    name: string
                    tenant_id: string | null
                  } | null
                  return (
                    <li key={version.id} className="flex flex-wrap items-start justify-between gap-3 py-4">
                      <div className="min-w-0">
                        <p className="text-sm font-medium text-ink-900">
                          <Link href={`/admin/referentiels/${version.id}`} className="text-brand-600 hover:underline">
                            {framework?.name ?? framework?.code} — version {version.version}
                          </Link>
                          {framework?.tenant_id === null ? (
                            <span className="ml-2 rounded bg-brand-500/10 px-1.5 py-0.5 text-[10px] font-normal text-brand-700">
                              éditeur
                            </span>
                          ) : null}
                        </p>
                        <p className="text-xs text-ink-400">
                          {version.declared_control_count ?? '—'} contrôle(s) ·{' '}
                          {version.source_filename ?? 'source inconnue'} · importé le{' '}
                          {formatDateTime(version.imported_at)}
                        </p>
                        {version.source_sha256 ? (
                          <p className="mt-1 font-mono text-[11px] text-ink-400">
                            sha256 {version.source_sha256.slice(0, 16)}…
                          </p>
                        ) : null}
                      </div>
                      <div className="flex shrink-0 flex-col items-end gap-2">
                        <Badge
                          tone={
                            version.status === 'published'
                              ? 'ok'
                              : version.status === 'superseded'
                                ? 'neutral'
                                : 'warn'
                          }
                        >
                          {VERSION_STATUS_LABELS[version.status] ?? version.status}
                        </Badge>
                        {version.status === 'frozen' ? (
                          <CatalogPublishForm versionId={version.id} />
                        ) : null}
                      </div>
                    </li>
                  )
                })}
              </ul>
            ) : (
              <Empty>
                Aucun référentiel. Celui de l’éditeur est livré par migration ; s’il manque, la base
                n’est pas à jour.
              </Empty>
            )}
          </Card>

          {currentDomains.length ? (
            <Card
              title="Domaines de la version courante"
              subtitle={`${currentDomains.length} domaine(s)`}
            >
              <ul className="grid gap-2 sm:grid-cols-2">
                {currentDomains.map((domain) => (
                  <li
                    key={domain.code}
                    className="flex items-center justify-between rounded-md border border-ink-200 px-3 py-2 text-sm"
                  >
                    <span>
                      <span className="font-mono text-xs text-ink-500">{domain.code}</span>{' '}
                      {domain.name}
                    </span>
                    <span className="text-xs tabular-nums text-ink-500">
                      {domain.control_count ?? '—'}
                    </span>
                  </li>
                ))}
              </ul>
            </Card>
          ) : null}

          <Card title="Derniers imports">
            {jobs?.length ? (
              <ul className="divide-y divide-ink-100">
                {jobs.map((job) => (
                  <li key={job.id} className="flex items-start justify-between gap-3 py-3">
                    <div className="min-w-0">
                      <p className="text-sm text-ink-900">{job.source_filename}</p>
                      <p className="text-xs text-ink-400">
                        {formatDateTime(job.uploaded_at)}
                        {job.imported_control_count
                          ? ` · ${job.imported_control_count} contrôle(s)`
                          : ''}
                      </p>
                      {job.rejected_reason ? (
                        <p className="mt-1 text-xs text-rose-700">{job.rejected_reason}</p>
                      ) : null}
                    </div>
                    <Badge
                      tone={
                        job.status === 'PUBLISHED' || job.status === 'IMPORTED'
                          ? 'ok'
                          : job.status === 'REJECTED'
                            ? 'stop'
                            : 'warn'
                      }
                    >
                      {JOB_STATUS_LABELS[job.status] ?? job.status}
                    </Badge>
                  </li>
                ))}
              </ul>
            ) : (
              <Empty>Aucun import.</Empty>
            )}
          </Card>
        </div>

        <div className="lg:col-span-2">
          <Card
            title="Importer un référentiel"
            subtitle="Dépôt, validation, aperçu, import transactionnel, publication."
            action={
              <InfoTip
                label="Ce qu’un import fait à l’application"
                title="Un référentiel de contrôles, et ce qu’il commande"
              >
                <div className="flex flex-col gap-3 text-sm leading-relaxed text-ink-600">
                  <p>
                    <strong className="font-medium text-ink-800">Ce qui s’importe ici.</strong>{' '}
                    Une bibliothèque de <em>contrôles-types</em> — le référentiel AIGMS, ou celui
                    d’un cabinet — dans laquelle les rôles de gouvernance puisent pour instancier
                    les contrôles de chaque organisation. Deux formats : le JSON canonique du
                    paquet, complet ; ou un CSV au format du modèle, une ligne par contrôle, qui ne
                    porte que l’ossature.
                  </p>
                  <p>
                    <strong className="font-medium text-ink-800">Ce qui ne s’importe pas ici.</strong>{' '}
                    Les référentiels <em>normatifs</em> — ISO/IEC 42001, AI Act — qui portent les
                    exigences de la Déclaration d’Applicabilité. Ils sont versionnés dans le dépôt
                    et livrés par migration, parce qu’une exigence mal transcrite fausserait la
                    déclaration de tous les clients. La matrice des preuves suit la même règle.
                  </p>
                  <p>
                    <strong className="font-medium text-ink-800">Ce que la publication change.</strong>{' '}
                    La version publiée devient celle que proposent les écrans de contrôles ; la
                    précédente passe « remplacée », mais les contrôles déjà instanciés chez les
                    clients ne bougent pas — ils gardent leur version d’origine. Une version
                    publiée est immuable : pour la corriger, on en dépose une nouvelle.
                  </p>
                  <p>
                    <strong className="font-medium text-ink-800">Ce que la validation garantit.</strong>{' '}
                    Rien n’entre en base avant votre confirmation, l’import est atomique, et le
                    fichier déposé, son empreinte SHA-256 et son auteur sont conservés : un import
                    reste rejouable et comparable.
                  </p>
                </div>
              </InfoTip>
            }
          >
            <CatalogUploadForm />

            <div className="mt-6 border-t border-ink-100 pt-5">
              <p className="mb-2 text-sm font-medium">Ce que la validation vérifie</p>
              <ul className="flex flex-col gap-1.5 text-[13px] leading-relaxed text-ink-600">
                <li>La structure : objet « framework », tableaux « domains » et « controls ».</li>
                <li>Les clés naturelles : <span className="font-mono">id + version</span>, sans doublon.</li>
                <li>Chaque contrôle référence un domaine présent dans le document.</li>
                <li>Le nombre de contrôles déclaré correspond au nombre porté.</li>
                <li>Une version déjà publiée n’est pas réimportée : la baseline est gelée.</li>
              </ul>
              <p className="mt-4 text-[13px] leading-relaxed text-ink-500">
                Le fichier source, son empreinte SHA-256 et son auteur sont conservés : un import
                reste rejouable et comparable.
              </p>
            </div>
          </Card>
        </div>
      </div>
    </Shell>
  )
}

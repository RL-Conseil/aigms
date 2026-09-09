import Link from 'next/link'
import { notFound } from 'next/navigation'
import { createClient } from '@/lib/supabase/server'
import { Shell } from '@/components/shell'
import { Badge, Card, Empty } from '@/components/ui'
import { Disclosure } from '@/components/forms'
import {
  EvidenceAttachForm,
  EvidenceReviewForm,
  EvidenceUploadForm,
  type ControlChoice,
} from '@/components/governance/evidence-forms'
import { FRESHNESS_LABELS, formatDate, type EvidenceFreshness } from '@/lib/domain/governance'

/**
 * Registre des preuves.
 *
 * L'ecran repond a la question que pose le chemin du risque quand il s'arrete
 * au dernier maillon : « quelle piece manque, et a quel controle ? ». Les
 * controles operants sans preuve valide sont donc mis en tete du choix, et
 * comptes en haut de page.
 */

type Row = {
  id: string
  business_ref: string
  title: string
  evidence_type: string
  source: string
  file_name: string | null
  file_size_bytes: number | null
  mime_type: string | null
  storage_path: string | null
  external_url: string | null
  content_hash: string | null
  version: string | null
  collected_at: string
  valid_until: string | null
  freshness: EvidenceFreshness
  validation_status: string
  owner_name: string | null
  validated_by_name: string | null
  validated_at: string | null
  superseded_by: string | null
  control_count: number
  control_codes: string[]
}

type Control = {
  id: string
  code: string
  name: string
  status: string
  is_mandatory: boolean
  evidence_count: number
  is_evidenced: boolean
}

const TYPE_LABELS: Record<string, string> = {
  document: 'Document',
  screenshot: 'Capture d’écran',
  log_extract: 'Extrait de journal',
  attestation: 'Attestation',
  test_result: 'Résultat de test',
  configuration: 'Configuration',
  declarative: 'Déclarative',
}

const VALIDATION_LABELS: Record<string, string> = {
  pending: 'À valider',
  validated: 'Validée',
  rejected: 'Rejetée',
  superseded: 'Remplacée',
}

function validationTone(status: string) {
  if (status === 'validated') return 'ok' as const
  if (status === 'rejected') return 'stop' as const
  if (status === 'superseded') return 'neutral' as const
  return 'warn' as const
}

function freshnessTone(freshness: EvidenceFreshness) {
  if (freshness === 'expired') return 'stop' as const
  if (freshness === 'expiring') return 'warn' as const
  if (freshness === 'fresh') return 'ok' as const
  return 'neutral' as const
}

function formatSize(bytes: number | null): string {
  if (!bytes) return '—'
  if (bytes < 1024) return `${bytes} o`
  if (bytes < 1024 * 1024) return `${Math.round(bytes / 1024)} Ko`
  return `${(bytes / (1024 * 1024)).toFixed(1)} Mo`
}

export default async function EvidencePage({
  params,
  searchParams,
}: {
  params: Promise<{ id: string }>
  searchParams: Promise<{ controle?: string }>
}) {
  const { id } = await params
  const { controle } = await searchParams
  const supabase = await createClient()

  const [{ data: organization }, { data: registerData }, { data: controlData }] = await Promise.all([
    supabase.from('organization').select('id, name, business_ref').eq('id', id).maybeSingle(),
    supabase.rpc('evidence_register', { p_organization_id: id }),
    supabase.rpc('controls_awaiting_evidence', { p_organization_id: id }),
  ])

  if (!organization) notFound()

  const rows = (registerData ?? []) as Row[]
  const controls = (controlData ?? []) as Control[]
  const choices: ControlChoice[] = controls.map((c) => ({
    id: c.id,
    code: c.code,
    name: c.name,
    is_evidenced: c.is_evidenced,
    status: c.status,
  }))

  const toValidate = rows.filter((r) => r.validation_status === 'pending').length
  const toRenew = rows.filter(
    (r) => r.validation_status === 'validated' && r.freshness !== 'fresh',
  ).length
  const uncovered = controls.filter((c) => c.status === 'operating' && !c.is_evidenced)

  return (
    <Shell
      breadcrumb={[
        { href: '/admin', label: 'Organisations' },
        { href: `/admin/organizations/${id}`, label: organization.name },
      ]}
      title="Preuves"
      subtitle="Ce que l’organisation peut produire pour démontrer que ses contrôles tiennent."
      actions={
        <Link
          href={`/admin/organizations/${id}/declaration-applicabilite`}
          className="rounded-md border border-ink-200 px-3.5 py-2 text-sm text-ink-700 hover:bg-ink-100"
        >
          Déclaration d’Applicabilité
        </Link>
      }
    >
      <div className="grid gap-5 lg:grid-cols-5">
        {/* ---------- Registre ---------- */}
        <div className="flex flex-col gap-5 lg:col-span-3">
          <Card
            title="Registre des preuves"
            subtitle={`${rows.length} pièce(s) · ${toValidate} à valider · ${toRenew} à renouveler`}
          >
            {rows.length ? (
              <ul className="flex flex-col divide-y divide-ink-100">
                {rows.map((row) => (
                  <li key={row.id} className="py-4 first:pt-0 last:pb-0">
                    <div className="flex flex-wrap items-start justify-between gap-2">
                      <div className="min-w-0">
                        <p className="text-sm font-medium text-ink-900">
                          <span className="mr-2 font-mono text-xs text-ink-400">
                            {row.business_ref}
                          </span>
                          {row.title}
                        </p>
                        <p className="mt-1 text-xs text-ink-500">
                          {TYPE_LABELS[row.evidence_type] ?? row.evidence_type} · {row.source}
                          {row.version ? ` · v${row.version}` : ''} · déposée par{' '}
                          {row.owner_name ?? '—'}
                        </p>
                      </div>
                      <div className="flex shrink-0 gap-2">
                        <Badge tone={validationTone(row.validation_status)}>
                          {VALIDATION_LABELS[row.validation_status] ?? row.validation_status}
                        </Badge>
                        <Badge tone={freshnessTone(row.freshness)}>
                          {FRESHNESS_LABELS[row.freshness]}
                        </Badge>
                      </div>
                    </div>

                    <dl className="mt-2 flex flex-wrap gap-x-5 gap-y-1 text-xs text-ink-500">
                      <div className="flex gap-1.5">
                        <dt>Échéance</dt>
                        <dd className="text-ink-700">{formatDate(row.valid_until)}</dd>
                      </div>
                      {row.storage_path ? (
                        <div className="flex gap-1.5">
                          <dt>Fichier</dt>
                          <dd className="text-ink-700">
                            {row.file_name} · {formatSize(row.file_size_bytes)}
                          </dd>
                        </div>
                      ) : null}
                      <div className="flex gap-1.5">
                        <dt>Contrôles</dt>
                        <dd className="text-ink-700">
                          {row.control_codes.length ? row.control_codes.join(', ') : '— aucun'}
                        </dd>
                      </div>
                      {row.validated_by_name ? (
                        <div className="flex gap-1.5">
                          <dt>Validée par</dt>
                          <dd className="text-ink-700">
                            {row.validated_by_name}, le {formatDate(row.validated_at)}
                          </dd>
                        </div>
                      ) : null}
                    </dl>

                    {row.content_hash ? (
                      <p className="mt-1.5 break-all font-mono text-[11px] text-ink-400">
                        {row.content_hash}
                      </p>
                    ) : null}

                    <div className="mt-3 flex flex-wrap items-start gap-x-4 gap-y-2">
                      {row.storage_path ? (
                        <a
                          href={`/admin/evidence/${row.id}/telecharger`}
                          className="text-xs font-medium text-brand-600 hover:underline"
                        >
                          Télécharger
                        </a>
                      ) : null}
                      {row.external_url ? (
                        <a
                          href={row.external_url}
                          target="_blank"
                          rel="noreferrer noopener"
                          className="text-xs font-medium text-brand-600 hover:underline"
                        >
                          Ouvrir le lien
                        </a>
                      ) : null}
                      <EvidenceReviewForm
                        organizationId={id}
                        evidenceId={row.id}
                        awaiting={row.validation_status === 'pending'}
                      />
                    </div>

                    <div className="mt-2">
                      <EvidenceAttachForm
                        organizationId={id}
                        evidenceId={row.id}
                        // Une preuve sert plusieurs controles, mais jamais deux
                        // fois le meme : on n'offre que ce qui reste a rattacher.
                        // Le code d'un controle est unique par organisation.
                        controls={choices.filter((c) => !row.control_codes.includes(c.code))}
                      />
                    </div>
                  </li>
                ))}
              </ul>
            ) : (
              <Empty>
                Aucune preuve déposée. Un contrôle sans preuve ne compte pas comme couvrant —
                c’est exactement ce qu’un auditeur vient vérifier.
              </Empty>
            )}
          </Card>
        </div>

        {/* ---------- Dépôt et manques ---------- */}
        <div className="flex flex-col gap-5 lg:col-span-2">
          <Card
            title="Déposer une preuve"
            subtitle="Un dépôt n’est pas une validation : la pièce arrive « à valider »."
          >
            <EvidenceUploadForm
              organizationId={id}
              controls={choices}
              defaultControlId={controle}
            />
          </Card>

          <Card
            title="Contrôles sans preuve valide"
            subtitle="Opérants, mais rien ne le démontre."
          >
            {uncovered.length ? (
              <ul className="flex flex-col gap-2">
                {uncovered.map((control) => (
                  <li key={control.id} className="flex items-baseline justify-between gap-2">
                    <Link
                      href={`/admin/organizations/${id}/preuves?controle=${control.id}`}
                      className="text-sm text-brand-600 hover:underline"
                    >
                      <span className="mr-2 font-mono text-xs text-ink-400">{control.code}</span>
                      {control.name}
                    </Link>
                    {control.is_mandatory ? <Badge tone="warn">Obligatoire</Badge> : null}
                  </li>
                ))}
              </ul>
            ) : (
              <Empty>Tous les contrôles opérants sont adossés à une preuve valide.</Empty>
            )}
          </Card>

          <Disclosure
            title="Où vivent les fichiers"
            summary="Compartiment privé, chemin confiné au client, lien de téléchargement éphémère"
          >
            <div className="flex flex-col gap-2 text-sm text-ink-600">
              <p>
                Les fichiers sont déposés dans un compartiment <strong>privé</strong>, sous un
                chemin <code className="font-mono text-xs">tenant/organisation/preuve/fichier</code>{' '}
                dérivé par le serveur — jamais saisi. Une politique de stockage vérifie
                l’appartenance au client à chaque lecture comme à chaque écriture.
              </p>
              <p>
                Le téléchargement passe par un lien signé valable{' '}
                <strong>une minute</strong> : la plateforme ne sert pas les fichiers elle-même, et
                un lien copié dans un courriel ne survit pas.
              </p>
              <p>
                La base ne stocke aucune URL, seulement le couple compartiment + chemin. La même
                arborescence se transpose telle quelle sur un stockage compatible S3 : c’est ce qui
                rend un hébergement chez un tiers possible sans reprise de données.
              </p>
            </div>
          </Disclosure>
        </div>
      </div>
    </Shell>
  )
}

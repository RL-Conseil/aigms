import Link from 'next/link'
import { notFound } from 'next/navigation'
import { createClient } from '@/lib/supabase/server'
import { Shell } from '@/components/shell'
import { Badge, Card, Empty } from '@/components/ui'
import { Disclosure } from '@/components/forms'
import {
  EvidenceAttachForm,
  EvidenceReviewForm,
  type ControlChoice,
  type TypologyChoice,
} from '@/components/governance/evidence-forms'
import { SegmentedFilter } from '@/components/governance/segmented-filter'
import { InfoTip } from '@/components/info-tip'
import {
  EvidenceMatrixCard,
  type MatrixGap,
  type TypologyCoverage,
} from '@/components/governance/evidence-matrix'
import {
  CRITICALITY_LABELS,
  criticalityTone,
  type ActivityProfile,
} from '@/lib/domain/activity-profile'
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
  typology_code: string | null
  typology_name: string | null
  typology_criticality: 'negligible' | 'low' | 'moderate' | 'high' | 'critical' | null
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
  searchParams: Promise<{ controle?: string; etat?: string; typologie?: string }>
}) {
  const { id } = await params
  const { controle, etat, typologie } = await searchParams
  const supabase = await createClient()

  const [
    { data: organization },
    { data: registerData },
    { data: controlData },
    { data: typologyData },
    { data: coverageData },
    { data: gapData },
  ] = await Promise.all([
    supabase
      .from('organization')
      .select('id, name, business_ref, ai_activity_profile')
      .eq('id', id)
      .maybeSingle(),
    supabase.rpc('evidence_register', { p_organization_id: id }),
    supabase.rpc('controls_awaiting_evidence', { p_organization_id: id }),
    supabase.rpc('evidence_typologies', { p_organization_id: id }),
    supabase.rpc('typology_coverage', { p_organization_id: id }),
    supabase.rpc('evidence_matrix_gaps'),
  ])

  if (!organization) notFound()

  const rows = (registerData ?? []) as Row[]
  const controls = (controlData ?? []) as Control[]
  const typologies = (typologyData ?? []) as TypologyChoice[]
  const coverage = (coverageData ?? []) as TypologyCoverage[]
  const gaps = (gapData ?? []) as MatrixGap[]
  const profile = (organization.ai_activity_profile ?? null) as ActivityProfile | null
  const choices: ControlChoice[] = controls.map((c) => ({
    id: c.id,
    code: c.code,
    name: c.name,
    is_evidenced: c.is_evidenced,
    status: c.status,
  }))

  // Un registre affiche en entier devient illisible des qu'une organisation
  // depose une preuve par controle et par trimestre. Les filtres comptent sur
  // l'ENSEMBLE du registre : leurs compteurs ne dependent pas l'un de l'autre.
  const isStale = (row: Row) =>
    row.validation_status === 'validated' && row.freshness !== 'fresh'

  const stateFilters = [
    { key: '', label: 'Toutes', count: rows.length },
    {
      key: 'a-valider',
      label: 'À valider',
      count: rows.filter((r) => r.validation_status === 'pending').length,
      tone: 'warn' as const,
    },
    {
      key: 'a-renouveler',
      label: 'À renouveler',
      count: rows.filter(isStale).length,
      tone: 'stop' as const,
    },
    {
      key: 'validees',
      label: 'Validées',
      count: rows.filter((r) => r.validation_status === 'validated').length,
    },
    {
      key: 'rejetees',
      label: 'Rejetées',
      count: rows.filter((r) => r.validation_status === 'rejected').length,
    },
  ]

  const typologyFilters = [
    { key: '', label: 'Toutes typologies' },
    // Ordonnees par criticite pour le profil : la fonction les rend deja triees.
    ...typologies.map((t) => ({
      key: t.code,
      label: t.name,
      count: rows.filter((r) => r.typology_code === t.code).length,
      tone:
        t.criticality === 'critical' || t.criticality === 'high'
          ? ('stop' as const)
          : ('neutral' as const),
    })),
    {
      key: 'aucune',
      label: 'Sans typologie',
      count: rows.filter((r) => r.typology_code === null).length,
    },
  ]

  const filtered = rows.filter((row) => {
    if (typologie === 'aucune' && row.typology_code !== null) return false
    if (typologie && typologie !== 'aucune' && row.typology_code !== typologie) return false
    if (etat === 'a-valider') return row.validation_status === 'pending'
    if (etat === 'a-renouveler') return isStale(row)
    if (etat === 'validees') return row.validation_status === 'validated'
    if (etat === 'rejetees') return row.validation_status === 'rejected'
    return true
  })

  // Plafond explicite plutot que troncature silencieuse : une preuve qu'on ne
  // voit pas sans savoir qu'elle existe est pire qu'une page longue.
  const LIMIT = 50
  const shown = filtered.slice(0, LIMIT)
  const hidden = filtered.length - shown.length

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
      organization={{ id, section: 'preuves' }}
      title="Preuves"
      subtitle="Ce que l’organisation peut produire pour démontrer que ses contrôles tiennent."
      actions={
        <div className="flex items-center gap-3">
          <Badge tone={toValidate ? 'warn' : 'neutral'}>
            {rows.length} pièce{rows.length > 1 ? 's' : ''}
          </Badge>
          <Link
            href={`/admin/organizations/${id}/preuves/deposer`}
            className="rounded-md bg-night-900 px-4 py-2.5 text-sm font-medium text-white hover:bg-night-800"
          >
            Déposer une preuve
          </Link>
          <InfoTip label="Comment lire ce registre" title="Ce que cette page présente">
            <div className="flex flex-col gap-3 text-sm leading-relaxed text-ink-600">
              <p>
                Le registre rassemble les pièces que l’organisation peut produire pour démontrer que
                ses contrôles tiennent. Une preuve n’est comptée comme couvrante que si elle est
                <strong className="font-medium text-ink-800"> validée</strong> et
                <strong className="font-medium text-ink-800"> non échue</strong> : c’est ce qu’un
                auditeur vient vérifier, et c’est le même seuil que le taux de couverture.
              </p>

              <p>
                <strong className="font-medium text-ink-800">D’où vient le classement des
                typologies.</strong> Les huit typologies de preuves techniques proviennent d’une
                matrice interne croisant chacune avec les quatre rôles vis-à-vis de l’IA au sens
                d’ISO/IEC 42001 — hébergeur, développeur, intégrateur, utilisateur métier. Le rôle
                déclaré sur la fiche de l’organisation détermine la criticité de chaque typologie, et donc
                l’ordre dans lequel elles vous sont proposées. Un hébergeur démontre l’isolation de
                ses calculs ; il n’a rien à dire sur l’équité d’un modèle qu’il n’entraîne pas.
              </p>

              <p>
                <strong className="font-medium text-ink-800">D’où viennent les contrôles.</strong>
                {' '}Ce sont ceux de l’organisation, déclarés dans son propre référentiel — soit
                créés à la main, soit importés depuis un catalogue publié. La liste proposée au
                rattachement ne présente que ceux qui ne sont pas déjà liés à la pièce : une preuve
                sert souvent plusieurs contrôles, jamais deux fois le même.
              </p>

              <p>
                <strong className="font-medium text-ink-800">Le rattachement.</strong> Il déclare
                qu’une pièce démontre un contrôle. Il se fait au dépôt, ou après coup depuis la
                ligne de la preuve — on découvre souvent en relisant qu’un rapport sert ailleurs.
                Un contrôle opérant sans preuve valide reste signalé jusqu’à ce qu’une pièce lui
                soit rattachée.
              </p>
            </div>
          </InfoTip>
        </div>
      }
    >
      <div className="grid gap-5 lg:grid-cols-5">
        {/* ---------- Registre ---------- */}
        <div className="flex flex-col gap-5 lg:col-span-3">
          <div className="flex flex-wrap gap-3">
            <SegmentedFilter
              label="Filtrer par état"
              param="etat"
              basePath={`/admin/organizations/${id}/preuves`}
              selected={etat}
              current={{ typologie, controle }}
              options={stateFilters}
            />
            <SegmentedFilter
              label="Filtrer par typologie de preuve"
              param="typologie"
              basePath={`/admin/organizations/${id}/preuves`}
              selected={typologie}
              current={{ etat, controle }}
              options={typologyFilters}
            />
          </div>

          <Card
            title="Registre des preuves"
            subtitle={`${rows.length} pièce(s) · ${toValidate} à valider · ${toRenew} à renouveler`}
            tone={toRenew ? 'stop' : toValidate ? 'warn' : 'neutral'}
          >
            {shown.length ? (
              <ul className="flex flex-col divide-y divide-ink-100">
                {shown.map((row) => (
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
                        {row.typology_name ? (
                          <p className="mt-1.5 text-xs text-ink-600">
                            <span className="mr-1.5 font-mono text-ink-400">
                              {row.typology_code}
                            </span>
                            {row.typology_name}
                            {row.typology_criticality ? (
                              <span className="ml-2 text-ink-400">
                                criticité {CRITICALITY_LABELS[row.typology_criticality].toLowerCase()}
                              </span>
                            ) : null}
                          </p>
                        ) : null}
                      </div>
                      <div className="flex shrink-0 gap-2">
                        <Badge tone={validationTone(row.validation_status)}>
                          {VALIDATION_LABELS[row.validation_status] ?? row.validation_status}
                        </Badge>
                        <Badge tone={freshnessTone(row.freshness)}>
                          {FRESHNESS_LABELS[row.freshness]}
                        </Badge>
                        {row.typology_criticality ? (
                          <Badge tone={criticalityTone(row.typology_criticality)}>
                            {CRITICALITY_LABELS[row.typology_criticality]}
                          </Badge>
                        ) : null}
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
            ) : rows.length ? (
              <Empty>
                Aucune pièce dans ce filtre.{' '}
                <Link
                  href={`/admin/organizations/${id}/preuves`}
                  className="text-brand-600 hover:underline"
                >
                  Revenir au registre complet
                </Link>
                .
              </Empty>
            ) : (
              <Empty>
                Aucune preuve déposée. Un contrôle sans preuve ne compte pas comme couvrant —
                c’est exactement ce qu’un auditeur vient vérifier.
              </Empty>
            )}

            {hidden > 0 ? (
              <p className="mt-4 border-t border-ink-100 pt-3 text-xs text-ink-500">
                {hidden} pièce{hidden > 1 ? 's' : ''} non affichée{hidden > 1 ? 's' : ''} :
                l’écran en présente {LIMIT} au plus. Restreignez par état ou par typologie pour
                atteindre les autres.
              </p>
            ) : null}
          </Card>
        </div>

        {/* ---------- Dépôt et manques ---------- */}
        <div className="flex flex-col gap-5 lg:col-span-2">
          <EvidenceMatrixCard rows={coverage} profile={profile} gaps={gaps} />

          <Card
            title="Contrôles sans preuve valide"
            subtitle="Opérants, mais rien ne le démontre."
          >
            {uncovered.length ? (
              <ul className="flex flex-col gap-2">
                {uncovered.map((control) => (
                  <li key={control.id} className="flex items-baseline justify-between gap-2">
                    <Link
                      href={`/admin/organizations/${id}/preuves/deposer?controle=${control.id}`}
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

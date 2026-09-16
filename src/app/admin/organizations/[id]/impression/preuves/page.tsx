import { notFound } from 'next/navigation'
import type { Metadata } from 'next'
import { createClient } from '@/lib/supabase/server'
import { PrintDocument } from '@/components/print/document'
import { documentIdentity } from '@/lib/governance/document-identity'
import { CRITICALITY_LABELS, type EvidenceCriticality } from '@/lib/domain/activity-profile'
import { FRESHNESS_LABELS, formatDate, type EvidenceFreshness } from '@/lib/domain/governance'

/**
 * Registre des preuves, version remise.
 *
 * La piece qu'un auditeur demande apres la declaration d'applicabilite : pour
 * chaque typologie attendue du role de l'organisation, ce que celle-ci peut
 * produire, dans quel etat de validation, jusqu'a quand, et pour quels
 * controles. Une typologie sans piece figure comme telle : c'est une
 * information, pas un trou.
 *
 * `?typologie=<code>` ne remet que cette typologie — le registre par typologie
 * que demande une revue ciblee. `aucune` isole les pieces sans typologie.
 */

export const metadata: Metadata = {
  title: 'Registre des preuves',
  robots: { index: false, follow: false },
}

type Row = {
  id: string
  business_ref: string
  title: string
  evidence_type: string
  source: string
  version: string | null
  collected_at: string
  valid_until: string | null
  freshness: EvidenceFreshness
  validation_status: string
  validated_by_name: string | null
  validated_at: string | null
  control_codes: string[]
  typology_code: string | null
  typology_name: string | null
  typology_criticality: EvidenceCriticality | null
}

type Typology = { code: string; name: string; criticality: EvidenceCriticality | null }

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

export default async function PrintableEvidencePage({
  params,
  searchParams,
}: {
  params: Promise<{ id: string }>
  searchParams: Promise<{ typologie?: string }>
}) {
  const { id } = await params
  const { typologie } = await searchParams
  const supabase = await createClient()

  const [{ data: organization, error }, { data: registerData }, { data: typologyData }, identity] =
    await Promise.all([
      supabase.from('organization').select('id, name').eq('id', id).maybeSingle(),
      supabase.rpc('evidence_register', { p_organization_id: id }),
      supabase.rpc('evidence_typologies', { p_organization_id: id }),
      documentIdentity(id),
    ])

  if (error) throw new Error(`Lecture de l’organisation refusée : ${error.message}`)
  if (!organization || !identity) notFound()

  const rows = ((registerData ?? []) as Row[]).filter((r) => r.validation_status !== 'superseded')
  const typologies = (typologyData ?? []) as Typology[]

  // Les groupes suivent l'ordre des typologies pour le role — le plus critique
  // en tete — puis les pieces sans typologie.
  const groups: { code: string | null; name: string; criticality: EvidenceCriticality | null; rows: Row[] }[] =
    typologies.map((t) => ({
      code: t.code,
      name: t.name,
      criticality: t.criticality,
      rows: rows.filter((r) => r.typology_code === t.code),
    }))
  groups.push({
    code: null,
    name: 'Sans typologie',
    criticality: null,
    rows: rows.filter((r) => r.typology_code === null),
  })

  const shown =
    typologie === 'aucune'
      ? groups.filter((g) => g.code === null)
      : typologie
        ? groups.filter((g) => g.code === typologie)
        : groups

  if (typologie && !shown.length) notFound()

  const scopeLabel =
    typologie && shown[0] ? `Typologie « ${shown[0].name} »` : 'Toutes typologies'
  const counted = shown.flatMap((g) => g.rows)
  const validated = counted.filter((r) => r.validation_status === 'validated').length
  const stale = counted.filter((r) => r.freshness === 'expired' || r.freshness === 'expiring').length

  return (
    <PrintDocument
      identity={identity}
      title="Registre des preuves"
      subtitle={scopeLabel}
      backHref={`/admin/organizations/${id}/preuves${typologie ? `?typologie=${typologie}` : ''}`}
      backLabel="Retour au registre"
    >
      <section className="doc-keep mb-7 rounded-md border border-ink-200 bg-ink-50 p-4">
        <dl className="grid grid-cols-2 gap-x-6 gap-y-2 text-[12px] sm:grid-cols-4">
          <div>
            <dt className="text-ink-500">Pièces</dt>
            <dd className="font-medium text-ink-900">{counted.length}</dd>
          </div>
          <div>
            <dt className="text-ink-500">Validées</dt>
            <dd className="font-medium text-ink-900">{validated}</dd>
          </div>
          <div>
            <dt className="text-ink-500">À renouveler</dt>
            <dd className="font-medium text-ink-900">{stale}</dd>
          </div>
          <div>
            <dt className="text-ink-500">Typologies</dt>
            <dd className="font-medium text-ink-900">
              {shown.filter((g) => g.code).length}
              {typologie ? '' : ` / ${typologies.length} attendues`}
            </dd>
          </div>
        </dl>
        <p className="mt-3 border-t border-ink-200 pt-3 text-[11px] leading-relaxed text-ink-500">
          Une preuve n’est comptée comme couvrante que si elle est validée et non échue. Les pièces
          remplacées ne figurent pas ; les typologies sans pièce figurent comme telles.
        </p>
      </section>

      {shown.map((group) => (
        <section key={group.code ?? 'aucune'} className="mb-7">
          <h2 className="mb-2 flex items-baseline justify-between gap-3 border-b border-ink-200 pb-1.5 font-serif text-base font-semibold text-ink-900">
            <span>
              {group.code ? <span className="mr-2 font-mono text-xs font-normal text-ink-400">{group.code}</span> : null}
              {group.name}
            </span>
            {group.criticality ? (
              <span className="text-[11px] font-normal text-ink-500">
                Criticité {CRITICALITY_LABELS[group.criticality].toLowerCase()} pour ce rôle
              </span>
            ) : null}
          </h2>

          {group.rows.length ? (
            <table className="w-full border-collapse text-[11px] leading-snug">
              <thead>
                <tr className="border-b border-ink-200 text-left text-ink-500">
                  <th className="w-[74px] py-1.5 pr-2 font-medium">Réf.</th>
                  <th className="py-1.5 pr-2 font-medium">Pièce</th>
                  <th className="w-[84px] py-1.5 pr-2 font-medium">Nature</th>
                  <th className="w-[92px] py-1.5 pr-2 font-medium">Validité</th>
                  <th className="w-[110px] py-1.5 pr-2 font-medium">Validation</th>
                  <th className="w-[96px] py-1.5 font-medium">Contrôles</th>
                </tr>
              </thead>
              <tbody>
                {group.rows.map((row) => (
                  <tr key={row.id} className="border-b border-ink-100 align-top">
                    <td className="py-2 pr-2 font-mono text-[10px] text-ink-500">{row.business_ref}</td>
                    <td className="py-2 pr-2">
                      <span className="font-medium text-ink-900">{row.title}</span>
                      <span className="block text-[10px] text-ink-500">
                        {row.source}
                        {row.version ? ` · v${row.version}` : ''} · collectée le {formatDate(row.collected_at)}
                      </span>
                    </td>
                    <td className="py-2 pr-2 text-ink-700">{TYPE_LABELS[row.evidence_type] ?? row.evidence_type}</td>
                    <td className="py-2 pr-2 text-ink-700">
                      {row.valid_until ? (
                        <>
                          <span className="block">{formatDate(row.valid_until)}</span>
                          <span
                            className={`block text-[10px] ${
                              row.freshness === 'expired'
                                ? 'text-stop-600'
                                : row.freshness === 'expiring'
                                  ? 'text-warn-600'
                                  : 'text-ink-500'
                            }`}
                          >
                            {FRESHNESS_LABELS[row.freshness]}
                          </span>
                        </>
                      ) : (
                        <span className="text-ink-500">Sans échéance</span>
                      )}
                    </td>
                    <td className="py-2 pr-2 text-ink-700">
                      <span className={`block ${row.validation_status === 'pending' ? 'text-warn-600' : ''}`}>
                        {VALIDATION_LABELS[row.validation_status] ?? row.validation_status}
                      </span>
                      {row.validated_by_name ? (
                        <span className="block text-[10px] text-ink-500">
                          {row.validated_by_name}
                          {row.validated_at ? ` · ${formatDate(row.validated_at)}` : ''}
                        </span>
                      ) : null}
                    </td>
                    <td className="py-2 text-ink-700">
                      {row.control_codes.length ? row.control_codes.join(', ') : <span className="text-warn-600">Aucun</span>}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          ) : (
            <p className="py-2 text-[11px] text-ink-500">
              Aucune pièce.{' '}
              {group.criticality === 'critical' || group.criticality === 'high'
                ? 'Cette typologie est attendue pour le rôle de l’organisation : l’absence est un écart à combler.'
                : ''}
            </p>
          )}
        </section>
      ))}
    </PrintDocument>
  )
}

import { Badge, Card, Empty } from '@/components/ui'
import { Disclosure } from '@/components/forms'
import {
  ACTIVITY_PROFILE_LABELS,
  CRITICALITY_LABELS,
  criticalityTone,
  type ActivityProfile,
  type EvidenceCriticality,
} from '@/lib/domain/activity-profile'

/**
 * Matrice des preuves attendues.
 *
 * Une organisation n'a pas les memes preuves a produire selon ce qu'elle fait
 * de l'IA. Cette carte rend cette difference lisible : ce que son profil appelle
 * en premier, ce qu'elle a effectivement depose, et l'ecart entre les deux.
 *
 * Elle ne classe pas par ordre de la matrice mais par CRITICITE : ce qui pese
 * le plus se lit en premier, et le reste s'efface.
 */

export type TypologyCoverage = {
  code: string
  name: string
  criticality: EvidenceCriticality | null
  evidence_total: number
  evidence_valid: number
}

export type MatrixGap = {
  typology_code: string
  typology_name: string
  framework_code: string
  framework_version: string
  reference: string
}

export function EvidenceMatrixCard({
  rows,
  profile,
  gaps,
}: {
  rows: TypologyCoverage[]
  profile: ActivityProfile | null
  gaps: MatrixGap[]
}) {
  if (!profile) {
    return (
      <Card title="Preuves attendues" subtitle="Selon le rôle exercé vis-à-vis de l’IA">
        <Empty>
          Le rôle de cette organisation vis-à-vis de l’IA n’est pas renseigné. Sans lui, aucune
          criticité ne peut être attribuée : la matrice attend des preuves très différentes d’un
          hébergeur et d’un utilisateur métier.
        </Empty>
      </Card>
    )
  }

  const demanding = rows.filter(
    (r) => r.criticality === 'critical' || r.criticality === 'high',
  )
  const missing = demanding.filter((r) => r.evidence_valid === 0)

  return (
    <Card
      title="Preuves attendues"
      subtitle={`Profil « ${ACTIVITY_PROFILE_LABELS[profile]} » · ${demanding.length} typologie(s) exigeante(s)`}
    >
      {missing.length ? (
        <p className="mb-3 rounded-md border border-stop-600/30 bg-stop-600/5 px-3.5 py-2.5 text-sm text-stop-600">
          {missing.length} typologie{missing.length > 1 ? 's' : ''} critique
          {missing.length > 1 ? 's' : ''} ou élevée{missing.length > 1 ? 's' : ''} sans aucune
          preuve valide : {missing.map((m) => m.name).join(', ')}.
        </p>
      ) : null}

      <ul className="flex flex-col divide-y divide-ink-100">
        {rows.map((row) => (
          <li key={row.code} className="py-2.5 first:pt-0 last:pb-0">
            <div className="flex flex-wrap items-baseline justify-between gap-2">
              <span className="text-sm text-ink-900">
                <span className="mr-2 font-mono text-xs text-ink-400">{row.code}</span>
                {row.name}
              </span>
              <span className="flex items-center gap-2">
                <span
                  className={`text-xs ${
                    row.evidence_valid === 0 ? 'text-ink-400' : 'text-ink-600'
                  }`}
                >
                  {row.evidence_valid}/{row.evidence_total} valide
                  {row.evidence_valid > 1 ? 's' : ''}
                </span>
                <Badge tone={criticalityTone(row.criticality)}>
                  {row.criticality ? CRITICALITY_LABELS[row.criticality] : '—'}
                </Badge>
              </span>
            </div>
          </li>
        ))}
      </ul>

      {gaps.length ? (
        <div className="mt-4">
          <Disclosure
            title="Références que le référentiel chargé ne porte pas"
            summary={`${gaps.length} référence(s) citées par la matrice, sans correspondance en base`}
          >
            <p className="mb-2 text-sm text-ink-600">
              La matrice cite ces articles ; AIGMS ne les a pas encore chargés. Les taire produirait
              une Déclaration d’Applicabilité qui paraît complète en omettant ce qu’elle ne sait pas
              rapprocher.
            </p>
            <ul className="flex flex-col gap-1 text-xs text-ink-500">
              {gaps.map((gap) => (
                <li key={`${gap.typology_code}-${gap.framework_code}-${gap.reference}`}>
                  <span className="font-mono">{gap.typology_code}</span> — {gap.framework_code}{' '}
                  {gap.reference}
                </li>
              ))}
            </ul>
          </Disclosure>
        </div>
      ) : null}
    </Card>
  )
}

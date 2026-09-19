import Link from 'next/link'
import { createClient } from '@/lib/supabase/server'
import { Badge, Card, Empty } from '@/components/ui'
import {
  ACTIVITY_PROFILE_LABELS,
  CRITICALITY_LABELS,
  criticalityTone,
  type ActivityProfile,
  type EvidenceCriticality,
} from '@/lib/domain/activity-profile'

/**
 * Le role de l'organisation vis-a-vis de l'IA, et ce qu'il rend exigeant.
 *
 * Une lecture de pilotage : le role commande la criticite de chaque typologie
 * de preuve, et ce que l'organisation doit demontrer en premier. Lecture
 * seule ici — changer le role requalifie tout le dossier, cela se fait en
 * administration, journalise.
 */
export async function OrganizationRoleCard({ organizationId }: { organizationId: string }) {
  const supabase = await createClient()
  const [{ data: organization }, { data: typologyRows }] = await Promise.all([
    supabase.from('organization').select('id, name, ai_activity_profile').eq('id', organizationId).maybeSingle(),
    supabase.rpc('typology_coverage', { p_organization_id: organizationId }),
  ])
  if (!organization) return null

  const profile = (organization.ai_activity_profile ?? null) as ActivityProfile | null
  const typologies = (typologyRows ?? []) as {
    code: string
    name: string
    criticality: EvidenceCriticality | null
    evidence_total: number
    evidence_valid: number
  }[]
  const demanding = typologies.filter((t) => t.criticality === 'critical' || t.criticality === 'high')

  return (
    <Card
      title="Rôle de l’organisation vis-à-vis de l’IA"
      subtitle={profile ? ACTIVITY_PROFILE_LABELS[profile] : 'Non renseigné — aucune criticité ne peut être attribuée'}
    >
      <p className="text-sm leading-relaxed text-ink-600">
        {profile ? (
          <>
            <span className="font-medium text-ink-900">{ACTIVITY_PROFILE_LABELS[profile]}</span>{' '}
            <span className="text-ink-500">· ISO/IEC 42001</span>
          </>
        ) : (
          'Non renseigné : aucune criticité de preuve ne peut être attribuée. L’administration de la plateforme le renseigne.'
        )}
      </p>

      {profile ? (
        <div className="mt-4 border-t border-ink-100 pt-3">
          <p className="mb-2 text-xs font-medium text-ink-600">Ce que ce rôle rend exigeant pour l’organisation</p>
          {demanding.length ? (
            <ul className="flex flex-col gap-1.5">
              {demanding.map((typology) => (
                <li key={typology.code} className="flex items-baseline justify-between gap-2 text-sm">
                  <span className="text-ink-800">
                    <span className="mr-2 font-mono text-xs text-ink-400">{typology.code}</span>
                    {typology.name}
                  </span>
                  <span className="flex shrink-0 items-center gap-2">
                    <span className={`text-xs ${typology.evidence_valid === 0 ? 'text-stop-600' : 'text-ink-500'}`}>
                      {typology.evidence_valid} preuve{typology.evidence_valid > 1 ? 's' : ''}
                    </span>
                    <Badge tone={criticalityTone(typology.criticality)}>
                      {typology.criticality ? CRITICALITY_LABELS[typology.criticality] : '—'}
                    </Badge>
                  </span>
                </li>
              ))}
            </ul>
          ) : (
            <Empty>
              Aucune typologie critique ou élevée pour ce rôle. La matrice reste consultable depuis le
              registre des preuves.
            </Empty>
          )}
          <Link
            href={`/admin/organizations/${organizationId}/preuves`}
            className="mt-3 inline-block text-xs font-medium text-brand-600 hover:underline"
          >
            Voir le registre complet et déposer une preuve
          </Link>
        </div>
      ) : null}
    </Card>
  )
}

import { SegmentedFilter } from '@/components/governance/segmented-filter'

/**
 * Filtre par organisation : cas particulier du filtre segmente.
 *
 * Le pilotage porte sur tout le perimetre accessible. Un cabinet qui suit huit
 * clients y lit huit retards meles : il lui faut pouvoir se placer chez l'un
 * d'eux sans perdre la vue d'ensemble.
 */
export function OrganizationFilter({
  organizations,
  selected,
  basePath,
}: {
  organizations: { id: string; name: string; total: number }[]
  selected?: string
  basePath: string
}) {
  return (
    <SegmentedFilter
      label="Filtrer par organisation"
      param="organisation"
      basePath={basePath}
      // « toutes » est explicite : sans parametre, la page se place sur
      // l'organisation courante.
      selected={selected ?? 'toutes'}
      options={[
        { key: 'toutes', label: 'Toutes' },
        ...organizations.map((organization) => ({
          key: organization.id,
          label: organization.name,
          count: organization.total,
          tone: organization.total ? ('warn' as const) : ('neutral' as const),
        })),
      ]}
    />
  )
}

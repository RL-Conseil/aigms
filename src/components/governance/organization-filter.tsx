import Link from 'next/link'

/**
 * Filtre par organisation.
 *
 * Le pilotage porte sur tout le perimetre accessible. Un cabinet qui suit huit
 * clients y lit huit retards meles : il lui faut pouvoir se placer chez l'un
 * d'eux sans perdre la vue d'ensemble.
 *
 * Le choix passe par l'URL, comme les vues de la carte : l'ecran reste rendu
 * cote serveur, et un lien vers « le pilotage de ce client » se partage.
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
  if (organizations.length < 2) return null

  return (
    <nav
      aria-label="Filtrer par organisation"
      className="flex flex-wrap items-center gap-1 rounded-md border border-ink-200 bg-white p-0.5"
    >
      <Link
        href={basePath}
        aria-current={selected ? undefined : 'page'}
        className={`rounded px-3 py-1.5 text-sm ${
          selected ? 'text-ink-600 hover:bg-ink-100' : 'bg-night-900 font-medium text-white'
        }`}
      >
        Toutes
      </Link>
      {organizations.map((organization) => (
        <Link
          key={organization.id}
          href={`${basePath}?organisation=${organization.id}`}
          aria-current={selected === organization.id ? 'page' : undefined}
          className={`inline-flex items-baseline rounded px-3 py-1.5 text-sm ${
            selected === organization.id
              ? 'bg-night-900 font-medium text-white'
              : 'text-ink-600 hover:bg-ink-100'
          }`}
        >
          {organization.name}
          {organization.total ? (
            <span
              className={`ml-1.5 text-xs tabular-nums ${
                selected === organization.id ? 'text-ink-300' : 'text-ink-400'
              }`}
            >
              {organization.total}
            </span>
          ) : null}
        </Link>
      ))}
    </nav>
  )
}

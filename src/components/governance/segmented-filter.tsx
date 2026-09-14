import Link from 'next/link'

/**
 * Filtre segmente, pilote par l'URL.
 *
 * Trois ecrans en avaient besoin — pilotage, Declaration d'Applicabilite,
 * registre des preuves — et les ecrire trois fois aurait produit trois
 * comportements legerement differents, exactement ce qu'on vient de corriger
 * sur les chiffres saillants.
 *
 * Deux exigences le faconnent :
 *
 *   1. **Il conserve les autres filtres.** Un filtre qui reinitialise ses
 *      voisins est un filtre qu'on n'ose plus combiner.
 *   2. **Il reste dans l'URL.** L'ecran demeure rendu cote serveur, et un lien
 *      vers « les exigences sans decision de ce client » se partage.
 *
 * Un compteur a zero reste affiche ici, contrairement aux pastilles du menu :
 * dans un filtre, savoir qu'une categorie est vide EST l'information — c'est ce
 * qui evite de cliquer pour le decouvrir.
 */

export type FilterOption = {
  /** Valeur du parametre. La chaine vide designe « tout ». */
  key: string
  label: string
  count?: number
  tone?: 'neutral' | 'warn' | 'stop'
}

export function SegmentedFilter({
  label,
  param,
  options,
  selected,
  basePath,
  current = {},
}: {
  /** Nom accessible de la barre de filtre. */
  label: string
  param: string
  options: FilterOption[]
  selected?: string
  basePath: string
  /** Parametres d'URL en vigueur, preserves d'un filtre a l'autre. */
  current?: Record<string, string | undefined>
}) {
  if (options.length < 2) return null

  const hrefFor = (key: string) => {
    const params = new URLSearchParams()
    for (const [name, value] of Object.entries(current)) {
      if (name !== param && value) params.set(name, value)
    }
    if (key) params.set(param, key)
    const query = params.toString()
    return query ? `${basePath}?${query}` : basePath
  }

  return (
    <nav
      aria-label={label}
      className="flex flex-wrap items-center gap-1 rounded-md border border-ink-200 bg-white p-0.5"
    >
      {options.map((option) => {
        const active = (selected ?? '') === option.key
        return (
          <Link
            key={option.key || 'tout'}
            href={hrefFor(option.key)}
            aria-current={active ? 'page' : undefined}
            className={`inline-flex items-baseline rounded px-3 py-1.5 text-sm ${
              active ? 'bg-night-900 font-medium text-white' : 'text-ink-600 hover:bg-ink-100'
            }`}
          >
            {option.label}
            {option.count !== undefined ? (
              <span
                className={`ml-1.5 text-xs tabular-nums ${
                  active
                    ? 'text-ink-300'
                    : option.count === 0
                      ? 'text-ink-300'
                      : option.tone === 'stop'
                        ? 'text-stop-600'
                        : option.tone === 'warn'
                          ? 'text-warn-600'
                          : 'text-ink-400'
                }`}
              >
                {option.count}
              </span>
            ) : null}
          </Link>
        )
      })}
    </nav>
  )
}

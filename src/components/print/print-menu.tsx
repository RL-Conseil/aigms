import Link from 'next/link'

/**
 * « Imprimer le registre », avec le choix de la typologie.
 *
 * Un `<details>` natif : aucun etat client, se ferme au clic ailleurs sur les
 * navigateurs recents, et la premiere entree est toujours le registre entier.
 * L'entree qui correspond au filtre en cours est marquee : on imprime en
 * general ce qu'on est en train de lire.
 */
export function PrintMenu({
  label,
  basePath,
  options,
  current,
}: {
  label: string
  /** Chemin de la vue imprimable, sans parametre. */
  basePath: string
  options: { key: string; label: string; count?: number }[]
  /** Cle en cours dans le filtre, pour la mettre en avant. */
  current?: string
}) {
  return (
    <details className="relative">
      <summary className="cursor-pointer list-none rounded-md border border-ink-200 px-3.5 py-2 text-sm text-ink-700 hover:bg-ink-100 [&::-webkit-details-marker]:hidden">
        {label} <span aria-hidden>▾</span>
      </summary>
      <ul className="absolute right-0 z-20 mt-1 w-72 rounded-md border border-ink-200 bg-white py-1 shadow-lg">
        <li>
          <Link href={basePath} className="block px-3.5 py-2 text-sm text-ink-800 hover:bg-ink-50">
            Registre complet
          </Link>
        </li>
        <li className="my-1 border-t border-ink-100" />
        <li className="px-3.5 pb-1 pt-1.5 text-[11px] font-medium uppercase tracking-wide text-ink-400">
          Par typologie
        </li>
        {options.map((option) => (
          <li key={option.key}>
            <Link
              href={`${basePath}?typologie=${option.key}`}
              className={`flex items-baseline justify-between gap-3 px-3.5 py-1.5 text-sm hover:bg-ink-50 ${
                option.key === current ? 'font-medium text-brand-700' : 'text-ink-800'
              }`}
            >
              <span className="min-w-0 truncate">{option.label}</span>
              {option.count !== undefined ? (
                <span className="shrink-0 text-xs tabular-nums text-ink-400">{option.count}</span>
              ) : null}
            </Link>
          </li>
        ))}
      </ul>
    </details>
  )
}

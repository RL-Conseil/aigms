import Link from 'next/link'

/**
 * Filtre a cocher, pilote par l'URL.
 *
 * Meme principe que `SegmentedFilter` — l'etat vit dans l'adresse, l'ecran
 * reste rendu cote serveur, et un lien vers « les controles sans preuve de ce
 * cas d'usage » se partage. Mais la ou le filtre segmente impose de choisir
 * UNE valeur, celui-ci se coche et se decoche : on restreint, ou l'on ne
 * restreint pas.
 *
 * Ce n'est pas une vraie case a cocher mais un lien qui en a l'apparence et le
 * role — `role="checkbox"` avec `aria-checked`. Une case qui declencherait une
 * navigation par JavaScript se comporterait mal sans lui ; un lien fonctionne
 * toujours, et se rouvre dans un onglet.
 */
export function CheckboxFilter({
  label,
  param,
  value,
  checked,
  count,
  basePath,
  current = {},
  hint,
}: {
  label: string
  param: string
  /** La valeur posee dans l'URL quand la case est cochee. */
  value: string
  checked: boolean
  count?: number
  basePath: string
  /** Parametres en vigueur, preserves : un filtre ne reinitialise pas ses voisins. */
  current?: Record<string, string | undefined>
  hint?: string
}) {
  const params = new URLSearchParams()
  for (const [name, v] of Object.entries(current)) {
    if (name !== param && v) params.set(name, v)
  }
  if (!checked) params.set(param, value)
  const query = params.toString()

  return (
    <Link
      href={query ? `${basePath}?${query}` : basePath}
      role="checkbox"
      aria-checked={checked}
      title={hint}
      className={`inline-flex items-center gap-2 rounded-md border px-3 py-1.5 text-sm transition-colors ${
        checked
          ? 'border-brand-600 bg-brand-600/10 text-brand-700'
          : 'border-ink-200 text-ink-600 hover:border-ink-400 hover:text-ink-800'
      }`}
    >
      <span
        aria-hidden
        className={`flex size-4 items-center justify-center rounded border text-[10px] font-bold ${
          checked ? 'border-brand-600 bg-brand-600 text-white' : 'border-ink-300'
        }`}
      >
        {checked ? '✓' : ''}
      </span>
      {label}
      {typeof count === 'number' ? (
        <span className="text-xs tabular-nums text-ink-400">{count}</span>
      ) : null}
      {hint ? <span className="sr-only">{hint}</span> : null}
    </Link>
  )
}

/**
 * Marque AIGMS.
 *
 * Le glyphe est un A dont la barre transversale se prolonge en ligne de
 * registre et s'achève sur un jalon : l'usage declare, la trace qui court, la
 * decision qui la ponctue. Il reste lisible a 16 px, taille du favicon.
 */
export function LogoMark({
  size = 32,
  className,
  tone = 'dark',
}: {
  size?: number
  className?: string
  tone?: 'dark' | 'light'
}) {
  const plate = tone === 'dark' ? 'var(--color-night-900)' : 'var(--color-night-700)'

  return (
    <svg
      width={size}
      height={size}
      viewBox="0 0 32 32"
      fill="none"
      className={className}
      role="img"
      aria-label="AIGMS"
    >
      <rect width="32" height="32" rx="7" fill={plate} />
      <path
        d="M9 23 L15 9 L18.2 16.4"
        stroke="white"
        strokeWidth="2.1"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
      <path d="M12.1 18.4 H25" stroke="white" strokeWidth="2.1" strokeLinecap="round" />
      <circle cx="25" cy="18.4" r="2.9" fill="var(--color-teal-400)" />
    </svg>
  )
}

/**
 * Bloc-marque : glyphe, nom, et mention de l'editeur.
 *
 * Trois choses varient, et c'est ce qui rend la revente en marque blanche
 * possible sans fork :
 *
 *   * `logoUrl` remplace le glyphe ET le nom par l'image deposee par le tenant —
 *     un logo revendu porte deja son propre nom, le doubler serait redondant ;
 *   * `label` remplace « AIGMS » ;
 *   * `tagline` porte « Designed by Caritis », et disparait quand elle est
 *     nulle — c'est le principe meme de la marque blanche.
 */
export function Wordmark({
  size = 32,
  className,
  tone = 'dark',
  label = 'AIGMS',
  tagline = 'Designed by Caritis',
  logoUrl = null,
}: {
  size?: number
  className?: string
  tone?: 'dark' | 'light'
  label?: string
  tagline?: string | null
  logoUrl?: string | null
}) {
  if (logoUrl) {
    return (
      /* eslint-disable-next-line @next/next/no-img-element -- URL signée d'un
         bucket privé : l'optimiseur d'images ne peut pas la revalider. */
      <img
        src={logoUrl}
        alt={label}
        style={{ height: size }}
        className={`w-auto max-w-[240px] object-contain ${className ?? ''}`}
      />
    )
  }

  return (
    <span className={`inline-flex items-center gap-3 ${className ?? ''}`}>
      <LogoMark size={size} tone={tone} />
      <span className="inline-flex items-baseline gap-2">
        <span
          className={`font-serif text-xl font-semibold tracking-tight ${
            tone === 'light' ? 'text-white' : 'text-ink-900'
          }`}
        >
          {label}
        </span>
        {tagline ? (
          <span
            className={`font-serif text-[15px] font-normal tracking-tight ${
              tone === 'light' ? 'text-white/70' : 'text-ink-600'
            }`}
          >
            <span aria-hidden="true" className="mr-1.5">
              –
            </span>
            {tagline}
          </span>
        ) : null}
      </span>
    </span>
  )
}

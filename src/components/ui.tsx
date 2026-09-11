import type { ReactNode } from 'react'

type Tone = 'neutral' | 'ok' | 'warn' | 'stop' | 'info'

const TONE_CLASSES: Record<Tone, string> = {
  neutral: 'bg-ink-100 text-ink-600 ring-ink-200',
  ok: 'bg-emerald-50 text-emerald-800 ring-emerald-200',
  warn: 'bg-amber-50 text-amber-800 ring-amber-200',
  stop: 'bg-rose-50 text-rose-800 ring-rose-200',
  info: 'bg-sky-50 text-sky-800 ring-sky-200',
}

export function Badge({ children, tone = 'neutral' }: { children: ReactNode; tone?: Tone }) {
  return (
    <span
      className={`inline-flex items-center rounded-full px-2.5 py-0.5 text-xs font-medium ring-1 ring-inset ${TONE_CLASSES[tone]}`}
    >
      {children}
    </span>
  )
}

export function Card({
  title,
  subtitle,
  action,
  children,
}: {
  title: string
  subtitle?: string
  action?: ReactNode
  children: ReactNode
}) {
  return (
    <section className="rounded-lg border border-ink-200 bg-white">
      <header className="flex items-start justify-between gap-4 border-b border-ink-100 px-5 py-3">
        <div>
          <h2 className="text-sm font-semibold text-ink-900">{title}</h2>
          {subtitle ? <p className="mt-0.5 text-xs text-ink-400">{subtitle}</p> : null}
        </div>
        {action}
      </header>
      <div className="px-5 py-4">{children}</div>
    </section>
  )
}

export function Empty({ children }: { children: ReactNode }) {
  return <p className="text-sm text-ink-400">{children}</p>
}

export function Field({ label, children }: { label: string; children: ReactNode }) {
  return (
    <div>
      <dt className="text-xs font-medium uppercase tracking-wide text-ink-400">{label}</dt>
      <dd className="mt-1 text-sm text-ink-900">{children}</dd>
    </div>
  )
}

/**
 * Chiffre saillant.
 *
 * Trois ecrans en avaient chacun leur copie, avec trois seuils de couleur
 * differents : le meme zero apparaissait gris ici, rouge la. Un chiffre ne
 * prend sa couleur que s'il appelle une action, et un zero n'en appelle jamais.
 */
export function Stat({
  label,
  value,
  total,
  tone = 'neutral',
}: {
  label: string
  value: number
  /** Affiche « value / total » lorsque la part compte plus que le nombre. */
  total?: number
  tone?: 'neutral' | 'ok' | 'warn' | 'stop'
}) {
  const color =
    value === 0 || tone === 'neutral'
      ? 'text-ink-400'
      : tone === 'ok'
        ? 'text-ok-600'
        : tone === 'warn'
          ? 'text-warn-600'
          : 'text-stop-600'

  return (
    <div className="rounded-lg border border-ink-200 bg-white px-4 py-3">
      <p className={`text-2xl font-semibold tabular-nums ${color}`}>
        {value}
        {total !== undefined ? (
          <span className="text-base font-normal text-ink-400"> / {total}</span>
        ) : null}
      </p>
      <p className="mt-0.5 text-xs text-ink-600">{label}</p>
    </div>
  )
}

/**
 * Tableau large dans une carte.
 *
 * Le defilement horizontal appartient au tableau, jamais a la page : un ecran
 * de gouvernance se lit souvent sur un portable, et une page qui glisse
 * lateralement fait perdre la colonne de gauche — celle qui nomme la ligne.
 */
export function ScrollTable({ children }: { children: ReactNode }) {
  return <div className="-mx-5 overflow-x-auto px-5">{children}</div>
}

/**
 * Bandeau de chiffres, en tete d'ecran.
 *
 * Il repond a « ou en est-on », avant le detail. Deux a quatre chiffres : au
 * dela, aucun ne ressort.
 */
export function StatStrip({ children }: { children: ReactNode }) {
  return <div className="mb-5 grid gap-3 sm:grid-cols-2 lg:grid-cols-4">{children}</div>
}

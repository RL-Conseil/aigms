import Link from 'next/link'
import type { ReactNode } from 'react'

/** Ossature commune : navigation du portefeuille et fil d'Ariane. */
export function Shell({
  breadcrumb,
  title,
  subtitle,
  actions,
  children,
}: {
  breadcrumb?: { href: string; label: string }[]
  title: string
  subtitle?: string
  actions?: ReactNode
  children: ReactNode
}) {
  return (
    <div className="min-h-screen">
      <header className="border-b border-ink-200 bg-white">
        <div className="mx-auto flex max-w-6xl items-center gap-6 px-6 py-3">
          <Link href="/portfolio" className="text-sm font-semibold text-ink-900">
            AIGMS
          </Link>
          <nav className="flex gap-4 text-sm text-ink-600">
            <Link href="/portfolio" className="hover:text-ink-900">
              Portefeuille
            </Link>
            <Link href="/dashboard" className="hover:text-ink-900">
              Pilotage
            </Link>
          </nav>
        </div>
      </header>

      <main className="mx-auto max-w-6xl px-6 py-8">
        {breadcrumb?.length ? (
          <nav aria-label="Fil d'Ariane" className="mb-3 text-xs text-ink-400">
            {breadcrumb.map((item, index) => (
              <span key={item.href}>
                {index > 0 ? <span className="px-1.5">/</span> : null}
                <Link href={item.href} className="hover:text-ink-600">
                  {item.label}
                </Link>
              </span>
            ))}
          </nav>
        ) : null}

        <div className="mb-6 flex flex-wrap items-start justify-between gap-4">
          <div>
            <h1 className="text-xl font-semibold text-ink-900">{title}</h1>
            {subtitle ? <p className="mt-1 text-sm text-ink-600">{subtitle}</p> : null}
          </div>
          {actions}
        </div>

        {children}
      </main>
    </div>
  )
}

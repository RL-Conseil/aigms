import Link from 'next/link'
import type { ReactNode } from 'react'
import { Wordmark } from '@/components/logo'
import { UserMenu } from '@/components/admin/user-menu'
import { getViewerContext, isAdministrating } from '@/lib/auth/context'
import { ROLE_LABELS } from '@/lib/domain/roles'

/**
 * Ossature de l'espace de travail.
 *
 * La navigation suit le role : l'administration de la plateforme ouvre les
 * acces, elle ne pilote pas de gouvernance, et son menu ne propose donc pas ce
 * qu'elle ne peut de toute facon pas faire. Ce n'est qu'un confort d'affichage :
 * la RLS refuserait ces actions meme si un lien y menait.
 */

type NavLink = { href: string; label: string }

const GOVERNANCE_NAV: NavLink[] = [
  { href: '/admin', label: 'Organisations' },
  { href: '/admin/pilotage', label: 'Pilotage' },
]

const ADMIN_NAV: NavLink[] = [
  { href: '/admin', label: 'Organisations' },
  { href: '/admin/comptes', label: 'Comptes et rôles' },
  { href: '/admin/connecteurs', label: 'Connecteurs' },
  { href: '/admin/referentiels', label: 'Référentiels' },
  { href: '/admin/contacts', label: 'Demandes' },
]

export async function Shell({
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
  const viewer = await getViewerContext()
  const administrating = isAdministrating(viewer)
  const nav = administrating ? ADMIN_NAV : GOVERNANCE_NAV
  const roleLabel = viewer?.role ? ROLE_LABELS[viewer.role] : 'Rôle non attribué'

  return (
    <div className="min-h-screen">
      <header className="border-b border-ink-200 bg-white">
        <div className="mx-auto flex max-w-6xl items-center gap-6 px-6 py-3">
          <Link href="/admin" aria-label="AIGMS, organisations">
            <Wordmark size={26} />
          </Link>

          <nav className="flex gap-4 text-sm text-ink-600">
            {nav.map((link) => (
              <Link key={link.href} href={link.href} className="hover:text-ink-900">
                {link.label}
              </Link>
            ))}
          </nav>

          <div className="ml-auto flex items-center gap-3">
            {viewer?.tenantName ? (
              <span className="hidden text-sm text-ink-500 lg:inline">{viewer.tenantName}</span>
            ) : null}
            {viewer ? (
              <UserMenu
                fullName={viewer.fullName}
                email={viewer.email}
                roleLabel={roleLabel}
                canSettleOrganization={!administrating}
              />
            ) : null}
          </div>
        </div>

        {administrating ? (
          <div className="border-t border-night-900/10 bg-night-900">
            <div className="mx-auto flex max-w-6xl items-center gap-3 px-6 py-2 text-white">
              <svg width="16" height="16" viewBox="0 0 18 18" fill="none" aria-hidden>
                <path
                  d="M9 1.8 L15.9 5.4 V9.9 C15.9 13.1 12.9 15.6 9 16.5 C5.1 15.6 2.1 13.1 2.1 9.9 V5.4 Z"
                  stroke="var(--color-teal-400)"
                  strokeWidth="1.5"
                  strokeLinejoin="round"
                />
                <path
                  d="M6.4 8.9 L8.3 10.8 L11.8 7.2"
                  stroke="var(--color-teal-400)"
                  strokeWidth="1.5"
                  strokeLinecap="round"
                  strokeLinejoin="round"
                />
              </svg>
              <p className="text-[13px]">
                <span className="font-semibold">Administration de la plateforme.</span>{' '}
                <span className="text-ink-200">
                  Vous ouvrez les accès : organisations, comptes et rôles. La gouvernance des cas
                  d’usage relève des rôles que vous attribuez.
                </span>
              </p>
            </div>
          </div>
        ) : null}
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

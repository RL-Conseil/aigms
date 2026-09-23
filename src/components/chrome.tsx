'use client'

import Link from 'next/link'
import { usePathname } from 'next/navigation'
import { createContext, useContext, useEffect, useMemo, useState, type ReactNode } from 'react'
import { Wordmark } from '@/components/logo'
import { NavDropdown } from '@/components/nav-dropdown'
import { UserMenu } from '@/components/admin/user-menu'
import { AttentionDot } from '@/components/governance/attention'
import type { Attention } from '@/lib/governance/attention'
import type { Branding } from '@/lib/branding'

/**
 * La barre de navigation, cote navigateur.
 *
 * Elle vit dans la mise en page du groupe `(espace)` : l'App Router la
 * CONSERVE d'une navigation a l'autre, elle ne se recalcule pas. C'est tout
 * l'objet de ADR-0029 — six allers-retours par clic s'evaporent.
 *
 * Elle doit donc savoir seule ou l'on se trouve. Deux sources, dans cet ordre :
 *
 *   1. le CHEMIN, quand il porte l'organisation — `/admin/organizations/<id>/…`.
 *      C'est le cas des trente-trois pages d'organisation, et cela vaut des le
 *      rendu serveur : aucun clignotement ;
 *   2. ce que la page ANNONCE, pour les adresses qui ne portent pas
 *      l'organisation — la fiche d'un cas d'usage. L'annonce arrive apres
 *      l'hydratation ; la barre affiche d'ici la l'organisation courante du
 *      profil.
 *
 * Les compteurs ne sont jamais rappeles : la mise en page charge l'attention de
 * TOUTES les organisations accessibles en un appel — c'est la meme fonction qui
 * sert le pilotage — et la barre y lit la ligne qui la concerne.
 */

export const ORGANIZATION_SECTIONS = [
  { key: 'apercu', label: 'Cas d’usage', href: '' },
  { key: 'processus', label: 'Processus et risques', href: '/processus' },
  { key: 'controles', label: 'Contrôles', href: '/controles' },
  { key: 'actifs', label: 'Actifs d’IA', href: '/actifs' },
  { key: 'decisions', label: 'Décisions', href: '/decisions' },
  { key: 'soa', label: 'Déclaration d’Applicabilité', href: '/declaration-applicabilite' },
  { key: 'preuves', label: 'Preuves', href: '/preuves' },
  { key: 'suivi', label: 'Suivi d’actions et d’incidents', href: '/suivi' },
  { key: 'revues', label: 'Revues de gouvernance', href: '/revues' },
] as const

export type OrganizationSection = (typeof ORGANIZATION_SECTIONS)[number]['key']

export const PRIMARY_SECTIONS = ['apercu', 'processus'] as const
export const REGISTER_SECTIONS = [
  'controles', 'actifs', 'decisions', 'soa', 'preuves', 'suivi', 'revues',
] as const

type Announcement = { organizationId: string; section: OrganizationSection } | null

const AnnounceContext = createContext<(a: Announcement) => void>(() => {})

/**
 * Ce qu'une page dit de sa place, quand le chemin ne le dit pas.
 *
 * Rien ne s'affiche : le composant n'existe que pour son effet. Il se demonte
 * avec sa page, et remet alors la barre a l'organisation du profil.
 */
export function AnnounceSection({
  organizationId,
  section,
}: {
  organizationId: string
  section: OrganizationSection
}) {
  const announce = useContext(AnnounceContext)
  useEffect(() => {
    announce({ organizationId, section })
    return () => announce(null)
  }, [announce, organizationId, section])
  return null
}

/** Ce que le chemin dit de lui-meme : organisation et section. */
function fromPathname(pathname: string): Announcement {
  const match = /^\/admin\/organizations\/([0-9a-f-]{36})(\/.*)?$/.exec(pathname)
  if (!match) return null
  const organizationId = match[1]!
  const rest = match[2] ?? ''
  // La section la plus longue qui prefixe le reste du chemin : `/preuves` et
  // `/preuves/deposer` designent le meme onglet.
  const section = [...ORGANIZATION_SECTIONS]
    .filter((s) => s.href && (rest === s.href || rest.startsWith(`${s.href}/`)))
    .sort((a, b) => b.href.length - a.href.length)[0]
  return { organizationId, section: section?.key ?? 'apercu' }
}

export function Chrome({
  viewer,
  branding,
  roleLabel,
  administrating,
  unread,
  attention,
  fallbackOrganizationId,
  adminNav,
  governanceNav,
  children,
}: {
  viewer: { fullName: string | null; email: string; tenantName: string | null } | null
  branding: Branding
  roleLabel: string
  administrating: boolean
  unread: number
  attention: Attention[]
  fallbackOrganizationId: string | null
  adminNav: { href: string; label: string }[]
  governanceNav: { href: string; label: string }[]
  children: ReactNode
}) {
  const pathname = usePathname()
  const [announced, setAnnounced] = useState<Announcement>(null)

  const here = fromPathname(pathname) ?? announced
  const organizationId = here?.organizationId ?? fallbackOrganizationId
  const activeSection = here?.section ?? null
  const activePilotage = pathname.startsWith('/admin/pilotage')

  const nav = administrating ? adminNav : governanceNav
  const orgBase = organizationId ? `/admin/organizations/${organizationId}` : null

  // L'administration n'a pas de gouvernance a suivre : lui compter des retards
  // qu'elle ne peut pas solder serait une invitation a outrepasser son role.
  const row = administrating ? null : attention.find((a) => a.organization_id === organizationId)
  const pending = administrating ? 0 : attention.reduce((n, a) => n + a.total, 0)

  const sectionCount = (key: OrganizationSection): number => {
    if (!row) return 0
    switch (key) {
      case 'preuves':
        return row.stale_evidence + row.evidence_to_review
      case 'soa':
        return row.soa_undecided
      case 'processus':
        return row.high_risks_open
      case 'suivi':
        return row.overdue_actions + row.open_incidents + row.reviews_due
      default:
        return 0
    }
  }

  const registerTotal = REGISTER_SECTIONS.reduce((n, key) => n + sectionCount(key), 0)
  const announceValue = useMemo(() => setAnnounced, [])

  return (
    <AnnounceContext.Provider value={announceValue}>
      <div className="min-h-screen">
        {/*
          Bandeau sombre : la marque et la navigation se detachent du contenu,
          qui reste clair. Les teintes sont celles de la charte — bleu nuit,
          accent bleu-vert.
        */}
        <header className="bg-night-950 text-white shadow-[0_1px_0_rgb(255_255_255/0.06)]">
          <div className="mx-auto flex max-w-6xl items-center gap-8 px-6 py-3">
            <Link
              href={administrating ? '/admin/organizations' : '/admin/pilotage'}
              aria-label={`${branding.label}, accueil`}
              className="shrink-0"
            >
              <Wordmark
                size={26}
                tone="light"
                label={branding.label}
                tagline={branding.tagline}
                logoUrl={branding.logoUrl}
              />
            </Link>

            <nav aria-label="Navigation principale" className="flex items-center gap-1 text-sm">
              {administrating ? (
                nav.map((link) => (
                  <Link
                    key={link.href}
                    href={link.href}
                    aria-current={pathname.startsWith(link.href) ? 'page' : undefined}
                    className={`inline-flex items-baseline rounded-md px-3 py-1.5 transition-colors hover:bg-white/10 hover:text-white ${
                      pathname.startsWith(link.href) ? 'bg-white/10 text-white' : 'text-white/75'
                    }`}
                  >
                    {link.label}
                  </Link>
                ))
              ) : (
                <>
                  {/*
                    Les sections de l'organisation courante — celle de la page,
                    sinon celle du profil. Sans organisation, les liens conduisent
                    a la liste : il faut en choisir une.
                  */}
                  {PRIMARY_SECTIONS.map((key) => {
                    const section = ORGANIZATION_SECTIONS.find((s) => s.key === key)!
                    const active = activeSection === key
                    return (
                      <Link
                        key={key}
                        href={orgBase ? `${orgBase}${section.href}` : '/admin/organizations'}
                        aria-current={active ? 'page' : undefined}
                        className={`inline-flex items-baseline rounded-md px-3 py-1.5 transition-colors hover:bg-white/10 hover:text-white ${
                          active ? 'bg-white/10 text-white' : 'text-white/75'
                        }`}
                      >
                        {section.label}
                        <AttentionDot
                          count={sectionCount(key)}
                          late={key === 'processus'}
                          inverted
                          label="élément(s) appelant une action"
                        />
                      </Link>
                    )
                  })}
                  <NavDropdown
                    label="Registres"
                    active={REGISTER_SECTIONS.some((key) => activeSection === key)}
                    badge={
                      <AttentionDot
                        count={registerTotal}
                        late={false}
                        inverted
                        label="élément(s) appelant une action dans les registres"
                      />
                    }
                    items={REGISTER_SECTIONS.map((key) => {
                      const section = ORGANIZATION_SECTIONS.find((s) => s.key === key)!
                      return {
                        href: orgBase ? `${orgBase}${section.href}` : '/admin/organizations',
                        label: section.label,
                        active: activeSection === key,
                        badge: (
                          <AttentionDot
                            count={sectionCount(key)}
                            late={false}
                            label="élément(s) appelant une action"
                          />
                        ),
                      }
                    })}
                  />
                  {nav.map((link) => (
                    <Link
                      key={link.href}
                      href={link.href}
                      aria-current={activePilotage ? 'page' : undefined}
                      className={`inline-flex items-baseline rounded-md px-3 py-1.5 transition-colors hover:bg-white/10 hover:text-white ${
                        activePilotage ? 'bg-white/10 text-white' : 'text-white/75'
                      }`}
                    >
                      {link.label}
                      <AttentionDot count={pending} inverted label="élément(s) appelant une action" />
                    </Link>
                  ))}
                </>
              )}
            </nav>

            <div className="ml-auto flex items-center gap-3">
              {viewer?.tenantName ? (
                <span className="hidden text-sm text-white/50 lg:inline">{viewer.tenantName}</span>
              ) : null}
              {viewer ? (
                <Link
                  href="/admin/alertes"
                  aria-label={unread ? `Mes alertes, ${unread} non lue(s)` : 'Mes alertes'}
                  className="relative inline-flex items-center rounded-md p-1.5 text-white/75 hover:bg-white/10 hover:text-white"
                >
                  <svg width="18" height="18" viewBox="0 0 24 24" fill="none" aria-hidden>
                    <path
                      d="M6 16V11a6 6 0 1 1 12 0v5l1.5 2h-15L6 16Z"
                      stroke="currentColor"
                      strokeWidth="1.6"
                      strokeLinejoin="round"
                    />
                    <path
                      d="M10 20a2 2 0 0 0 4 0"
                      stroke="currentColor"
                      strokeWidth="1.6"
                      strokeLinecap="round"
                    />
                  </svg>
                  {unread ? (
                    <span className="absolute -right-1 -top-1 inline-flex min-w-[1.1rem] items-center justify-center rounded-full bg-warn-600 px-1 text-[10px] font-semibold tabular-nums text-night-950">
                      {unread}
                    </span>
                  ) : null}
                </Link>
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
            <div className="border-t border-white/10 bg-night-900">
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
          {/*
            Averti seulement sur ecran etroit : une mention permanente serait du
            bruit pour ceux qui sont deja au bon endroit. L'application n'est pas
            bloquee pour autant — consulter depuis un telephone reste legitime.
          */}
          <p className="mb-5 rounded-md border border-warn-600/25 bg-warn-600/5 px-4 py-3 text-[13px] leading-relaxed text-ink-700 sm:hidden">
            Cet écran est étroit pour AIGMS. Cartes, matrices et déclarations se travaillent sur un
            poste de bureau ou une tablette ; ici, la consultation passe, la saisie sera
            inconfortable.
          </p>
          {children}
        </main>
      </div>
    </AnnounceContext.Provider>
  )
}

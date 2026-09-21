import Link from 'next/link'
import type { ReactNode } from 'react'
import { Wordmark } from '@/components/logo'
import { tenantBranding } from '@/lib/branding'
import { NavDropdown } from '@/components/nav-dropdown'
import { UserMenu } from '@/components/admin/user-menu'
import { getViewerContext, isAdministrating } from '@/lib/auth/context'
import { ROLE_LABELS } from '@/lib/domain/roles'
import { AttentionDot } from '@/components/governance/attention'
import { attentionFor, attentionTotal } from '@/lib/governance/attention'
import { unreadNotifications } from '@/lib/governance/notifications'
import { organizationReadiness } from '@/lib/governance/readiness'
import { ReadinessBanner } from '@/components/governance/readiness-banner'

/**
 * Ossature de l'espace de travail.
 *
 * La navigation suit le role : l'administration de la plateforme ouvre les
 * acces, elle ne pilote pas de gouvernance, et son menu ne propose donc pas ce
 * qu'elle ne peut de toute facon pas faire. Ce n'est qu'un confort d'affichage :
 * la RLS refuserait ces actions meme si un lien y menait.
 *
 * Elle se lit sur DEUX NIVEAUX. Le premier est stable — ou travailler. Le
 * second n'apparait qu'a l'interieur d'une organisation et porte ses sections,
 * chacune avec ce qui y appelle une action. Sans ce second niveau, tout ce qui
 * relevait d'un client etait enfoui sous sa fiche et ne se trouvait qu'en s'en
 * souvenant.
 *
 * Les pastilles ne decorent pas : elles evitent d'ouvrir quatre ecrans pour
 * decouvrir qu'il ne s'y passe rien.
 */

type NavLink = { href: string; label: string }

// Le premier niveau ne porte que deux destinations : ou l'on travaille, et ce
// qui appelle une action. La liste des organisations gerees a quitte le menu
// principal pour celui de l'utilisateur — on en change rarement, et l'y laisser
// donnait deux entrees concurrentes pour « organisation ».
const GOVERNANCE_NAV: NavLink[] = [{ href: '/admin/pilotage', label: 'Pilotage' }]

const ADMIN_NAV: NavLink[] = [
  { href: '/admin/organizations', label: 'Organisations' },
  { href: '/admin/comptes', label: 'Comptes et rôles' },
  { href: '/admin/connecteurs', label: 'Connecteurs' },
  { href: '/admin/referentiels', label: 'Référentiels' },
  { href: '/admin/journal', label: 'Journal' },
  { href: '/admin/contacts', label: 'Demandes' },
]

/** Sections d'une organisation, dans l'ordre ou l'on y travaille. */
export const ORGANIZATION_SECTIONS = [
  { key: 'apercu', label: 'Cas d’usage', href: '' },
  { key: 'processus', label: 'Processus et risques', href: '/processus' },
  { key: 'controles', label: 'Contrôles', href: '/controles' },
  { key: 'actifs', label: 'Actifs d’IA', href: '/actifs' },
  { key: 'decisions', label: 'Décisions', href: '/decisions' },
  { key: 'soa', label: 'Déclaration d’Applicabilité', href: '/declaration-applicabilite' },
  { key: 'preuves', label: 'Preuves', href: '/preuves' },
  { key: 'suivi', label: 'Suivi d’actions', href: '/suivi' },
  { key: 'revues', label: 'Revues de gouvernance', href: '/revues' },
] as const

/**
 * Une seule barre. Deux sections en premiere ligne — la ou l'on travaille —,
 * cinq registres sous un menu, et le pilotage. Le fil d'Ariane porte le mot
 * « Registres » sur les pages du menu, pour que l'endroit se nomme.
 */
export const PRIMARY_SECTIONS = ['apercu', 'processus'] as const
export const REGISTER_SECTIONS = ['controles', 'actifs', 'decisions', 'soa', 'preuves', 'suivi', 'revues'] as const

export type OrganizationSection = (typeof ORGANIZATION_SECTIONS)[number]['key']

export async function Shell({
  breadcrumb,
  title,
  subtitle,
  titleAside,
  actions,
  organization,
  activeNav,
  children,
}: {
  /**
   * Fil d'Ariane. Un element sans `href` est la page courante : elle se nomme
   * mais ne se clique pas — un lien vers soi-meme n'apprend rien et se teste
   * mal.
   */
  breadcrumb?: { href?: string; label: string }[]
  title: string
  subtitle?: string
  /** A droite du titre, colle a lui : un geste sur l'objet meme (modifier). */
  titleAside?: ReactNode
  actions?: ReactNode
  /** Renseigne, la barre sait quelle section est active. */
  organization?: { id: string; section: OrganizationSection }
  /** Pour les pages hors organisation : ce que la barre souligne. */
  activeNav?: 'pilotage'
  children: ReactNode
}) {
  const viewer = await getViewerContext()
  const administrating = isAdministrating(viewer)
  const nav = administrating ? ADMIN_NAV : GOVERNANCE_NAV
  const roleLabel = viewer?.role ? ROLE_LABELS[viewer.role] : 'Rôle non attribué'

  // L'administration n'a pas de gouvernance a suivre : lui compter des retards
  // qu'elle ne peut pas solder serait une invitation a outrepasser son role.
  const branding = await tenantBranding()
  const pending = administrating ? 0 : await attentionTotal()
  // Les alertes sont nominatives : elles se comptent pour tout le monde.
  const unread = viewer ? await unreadNotifications() : 0
  // Une organisation dont un role manque ne s'ecrit pas : la page le dit en tete.
  const readiness = organization ? await organizationReadiness(organization.id) : null
  // L'organisation dont la barre parle : celle de la page, sinon la courante.
  const navOrganizationId = organization?.id ?? viewer?.currentOrganizationId ?? null
  const orgBase = navOrganizationId ? `/admin/organizations/${navOrganizationId}` : null
  const orgAttention =
    navOrganizationId && !administrating ? await attentionFor(navOrganizationId) : null
  const sectionCount = (key: OrganizationSection): number => {
    if (!orgAttention) return 0
    switch (key) {
      case 'preuves':
        return orgAttention.stale_evidence + orgAttention.evidence_to_review
      case 'soa':
        return orgAttention.soa_undecided
      case 'processus':
        return orgAttention.high_risks_open
      case 'suivi':
        return orgAttention.overdue_actions + orgAttention.open_incidents + orgAttention.reviews_due
      default:
        return 0
    }
  }

  // Sur une page de registre, le fil d'Ariane nomme l'endroit : « Registres »
  // s'intercale apres l'organisation. Un jalon, pas une page.
  const isRegister = organization ? (REGISTER_SECTIONS as readonly string[]).includes(organization.section) : false
  const crumbs =
    breadcrumb && isRegister && breadcrumb.length >= 2 && !breadcrumb.some((b) => b.label === 'Registres')
      ? [...breadcrumb.slice(0, 2), { label: 'Registres' }, ...breadcrumb.slice(2)]
      : breadcrumb

  return (
    <div className="min-h-screen">
      {/*
        Bandeau sombre : la marque et la navigation se detachent du contenu,
        qui reste clair. Les teintes sont celles de la charte — bleu nuit,
        accent bleu-vert — et le bandeau des sections, en dessous, prolonge le
        meme fond un ton plus clair pour que les deux niveaux se lisent comme
        un seul bloc.
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
                  className="inline-flex items-baseline rounded-md px-3 py-1.5 text-white/75 transition-colors hover:bg-white/10 hover:text-white"
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
                  const active = organization?.section === key
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
                      <AttentionDot count={sectionCount(key)} late={key === 'processus'} inverted label="élément(s) appelant une action" />
                    </Link>
                  )
                })}
                <NavDropdown
                  label="Registres"
                  active={REGISTER_SECTIONS.some((key) => organization?.section === key)}
                  badge={
                    <AttentionDot
                      count={REGISTER_SECTIONS.reduce((n, key) => n + sectionCount(key), 0)}
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
                      active: organization?.section === key,
                      badge: <AttentionDot count={sectionCount(key)} late={false} label="élément(s) appelant une action" />,
                    }
                  })}
                />
                {nav.map((link) => (
                  <Link
                    key={link.href}
                    href={link.href}
                    aria-current={activeNav === 'pilotage' ? 'page' : undefined}
                    className={`inline-flex items-baseline rounded-md px-3 py-1.5 transition-colors hover:bg-white/10 hover:text-white ${
                      activeNav === 'pilotage' ? 'bg-white/10 text-white' : 'text-white/75'
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
                  <path d="M10 20a2 2 0 0 0 4 0" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" />
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
          poste de bureau ou une tablette ; ici, la consultation passe, la saisie sera inconfortable.
        </p>

        {crumbs?.length ? (
          <nav aria-label="Fil d'Ariane" className="mb-3 text-xs text-ink-400">
            {crumbs!.map((item, index) => (
              <span key={item.href ?? item.label}>
                {index > 0 ? <span className="px-1.5">/</span> : null}
                {item.href ? (
                  <Link href={item.href} className="hover:text-ink-600">
                    {item.label}
                  </Link>
                ) : index === crumbs!.length - 1 ? (
                  <span aria-current="page" className="text-ink-600">
                    {item.label}
                  </span>
                ) : (
                  // Un jalon qui nomme l'endroit sans etre une page : « Registres ».
                  <span>{item.label}</span>
                )}
              </span>
            ))}
          </nav>
        ) : null}

        <div className="mb-6 flex flex-wrap items-start justify-between gap-4">
          <div>
            <div className="flex items-center gap-2">
              <h1 className="text-xl font-semibold text-ink-900">{title}</h1>
              {titleAside}
            </div>
            {subtitle ? <p className="mt-1 text-sm text-ink-600">{subtitle}</p> : null}
          </div>
          {actions}
        </div>

        {readiness ? <ReadinessBanner readiness={readiness} administrating={administrating} /> : null}
        {children}
      </main>
    </div>
  )
}

import Link from 'next/link'
import type { ReactNode } from 'react'
import { Wordmark } from '@/components/logo'
import { tenantBranding } from '@/lib/branding'
import { UserMenu } from '@/components/admin/user-menu'
import { getViewerContext, isAdministrating } from '@/lib/auth/context'
import { ROLE_LABELS } from '@/lib/domain/roles'
import { AttentionDot } from '@/components/governance/attention'
import { attentionFor, attentionTotal } from '@/lib/governance/attention'

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
const GOVERNANCE_NAV: NavLink[] = [
  { href: '/admin/pilotage', label: 'Pilotage' },
  // « Cas d'usage » ouvre l'organisation courante ; /admin s'y rend pour nous.
  { href: '/admin/organizations/courante', label: 'Cas d’usage' },
]

const ADMIN_NAV: NavLink[] = [
  { href: '/admin/organizations', label: 'Organisations' },
  { href: '/admin/comptes', label: 'Comptes et rôles' },
  { href: '/admin/connecteurs', label: 'Connecteurs' },
  { href: '/admin/referentiels', label: 'Référentiels' },
  { href: '/admin/contacts', label: 'Demandes' },
]

/** Sections d'une organisation, dans l'ordre ou l'on y travaille. */
export const ORGANIZATION_SECTIONS = [
  { key: 'apercu', label: 'Cas d’usage', href: '' },
  { key: 'processus', label: 'Processus et risques', href: '/processus' },
  { key: 'controles', label: 'Contrôles', href: '/controles' },
  { key: 'preuves', label: 'Preuves', href: '/preuves' },
  { key: 'decisions', label: 'Décisions', href: '/decisions' },
  { key: 'suivi', label: 'Suivi', href: '/suivi' },
  { key: 'soa', label: 'Déclaration d’Applicabilité', href: '/declaration-applicabilite' },
] as const

export type OrganizationSection = (typeof ORGANIZATION_SECTIONS)[number]['key']

export async function Shell({
  breadcrumb,
  title,
  subtitle,
  actions,
  organization,
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
  actions?: ReactNode
  /** Renseigne pour afficher le second niveau de navigation. */
  organization?: { id: string; section: OrganizationSection }
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
  const orgAttention =
    organization && !administrating ? await attentionFor(organization.id) : null

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

          <nav aria-label="Navigation principale" className="flex gap-1 text-sm">
            {nav.map((link) => (
              <Link
                key={link.href}
                href={link.href}
                className="inline-flex items-baseline rounded-md px-3 py-1.5 text-white/75 transition-colors hover:bg-white/10 hover:text-white"
              >
                {link.label}
                {link.href === '/admin/pilotage' ? (
                  <AttentionDot count={pending} inverted label="élément(s) appelant une action" />
                ) : null}
              </Link>
            ))}
          </nav>

          <div className="ml-auto flex items-center gap-3">
            {viewer?.tenantName ? (
              <span className="hidden text-sm text-white/50 lg:inline">{viewer.tenantName}</span>
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

        {organization ? (
          <div className="border-t border-white/10 bg-night-900">
            <nav
              aria-label="Sections de l’organisation"
              className="mx-auto flex max-w-6xl flex-wrap gap-1 px-6"
            >
              {ORGANIZATION_SECTIONS.map((section) => {
                const active = section.key === organization.section
                const count =
                  orgAttention &&
                  (section.key === 'preuves'
                    ? orgAttention.stale_evidence + orgAttention.evidence_to_review
                    : section.key === 'soa'
                      ? orgAttention.soa_undecided
                      : section.key === 'processus'
                        ? orgAttention.high_risks_open
                        : section.key === 'suivi'
                          ? orgAttention.overdue_actions +
                            orgAttention.open_incidents +
                            orgAttention.reviews_due
                          : 0)

                return (
                  <Link
                    key={section.key}
                    href={`/admin/organizations/${organization.id}${section.href}`}
                    aria-current={active ? 'page' : undefined}
                    className={`inline-flex items-baseline border-b-2 px-3 py-2.5 text-sm transition-colors ${
                      active
                        ? 'border-teal-400 font-medium text-white'
                        : 'border-transparent text-white/65 hover:text-white'
                    }`}
                  >
                    {section.label}
                    <AttentionDot
                      count={count ?? 0}
                      late={section.key === 'processus'}
                      inverted
                      label="élément(s) appelant une action"
                    />
                  </Link>
                )
              })}
            </nav>
          </div>
        ) : null}

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

        {breadcrumb?.length ? (
          <nav aria-label="Fil d'Ariane" className="mb-3 text-xs text-ink-400">
            {breadcrumb.map((item, index) => (
              <span key={item.href ?? item.label}>
                {index > 0 ? <span className="px-1.5">/</span> : null}
                {item.href ? (
                  <Link href={item.href} className="hover:text-ink-600">
                    {item.label}
                  </Link>
                ) : (
                  <span aria-current="page" className="text-ink-600">
                    {item.label}
                  </span>
                )}
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

import Link from 'next/link'
import type { ReactNode } from 'react'
import { AnnounceSection } from '@/components/chrome'
import {
  ORGANIZATION_SECTIONS,
  PRIMARY_SECTIONS,
  REGISTER_SECTIONS,
  type OrganizationSection,
} from '@/lib/domain/sections'
import { getViewerContext, isAdministrating } from '@/lib/auth/context'
import { organizationReadiness } from '@/lib/governance/readiness'
import { ReadinessBanner } from '@/components/governance/readiness-banner'

/**
 * En-tete d'une page de l'espace de travail.
 *
 * Elle ne porte plus la barre de navigation : celle-ci vit dans la mise en
 * page du groupe `(espace)` et se conserve d'une navigation a l'autre
 * (ADR-0029). Ne reste ici que ce qui change avec la page — le fil d'Ariane,
 * le titre, les gestes — et la disponibilite de l'organisation, qui depend
 * d'elle.
 *
 * Le nom `Shell` et sa signature sont conserves : trente-six pages s'en
 * servent, et les renommer n'aurait rien appris a personne.
 */

// Reexportes depuis le module PUR : un composant serveur ne peut pas lire une
// donnee exportee par un module `'use client'` — il n'en recoit qu'une
// reference, et la moindre lecture leve.
export { ORGANIZATION_SECTIONS, PRIMARY_SECTIONS, REGISTER_SECTIONS }
export type { OrganizationSection }

export async function Shell({
  breadcrumb,
  title,
  subtitle,
  titleAside,
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
  /** A droite du titre, colle a lui : un geste sur l'objet meme (modifier). */
  titleAside?: ReactNode
  actions?: ReactNode
  /** Renseigne, la barre sait quelle section est active. */
  organization?: { id: string; section: OrganizationSection }
  /** Conserve pour compatibilite : la barre deduit desormais l'onglet actif. */
  activeNav?: 'pilotage'
  children: ReactNode
}) {
  // Deux lectures independantes : elles partent ensemble. Ce qui reste ici est
  // tout ce que la mise en page ne peut pas savoir — la disponibilite depend de
  // l'organisation, et la fiche d'un cas d'usage n'est pas sous son adresse.
  const [viewer, readiness] = await Promise.all([
    getViewerContext(),
    // Une organisation dont un role manque ne s'ecrit pas : la page le dit en tete.
    organization ? organizationReadiness(organization.id) : Promise.resolve(null),
  ])
  const administrating = isAdministrating(viewer)

  // Sur une page de registre, le fil d'Ariane nomme l'endroit : « Registres »
  // s'intercale apres l'organisation. Un jalon, pas une page.
  const isRegister = organization
    ? (REGISTER_SECTIONS as readonly string[]).includes(organization.section)
    : false
  const crumbs =
    breadcrumb && isRegister && breadcrumb.length >= 2 && !breadcrumb.some((b) => b.label === 'Registres')
      ? [...breadcrumb.slice(0, 2), { label: 'Registres' }, ...breadcrumb.slice(2)]
      : breadcrumb

  return (
    <>
      {/*
        Les adresses d'organisation portent leur identifiant : la barre le lit
        seule. Celles qui ne le portent pas — la fiche d'un cas d'usage — le lui
        annoncent.
      */}
      {organization ? (
        <AnnounceSection organizationId={organization.id} section={organization.section} />
      ) : null}

      {crumbs?.length ? (
        <nav aria-label="Fil d'Ariane" className="mb-3 text-xs text-ink-400">
          {crumbs.map((item, index) => (
            <span key={item.href ?? item.label}>
              {index > 0 ? <span className="px-1.5">/</span> : null}
              {item.href ? (
                <Link href={item.href} className="hover:text-ink-600">
                  {item.label}
                </Link>
              ) : index === crumbs.length - 1 ? (
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
    </>
  )
}

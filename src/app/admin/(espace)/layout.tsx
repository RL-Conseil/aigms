import type { ReactNode } from 'react'
import { Chrome } from '@/components/chrome'
import { tenantBranding } from '@/lib/branding'
import { getViewerContext, isAdministrating } from '@/lib/auth/context'
import { ROLE_LABELS } from '@/lib/domain/roles'
import { attentionByOrganization } from '@/lib/governance/attention-data'
import { unreadNotifications } from '@/lib/governance/notifications'

/**
 * Ossature de l'espace de travail.
 *
 * Elle est une MISE EN PAGE, et c'est tout son interet : l'App Router la
 * conserve d'une navigation a l'autre au lieu de la reconstruire. Ce qu'elle
 * lit ici — qui vous etes, la marque, vos alertes, ce qui appelle une action —
 * etait auparavant relu a chaque clic, par chacune des trente-six pages, en
 * six allers-retours enchaines. Voir ADR-0029.
 *
 * Le groupe `(espace)` ne change aucune adresse. Il existe pour laisser
 * DEHORS ce qui ne doit pas porter la barre : les pages d'impression, remises
 * a un auditeur, qui ont leur propre chrome.
 *
 * La navigation suit le role : l'administration de la plateforme ouvre les
 * acces, elle ne pilote pas de gouvernance, et son menu ne propose donc pas ce
 * qu'elle ne peut de toute facon pas faire. Ce n'est qu'un confort d'affichage :
 * la RLS refuserait ces actions meme si un lien y menait.
 */

// Le premier niveau ne porte que deux destinations : ou l'on travaille, et ce
// qui appelle une action. La liste des organisations gerees a quitte le menu
// principal pour celui de l'utilisateur — on en change rarement, et l'y laisser
// donnait deux entrees concurrentes pour « organisation ».
const GOVERNANCE_NAV = [{ href: '/admin/pilotage', label: 'Pilotage' }]

const ADMIN_NAV = [
  { href: '/admin/organizations', label: 'Organisations' },
  { href: '/admin/comptes', label: 'Comptes et rôles' },
  { href: '/admin/actifs-fournisseurs', label: 'Actifs et fournisseurs' },
  { href: '/admin/connecteurs', label: 'Connecteurs' },
  { href: '/admin/referentiels', label: 'Référentiels' },
  { href: '/admin/journal', label: 'Journal' },
  { href: '/admin/contacts', label: 'Demandes' },
]

export default async function EspaceLayout({ children }: { children: ReactNode }) {
  // Ce que la barre ne peut pas afficher sans : qui vous etes, et sous quelle
  // marque. Les deux partent ensemble — une seule vague.
  const [viewer, branding] = await Promise.all([getViewerContext(), tenantBranding()])
  const administrating = isAdministrating(viewer)

  /*
   * Les compteurs, eux, ne sont PAS attendus ici.
   *
   * On passe les promesses ; la barre les consomme derriere une frontiere
   * `Suspense`, pastille par pastille. Les intitules, les liens et les menus
   * s'affichent donc sans attendre la base — et une pastille qui manque une
   * fraction de seconde ne trompe personne, quand une barre qui manque une
   * seconde, si.
   *
   * `catch` plutot que rien : un compteur indisponible ne doit pas emporter la
   * navigation. La barre s'affiche alors sans pastille, ce qui est le pire cas
   * acceptable.
   *
   * `attentionByOrganization` couvre tout le portefeuille en un appel — la
   * barre y lit la ligne de l'organisation ouverte, et le total pour Pilotage.
   * L'administration n'a pas de gouvernance a suivre : lui compter des retards
   * qu'elle ne peut pas solder serait une invitation a outrepasser son role.
   */
  const unread = viewer ? unreadNotifications().catch(() => 0) : Promise.resolve(0)
  const attention =
    administrating || !viewer ? Promise.resolve([]) : attentionByOrganization().catch(() => [])

  return (
    <Chrome
      viewer={
        viewer
          ? { fullName: viewer.fullName, email: viewer.email, tenantName: viewer.tenantName }
          : null
      }
      branding={branding}
      roleLabel={viewer?.role ? ROLE_LABELS[viewer.role] : 'Rôle non attribué'}
      administrating={administrating}
      unread={unread}
      attention={attention}
      fallbackOrganizationId={viewer?.currentOrganizationId ?? null}
      adminNav={ADMIN_NAV}
      governanceNav={GOVERNANCE_NAV}
    >
      {children}
    </Chrome>
  )
}

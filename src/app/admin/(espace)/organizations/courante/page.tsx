import { redirect } from 'next/navigation'
import { getViewerContext, isAdministrating } from '@/lib/auth/context'

/**
 * « Cas d'usage », dans la navigation principale : l'organisation courante.
 *
 * Le lien du menu ne peut pas porter l'identifiant — il est rendu avant de
 * savoir sur quelle organisation la personne se trouve. Cette route le resout
 * et redirige ; sans organisation courante, la liste permet d'en choisir une.
 */
export default async function CurrentOrganizationPage() {
  const viewer = await getViewerContext()
  if (!viewer) redirect('/')
  if (isAdministrating(viewer)) redirect('/admin/organizations')
  if (viewer.currentOrganizationId) redirect(`/admin/organizations/${viewer.currentOrganizationId}`)
  redirect('/admin/organizations')
}

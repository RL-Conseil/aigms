import { redirect } from 'next/navigation'
import { getViewerContext, isAdministrating } from '@/lib/auth/context'

/**
 * Racine de l'espace de travail.
 *
 * Elle ne montre rien d'elle-meme : elle conduit la ou l'on commence. Pour un
 * role de gouvernance, c'est le pilotage — ce qui appelle une action, place
 * sur l'organisation courante. Pour l'administration, la liste des
 * organisations : c'est son metier.
 */
export default async function WorkspaceRoot() {
  const viewer = await getViewerContext()
  if (!viewer) redirect('/')

  if (isAdministrating(viewer)) redirect('/admin/organizations')
  redirect('/admin/pilotage')
}

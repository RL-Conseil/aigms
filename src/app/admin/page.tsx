import { redirect } from 'next/navigation'
import { Shell } from '@/components/shell'
import { Card, Empty } from '@/components/ui'
import Link from 'next/link'
import { getViewerContext, isAdministrating } from '@/lib/auth/context'

/**
 * Racine de l'espace de travail.
 *
 * Elle ne montre rien d'elle-meme : elle conduit la ou l'on travaille. Une
 * personne se place sur UNE organisation a la fois, et c'est sa fiche qu'elle
 * ouvre en arrivant — pas une liste dans laquelle se retrouver a chaque
 * connexion.
 *
 * Trois cas, et un seul detour :
 *
 *   * une organisation courante  -> sa fiche ;
 *   * l'administration           -> la liste, c'est son metier ;
 *   * un choix a faire ou rien   -> on le dit, sans rediriger en boucle.
 */
export default async function WorkspaceRoot() {
  const viewer = await getViewerContext()
  if (!viewer) redirect('/')

  if (isAdministrating(viewer)) redirect('/admin/organizations')
  if (viewer.currentOrganizationId) redirect(`/admin/organizations/${viewer.currentOrganizationId}`)

  return (
    <Shell
      title="Vue d’ensemble"
      subtitle="Choisissez l’organisation sur laquelle vous travaillez."
    >
      <div className="max-w-2xl">
        <Card title="Aucune organisation courante">
          <Empty>
            Plusieurs organisations vous sont attribuées, ou aucune ne l’est encore. Choisissez
            celle sur laquelle vous travaillez depuis{' '}
            <Link href="/admin/organizations" className="text-brand-600 hover:underline">
              les organisations gérées
            </Link>
            , ou depuis{' '}
            <Link href="/admin/parametres#organisation" className="text-brand-600 hover:underline">
              Mon organisation
            </Link>
            . Si aucune ne vous est attribuée, l’administration de la plateforme s’en charge.
          </Empty>
        </Card>
      </div>
    </Shell>
  )
}

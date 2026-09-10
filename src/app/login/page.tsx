import { redirect } from 'next/navigation'

/**
 * `/login` est conserve comme redirection.
 *
 * L'adresse a circule — signets, liens de courriel, documentation. La supprimer
 * casserait des acces existants pour un gain nul ; la maintenir en double
 * ferait vivre deux mires. Elle redirige donc vers l'accueil, en conservant le
 * parametre `next` que le proxy y depose.
 */
export default async function LoginRedirect({
  searchParams,
}: {
  searchParams: Promise<{ next?: string }>
}) {
  const { next } = await searchParams
  redirect(next?.startsWith('/admin') ? `/?next=${encodeURIComponent(next)}` : '/')
}

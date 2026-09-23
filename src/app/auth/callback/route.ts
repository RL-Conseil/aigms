import { NextResponse, type NextRequest } from 'next/server'
import { createClient } from '@/lib/supabase/server'

/**
 * Retour de l'annuaire d'entreprise.
 *
 * SAML comme OpenID Connect finissent ici : l'IdP a authentifie la personne et
 * Supabase depose un code d'echange. On l'echange contre une session — c'est
 * la seule chose que fait cette route.
 *
 * Elle ne donne aucun droit. Le declencheur `on_auth_user_created` cree un
 * profil SANS role (migration 0002) ; l'annuaire dit qui est la, AIGMS dit ce
 * qu'elle a le droit de faire. Une personne inconnue de `role_assignment`
 * arrive sur /admin et n'y voit rien : c'est voulu.
 */
export async function GET(request: NextRequest) {
  const url = new URL(request.url)
  const code = url.searchParams.get('code')
  const next = url.searchParams.get('next')
  const destination = next?.startsWith('/admin') ? next : '/admin'

  // `origin` de la requete plutot qu'une variable d'environnement : la mire
  // vit aussi sur les Preview, dont l'adresse change a chaque branche.
  const home = new URL('/', url.origin)

  if (!code) {
    home.searchParams.set('erreur', 'annuaire')
    return NextResponse.redirect(home)
  }

  const supabase = await createClient()
  const { error } = await supabase.auth.exchangeCodeForSession(code)

  if (error) {
    home.searchParams.set('erreur', 'annuaire')
    return NextResponse.redirect(home)
  }

  return NextResponse.redirect(new URL(destination, url.origin))
}

import { type NextRequest, NextResponse } from 'next/server'
import { createServerClient } from '@supabase/ssr'
import { publicEnv } from '@/lib/env'

/**
 * Rafraichissement de session et garde d'acces.
 *
 * Next.js 16 : ce fichier remplace `middleware.ts`.
 *
 * AIGMS est une application : la seule page ouverte est la mire de connexion,
 * qui est aussi l'accueil. Tout /admin exige une session. Le proxy ne decide
 * d'aucune regle metier : il verifie seulement qu'une session existe.
 * L'autorisation reelle est portee par la RLS et par les fonctions serveur,
 * jamais par cette couche.
 */
const PROTECTED_PREFIX = '/admin'

export async function proxy(request: NextRequest) {
  let response = NextResponse.next({ request })
  const env = publicEnv()

  const supabase = createServerClient(
    env.NEXT_PUBLIC_SUPABASE_URL,
    env.NEXT_PUBLIC_SUPABASE_ANON_KEY,
    {
      cookies: {
        getAll() {
          return request.cookies.getAll()
        },
        setAll(cookiesToSet) {
          for (const { name, value } of cookiesToSet) {
            request.cookies.set(name, value)
          }
          response = NextResponse.next({ request })
          for (const { name, value, options } of cookiesToSet) {
            response.cookies.set(name, value, options)
          }
        },
      },
    },
  )

  /*
   * `getClaims` plutot que `getUser`.
   *
   * `getUser` interroge le serveur d'authentification a CHAQUE requete — et le
   * proxy en voit beaucoup : chaque navigation, mais aussi chaque
   * prechargement de lien, que Next declenche au survol. Autant d'allers-
   * retours pour une reponse que le jeton porte deja.
   *
   * Les deux projets Supabase signent en ES256 : la signature se verifie ici,
   * avec la cle publique recuperee une fois puis gardee. Ce n'est pas une
   * verification au rabais — c'est la meme que fait PostgREST avant d'appliquer
   * la RLS.
   *
   * CE QUE CELA CHANGE : une session revoquee cote serveur reste acceptee
   * jusqu'a l'expiration du jeton, une heure au plus. C'est deja le cas pour
   * l'acces aux DONNEES, que PostgREST sert sur la seule foi de la signature :
   * ce changement aligne la porte sur ce que la RLS fait depuis toujours.
   * Couper quelqu'un immediatement se fait la ou cela compte — en retirant son
   * affectation (`valid_until = now()`), lue en base a chaque requete.
   */
  const { data: claims } = await supabase.auth.getClaims()
  const user = claims?.claims ?? null

  const { pathname } = request.nextUrl

  if (!user && pathname.startsWith(PROTECTED_PREFIX)) {
    const url = request.nextUrl.clone()
    url.pathname = '/'
    url.searchParams.set('next', pathname)
    return NextResponse.redirect(url)
  }

  // Une session ouverte n'a rien a faire sur la mire : elle repart au travail.
  if (user && (pathname === '/' || pathname === '/login')) {
    const url = request.nextUrl.clone()
    url.pathname = '/admin'
    url.search = ''
    return NextResponse.redirect(url)
  }

  return response
}

export const config = {
  matcher: ['/((?!_next/static|_next/image|favicon.ico|.*\\.(?:svg|png|jpg|jpeg|gif|webp)$).*)'],
}

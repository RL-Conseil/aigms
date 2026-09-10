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

  const {
    data: { user },
  } = await supabase.auth.getUser()

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

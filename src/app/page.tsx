import type { Metadata } from 'next'
import { Suspense } from 'react'
import { LoginForm } from '@/components/login-form'
import { Wordmark } from '@/components/logo'

/**
 * Page d'accueil de l'application.
 *
 * AIGMS est une application SaaS : la vitrine vit sur le site commercial, pas
 * ici. Ce que cet ecran doit faire tient en trois choses — permettre de se
 * connecter, dire a qui s'adresser pour obtenir un acces, et donner en trois
 * lignes de quoi il s'agit a qui atterrit ici sans contexte.
 *
 * Il n'y a PAS d'inscription libre, et c'est voulu : les comptes sont declares
 * par l'administration de la plateforme, qui attribue les roles (ADR-0008).
 * Un formulaire d'inscription contredirait le modele d'habilitation.
 */

export const metadata: Metadata = {
  title: 'AIGMS — Espace de gouvernance',
  description:
    'Registre des usages d’IA, des décisions qui les autorisent et des preuves qui le démontrent.',
  robots: { index: false, follow: false },
}

const PILLARS = [
  ['Registre', 'Les usages d’IA, leurs responsables, leurs risques.'],
  ['Décisions', 'Qui a autorisé quoi, pourquoi, sous quelles conditions.'],
  ['Preuves', 'Ce que l’organisation peut produire devant un auditeur.'],
] as const

export default function HomePage() {
  // Renseignee, elle affiche le defi ; c'est Supabase qui refuse une
  // authentification sans jeton valide (Authentication > Attack protection).
  const captchaSiteKey = process.env.NEXT_PUBLIC_TURNSTILE_SITE_KEY || undefined

  return (
    <main className="flex min-h-screen flex-col lg:flex-row">
      {/* ---------- Connexion ---------- */}
      <div className="flex grow flex-col px-6 py-8 lg:px-12">
        <Wordmark size={30} />

        <div className="flex grow items-center justify-center py-16">
          <div className="w-full max-w-sm">
            <h1 className="mb-2 font-serif text-3xl font-medium tracking-tight">
              Accès à votre espace de gouvernance
            </h1>
            <p className="mb-8 text-[15px] text-ink-600">
              L’accès est réservé aux comptes ouverts par l’administration de la plateforme.
            </p>

            <Suspense fallback={null}>
              <LoginForm captchaSiteKey={captchaSiteKey} />
            </Suspense>

            <div className="mt-8 border-t border-ink-200 pt-6 text-[13px] leading-relaxed text-ink-500">
              <p>
                <strong className="font-medium text-ink-700">
                  Pas encore de compte ou mot de passe oublié ?
                </strong>{' '}
                Les comptes ne s’ouvrent pas librement, adressez-vous à l’administrateur de la
                plateforme.
              </p>
            </div>
          </div>
        </div>
      </div>

      {/* ---------- Ce dont il s'agit ---------- */}
      {/*
        Trois lignes, pas une page de vente : quelqu'un qui arrive ici a deja
        choisi, ou s'est trompe d'adresse. Le discours commercial vit sur
        caritis.fr, et n'a plus a etre maintenu en double.
      */}
      {/*
        Meme gabarit qu'a gauche : le bloc-marque en haut, le propos centre en
        dessous. Les deux marques se repondent alors a la meme hauteur, et il
        n'y a plus de vide au-dessus du logo.
      */}
      <aside className="flex flex-col bg-night-900 px-6 py-8 text-ink-200 lg:max-w-md lg:px-12">
        <Wordmark size={30} tone="light" />

        <div className="flex grow flex-col justify-center gap-8 py-16">
          <div>
            {/* La question d'abord, la reponse ensuite : c'est l'ordre dans
                lequel le sujet se pose a qui arrive ici. */}
            <p className="mb-4 font-serif text-[1.375rem] leading-snug text-ink-400 text-pretty">
              Vous pensez contrôler vos usages d’IA ?
            </p>
            <p className="font-serif text-[2rem] font-medium leading-[1.15] text-white text-pretty">
              Le jour de l’audit, ce qui compte n’est pas ce que vous avez fait.
              <span className="text-teal-400"> C’est ce que vous pouvez montrer.</span>
            </p>
            <p className="mt-4 leading-relaxed">
              AIGMS tient le registre unique de vos usages d’IA : qui a décidé quoi, sous quelles
              conditions, et la preuve qui va avec.
            </p>
          </div>

          <dl className="flex flex-col gap-4 border-t border-white/10 pt-8">
            {PILLARS.map(([term, description]) => (
              <div key={term}>
                <dt className="text-[13px] font-semibold uppercase tracking-[0.08em] text-teal-400">
                  {term}
                </dt>
                <dd className="mt-0.5 text-[15px] leading-snug">{description}</dd>
              </div>
            ))}
          </dl>

          {/*
            Le seul appel commercial de l'application, et il reste discret : qui
            arrive ici a deja un compte, ou s'est trompe d'adresse. Le discours
            de vente vit sur caritis.fr et n'a pas a etre maintenu en double.
          */}
          <div className="border-t border-white/10 pt-8 text-[13px] leading-relaxed text-ink-400">
            <a
              href="https://www.caritis.fr/realisations/aigms"
              className="group inline-flex items-baseline gap-1.5 hover:text-ink-200"
              rel="noreferrer noopener"
            >
              <span>
                Vous découvrez AIGMS ?{' '}
                <span className="font-medium text-teal-400 group-hover:underline">
                  Demandez votre atelier de qualification.
                </span>
              </span>
              <span
                aria-hidden
                className="text-teal-400 transition-transform group-hover:translate-x-0.5"
              >
                →
              </span>
            </a>
          </div>
        </div>
      </aside>
    </main>
  )
}

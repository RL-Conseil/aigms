import type { Metadata } from 'next'
import Link from 'next/link'
import { Suspense } from 'react'
import { LoginForm } from '@/components/login-form'
import { Wordmark } from '@/components/logo'

export const metadata: Metadata = {
  title: 'Connexion',
  robots: { index: false, follow: false },
}

export default function LoginPage() {
  return (
    <main className="flex min-h-screen flex-col">
      <div className="px-6 py-6 lg:px-12">
        <Link href="/" aria-label="AIGMS, accueil">
          <Wordmark size={30} />
        </Link>
      </div>

      <div className="flex grow items-center justify-center px-6 pb-24">
        <div className="w-full max-w-sm">
          <h1 className="mb-2 font-serif text-3xl font-medium tracking-tight">Espace de gouvernance</h1>
          <p className="mb-8 text-[15px] text-ink-600">
            L’accès est réservé aux comptes ouverts par votre AI Governance Officer.
          </p>

          <Suspense fallback={null}>
            <LoginForm />
          </Suspense>

          <p className="mt-8 border-t border-ink-200 pt-6 text-[13px] leading-relaxed text-ink-500">
            Mot de passe oublié ou accès à ouvrir : adressez-vous à votre AI Governance Officer, qui
            gère les comptes de votre organisation.
          </p>
        </div>
      </div>
    </main>
  )
}

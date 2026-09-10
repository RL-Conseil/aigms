import type { Metadata } from 'next'
import { Suspense } from 'react'
import { LoginForm } from '@/components/login-form'
import { LogoMark, Wordmark } from '@/components/logo'

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
  return (
    <main className="flex min-h-screen flex-col lg:flex-row">
      {/* ---------- Connexion ---------- */}
      <div className="flex grow flex-col px-6 py-8 lg:px-12">
        <Wordmark size={30} />

        <div className="flex grow items-center justify-center py-16">
          <div className="w-full max-w-sm">
            <h1 className="mb-2 font-serif text-3xl font-medium tracking-tight">
              Accès à l’espace de gouvernance
            </h1>
            <p className="mb-8 text-[15px] text-ink-600">
              L’accès est réservé aux comptes ouverts par l’administration de la plateforme.
            </p>

            <Suspense fallback={null}>
              <LoginForm />
            </Suspense>

            <div className="mt-8 flex flex-col gap-3 border-t border-ink-200 pt-6 text-[13px] leading-relaxed text-ink-500">
              <p>
                <strong className="font-medium text-ink-700">Pas encore de compte ?</strong> Les
                comptes ne s’ouvrent pas librement : l’administration de la plateforme les déclare
                et attribue les rôles — porteur du système, responsable du risque, auditeur, AI
                Governance Officer. C’est ce qui permet au registre de décisions de tenir.
              </p>
              <p>
                <strong className="font-medium text-ink-700">Mot de passe oublié</strong>, accès à
                ouvrir ou rôle à modifier : adressez-vous à l’administration de la plateforme.
              </p>
              <p>
                Découvrir AIGMS et demander un atelier de qualification :{' '}
                <a
                  href="https://caritis.fr"
                  className="font-medium text-brand-600 hover:underline"
                  rel="noreferrer noopener"
                >
                  caritis.fr
                </a>
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
      <aside className="flex flex-col justify-center gap-8 bg-night-900 px-6 py-16 text-ink-200 lg:max-w-md lg:px-12">
        <div>
          <LogoMark size={30} tone="light" />
          <p className="mt-5 font-serif text-2xl font-medium leading-snug text-white text-pretty">
            Gouverner l’IA. Décider. Prouver. Améliorer.
          </p>
          <p className="mt-4 leading-relaxed">
            Le registre unique des usages d’IA d’une organisation : leurs risques, les décisions qui
            les autorisent, les contrôles qui les encadrent, et les preuves qui le démontrent.
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

        <p className="border-t border-white/10 pt-8 text-[13px] leading-relaxed text-ink-400">
          AIGMS aide au cadrage, à la pré-classification, à la documentation et à la preuve. Il ne
          remplace ni un avis juridique, ni la décision d’un responsable de risque, ni un audit de
          certification, ni une autorité compétente.
        </p>
      </aside>
    </main>
  )
}

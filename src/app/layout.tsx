import type { Metadata } from 'next'
import { IBM_Plex_Sans, Newsreader } from 'next/font/google'
import './globals.css'

/**
 * Deux familles : un serif de lecture pour les titres, un sans technique pour
 * le corps. Les fallbacks ont des metriques proches, de sorte qu'un echec de
 * chargement ne deplace pas la mise en page.
 */
const newsreader = Newsreader({
  subsets: ['latin'],
  weight: ['400', '500', '600'],
  variable: '--font-newsreader',
  display: 'swap',
  fallback: ['Georgia', 'Times New Roman', 'serif'],
})

const plex = IBM_Plex_Sans({
  subsets: ['latin'],
  weight: ['400', '500', '600'],
  variable: '--font-plex',
  display: 'swap',
  fallback: ['Segoe UI', 'system-ui', 'sans-serif'],
})

export const metadata: Metadata = {
  title: {
    default: 'AIGMS — Gouverner l’IA. Décider. Prouver. Améliorer.',
    template: '%s — AIGMS',
  },
  description:
    "Le registre unique des usages d'IA de votre organisation : leurs risques, les décisions qui les autorisent, les contrôles qui les encadrent, et les preuves qui le démontrent.",
}

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="fr" className={`${newsreader.variable} ${plex.variable}`}>
      <body className="min-h-screen font-sans antialiased">{children}</body>
    </html>
  )
}

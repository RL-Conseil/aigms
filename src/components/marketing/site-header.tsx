import Link from 'next/link'
import { Wordmark } from '@/components/logo'

const SECTIONS = [
  { href: '/#constat', label: 'Le constat' },
  { href: '/#methode', label: 'La méthode' },
  { href: '/#decisions', label: 'Registre de décisions' },
  { href: '/#ecosysteme', label: 'Écosystème' },
  { href: '/#calendrier', label: 'Calendrier' },
]

export function SiteHeader() {
  return (
    <header className="sticky top-0 z-20 border-b border-ink-200 bg-ink-50/90 backdrop-blur">
      <div className="mx-auto flex max-w-7xl items-center justify-between gap-6 px-6 py-4 lg:px-12">
        <Link href="/" aria-label="AIGMS, accueil">
          <Wordmark size={30} />
        </Link>

        <nav className="hidden items-center gap-8 text-[15px] text-ink-600 lg:flex">
          {SECTIONS.map((section) => (
            <Link key={section.href} href={section.href} className="hover:text-ink-900">
              {section.label}
            </Link>
          ))}
        </nav>

        <div className="flex items-center gap-3">
          <Link
            href="/login"
            className="hidden px-2 py-2 text-[15px] text-ink-600 hover:text-ink-900 sm:block"
          >
            Se connecter
          </Link>
          <Link
            href="/contact"
            className="rounded-md bg-night-900 px-4 py-2.5 text-[15px] font-medium text-white hover:bg-night-800"
          >
            Prendre rendez-vous
          </Link>
        </div>
      </div>
    </header>
  )
}

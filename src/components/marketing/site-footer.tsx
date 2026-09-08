import Link from 'next/link'
import { LogoMark } from '@/components/logo'

const REFERENCES = [
  'ISO/IEC 42001:2023',
  'ISO/IEC 23894:2023',
  'ISO/IEC 42005:2025',
  'Règlement (UE) 2024/1689',
  'Règlement (UE) 2026/1744',
  'Règlement (UE) 2024/2847',
  'RGPD',
  'NIST AI RMF',
]

export function SiteFooter() {
  return (
    <footer className="bg-night-950 text-ink-300">
      <div className="mx-auto flex max-w-7xl flex-col gap-10 px-6 py-12 lg:flex-row lg:justify-between lg:px-12">
        <div className="max-w-lg">
          <span className="mb-4 inline-flex items-center gap-3">
            <LogoMark size={26} tone="light" />
            <span className="font-serif text-lg font-semibold text-white">AIGMS</span>
          </span>
          <p className="text-[13px] leading-relaxed text-ink-300">
            AIGMS aide au cadrage, à la pré-classification, à la documentation et à la preuve. Il ne
            remplace ni un avis juridique, ni la décision d’un responsable de risque, ni un audit de
            certification, ni une autorité compétente.
          </p>
          <div className="mt-6 flex gap-5 text-[13px]">
            <Link href="/contact" className="text-white hover:underline">
              Nous contacter
            </Link>
            <Link href="/login" className="text-ink-300 hover:text-white">
              Espace client
            </Link>
          </div>
        </div>

        <div className="text-[13px] lg:text-right">
          <p className="mb-2 text-ink-400">Références citées</p>
          <ul className="space-y-1">
            {REFERENCES.map((reference) => (
              <li key={reference}>{reference}</li>
            ))}
          </ul>
        </div>
      </div>
    </footer>
  )
}

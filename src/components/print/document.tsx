import Link from 'next/link'
import {
  formatLegalIdentifiers,
  formatPostalAddress,
  type DocumentIdentity,
} from '@/lib/governance/document-identity'
import { PrintButton } from '@/components/print/print-button'

/**
 * Chrome d'un document imprimable.
 *
 * Deux vues la partagent — le registre des usages d'IA et la declaration
 * d'applicabilite — et une troisieme ne coutera rien. C'est volontaire : deux
 * en-tetes ecrits separement finissent par diverger, et un auditeur qui recoit
 * deux pieces du meme systeme avec deux identites differentes a raison de s'en
 * inquieter.
 *
 * L'EN-TETE ET LE PIED SE REPETENT sur chaque page imprimee : `position: fixed`
 * est repete par le moteur d'impression a chaque feuille, et les marges de
 * `@page` lui reservent la place. Le numero de page est laisse au navigateur —
 * les boites de marge de `@page` ne sont pas implementees la ou cette
 * application s'utilise.
 */

const PRINT_CSS = `
@page {
  size: A4;
  margin: 30mm 14mm 22mm;
}

@media print {
  html, body { background: #fff; }
  .no-print { display: none !important; }

  .doc-header, .doc-footer {
    position: fixed;
    left: 0;
    right: 0;
  }
  .doc-header { top: -24mm; }
  .doc-footer { bottom: -16mm; }

  .doc-body { padding: 0; }

  /* Une ligne de tableau ne se coupe pas entre deux feuilles, et un intitulé
     ne reste pas seul en bas de page. */
  tr, li, .doc-keep { break-inside: avoid; }
  h2, h3 { break-after: avoid; }
  thead { display: table-header-group; }
  a { color: inherit; text-decoration: none; }
}

@media screen {
  .doc-sheet {
    max-width: 210mm;
    margin: 0 auto;
    background: #fff;
    border: 1px solid var(--color-ink-200);
    border-radius: 0.5rem;
    padding: 2.5rem;
  }
}
`

export function PrintDocument({
  identity,
  title,
  subtitle,
  backHref,
  backLabel,
  children,
}: {
  identity: DocumentIdentity
  title: string
  subtitle?: string
  backHref: string
  backLabel: string
  children: React.ReactNode
}) {
  const address = formatPostalAddress(identity)
  const identifiers = formatLegalIdentifiers(identity)
  const issuedOn = new Date().toLocaleDateString('fr-FR', {
    day: '2-digit',
    month: 'long',
    year: 'numeric',
  })

  return (
    <div className="min-h-screen bg-ink-50 py-8 print:bg-white print:py-0">
      <style dangerouslySetInnerHTML={{ __html: PRINT_CSS }} />

      <div className="no-print mx-auto mb-5 flex max-w-[210mm] items-center justify-between gap-4 px-4">
        <Link href={backHref} className="text-sm text-ink-600 hover:text-ink-900">
          ← {backLabel}
        </Link>
        <PrintButton />
      </div>

      <div className="doc-sheet">
        {/* ---------- En-tête ---------- */}
        <header className="doc-header mb-6 flex items-start justify-between gap-6 border-b border-ink-200 pb-4">
          <div className="min-w-0">
            <p className="font-serif text-lg font-semibold leading-tight text-ink-900">
              {identity.legalName}
            </p>
            <p className="mt-0.5 text-[11px] leading-relaxed text-ink-500">
              {identity.businessRef}
              {address ? ` · ${address}` : ''}
            </p>
            {identifiers ? (
              <p className="text-[11px] leading-relaxed text-ink-500">{identifiers}</p>
            ) : null}
          </div>

          {identity.logoUrl ? (
            /* eslint-disable-next-line @next/next/no-img-element -- URL signée
               d'un bucket privé : l'optimiseur d'images ne peut pas la revalider. */
            <img
              src={identity.logoUrl}
              alt=""
              className="h-10 w-auto max-w-[180px] shrink-0 object-contain"
            />
          ) : null}
        </header>

        {/* ---------- Corps ---------- */}
        <div className="doc-body">
          <h1 className="font-serif text-2xl font-medium tracking-tight text-ink-900">{title}</h1>
          {subtitle ? <p className="mt-1 text-sm text-ink-600">{subtitle}</p> : null}
          <p className="mt-2 text-[11px] text-ink-500">
            Édité le {issuedOn} depuis AIGMS · {identity.tenantName}
          </p>

          <div className="mt-6">{children}</div>
        </div>

        {/* ---------- Pied ---------- */}
        <footer className="doc-footer mt-8 flex flex-wrap items-baseline justify-between gap-2 border-t border-ink-200 pt-3 text-[10px] leading-relaxed text-ink-500">
          <span className="font-medium uppercase tracking-wide text-ink-700">
            {identity.confidentialityLabel}
          </span>
          <span>
            {identity.legalName}
            {identity.footerNote ? ` · ${identity.footerNote}` : ''}
          </span>
        </footer>
      </div>
    </div>
  )
}

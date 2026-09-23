import { PageSkeleton } from '@/components/skeleton'

/**
 * L'attente d'une piece a remettre.
 *
 * Ces pages vivent hors du groupe `(espace)` : elles n'ont ni barre, ni
 * `<main>`, et portent leur propre chrome d'impression. L'ecran d'attente doit
 * donc se placer lui-meme. Elles comptent parmi les plus longues a servir — un
 * registre complet, une declaration d'applicabilite — et sont ouvertes dans un
 * onglet neuf, ou rien d'autre ne rassure.
 */
export default function Loading() {
  return (
    <div className="mx-auto max-w-4xl px-8 py-10">
      <PageSkeleton cards={4} />
    </div>
  )
}

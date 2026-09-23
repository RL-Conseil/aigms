/**
 * L'ecran d'attente.
 *
 * Il ne decore pas : il repond a une question. Sans lui, un clic ne produit
 * rien jusqu'a ce que la derniere requete revienne — et l'application parait
 * lente meme quand le serveur est rapide. Avec lui, la barre reste en place
 * (elle est dans la mise en page), la zone de contenu dit « ca arrive », et
 * l'attente se voit au lieu de se subir.
 *
 * La forme imite ce qui va s'afficher — un titre, des cartes — plutot qu'un
 * rond qui tourne : l'oeil se place avant que le contenu n'arrive, et le saut
 * final est moins brutal.
 *
 * `animate-pulse` s'arrete de lui-meme lorsque le systeme demande moins
 * d'animations : Tailwind respecte `prefers-reduced-motion`.
 */

/** Une ligne de texte simulee. `w` en classe Tailwind. */
export function SkeletonLine({ w = 'w-full', h = 'h-4' }: { w?: string; h?: string }) {
  return <span className={`block rounded ${h} ${w} bg-ink-200`} />
}

/** Une carte au meme gabarit que `Card` : bordure, en-tete, corps. */
export function SkeletonCard({ lines = 3 }: { lines?: number }) {
  return (
    <section className="rounded-lg border border-ink-200 bg-white">
      <div className="border-b border-ink-100 px-5 py-3">
        <SkeletonLine w="w-40" h="h-3.5" />
      </div>
      <div className="flex flex-col gap-2.5 px-5 py-4">
        {Array.from({ length: lines }, (_, i) => (
          <SkeletonLine key={i} w={i === lines - 1 ? 'w-2/3' : 'w-full'} h="h-3" />
        ))}
      </div>
    </section>
  )
}

/**
 * L'attente d'une page entiere : fil d'Ariane, titre, puis des cartes.
 *
 * `role="status"` et le texte cache disent a un lecteur d'ecran ce que l'oeil
 * comprend tout seul. `aria-busy` evite qu'il annonce un contenu vide comme
 * s'il etait definitif.
 */
export function PageSkeleton({ cards = 3 }: { cards?: number }) {
  return (
    <div role="status" aria-busy="true" className="animate-pulse">
      <span className="sr-only">Chargement de la page…</span>

      <div className="mb-3">
        <SkeletonLine w="w-64" h="h-3" />
      </div>
      <div className="mb-6 flex flex-col gap-2">
        <SkeletonLine w="w-80" h="h-6" />
        <SkeletonLine w="w-1/2" h="h-3.5" />
      </div>

      <div className="flex flex-col gap-4">
        {Array.from({ length: cards }, (_, i) => (
          <SkeletonCard key={i} lines={i === 0 ? 4 : 3} />
        ))}
      </div>
    </div>
  )
}

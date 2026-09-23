import { PageSkeleton } from '@/components/skeleton'

/**
 * Ce que l'on voit pendant qu'une page se prepare.
 *
 * Un `loading.tsx` pose une frontiere `Suspense` autour de `{children}` : la
 * barre de navigation, qui vit dans la mise en page, reste affichee et
 * cliquable, et seule la zone de contenu attend. Le routeur montre cet ecran
 * DES le clic, sans attendre le serveur — c'est ce qui manquait a
 * l'application, ou rien ne bougeait jusqu'a la derniere requete.
 *
 * Un seul suffit pour tout le groupe : le gabarit — fil d'Ariane, titre,
 * cartes — est celui de presque toutes les pages. Une page au gabarit
 * particulier peut poser le sien a cote d'elle.
 */
export default function Loading() {
  return <PageSkeleton />
}

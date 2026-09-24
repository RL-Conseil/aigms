/**
 * Les sections d'une organisation, dans l'ordre ou l'on y travaille.
 *
 * Donnees PURES, et c'est tout leur interet : la barre de navigation les lit
 * dans le navigateur, l'en-tete de page les lit sur le serveur. Les avoir
 * laissees dans le composant client a coute une erreur serveur — depuis un
 * module `'use client'`, un composant serveur ne recoit pas la valeur mais une
 * reference, et `.includes()` leve. Meme lecon que pour `attention.ts`.
 */

export const ORGANIZATION_SECTIONS = [
  { key: 'apercu', label: 'Cas d’usage', href: '' },
  { key: 'processus', label: 'Processus et risques', href: '/processus' },
  { key: 'controles', label: 'Contrôles et outillages', href: '/controles' },
  { key: 'actifs', label: 'Actifs d’IA et fournisseurs', href: '/actifs' },
  { key: 'decisions', label: 'Décisions', href: '/decisions' },
  { key: 'soa', label: 'Déclaration d’Applicabilité', href: '/declaration-applicabilite' },
  { key: 'preuves', label: 'Preuves', href: '/preuves' },
  { key: 'suivi', label: 'Suivi d’actions et d’incidents', href: '/suivi' },
  { key: 'revues', label: 'Revues de gouvernance', href: '/revues' },
] as const

export type OrganizationSection = (typeof ORGANIZATION_SECTIONS)[number]['key']

/**
 * Une seule barre. Deux sections en premiere ligne — la ou l'on travaille —,
 * les registres sous un menu, et le pilotage. Le fil d'Ariane porte le mot
 * « Registres » sur les pages du menu, pour que l'endroit se nomme.
 */
export const PRIMARY_SECTIONS = ['apercu', 'processus'] as const

export const REGISTER_SECTIONS = [
  'controles',
  'actifs',
  'decisions',
  'soa',
  'preuves',
  'suivi',
  'revues',
] as const

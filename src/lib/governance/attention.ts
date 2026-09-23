/**
 * Ce qui appelle une action.
 *
 * Un menu qui ne porte que des noms de pages oblige a ouvrir chaque ecran pour
 * savoir s'il s'y passe quelque chose. Ces compteurs permettent a la navigation
 * de dire ou aller avant qu'on ait a chercher.
 *
 * Ce module est PUR : la barre de navigation vit dans le navigateur, et elle a
 * besoin de ces intitules, de cet ordre et de ces destinations. Les lectures
 * de la base vivent dans `attention-data.ts`, cote serveur.
 */

export type Attention = {
  organization_id: string
  organization_name: string
  organization_ref: string
  overdue_actions: number
  reviews_due: number
  stale_evidence: number
  evidence_to_review: number
  open_incidents: number
  high_risks_open: number
  soa_undecided: number
  total: number
}

export type AttentionKind = Exclude<
  keyof Attention,
  'organization_id' | 'organization_name' | 'organization_ref' | 'total'
>

/**
 * Chaque intitule nomme un ACTE a poser, pas un etat a contempler — « preuve a
 * valider » plutot que « preuves en attente ».
 *
 * Le pluriel est ecrit, jamais derive : « revue en retard » donne « revues en
 * retard », pas « revues en retards ». Une regle automatique se trompe des
 * qu'un complement suit le nom, ce qui est le cas de presque tous.
 */
export const ATTENTION_LABELS: Record<AttentionKind, readonly [string, string]> = {
  overdue_actions: ['action échue', 'actions échues'],
  reviews_due: ['revue en retard', 'revues en retard'],
  stale_evidence: ['preuve à renouveler', 'preuves à renouveler'],
  evidence_to_review: ['preuve à valider', 'preuves à valider'],
  open_incidents: ['incident ouvert', 'incidents ouverts'],
  high_risks_open: ['risque élevé ouvert', 'risques élevés ouverts'],
  soa_undecided: ['exigence sans décision', 'exigences sans décision'],
}

export const ATTENTION_ORDER: AttentionKind[] = [
  'overdue_actions',
  'open_incidents',
  'high_risks_open',
  'reviews_due',
  'stale_evidence',
  'evidence_to_review',
  'soa_undecided',
]

/**
 * Un retard est passe, une attente ne l'est pas encore. La distinction commande
 * la couleur : rouge pour ce qui aurait deja du etre fait, ambre pour ce qui
 * attend une main.
 */
const LATE: AttentionKind[] = ['overdue_actions', 'open_incidents', 'high_risks_open', 'reviews_due']

export function isLate(kind: AttentionKind): boolean {
  return LATE.includes(kind)
}

/** Rend la liste lisible : « 2 preuves à renouveler, 1 incident ouvert ». */
export function describeAttention(attention: Attention, kinds = ATTENTION_ORDER): string[] {
  return kinds
    .filter((kind) => attention[kind] > 0)
    .map((kind) => {
      const count = attention[kind]
      const [singular, plural] = ATTENTION_LABELS[kind]
      return `${count} ${count > 1 ? plural : singular}`
    })
}

/** Intitule d'un compteur, accorde. */
export function attentionLabel(kind: AttentionKind, count: number): string {
  const [singular, plural] = ATTENTION_LABELS[kind]
  return count > 1 ? plural : singular
}

/**
 * Ou conduit chaque compteur, filtre.
 *
 * Renvoyer vers l'ecran sans son filtre obligerait a refaire soi-meme le tri
 * qu'on vient de lire — et ferait douter du chiffre. Une seule table pour la
 * barre, le graphique et les tuiles : trois endroits qui divergeraient sinon.
 */
export function attentionDestination(kind: AttentionKind, organizationId: string): string {
  const base = `/admin/organizations/${organizationId}`
  switch (kind) {
    case 'overdue_actions':
      return `${base}/suivi?vue=actions&etat=echues`
    case 'open_incidents':
      return `${base}/suivi?vue=incidents`
    case 'reviews_due':
      return `${base}/suivi?vue=revues`
    case 'high_risks_open':
      return `${base}/processus?vue=risques`
    case 'stale_evidence':
      return `${base}/preuves?etat=a-renouveler`
    case 'evidence_to_review':
      return `${base}/preuves?etat=a-valider`
    case 'soa_undecided':
      return `${base}/declaration-applicabilite?ecart=undecided`
  }
}

/**
 * La rubrique de chaque compteur : la section de l'organisation ou l'on agit,
 * et son sous-onglet quand il y en a un. C'est l'en-tete que porte le
 * graphique du pilotage au-dessus de chaque libelle.
 */
export const ATTENTION_SECTIONS: Record<AttentionKind, { section: string; tab?: string; href: (organizationId: string) => string }> = {
  overdue_actions: { section: 'Suivi', tab: 'Actions', href: (o) => `/admin/organizations/${o}/suivi?vue=actions` },
  open_incidents: { section: 'Suivi', tab: 'Incidents', href: (o) => `/admin/organizations/${o}/suivi?vue=incidents` },
  reviews_due: { section: 'Suivi', tab: 'Revues', href: (o) => `/admin/organizations/${o}/suivi?vue=revues` },
  high_risks_open: { section: 'Processus et risques', tab: 'Risques', href: (o) => `/admin/organizations/${o}/processus?vue=risques` },
  stale_evidence: { section: 'Registre des preuves', href: (o) => `/admin/organizations/${o}/preuves` },
  evidence_to_review: { section: 'Registre des preuves', href: (o) => `/admin/organizations/${o}/preuves` },
  soa_undecided: { section: 'Déclaration d’Applicabilité', href: (o) => `/admin/organizations/${o}/declaration-applicabilite` },
}

/** L'ordre de lecture du graphique : par rubrique, dans l'ordre des sections. */
export const ATTENTION_SECTION_ORDER = [
  'Suivi',
  'Processus et risques',
  'Registre des preuves',
  'Déclaration d’Applicabilité',
] as const

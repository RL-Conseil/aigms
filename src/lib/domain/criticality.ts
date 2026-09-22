/**
 * La criticite d'un cas d'usage : combien d'effort de gouvernance il appelle.
 *
 * Elle se pose au triage, a priori — avant les risques, avant l'evaluation
 * d'impact. Ce qu'elle commande vit en base : l'AIIA (0011), l'arbitrage du
 * Comite de direction sur le GO production (0055), la cadence de revue (0067),
 * des controles supplementaires (0048). Ici, seulement de quoi la choisir et
 * la lire.
 */

export type Criticality = 'low' | 'moderate' | 'high' | 'critical'

export const CRITICALITY_ORDER: Criticality[] = ['low', 'moderate', 'high', 'critical']

export const CRITICALITY_LABELS: Record<Criticality, string> = {
  low: 'Faible',
  moderate: 'Modérée',
  high: 'Élevée',
  critical: 'Critique',
}

/** Ce que chaque niveau engage — c'est cela qu'on choisit, pas un adjectif. */
export const CRITICALITY_CONSEQUENCES: Record<Criticality, string> = {
  low: 'Instruction légère : contrôles de base, revue annuelle.',
  moderate: 'Instruction standard : contrôles applicables, revue semestrielle.',
  high: 'Évaluation d’impact exigée, GO production arbitré par le Comité de direction, contrôles renforcés, revue trimestrielle.',
  critical: 'Idem élevée, avec revue rapprochée et arbitrage du Comité de direction sur toute exception.',
}

export function criticalityRank(level: string | null | undefined): number {
  return level ? CRITICALITY_ORDER.indexOf(level as Criticality) + 1 : 0
}

/**
 * La grille de triage : quatre questions dont chaque reponse porte un niveau.
 * Le niveau propose est le plus haut des quatre. L'officer retient le sien —
 * et justifie l'ecart.
 */
export type GridQuestion = {
  key: 'affected' | 'reversibility' | 'scope' | 'data'
  label: string
  options: { value: string; label: string; level: Criticality }[]
}

export const CRITICALITY_GRID: GridQuestion[] = [
  {
    key: 'affected',
    label: 'Qui subit une erreur du système ?',
    options: [
      { value: 'internal', label: 'Le personnel, en interne', level: 'low' },
      { value: 'customers', label: 'Des clients ou partenaires identifiés', level: 'moderate' },
      { value: 'public', label: 'Le public, des candidats, des usagers', level: 'high' },
      { value: 'vulnerable', label: 'Des personnes vulnérables (mineurs, patients, précaires)', level: 'critical' },
    ],
  },
  {
    key: 'reversibility',
    label: 'Une erreur se rattrape…',
    options: [
      { value: 'trivial', label: 'Sans effort : on corrige et c’est fini', level: 'low' },
      { value: 'costly', label: 'Avec un coût ou un délai', level: 'moderate' },
      { value: 'hard', label: 'Difficilement : préjudice durable, recours', level: 'high' },
      { value: 'irreversible', label: 'Pas du tout : atteinte irréversible', level: 'critical' },
    ],
  },
  {
    key: 'scope',
    label: 'Que fait le système de sa sortie ?',
    options: [
      { value: 'advice', label: 'Il informe : un humain fait tout le reste', level: 'low' },
      { value: 'proposes', label: 'Il propose : un humain valide chaque cas', level: 'moderate' },
      { value: 'executes_bounded', label: 'Il agit dans des limites, un humain surveille', level: 'high' },
      { value: 'automatic', label: 'Il décide seul, sans validation humaine', level: 'critical' },
    ],
  },
  {
    key: 'data',
    label: 'Quelles données traite-t-il ?',
    options: [
      { value: 'none', label: 'Aucune donnée sur des personnes', level: 'low' },
      { value: 'internal', label: 'Des données internes, non personnelles', level: 'moderate' },
      { value: 'personal', label: 'Des données personnelles', level: 'high' },
      { value: 'sensitive', label: 'Des données sensibles (santé, biométrie, opinions)', level: 'critical' },
    ],
  },
]

/**
 * Ce qu'une reponse de la grille ENGAGE, quand elle constate un fait que les
 * regles lisent. Cle : « question:reponse ».
 */
export const GRID_EFFECTS: Record<string, string> = {
  'affected:vulnerable':
    'Inscrit « personnes vulnérables » sur la fiche : l’évaluation d’impact devient exigée et la supervision humaine se renforce.',
  'data:personal':
    'Inscrit « données personnelles » sur la fiche : l’évaluation d’impact devient exigée, l’AIPD se pré-coche, les contrôles « données » se proposent.',
  'data:sensitive':
    'Inscrit « données sensibles » (article 9 du RGPD) : l’évaluation d’impact est exigée et ne s’achève pas sans référence d’AIPD ; la criticité observée passe au moins à « élevée ».',
  'scope:automatic':
    'Une décision sans validation humaine : la supervision humaine et ses contrôles deviennent le cœur du dossier.',
}

export type GridAnswers = Partial<Record<GridQuestion['key'], string>>

/**
 * Ce que la grille CONSTATE, et qui doit atteindre les regles : la fiche le
 * porte, l'AIIA et les controles en decoulent. Une question sans reponse ne
 * dit rien ; une reponse qui dement un fait le retire — acte justifie et
 * journalise, comme le reste du triage.
 */
export function factsFromGrid(answers: GridAnswers): {
  personalData?: boolean
  sensitiveData?: boolean
  vulnerablePersons?: boolean
} {
  return {
    ...(answers.data
      ? {
          personalData: answers.data === 'personal' || answers.data === 'sensitive',
          sensitiveData: answers.data === 'sensitive',
        }
      : {}),
    ...(answers.affected ? { vulnerablePersons: answers.affected === 'vulnerable' } : {}),
  }
}

export function suggestCriticality(answers: GridAnswers): Criticality | null {
  let best = 0
  for (const q of CRITICALITY_GRID) {
    const opt = q.options.find((o) => o.value === answers[q.key])
    if (opt) best = Math.max(best, criticalityRank(opt.level))
  }
  return best ? (CRITICALITY_ORDER[best - 1] ?? null) : null
}

/** Ce que la fiche sait deja, traduit en reponses de depart. */
export function prefillGrid(useCase: {
  autonomy_level: string
  involves_personal_data: boolean
  involves_vulnerable_persons: boolean
}): GridAnswers {
  const scope =
    useCase.autonomy_level === 'L0'
      ? 'advice'
      : useCase.autonomy_level === 'L1'
        ? 'proposes'
        : useCase.autonomy_level === 'L4'
          ? 'automatic'
          : 'executes_bounded'
  return {
    scope,
    affected: useCase.involves_vulnerable_persons ? 'vulnerable' : undefined,
    data: useCase.involves_personal_data ? 'personal' : undefined,
  }
}

/** Le signal que calcule app.criticality_signal. */
export type CriticalitySignal = {
  retained: Criticality | null
  observed: Criticality | null
  exceeds: boolean
  reasons: string[]
}

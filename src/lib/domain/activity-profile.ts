/**
 * Profil d'activite d'une organisation, au sens d'ISO/IEC 42001.
 *
 * Il commande les typologies de preuves attendues et leur criticite : un
 * hebergeur demontre l'isolation de ses calculs, pas l'equite d'un modele qu'il
 * n'entraine pas ; un utilisateur metier repond de la derive du systeme qu'il
 * exploite, pas de son alignement.
 *
 * La table de verite est en base (`evidence_typology_profile`) : ces libelles
 * ne servent qu'a l'affichage.
 */

export const ACTIVITY_PROFILES = [
  {
    value: 'infrastructure_host',
    label: 'Hébergeur / Infrastructure',
    hint: 'Fournit la capacité de calcul et l’hébergement. Ne conçoit ni n’entraîne de modèle.',
  },
  {
    value: 'model_developer',
    label: 'Développeur / Éditeur d’IA',
    hint: 'Conçoit, entraîne, évalue et publie des modèles ou des systèmes d’IA.',
  },
  {
    value: 'integrator_consultant',
    label: 'Intégrateur / Conseil / ESN',
    hint: 'Assemble, paramètre et déploie des systèmes d’IA pour le compte de tiers.',
  },
  {
    value: 'business_user',
    label: 'Utilisateur métier',
    hint: 'Exploite des systèmes d’IA acquis auprès de tiers dans ses propres processus.',
  },
] as const

export type ActivityProfile = (typeof ACTIVITY_PROFILES)[number]['value']

export const ACTIVITY_PROFILE_LABELS: Record<ActivityProfile, string> = {
  infrastructure_host: 'Hébergeur / Infrastructure',
  model_developer: 'Développeur / Éditeur d’IA',
  integrator_consultant: 'Intégrateur / Conseil / ESN',
  business_user: 'Utilisateur métier',
}

export type EvidenceCriticality = 'negligible' | 'low' | 'moderate' | 'high' | 'critical'

export const CRITICALITY_LABELS: Record<EvidenceCriticality, string> = {
  critical: 'Critique',
  high: 'Élevé',
  moderate: 'Modéré',
  low: 'Faible',
  negligible: 'Négligeable',
}

export function criticalityTone(level: EvidenceCriticality | null) {
  if (level === 'critical' || level === 'high') return 'stop' as const
  if (level === 'moderate') return 'warn' as const
  if (level === 'low') return 'info' as const
  return 'neutral' as const
}

/**
 * Ce que la Declaration d'Applicabilite exige, selon la criticite attendue.
 * La regle vient du cadrage SoA : elle est appliquee en base, ces libelles ne
 * font que l'expliciter a l'ecran.
 */
export const REGIME_LABELS: Record<string, { label: string; expectation: string }> = {
  technical: {
    label: 'Preuve technique',
    expectation:
      'Décrire la mesure technique en place et pointer un livrable concret : journaux, manifestes, rapports d’audit.',
  },
  organisational: {
    label: 'Preuve organisationnelle',
    expectation:
      'L’exigence s’applique, mais la preuve est une politique, une clause contractuelle ou une procédure humaine.',
  },
  exclusion: {
    label: 'Exclusion motivée',
    expectation:
      'Le profil d’activité ne rencontre pas ce risque : écrire pourquoi ce contrôle ne concerne pas l’organisation.',
  },
  unspecified: {
    label: 'Non couverte par la matrice',
    expectation:
      'La matrice des preuves techniques ne se prononce pas. La règle d’or s’applique néanmoins : sélectionner ou exclure, et justifier.',
  },
}

export const GAP_LABELS: Record<string, string> = {
  undecided: 'À décider',
  exclusion_contested: 'Exclusion à réexaminer',
  technical_evidence_missing: 'Preuve technique manquante',
  evidence_missing: 'Aucun contrôle rattaché',
}

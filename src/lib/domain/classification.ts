/**
 * Vocabulaire de la qualification au regard du règlement (UE) 2024/1689.
 *
 * Une seule source pour le formulaire et pour ce qu'on relit : un code ne se
 * montre jamais en anglais a l'ecran.
 */
export const ORGANIZATION_ROLE_LABELS: Record<string, string> = {
  deployer: 'Déployeur',
  provider: 'Fournisseur',
  importer: 'Importateur',
  distributor: 'Distributeur',
  other: 'Autre',
  undetermined: 'À déterminer',
}

export const CLASSIFICATION_FLAG_LABELS: Record<string, string> = {
  out_of_scope: 'Hors périmètre',
  to_confirm: 'À confirmer',
  prohibited_practice_suspected: 'Pratique interdite suspectée',
  high_risk_potential: 'Haut risque potentiel',
  transparency_obligations: 'Obligations de transparence',
  gpai_dependency: 'Dépendance à un modèle à usage général',
  privacy_impact: 'Impact sur la vie privée',
  security_impact: 'Impact sur la sécurité',
}

/**
 * Ce que chaque qualification ENGAGE. Une case qu'on coche sans savoir ce
 * qu'elle declenche est une case qu'on coche mal : la regle vit en base, la
 * phrase la rend lisible a l'endroit du geste.
 */
export const CLASSIFICATION_FLAG_EFFECTS: Record<string, string> = {
  out_of_scope: 'Ne lève aucune exigence : la gouvernance interne — risques, supervision, preuves — reste due.',
  to_confirm: 'Bloque les jalons Revue et Production tant qu’elle est cochée.',
  prohibited_practice_suspected: 'Bloque les jalons et porte la criticité observée à « critique ».',
  high_risk_potential: 'Rend l’évaluation d’impact exigée, resserre la cadence de revue, propose 8 contrôles.',
  transparency_obligations: 'Propose l’information des personnes (article 50) et le recensement des parties prenantes.',
  gpai_dependency: 'Propose 4 contrôles, dont les injections de requêtes.',
  privacy_impact: 'Inscrit « données personnelles » sur la fiche : l’évaluation d’impact devient exigée, les contrôles de catégories particulières se proposent.',
  security_impact: 'Propose 3 contrôles de sécurité : moindre privilège, validation des entrées, tests avant mise en service.',
}

export const LEGAL_REVIEW_LABELS: Record<string, string> = {
  none: 'Non nécessaire',
  internal_review: 'Revue interne',
  external_counsel_required: 'Conseil externe requis',
}

export const FRAMEWORK_LABELS: Record<string, string> = {
  EU_AI_ACT: 'Règlement (UE) 2024/1689 — AI Act',
}

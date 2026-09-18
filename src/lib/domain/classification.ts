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

export const LEGAL_REVIEW_LABELS: Record<string, string> = {
  none: 'Non nécessaire',
  internal_review: 'Revue interne',
  external_counsel_required: 'Conseil externe requis',
}

export const FRAMEWORK_LABELS: Record<string, string> = {
  EU_AI_ACT: 'Règlement (UE) 2024/1689 — AI Act',
}

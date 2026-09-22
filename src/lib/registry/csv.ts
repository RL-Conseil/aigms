import { detectDelimiter, splitLine } from '@/lib/catalog/csv'

/**
 * Lecture d'un CSV de registre — actifs, fournisseurs — en lignes nommees.
 *
 * L'en-tete nomme les colonnes ; les noms acceptes sont ceux du modele,
 * plus quelques synonymes courants des exports d'ITSM et de tableurs, pour
 * qu'un export Excel francais passe sans retouche. Ce qui n'est pas reconnu
 * est ignore, et dit.
 */
export type CsvRows = { rows: Record<string, string>[]; ignored: string[]; delimiter: string }

const SYNONYMS: Record<string, string> = {
  // Actifs
  nom: 'name', libellé: 'name', libelle: 'name', asset: 'name', 'ci name': 'name', 'nom de l’actif': 'name',
  nature: 'kind', type: 'kind', classe: 'kind', sys_class_name: 'kind', catégorie: 'kind', categorie: 'kind',
  fournisseur: 'vendor', éditeur: 'vendor', editeur: 'vendor', manufacturer: 'vendor', model_id: 'version',
  hébergement: 'hosting_location', hebergement: 'hosting_location', localisation: 'hosting_location', location: 'hosting_location',
  'données personnelles': 'contains_personal_data', 'donnees personnelles': 'contains_personal_data', 'personal data': 'contains_personal_data',
  responsable: 'owner_email', owner: 'owner_email', owned_by: 'owner_email', propriétaire: 'owner_email', proprietaire: 'owner_email',
  // Fournisseurs
  'fournisseur de modèle': 'is_model_provider', 'fournisseur de modele': 'is_model_provider', 'model provider': 'is_model_provider',
  criticité: 'criticality', criticite: 'criticality',
  pays: 'country_code', country: 'country_code',
  dpa: 'dpa_signed', 'dpa signé': 'dpa_signed', 'dpa signe': 'dpa_signed',
  'sécurité évaluée': 'security_assessed', 'securite evaluee': 'security_assessed',
  réversibilité: 'reversibility_documented', reversibilite: 'reversibility_documented',
  'sous-traitants': 'subprocessors', 'sous traitants': 'subprocessors',
  commentaires: 'notes', remarques: 'notes',
  // Cas d'usage
  'cas d’usage': 'name', "cas d'usage": 'name', usage: 'name', 'nom de l’usage': 'name',
  finalité: 'purpose', finalite: 'purpose', objectif: 'purpose', but: 'purpose', description: 'purpose',
  processus: 'business_process', 'processus métier': 'business_process', 'processus metier': 'business_process',
  activité: 'activity', activite: 'activity',
  bénéfice: 'expected_benefit', benefice: 'expected_benefit', 'bénéfice attendu': 'expected_benefit', 'benefice attendu': 'expected_benefit',
  utilisateurs: 'users_description', 'personnes affectées': 'affected_persons', 'personnes affectees': 'affected_persons',
  données: 'data_description', donnees: 'data_description', 'données traitées': 'data_description', 'donnees traitees': 'data_description',
  'données sensibles': 'involves_sensitive_data', 'donnees sensibles': 'involves_sensitive_data',
  'personnes vulnérables': 'involves_vulnerable_persons', 'personnes vulnerables': 'involves_vulnerable_persons',
  autonomie: 'autonomy_level', "niveau d’autonomie": 'autonomy_level', "niveau d'autonomie": 'autonomy_level',
  justification: 'criticality_rationale', 'justification de la criticité': 'criticality_rationale',
  'portée de la décision': 'decision_impact', 'portee de la decision': 'decision_impact',
  'porteur': 'owner_email', 'porteur de l’ia': 'owner_email', "porteur de l'ia": 'owner_email',
  redevable: 'accountable_email', 'responsable redevable': 'accountable_email',
  'prochaine revue': 'next_review_at', revue: 'next_review_at',
  actifs: 'assets', 'actifs employés': 'assets', 'actifs employes': 'assets',
  fournisseurs: 'vendors', tiers: 'vendors',
}

export function readRegistryCsv(raw: string, known: readonly string[]): CsvRows {
  const text = raw.replace(/^﻿/, '')
  const lines = text.split(/\r?\n/).filter((l) => l.trim() !== '')
  if (!lines.length) return { rows: [], ignored: [], delimiter: ';' }
  const delimiter = detectDelimiter(lines[0]!)
  const header = splitLine(lines[0]!, delimiter).map((h) => {
    const key = h.trim().toLowerCase()
    return known.includes(key) ? key : (SYNONYMS[key] ?? key)
  })
  const ignored = header.filter((h) => !known.includes(h))
  const rows = lines.slice(1).map((line) => {
    const fields = splitLine(line, delimiter)
    const row: Record<string, string> = {}
    header.forEach((h, i) => {
      if (known.includes(h)) row[h] = fields[i] ?? ''
    })
    return row
  })
  return { rows, ignored: [...new Set(ignored)], delimiter }
}

export const ASSET_COLUMNS = [
  'name', 'kind', 'description', 'version', 'vendor', 'hosting_location', 'contains_personal_data', 'owner_email',
] as const

export const USE_CASE_COLUMNS = [
  'name', 'purpose', 'business_process', 'activity', 'expected_benefit', 'users_description',
  'affected_persons', 'data_description', 'involves_personal_data', 'involves_sensitive_data',
  'involves_vulnerable_persons', 'autonomy_level', 'criticality', 'criticality_rationale',
  'decision_impact', 'owner_email', 'accountable_email', 'next_review_at', 'assets', 'vendors',
] as const

export const VENDOR_COLUMNS = [
  'name', 'is_model_provider', 'criticality', 'country_code', 'dpa_signed', 'security_assessed',
  'reversibility_documented', 'subprocessors', 'notes',
] as const

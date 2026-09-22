/**
 * Roles applicatifs.
 *
 * Cette liste double celle de l'enumere `app.app_role` en base. La base fait
 * autorite ; ce module ne sert qu'a nommer les roles dans l'interface et a
 * decrire ce qu'ils recouvrent.
 */

export const APP_ROLES = [
  'platform_admin',
  'governance_officer',
  'client_admin',
  'system_owner',
  'risk_owner',
  'reviewer',
  'auditor',
  'executive_viewer',
] as const

export type AppRole = (typeof APP_ROLES)[number]

/**
 * Les six denominations de gouvernance, fixees le 18 septembre 2026. Les
 * valeurs de l'enumere ne changent pas — elles sont dans les politiques, les
 * tests et les comptes deja attribues ; seul le nom qu'on leur donne change,
 * pour les comptes existants comme pour les futurs.
 */
export const ROLE_LABELS: Record<AppRole, string> = {
  platform_admin: 'Administration de la plateforme',
  governance_officer: 'AI Governance Officer',
  client_admin: 'Administrateur client',
  system_owner: 'Porteur de l’IA',
  risk_owner: 'Comité des risques',
  reviewer: 'Expert métier (DPO / RSSI)',
  auditor: 'Auditeur',
  executive_viewer: 'Comité de direction',
}

export const ROLE_DESCRIPTIONS: Record<AppRole, string> = {
  platform_admin:
    "Crée les organisations, déclare les comptes et attribue les rôles. Ne gouverne aucun cas d'usage.",
  governance_officer:
    'Pilote global de la conformité IA : registre, qualification, risques, impacts, contrôles, décisions et transitions.',
  client_admin:
    "L'AI Governance Officer chez le client, quand le cabinet tient le rôle en prestation : mêmes prérogatives de gouvernance, plus le réglage des comptes de son espace. Il double l'officer, il ne le remplace pas — la règle des six rôles ne le compte pas.",
  system_owner:
    'Le métier ou chef de projet qui déploie l’outil : déclare ses usages, répond aux évaluations et dépose les preuves attendues.',
  risk_owner:
    'Le valideur indépendant des risques (Risk Manager) : cote les risques, décide de leur traitement et porte les acceptations.',
  reviewer:
    'Les relecteurs spécialisés — vie privée, sécurité : consultés sur les risques, se prononcent sur les décisions soumises.',
  auditor: 'Le contrôleur indépendant, a posteriori : consulte tout son périmètre, journal d’audit compris, sans jamais écrire.',
  executive_viewer:
    'L’instance suprême d’arbitrage stratégique : consulte les tableaux de bord et les décisions, sans jamais écrire.',
}

/**
 * Le RACI synthetique des six roles de gouvernance, par etape du parcours.
 * R realise, A valide et assume, C donne son expertise, I est informe.
 * C'est une reference de lecture : ce que la base APPLIQUE se lit dans la
 * matrice des capacites, calculee depuis les politiques.
 */
export const RACI_ROLES = [
  'system_owner',
  'governance_officer',
  'client_admin',
  'reviewer',
  'risk_owner',
  'executive_viewer',
  'auditor',
] as const satisfies readonly AppRole[]

export type RaciRole = (typeof RACI_ROLES)[number]

export type RaciLetter = 'R' | 'A' | 'C' | 'I' | null

export const RACI_LETTERS: Record<Exclude<RaciLetter, null>, string> = {
  R: 'Responsible — réalise l’action',
  A: 'Accountable — valide et assume la responsabilité finale',
  C: 'Consulted — donne son expertise obligatoire',
  I: 'Informed — reçoit l’information sans bloquer le flux',
}

export const ROLE_RACI: { step: string; where: string; cells: Record<RaciRole, RaciLetter> }[] = [
  {
    step: '1. Déclaration et inventaire',
    where: 'Cas d’usage, fiche › Avancement',
    cells: { system_owner: 'A', governance_officer: 'R', client_admin: 'R', reviewer: 'C', risk_owner: null, executive_viewer: null, auditor: 'I' },
  },
  {
    step: '2. Évaluation des risques',
    where: 'Fiche › Risques, Évaluation d’impact',
    cells: { system_owner: 'R', governance_officer: 'A', client_admin: 'A', reviewer: 'C', risk_owner: 'C', executive_viewer: null, auditor: 'I' },
  },
  {
    step: '3. Validation des contrôles',
    where: 'Fiche › Contrôles affectés, registre des preuves',
    cells: { system_owner: 'I', governance_officer: 'R', client_admin: 'R', reviewer: 'A', risk_owner: 'A', executive_viewer: null, auditor: 'I' },
  },
  {
    step: '4. Arbitrage IA critique',
    where: 'Fiche › Décisions, passage en production',
    cells: { system_owner: 'I', governance_officer: 'C', client_admin: 'C', reviewer: 'C', risk_owner: 'C', executive_viewer: 'A', auditor: 'I' },
  },
  {
    step: '5. Outillage des contrôles',
    where: 'Registre des contrôles › Outillage',
    cells: { system_owner: 'I', governance_officer: 'R', client_admin: 'R', reviewer: 'C', risk_owner: 'I', executive_viewer: null, auditor: 'I' },
  },
  {
    step: '6. Référentiel — contrôles-types et familles d’outillage',
    where: 'Administration › Référentiels',
    cells: { system_owner: null, governance_officer: 'I', client_admin: 'I', reviewer: null, risk_owner: null, executive_viewer: null, auditor: 'I' },
  },
  {
    step: '7. Audit de conformité',
    where: 'Journal d’audit, registres, impressions',
    cells: { system_owner: 'I', governance_officer: 'I', client_admin: 'I', reviewer: 'I', risk_owner: 'I', executive_viewer: 'I', auditor: 'A' },
  },
]

/**
 * Roles qu'un administrateur peut attribuer depuis l'application. Reflete
 * `app.assignable_roles()` ; la base refuse tout ce qui sort de cette liste.
 */
export const ASSIGNABLE_ROLES: AppRole[] = [
  'governance_officer',
  'client_admin',
  'system_owner',
  'risk_owner',
  'reviewer',
  'auditor',
  'executive_viewer',
]

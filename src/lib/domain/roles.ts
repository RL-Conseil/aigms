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

export const ROLE_LABELS: Record<AppRole, string> = {
  platform_admin: 'Administration de la plateforme',
  governance_officer: 'AI Governance Officer',
  client_admin: 'Administrateur client',
  system_owner: 'Porteur du système',
  risk_owner: 'Responsable du risque',
  reviewer: 'Relecteur',
  auditor: 'Auditeur',
  executive_viewer: 'Direction',
}

export const ROLE_DESCRIPTIONS: Record<AppRole, string> = {
  platform_admin:
    "Crée les organisations, déclare les comptes et attribue les rôles. Ne gouverne aucun cas d'usage.",
  governance_officer:
    "Pilote la gouvernance : registre, classification, risques, impacts, contrôles, décisions et transitions.",
  client_admin:
    "Mêmes prérogatives de gouvernance que l'officer, du côté du client.",
  system_owner:
    "Déclare ses usages, répond aux évaluations et dépose les preuves attendues.",
  risk_owner: 'Cote les risques, décide de leur traitement et porte les acceptations.',
  reviewer: 'Instruit les décisions soumises à approbation.',
  auditor: 'Consulte tout son périmètre, journal d’audit compris, sans jamais écrire.',
  executive_viewer: 'Consulte les tableaux de bord et les décisions, sans jamais écrire.',
}

/**
 * Roles qu'un administrateur peut attribuer depuis l'application. Reflete
 * `app.assignable_roles()` ; la base refuse tout ce qui sort de cette liste.
 */
export const ASSIGNABLE_ROLES: AppRole[] = [
  'governance_officer',
  'system_owner',
  'risk_owner',
  'reviewer',
  'auditor',
  'executive_viewer',
]

/**
 * Connecteurs de gouvernance.
 *
 * AIGMS n'absorbe pas ces plateformes : il lit chez elles des metadonnees, des
 * statuts et des preuves. La lecture seule est le defaut, et l'ecriture doit
 * etre un choix explicite.
 */

export const CONNECTOR_KINDS = [
  'vanta',
  'onetrust',
  'servicenow',
  'microsoft_purview',
  'microsoft_entra',
  'azure',
  'github',
  'google_workspace',
  'jira',
  'siem',
  'openai_admin',
  'anthropic_admin',
  'generic_webhook',
] as const

export type ConnectorKind = (typeof CONNECTOR_KINDS)[number]

export const CONNECTOR_CAPABILITIES = [
  'asset_inventory',
  'control_catalog',
  'evidence_pull',
  'control_status',
  'incident_feed',
  'usage_metadata',
  'vendor_metadata',
] as const

export type ConnectorCapability = (typeof CONNECTOR_CAPABILITIES)[number]

export const CAPABILITY_LABELS: Record<ConnectorCapability, string> = {
  asset_inventory: 'Inventaire d’actifs',
  control_catalog: 'Catalogue de contrôles',
  evidence_pull: 'Collecte de preuves',
  control_status: 'État des contrôles',
  incident_feed: 'Flux d’incidents',
  usage_metadata: 'Métadonnées d’usage',
  vendor_metadata: 'Informations fournisseur',
}

/**
 * Ce que chaque plateforme fait le mieux, et ce qu'AIGMS lui demande. Les
 * capacites proposees par defaut refletent la matrice BUILD / CONNECT.
 */
export const CONNECTOR_CATALOG: Record<
  ConnectorKind,
  {
    label: string
    role: string
    defaultCapabilities: ConnectorCapability[]
    suggestedEnvVar: string
    docUrl?: string
  }
> = {
  vanta: {
    label: 'Vanta',
    role: 'Automatisation de la collecte de preuves et de la conformité',
    defaultCapabilities: ['evidence_pull', 'control_status', 'control_catalog'],
    suggestedEnvVar: 'CONNECTOR_VANTA_TOKEN',
  },
  onetrust: {
    label: 'OneTrust',
    role: "Gouvernance IA d'entreprise et contrôles à l'exécution",
    defaultCapabilities: ['asset_inventory', 'control_catalog', 'vendor_metadata'],
    suggestedEnvVar: 'CONNECTOR_ONETRUST_TOKEN',
  },
  servicenow: {
    label: 'ServiceNow',
    role: 'Tour de contrôle IA, CMDB et workflows d’entreprise',
    defaultCapabilities: ['asset_inventory', 'incident_feed', 'control_status'],
    suggestedEnvVar: 'CONNECTOR_SERVICENOW_TOKEN',
  },
  microsoft_purview: {
    label: 'Microsoft Purview',
    role: 'Sécurité des données, classification et prévention des fuites',
    defaultCapabilities: ['asset_inventory', 'usage_metadata', 'evidence_pull'],
    suggestedEnvVar: 'CONNECTOR_PURVIEW_TOKEN',
  },
  microsoft_entra: {
    label: 'Microsoft Entra',
    role: 'Identités, applications et consentements',
    defaultCapabilities: ['asset_inventory', 'usage_metadata'],
    suggestedEnvVar: 'CONNECTOR_ENTRA_TOKEN',
  },
  azure: {
    label: 'Azure',
    role: 'Métadonnées techniques des ressources et services IA',
    defaultCapabilities: ['asset_inventory', 'usage_metadata'],
    suggestedEnvVar: 'CONNECTOR_AZURE_TOKEN',
  },
  github: {
    label: 'GitHub',
    role: 'Dépôts, dépendances et traces de revue',
    defaultCapabilities: ['asset_inventory', 'evidence_pull'],
    suggestedEnvVar: 'CONNECTOR_GITHUB_TOKEN',
  },
  google_workspace: {
    label: 'Google Workspace',
    role: 'Usages bureautiques et partages',
    defaultCapabilities: ['usage_metadata'],
    suggestedEnvVar: 'CONNECTOR_GOOGLE_TOKEN',
  },
  jira: {
    label: 'Jira',
    role: 'Synchronisation des actions et des plans de remédiation',
    defaultCapabilities: ['incident_feed'],
    suggestedEnvVar: 'CONNECTOR_JIRA_TOKEN',
  },
  siem: {
    label: 'SIEM / SOC',
    role: 'Télémétrie de sécurité et signaux d’incident',
    defaultCapabilities: ['incident_feed'],
    suggestedEnvVar: 'CONNECTOR_SIEM_TOKEN',
  },
  openai_admin: {
    label: 'OpenAI — administration',
    role: 'Métadonnées d’usage des modèles',
    defaultCapabilities: ['usage_metadata', 'vendor_metadata'],
    suggestedEnvVar: 'CONNECTOR_OPENAI_ADMIN_TOKEN',
  },
  anthropic_admin: {
    label: 'Claude — administration',
    role: 'Métadonnées d’usage des modèles',
    defaultCapabilities: ['usage_metadata', 'vendor_metadata'],
    suggestedEnvVar: 'CONNECTOR_ANTHROPIC_ADMIN_TOKEN',
  },
  generic_webhook: {
    label: 'Webhook générique',
    role: 'Source interne ou outil non couvert par un connecteur dédié',
    defaultCapabilities: ['evidence_pull'],
    suggestedEnvVar: 'CONNECTOR_WEBHOOK_TOKEN',
  },
}

export const CONNECTOR_STATUS_LABELS: Record<string, string> = {
  draft: 'Brouillon',
  configured: 'Configuré',
  active: 'Actif',
  degraded: 'Dégradé',
  suspended: 'Suspendu',
  retired: 'Retiré',
}

export const CONNECTOR_HEALTH_LABELS: Record<string, string> = {
  unknown: 'Non testé',
  healthy: 'Opérationnel',
  stale: 'Données anciennes',
  error: 'En erreur',
}

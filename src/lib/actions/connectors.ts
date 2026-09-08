'use server'

import { revalidatePath } from 'next/cache'
import { z } from 'zod'
import { createClient } from '@/lib/supabase/server'
import {
  CONNECTOR_CAPABILITIES,
  CONNECTOR_KINDS,
  type ConnectorCapability,
  type ConnectorKind,
} from '@/lib/domain/connectors'

/**
 * Configuration des connecteurs.
 *
 * Aucun secret ne transite par ces actions : le formulaire recueille le NOM
 * d'une variable d'environnement, jamais sa valeur. Le secret est pose dans le
 * coffre de la plateforme d'hebergement, hors de portee de la base, des
 * sauvegardes et des exports.
 */

export type ConnectorState =
  | { ok: true; message: string }
  | { ok: false; message: string }

const connectorSchema = z.object({
  kind: z.enum(CONNECTOR_KINDS as unknown as [ConnectorKind, ...ConnectorKind[]]),
  displayName: z.string().trim().min(2, 'Nom trop court.').max(120),
  sourceOfTruth: z.string().trim().min(2, 'Précisez la source de vérité.').max(160),
  baseUrl: z.string().trim().url('URL invalide.').max(300).optional().or(z.literal('')),
  credentialEnvVar: z
    .string()
    .trim()
    .regex(
      /^[A-Z][A-Z0-9_]{2,63}$/,
      'Attendu : un NOM de variable d’environnement en majuscules, jamais un secret.',
    )
    .optional()
    .or(z.literal('')),
  capabilities: z
    .array(z.enum(CONNECTOR_CAPABILITIES as unknown as [ConnectorCapability, ...ConnectorCapability[]]))
    .min(1, 'Choisissez au moins une capacité.'),
  syncFrequency: z.string().trim().max(60),
  description: z.string().trim().max(1000).optional().or(z.literal('')),
  retentionNote: z.string().trim().max(500).optional().or(z.literal('')),
})

async function administratedTenant(): Promise<string | null> {
  const supabase = await createClient()
  const {
    data: { user },
  } = await supabase.auth.getUser()
  if (!user) return null

  const { data } = await supabase
    .from('membership')
    .select('tenant_id')
    .eq('user_id', user.id)
    .eq('status', 'active')
    .eq('role', 'platform_admin')
    .maybeSingle()

  return data?.tenant_id ?? null
}

export async function saveConnector(
  _previous: ConnectorState | null,
  formData: FormData,
): Promise<ConnectorState> {
  const tenantId = await administratedTenant()
  if (!tenantId) {
    return { ok: false, message: "La configuration des connecteurs relève de l'administration." }
  }

  const parsed = connectorSchema.safeParse({
    kind: formData.get('kind'),
    displayName: formData.get('displayName'),
    sourceOfTruth: formData.get('sourceOfTruth'),
    baseUrl: formData.get('baseUrl') ?? '',
    credentialEnvVar: formData.get('credentialEnvVar') ?? '',
    capabilities: formData.getAll('capabilities'),
    syncFrequency: formData.get('syncFrequency') ?? 'daily',
    description: formData.get('description') ?? '',
    retentionNote: formData.get('retentionNote') ?? '',
  })

  if (!parsed.success) {
    return { ok: false, message: parsed.error.issues[0]?.message ?? 'Formulaire incomplet.' }
  }

  const data = parsed.data
  const supabase = await createClient()

  const { error } = await supabase.from('governance_connector').insert({
    tenant_id: tenantId,
    kind: data.kind,
    display_name: data.displayName,
    description: data.description || null,
    source_of_truth: data.sourceOfTruth,
    capabilities: data.capabilities,
    base_url: data.baseUrl || null,
    credential_env_var: data.credentialEnvVar || null,
    sync_frequency: data.syncFrequency || 'daily',
    retention_note: data.retentionNote || null,
    // Lecture seule, toujours : ouvrir l'ecriture vers un systeme tiers est une
    // decision qui ne se prend pas depuis un formulaire de creation.
    is_read_only: true,
    status: data.credentialEnvVar && data.baseUrl ? 'configured' : 'draft',
  })

  if (error) {
    if (error.code === '23505') {
      return { ok: false, message: 'Un connecteur porte déjà ce nom pour cette plateforme.' }
    }
    return { ok: false, message: `Enregistrement refusé : ${error.message}` }
  }

  revalidatePath('/admin/connecteurs')
  return { ok: true, message: `Connecteur « ${data.displayName} » déclaré.` }
}

const testSchema = z.object({ connectorId: z.string().uuid() })

/**
 * Test de configuration.
 *
 * Il verifie ce qui est verifiable sans appeler la plateforme distante : le
 * secret est-il present dans l'environnement, l'URL repond-elle. Un appel
 * authentifie reel dependrait de l'API de chaque editeur, et viendra avec
 * chaque integration.
 */
export async function testConnector(
  _previous: ConnectorState | null,
  formData: FormData,
): Promise<ConnectorState> {
  const tenantId = await administratedTenant()
  if (!tenantId) {
    return { ok: false, message: "Le test d'un connecteur relève de l'administration." }
  }

  const parsed = testSchema.safeParse({ connectorId: formData.get('connectorId') })
  if (!parsed.success) return { ok: false, message: 'Demande invalide.' }

  const supabase = await createClient()
  const { data: connector } = await supabase
    .from('governance_connector')
    .select('id, display_name, base_url, credential_env_var, capabilities')
    .eq('id', parsed.data.connectorId)
    .maybeSingle()

  if (!connector) return { ok: false, message: 'Connecteur introuvable.' }

  const findings: string[] = []
  let health: 'healthy' | 'error' = 'healthy'

  if (!connector.credential_env_var) {
    findings.push('aucune variable d’environnement déclarée')
    health = 'error'
  } else if (!process.env[connector.credential_env_var]) {
    findings.push(`la variable ${connector.credential_env_var} n’est pas définie sur cet environnement`)
    health = 'error'
  }

  if (!connector.base_url) {
    findings.push('aucune URL de base')
    health = 'error'
  } else {
    try {
      const response = await fetch(connector.base_url, {
        method: 'HEAD',
        signal: AbortSignal.timeout(8000),
      })
      // Un 401 ou 403 prouve que l'hote repond : c'est ce qu'on cherche ici.
      if (response.status >= 500) {
        findings.push(`l’hôte répond ${response.status}`)
        health = 'error'
      }
    } catch {
      findings.push('l’hôte n’a pas répondu')
      health = 'error'
    }
  }

  const message =
    health === 'healthy'
      ? 'Configuration complète : secret présent et hôte joignable.'
      : `Configuration incomplète — ${findings.join(', ')}.`

  await supabase
    .from('governance_connector')
    .update({
      health,
      last_tested_at: new Date().toISOString(),
      last_error: health === 'error' ? message : null,
      last_error_at: health === 'error' ? new Date().toISOString() : null,
    })
    .eq('id', connector.id)

  await supabase.from('connector_sync_run').insert({
    tenant_id: tenantId,
    connector_id: connector.id,
    finished_at: new Date().toISOString(),
    outcome: health,
    message,
  })

  revalidatePath('/admin/connecteurs')
  return { ok: health === 'healthy', message }
}

const statusSchema = z.object({
  connectorId: z.string().uuid(),
  status: z.enum(['draft', 'configured', 'active', 'suspended', 'retired']),
})

export async function setConnectorStatus(
  _previous: ConnectorState | null,
  formData: FormData,
): Promise<ConnectorState> {
  const tenantId = await administratedTenant()
  if (!tenantId) {
    return { ok: false, message: "Cette action relève de l'administration." }
  }

  const parsed = statusSchema.safeParse({
    connectorId: formData.get('connectorId'),
    status: formData.get('status'),
  })
  if (!parsed.success) return { ok: false, message: 'Demande invalide.' }

  const supabase = await createClient()
  const { error } = await supabase
    .from('governance_connector')
    .update({ status: parsed.data.status })
    .eq('id', parsed.data.connectorId)

  if (error) {
    // La contrainte connector_active_is_configured refuse d'activer un
    // connecteur qui ne sait pas où il se branche.
    return {
      ok: false,
      message: error.message.includes('connector_active_is_configured')
        ? 'Un connecteur ne s’active qu’avec une URL et une variable d’environnement déclarées.'
        : `Modification refusée : ${error.message}`,
    }
  }

  revalidatePath('/admin/connecteurs')
  return { ok: true, message: 'Statut mis à jour.' }
}

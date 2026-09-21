import { createClient } from '@/lib/supabase/server'

/**
 * Lecture du journal d'audit pour l'ecran d'administration et son export.
 *
 * La RLS decide de ce qui est visible ; ces fonctions ne font que porter les
 * filtres. Les deux — ecran et export — passent par la meme requete : ce qu'on
 * exporte est exactement ce qu'on lit.
 */

export type AuditFilters = {
  since?: string
  until?: string
  action?: string
  entityType?: string
  actor?: string
  search?: string
  /** Restreint a une organisation, a un cas d'usage, a une famille d'actions. */
  organizationId?: string
  useCaseId?: string
  actions?: string[]
}

export type AuditRow = {
  id: number
  occurred_at: string
  actor_email: string | null
  actor_role: string | null
  action: string
  entity_type: string
  entity_id: string | null
  entity_ref: string | null
  summary: string | null
  before_state: Record<string, unknown> | null
  after_state: Record<string, unknown> | null
  metadata: Record<string, unknown>
  organization_id?: string | null
  use_case_id?: string | null
}

export function parseFilters(params: Record<string, string | undefined>): AuditFilters {
  const clean = (v?: string) => (v && v.trim() ? v.trim() : undefined)
  return {
    since: clean(params.depuis),
    until: clean(params.jusqua),
    action: clean(params.action),
    entityType: clean(params.type),
    actor: clean(params.acteur),
    search: clean(params.q),
  }
}

/** Une date de fin saisie « 2026-09-16 » couvre la journee entiere. */
function endOfDay(date: string): string {
  const d = new Date(date)
  d.setDate(d.getDate() + 1)
  return d.toISOString()
}

export async function auditLogPage(filters: AuditFilters, limit: number, offset = 0) {
  const supabase = await createClient()
  const { data, error } = await supabase.rpc('audit_log_page', {
    p_since: filters.since ? new Date(filters.since).toISOString() : undefined,
    p_until: filters.until ? endOfDay(filters.until) : undefined,
    p_action: filters.action,
    p_entity_type: filters.entityType,
    p_actor: filters.actor,
    p_search: filters.search,
    p_limit: limit,
    p_offset: offset,
    p_organization_id: filters.organizationId,
    p_use_case_id: filters.useCaseId,
    p_actions: filters.actions,
  })
  if (error) throw new Error(`Journal illisible : ${error.message}`)
  return (data ?? []) as unknown as AuditRow[]
}

export async function auditLogFacets() {
  const supabase = await createClient()
  const { data, error } = await supabase.rpc('audit_log_facets')
  if (error) throw new Error(`Journal illisible : ${error.message}`)
  const raw = (data ?? {}) as { actions?: string[]; entity_types?: string[]; actors?: string[]; total?: number }
  return {
    actions: (raw.actions ?? []).sort(),
    entityTypes: (raw.entity_types ?? []).sort(),
    actors: (raw.actors ?? []).sort(),
    total: raw.total ?? 0,
  }
}

/** Les cles dont la valeur a change entre avant et apres. */
export function changedKeys(row: AuditRow): string[] {
  if (!row.before_state || !row.after_state) return []
  const keys = new Set([...Object.keys(row.before_state), ...Object.keys(row.after_state)])
  return [...keys]
    .filter((k) => !['updated_at'].includes(k))
    .filter((k) => JSON.stringify(row.before_state![k]) !== JSON.stringify(row.after_state![k]))
    .sort()
}

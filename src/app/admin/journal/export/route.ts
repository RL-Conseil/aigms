import { NextResponse } from 'next/server'
import { getViewerContext, isAdministrating } from '@/lib/auth/context'
import { auditLogPage, parseFilters } from '@/lib/admin/audit-log'

/**
 * Export JSON du journal d'audit, avec les filtres de l'ecran.
 *
 * Meme requete que l'ecran, meme RLS : ce qu'on telecharge est ce qu'on lit.
 * L'export est lui-meme un acte sensible ; il est journalise (`export`).
 */
export async function GET(request: Request) {
  const viewer = await getViewerContext()
  if (!viewer) return new NextResponse('Non authentifié.', { status: 401 })
  if (!isAdministrating(viewer)) return new NextResponse('Réservé à l’administration.', { status: 403 })

  const url = new URL(request.url)
  const filters = parseFilters(Object.fromEntries(url.searchParams.entries()))
  const rows = await auditLogPage(filters, 5000)

  const { createClient } = await import('@/lib/supabase/server')
  const supabase = await createClient()
  if (viewer.tenantId) {
    await supabase.rpc('log_audit_export', {
      p_tenant_id: viewer.tenantId,
      p_count: rows.length,
      p_filters: filters as unknown as Record<string, string>,
    })
  }

  const stamp = new Date().toISOString().slice(0, 19).replace(/[:T]/g, '-')
  const body = JSON.stringify(
    {
      exported_at: new Date().toISOString(),
      exported_by: viewer.email,
      filters,
      count: rows.length,
      truncated: rows.length >= 5000,
      entries: rows,
    },
    null,
    2,
  )

  return new NextResponse(body, {
    headers: {
      'Content-Type': 'application/json; charset=utf-8',
      'Content-Disposition': `attachment; filename="aigms-journal-${stamp}.json"`,
      'Cache-Control': 'no-store',
    },
  })
}

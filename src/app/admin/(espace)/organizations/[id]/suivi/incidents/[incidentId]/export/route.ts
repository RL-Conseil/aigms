import { NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'

/**
 * Le ticket, en JSON — le format du kit, importable dans Jira, ServiceNow ou
 * Monday. Tout y est : chronologie, acteurs, cause, CAPA, signatures.
 */
export async function GET(_request: Request, { params }: { params: Promise<{ id: string; incidentId: string }> }) {
  const { incidentId } = await params
  const supabase = await createClient()
  const { data, error } = await supabase.rpc('incident_ticket', { p_incident_id: incidentId })
  if (error || !data) return new NextResponse('Ticket introuvable', { status: 404 })
  const ticket = data as { business_ref: string }
  return new NextResponse(JSON.stringify(data, null, 2), {
    headers: {
      'Content-Type': 'application/json; charset=utf-8',
      'Content-Disposition': `attachment; filename="${ticket.business_ref}.json"`,
    },
  })
}

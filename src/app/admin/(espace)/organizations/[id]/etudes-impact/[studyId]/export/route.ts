import { NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { buildImpactStudyDocx } from '@/lib/impact/docx'
import type { ImpactStudy } from '@/lib/domain/impact'

/** L'etude au format du modele de l'organisation (.docx) : a remettre, a annexer. */
export async function GET(_request: Request, { params }: { params: Promise<{ id: string; studyId: string }> }) {
  const { id, studyId } = await params
  const supabase = await createClient()
  const [{ data: organization }, { data }] = await Promise.all([
    supabase.from('organization').select('name').eq('id', id).maybeSingle(),
    supabase.rpc('impact_study', { p_id: studyId }),
  ])
  if (!organization || !data) return new NextResponse('Étude introuvable', { status: 404 })
  const study = data as unknown as ImpactStudy
  if (study.organization_id !== id) return new NextResponse('Étude introuvable', { status: 404 })
  const bytes = await buildImpactStudyDocx(study, organization.name)
  return new NextResponse(new Uint8Array(bytes), {
    headers: {
      'Content-Type': 'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
      'Content-Disposition': `attachment; filename="${study.business_ref}-etude-impact.docx"`,
      'Cache-Control': 'no-store',
    },
  })
}

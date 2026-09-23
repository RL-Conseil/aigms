import { NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { EVIDENCE_BUCKET, SIGNED_URL_TTL_SECONDS } from '@/lib/storage/evidence'

/**
 * Telechargement d'une preuve.
 *
 * Le fichier n'est jamais servi par l'application : on redirige vers une URL
 * signee de courte duree. La plateforme ne devient donc pas un mandataire de
 * telechargement, et le lien produit ne survit pas a sa copie dans un courriel.
 *
 * L'URL est demandee avec le client de session : c'est la politique de stockage
 * qui accorde ou refuse, pas ce fichier.
 */

export async function GET(
  _request: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  const { id } = await params
  const supabase = await createClient()

  const { data: evidence } = await supabase
    .from('evidence')
    .select('storage_path, file_name')
    .eq('id', id)
    .maybeSingle()

  if (!evidence?.storage_path) {
    return NextResponse.json({ error: 'Preuve introuvable ou sans fichier.' }, { status: 404 })
  }

  const { data, error } = await supabase.storage
    .from(EVIDENCE_BUCKET)
    .createSignedUrl(evidence.storage_path, SIGNED_URL_TTL_SECONDS, {
      download: evidence.file_name ?? true,
    })

  if (error || !data) {
    return NextResponse.json({ error: 'Accès au fichier refusé.' }, { status: 403 })
  }

  return NextResponse.redirect(data.signedUrl)
}

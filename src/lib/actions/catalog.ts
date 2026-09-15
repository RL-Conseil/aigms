'use server'

import { createHash } from 'node:crypto'
import { revalidatePath } from 'next/cache'
import { z } from 'zod'
import { createClient } from '@/lib/supabase/server'
import { translateCsv } from '@/lib/catalog/csv'

/**
 * Import d'un referentiel de controles.
 *
 * Les actions ne font que porter le fichier et declencher les fonctions de
 * base : la validation, l'import atomique et la publication vivent en base,
 * comme les gates de gouvernance. Un import ne doit pas pouvoir etre contourne
 * en s'adressant directement a l'API.
 */

export type CatalogState =
  | { ok: true; message: string; jobId?: string; details?: string[] }
  | { ok: false; message: string; details?: string[] }

const MAX_BYTES = 8 * 1024 * 1024

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

/** Depose un fichier et lance sa validation. */
export async function uploadCatalog(
  _previous: CatalogState | null,
  formData: FormData,
): Promise<CatalogState> {
  const tenantId = await administratedTenant()
  if (!tenantId) {
    return { ok: false, message: "L'import d'un référentiel relève de l'administration." }
  }

  const file = formData.get('file')
  if (!(file instanceof File) || file.size === 0) {
    return { ok: false, message: 'Choisissez un fichier JSON ou CSV.' }
  }
  if (file.size > MAX_BYTES) {
    return { ok: false, message: 'Fichier trop volumineux (limite : 8 Mo).' }
  }

  const raw = await file.text()
  // L'empreinte porte sur le fichier DEPOSE, pas sur sa traduction : c'est lui
  // que l'administrateur a relu, c'est lui qui doit rester rejouable.
  const sha256 = createHash('sha256').update(raw).digest('hex')

  let payload: unknown
  if (/\.csv$/i.test(file.name) || file.type === 'text/csv') {
    // Un CSV ne porte pas l'identite du referentiel : elle vient du formulaire.
    const id = String(formData.get('frameworkCode') ?? '').trim().toUpperCase()
    const name = String(formData.get('frameworkName') ?? '').trim()
    const version = String(formData.get('frameworkVersion') ?? '').trim()
    if (!id || !name || !version) {
      return {
        ok: false,
        message: 'Un CSV ne porte pas l’identité du référentiel : renseigner son code, son nom et sa version.',
      }
    }
    if (!/^[A-Z0-9][A-Z0-9-]{1,30}$/.test(id)) {
      return { ok: false, message: 'Le code du référentiel : lettres, chiffres et tirets (ex. CAB-CF).' }
    }
    const translated = translateCsv(raw, { id, name, version })
    if (!translated.ok) {
      return {
        ok: false,
        message: `CSV refusé : ${translated.issues.length} constat(s).`,
        details: translated.issues.slice(0, 20).map((i) => `ligne ${i.line} · ${i.message}`),
      }
    }
    payload = translated.payload
  } else {
    try {
      payload = JSON.parse(raw)
    } catch {
      return {
        ok: false,
        message: 'Le fichier n’est ni du JSON valide ni un CSV. Le format canonique est le JSON du paquet ; le modèle CSV est téléchargeable depuis cette page.',
      }
    }
  }

  const supabase = await createClient()

  const { data: job, error } = await supabase
    .from('catalog_import_job')
    .insert({
      tenant_id: tenantId,
      source_filename: file.name,
      source_sha256: sha256,
      payload: payload as never,
    })
    .select('id')
    .single()

  if (error) {
    return { ok: false, message: `Dépôt refusé : ${error.message}` }
  }

  // Validation immediate : l'administrateur voit tout de suite si le document
  // tient, plutot que d'avoir a declencher une seconde action.
  const { data: verdict, error: validationError } = await supabase.rpc('validate_catalog_import', {
    p_job_id: job.id,
  })

  if (validationError) {
    return { ok: false, message: `Validation impossible : ${validationError.message}` }
  }

  const result = verdict as { status: string; errors: number; controls?: number; domains?: number }

  if (result.status === 'REJECTED') {
    const { data: errors } = await supabase
      .from('catalog_import_error')
      .select('path, code, message')
      .eq('job_id', job.id)
      .limit(20)

    revalidatePath('/admin/referentiels')
    return {
      ok: false,
      message: `Document refusé : ${result.errors} constat(s).`,
      details: (errors ?? []).map((e) => `${e.path ?? '—'} · ${e.message}`),
    }
  }

  revalidatePath('/admin/referentiels')
  return {
    ok: true,
    jobId: job.id,
    message: `Document validé : ${result.domains} domaine(s), ${result.controls} contrôle(s). Vérifiez l’aperçu avant d’importer.`,
  }
}

const jobSchema = z.object({ jobId: z.string().uuid() })

export async function commitCatalog(
  _previous: CatalogState | null,
  formData: FormData,
): Promise<CatalogState> {
  const parsed = jobSchema.safeParse({ jobId: formData.get('jobId') })
  if (!parsed.success) return { ok: false, message: 'Demande invalide.' }

  const supabase = await createClient()
  const { data, error } = await supabase.rpc('commit_catalog_import', {
    p_job_id: parsed.data.jobId,
  })

  if (error) return { ok: false, message: `Import refusé : ${error.message}` }

  const result = data as { controls: number; domains: number }
  revalidatePath('/admin/referentiels')
  return {
    ok: true,
    message: `Référentiel importé : ${result.controls} contrôle(s) répartis en ${result.domains} domaine(s).`,
  }
}

const versionSchema = z.object({ versionId: z.string().uuid() })

export async function publishCatalog(
  _previous: CatalogState | null,
  formData: FormData,
): Promise<CatalogState> {
  const parsed = versionSchema.safeParse({ versionId: formData.get('versionId') })
  if (!parsed.success) return { ok: false, message: 'Demande invalide.' }

  const supabase = await createClient()
  const { error } = await supabase.rpc('publish_catalog_version', {
    p_version_id: parsed.data.versionId,
  })

  if (error) return { ok: false, message: `Publication refusée : ${error.message}` }

  revalidatePath('/admin/referentiels')
  return {
    ok: true,
    message: 'Référentiel publié. La baseline est désormais gelée : toute évolution passera par une nouvelle version.',
  }
}

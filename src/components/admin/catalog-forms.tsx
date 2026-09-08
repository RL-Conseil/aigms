'use client'

import { useActionState } from 'react'
import { commitCatalog, publishCatalog, uploadCatalog, type CatalogState } from '@/lib/actions/catalog'

function Feedback({ state }: { state: CatalogState | null }) {
  if (!state) return null
  return (
    <div
      role="status"
      className={`rounded-md px-4 py-3 text-sm ${
        state.ok ? 'bg-emerald-50 text-emerald-800' : 'bg-rose-50 text-rose-800'
      }`}
    >
      <p>{state.message}</p>
      {state.details?.length ? (
        <ul className="mt-2 flex flex-col gap-1 text-[13px]">
          {state.details.map((detail, index) => (
            <li key={index} className="font-mono">
              {detail}
            </li>
          ))}
        </ul>
      ) : null}
    </div>
  )
}

/**
 * Depot puis confirmation.
 *
 * Les deux etapes sont deux formulaires FRERES, jamais imbriques : un `<form>`
 * dans un `<form>` est invalide en HTML, et le navigateur ignore purement et
 * simplement le formulaire interne — le bouton de confirmation ne soumettait
 * rien.
 */
export function CatalogUploadForm() {
  const [uploadState, uploadAction, uploading] = useActionState<CatalogState | null, FormData>(
    uploadCatalog,
    null,
  )
  const [commitState, commitAction, committing] = useActionState<CatalogState | null, FormData>(
    commitCatalog,
    null,
  )

  const readyToCommit = uploadState?.ok === true && Boolean(uploadState.jobId) && !commitState?.ok

  return (
    <div className="flex flex-col gap-4">
      <form action={uploadAction} className="flex flex-col gap-4">
        <div>
          <label htmlFor="file" className="mb-1.5 block text-sm font-medium">
            Fichier du référentiel
          </label>
          <input
            id="file"
            name="file"
            type="file"
            accept="application/json,.json"
            required
            className="w-full rounded-md border border-ink-200 bg-white px-3 py-2 text-sm file:mr-3 file:rounded file:border-0 file:bg-ink-100 file:px-3 file:py-1.5 file:text-sm"
          />
          <p className="mt-1.5 text-xs leading-relaxed text-ink-500">
            JSON canonique du paquet. Le document est validé au dépôt : structure, clés naturelles,
            domaines référencés, doublons et nombre de contrôles déclaré. Rien n’entre en base avant
            votre confirmation.
          </p>
        </div>

        <button
          type="submit"
          disabled={uploading}
          className="self-start rounded-md bg-night-900 px-5 py-2.5 text-sm font-medium text-white hover:bg-night-800 disabled:opacity-60"
        >
          {uploading ? 'Validation…' : 'Déposer et valider'}
        </button>
      </form>

      <Feedback state={uploadState} />

      {readyToCommit ? (
        <form
          action={commitAction}
          className="flex flex-col gap-3 rounded-md border border-ink-200 bg-ink-100 px-4 py-3"
        >
          <input type="hidden" name="jobId" value={uploadState.jobId} />
          <p className="text-sm text-ink-700">
            Le document est recevable. L’import est transactionnel : il aboutit entièrement ou pas
            du tout.
          </p>
          <button
            type="submit"
            disabled={committing}
            className="self-start rounded-md bg-night-900 px-5 py-2.5 text-sm font-medium text-white hover:bg-night-800 disabled:opacity-60"
          >
            {committing ? 'Import…' : 'Importer le référentiel'}
          </button>
        </form>
      ) : null}

      <Feedback state={commitState} />
    </div>
  )
}

export function CatalogPublishForm({ versionId }: { versionId: string }) {
  const [state, formAction, pending] = useActionState<CatalogState | null, FormData>(
    publishCatalog,
    null,
  )

  return (
    <div className="flex flex-col items-end gap-2">
      <form action={formAction}>
        <input type="hidden" name="versionId" value={versionId} />
        <button
          type="submit"
          disabled={pending}
          className="rounded-md border border-ink-200 px-3 py-1.5 text-sm text-ink-700 hover:bg-ink-100 disabled:opacity-60"
        >
          {pending ? 'Publication…' : 'Publier'}
        </button>
      </form>
      {state ? (
        <p className={`max-w-sm text-right text-xs ${state.ok ? 'text-emerald-700' : 'text-rose-700'}`}>
          {state.message}
        </p>
      ) : null}
    </div>
  )
}

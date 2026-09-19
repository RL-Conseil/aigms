'use client'

import { useActionState } from 'react'
import { importAssetsCsv, importVendorsCsv, type ImportState } from '@/lib/actions/registry'
import { Submit } from '@/components/forms'

/**
 * Importer un registre depuis un CSV — actifs d'IA ou fournisseurs.
 *
 * Le modele se telecharge a cote ; les colonnes se lisent par leur nom, avec
 * les synonymes courants des exports d'ITSM. La base rapproche par nom : une
 * ligne connue met a jour, une ligne nouvelle cree, et chaque refus est nomme.
 */
export function RegistryImportForm({
  organizationId,
  what,
}: {
  organizationId: string
  what: 'actifs' | 'fournisseurs'
}) {
  const [state, formAction, pending] = useActionState<ImportState | null, FormData>(
    what === 'actifs' ? importAssetsCsv : importVendorsCsv,
    null,
  )
  const template = what === 'actifs' ? '/modeles/actifs-ia.csv' : '/modeles/fournisseurs.csv'
  const columns =
    what === 'actifs'
      ? 'name, kind, description, version, vendor, hosting_location, contains_personal_data, owner_email'
      : 'name, is_model_provider, criticality, country_code, dpa_signed, security_assessed, reversibility_documented, subprocessors, notes'

  return (
    <form action={formAction} className="flex flex-col gap-3">
      <input type="hidden" name="organizationId" value={organizationId} />
      <p className="text-xs leading-relaxed text-ink-500">
        Colonnes : <span className="font-mono">{columns}</span>. Séparateur « ; » ou « , », UTF-8.
        Les synonymes courants (nom, type, fournisseur, hébergement, owned_by, sys_class_name…) sont
        reconnus.{' '}
        <a href={template} download className="font-medium text-brand-600 hover:underline">
          Télécharger le modèle
        </a>
      </p>
      <div className="flex flex-wrap items-center gap-3">
        <label htmlFor={`import-${what}`} className="sr-only">
          Fichier CSV
        </label>
        <input
          id={`import-${what}`}
          name="file"
          type="file"
          accept=".csv,text/csv"
          required
          className="text-sm text-ink-700 file:mr-3 file:rounded-md file:border file:border-ink-200 file:bg-white file:px-3 file:py-1.5 file:text-sm file:text-ink-700 hover:file:bg-ink-100"
        />
        <Submit pending={pending} idle={what === 'actifs' ? 'Importer les actifs' : 'Importer les fournisseurs'} />
      </div>
      {state ? (
        <div
          role="status"
          data-outcome={state.ok ? 'ok' : 'error'}
          className={`rounded-md px-4 py-3 text-sm ${state.ok ? 'bg-emerald-50 text-emerald-800' : 'bg-rose-50 text-rose-800'}`}
        >
          <p>{state.message}</p>
          {state.ok && state.ignored.length ? (
            <p className="mt-1 text-xs">Colonnes ignorées : {state.ignored.join(', ')}.</p>
          ) : null}
          {state.ok && state.issues.length ? (
            <ul className="mt-1 list-disc pl-4 text-xs">
              {state.issues.map((i) => (
                <li key={i.line}>Ligne {i.line + 1} : {i.message}</li>
              ))}
            </ul>
          ) : null}
        </div>
      ) : null}
    </form>
  )
}


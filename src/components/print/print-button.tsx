'use client'

/** Ouvre la boîte d'impression du navigateur. Absent du document imprimé. */
export function PrintButton() {
  return (
    <button
      type="button"
      onClick={() => window.print()}
      className="rounded-md bg-night-900 px-4 py-2.5 text-sm font-medium text-white hover:bg-night-800"
    >
      Imprimer
    </button>
  )
}

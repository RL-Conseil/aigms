'use client'

import { useState, type ReactNode } from 'react'

/**
 * Primitives de formulaire.
 *
 * Elles existent pour que chaque champ porte son libelle, son aide et son
 * erreur au meme endroit : un formulaire de gouvernance se remplit une fois et
 * se relit des mois plus tard, l'etiquetage n'y est pas decoratif.
 */

export const FIELD =
  'w-full rounded-md border border-ink-200 bg-white px-3 py-2 text-sm outline-none focus:border-brand-500 focus:ring-2 focus:ring-brand-500/20 disabled:bg-ink-100'

export function Field({
  label,
  htmlFor,
  hint,
  error,
  optional,
  children,
}: {
  label: string
  htmlFor: string
  hint?: string
  error?: string
  optional?: boolean
  children: ReactNode
}) {
  return (
    <div>
      <label htmlFor={htmlFor} className="mb-1.5 block text-sm font-medium">
        {label}
        {optional ? <span className="font-normal text-ink-500"> (facultatif)</span> : null}
      </label>
      {children}
      {hint ? <p className="mt-1.5 text-xs leading-relaxed text-ink-500">{hint}</p> : null}
      {error ? (
        <p role="alert" className="mt-1.5 text-[13px] text-stop-600">
          {error}
        </p>
      ) : null}
    </div>
  )
}

export function FormFeedback({
  state,
}: {
  state: { ok: boolean; message: string } | null
}) {
  if (!state) return null
  return (
    <p
      role="status"
      className={`rounded-md px-4 py-3 text-sm ${
        state.ok ? 'bg-emerald-50 text-emerald-800' : 'bg-rose-50 text-rose-800'
      }`}
    >
      {state.message}
    </p>
  )
}

export function Submit({ pending, children, idle }: { pending: boolean; children?: ReactNode; idle: string }) {
  return (
    <button
      type="submit"
      disabled={pending}
      className="self-start rounded-md bg-night-900 px-5 py-2.5 text-sm font-medium text-white hover:bg-night-800 disabled:opacity-60"
    >
      {pending ? (children ?? 'Enregistrement…') : idle}
    </button>
  )
}

/**
 * Section repliable.
 *
 * Le dossier d'un cas d'usage est long ; on ne travaille jamais sur tout en
 * meme temps. Chaque etape s'ouvre a la demande, et celle qui reste a faire
 * s'ouvre d'elle-meme.
 */
export function Disclosure({
  title,
  summary,
  defaultOpen = false,
  stayOpen = false,
  tone = 'neutral',
  children,
}: {
  title: string
  summary?: string
  defaultOpen?: boolean
  /**
   * Maintient le volet ouvert malgre un rechargement du contenu. Apres un
   * enregistrement, la page est revalidee et le resume du volet change : sans
   * cela le volet se refermerait, emportant la confirmation avec lui.
   */
  stayOpen?: boolean
  tone?: 'neutral' | 'todo' | 'done'
  children: ReactNode
}) {
  const [open, setOpen] = useState(defaultOpen)
  const shown = open || stayOpen

  const dot =
    tone === 'done' ? 'bg-emerald-500' : tone === 'todo' ? 'bg-amber-500' : 'bg-ink-300'

  return (
    <section className="rounded-lg border border-ink-200 bg-white">
      {/*
        Le titre porte un niveau de titre, comme celui d'une carte : replier une
        section ne doit pas la retirer du plan du document. Le bouton vit DANS
        le titre — l'inverse serait invalide, un bouton ne contient pas de titre.
      */}
      <h2>
        <button
          type="button"
          onClick={() => setOpen((v) => !v)}
          aria-expanded={shown}
          className="flex w-full items-center gap-3 px-5 py-3.5 text-left hover:bg-ink-50"
        >
          <span aria-hidden className={`size-2 shrink-0 rounded-full ${dot}`} />
          <span className="min-w-0 flex-1">
            <span className="block text-sm font-semibold text-ink-900">{title}</span>
            {summary ? <span className="block text-xs text-ink-500">{summary}</span> : null}
          </span>
          <svg
            width="16"
            height="16"
            viewBox="0 0 16 16"
            fill="none"
            aria-hidden
            className={`shrink-0 text-ink-400 transition-transform ${shown ? 'rotate-180' : ''}`}
          >
            <path d="M4 6.4 L8 10.4 L12 6.4" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round" />
          </svg>
        </button>
      </h2>

      {shown ? <div className="border-t border-ink-100 px-5 py-5">{children}</div> : null}
    </section>
  )
}

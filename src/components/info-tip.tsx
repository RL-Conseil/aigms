'use client'

import { useEffect, useRef, useState, type ReactNode } from 'react'

/**
 * Note explicative, repliee derriere une icone.
 *
 * Elle sert a ce qui doit rester DISPONIBLE sans rester PRESENT : une mise en
 * garde qu'on lit une fois et qu'on veut pouvoir relire, sans qu'elle occupe le
 * haut de l'ecran a chaque visite.
 *
 * Ce n'est pas une infobulle au survol : le contenu tient plusieurs phrases, et
 * une bulle qui disparait des qu'on bouge la souris ne se lit pas. Elle s'ouvre
 * au clic, se ferme par Echap ou en cliquant ailleurs — et reste donc
 * atteignable au clavier.
 */
export function InfoTip({
  label,
  title,
  children,
}: {
  /** Nom accessible du bouton. Decrit ce qu'on va lire, pas l'icone. */
  label: string
  title?: string
  children: ReactNode
}) {
  const [open, setOpen] = useState(false)
  const container = useRef<HTMLDivElement>(null)

  useEffect(() => {
    if (!open) return

    const onKey = (event: KeyboardEvent) => {
      if (event.key === 'Escape') setOpen(false)
    }
    const onClick = (event: MouseEvent) => {
      if (!container.current?.contains(event.target as Node)) setOpen(false)
    }

    document.addEventListener('keydown', onKey)
    document.addEventListener('mousedown', onClick)
    return () => {
      document.removeEventListener('keydown', onKey)
      document.removeEventListener('mousedown', onClick)
    }
  }, [open])

  return (
    <div ref={container} className="relative">
      <button
        type="button"
        aria-label={label}
        aria-expanded={open}
        onClick={() => setOpen((v) => !v)}
        className={`inline-flex size-7 items-center justify-center rounded-full border text-sm font-semibold transition-colors ${
          open
            ? 'border-brand-600 bg-brand-600 text-white'
            : 'border-ink-300 text-ink-500 hover:border-ink-400 hover:text-ink-700'
        }`}
      >
        <span aria-hidden>i</span>
      </button>

      {open ? (
        <div
          role="dialog"
          aria-label={label}
          className="absolute right-0 z-20 mt-2 w-[min(30rem,calc(100vw-3rem))] rounded-lg border border-ink-200 bg-white p-5 text-left shadow-[0_1px_2px_rgb(30_42_68/0.04),0_12px_32px_rgb(30_42_68/0.12)]"
        >
          {title ? <p className="mb-2 text-sm font-semibold text-ink-900">{title}</p> : null}
          {children}
        </div>
      ) : null}
    </div>
  )
}

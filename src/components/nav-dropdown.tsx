'use client'

import Link from 'next/link'
import { useEffect, useRef, useState } from 'react'

/**
 * Un menu deroulant de la navigation principale — « Registres ».
 *
 * Cinq destinations d'egale importance qui n'avaient pas leur place en
 * premiere ligne : les regrouper sous un mot les garde a un clic sans
 * encombrer la barre. S'ouvre au clic, se ferme a Echap, au clic ailleurs, et
 * apres avoir choisi.
 */
export function NavDropdown({
  label,
  badge,
  active,
  items,
}: {
  label: string
  badge?: React.ReactNode
  active?: boolean
  items: { href: string; label: string; badge?: React.ReactNode; active?: boolean }[]
}) {
  const [open, setOpen] = useState(false)
  const container = useRef<HTMLDivElement>(null)

  useEffect(() => {
    if (!open) return
    const onKey = (e: KeyboardEvent) => e.key === 'Escape' && setOpen(false)
    const onClick = (e: MouseEvent) => {
      if (container.current && !container.current.contains(e.target as Node)) setOpen(false)
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
        onClick={() => setOpen((v) => !v)}
        aria-expanded={open}
        aria-haspopup="menu"
        className={`inline-flex items-baseline gap-1 rounded-md px-3 py-1.5 text-sm transition-colors hover:bg-white/10 hover:text-white ${
          active ? 'text-white' : 'text-white/75'
        }`}
      >
        {label}
        {badge}
        <svg width="12" height="12" viewBox="0 0 16 16" fill="none" aria-hidden className={`ml-0.5 self-center transition-transform ${open ? 'rotate-180' : ''}`}>
          <path d="M4 6.4 L8 10.4 L12 6.4" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" />
        </svg>
      </button>

      {open ? (
        <ul
          role="menu"
          className="absolute left-0 z-30 mt-1.5 w-72 rounded-lg border border-ink-200 bg-white py-1.5 shadow-[0_1px_2px_rgb(30_42_68/0.04),0_12px_28px_rgb(30_42_68/0.14)]"
        >
          {items.map((item) => (
            <li key={item.href} role="none">
              <Link
                href={item.href}
                role="menuitem"
                aria-current={item.active ? 'page' : undefined}
                onClick={() => setOpen(false)}
                className={`flex items-baseline justify-between gap-3 px-4 py-2.5 text-sm hover:bg-ink-100 ${
                  item.active ? 'font-medium text-ink-900' : 'text-ink-700'
                }`}
              >
                <span>{item.label}</span>
                {item.badge}
              </Link>
            </li>
          ))}
        </ul>
      ) : null}
    </div>
  )
}

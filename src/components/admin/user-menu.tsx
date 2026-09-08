'use client'

import { useEffect, useRef, useState } from 'react'
import Link from 'next/link'
import { useRouter } from 'next/navigation'
import { createClient } from '@/lib/supabase/client'

/**
 * Menu de la personne connectee.
 *
 * Il regroupe ce qui la concerne — son profil, son organisation, sa sortie —
 * sous un seul point d'entree, plutot qu'un bouton de deconnexion isole.
 */
export function UserMenu({
  fullName,
  email,
  roleLabel,
  canSettleOrganization,
}: {
  fullName: string | null
  email: string
  roleLabel: string
  canSettleOrganization: boolean
}) {
  const router = useRouter()
  const [open, setOpen] = useState(false)
  const containerRef = useRef<HTMLDivElement>(null)

  useEffect(() => {
    if (!open) return

    function onPointerDown(event: MouseEvent) {
      if (!containerRef.current?.contains(event.target as Node)) setOpen(false)
    }
    function onKeyDown(event: KeyboardEvent) {
      if (event.key === 'Escape') setOpen(false)
    }

    document.addEventListener('mousedown', onPointerDown)
    document.addEventListener('keydown', onKeyDown)
    return () => {
      document.removeEventListener('mousedown', onPointerDown)
      document.removeEventListener('keydown', onKeyDown)
    }
  }, [open])

  async function signOut() {
    await createClient().auth.signOut()
    router.push('/login')
    router.refresh()
  }

  const initials = (fullName ?? email)
    .split(/[\s@.]+/)
    .filter(Boolean)
    .slice(0, 2)
    .map((part) => part[0]?.toUpperCase() ?? '')
    .join('')

  return (
    <div ref={containerRef} className="relative">
      <button
        type="button"
        onClick={() => setOpen((value) => !value)}
        aria-expanded={open}
        aria-haspopup="menu"
        className="flex items-center gap-2 rounded-md py-1.5 pl-1.5 pr-2.5 text-sm text-ink-600 hover:bg-ink-100 hover:text-ink-900"
      >
        <span className="flex size-7 items-center justify-center rounded-full bg-night-900 text-[11px] font-semibold text-white">
          {initials}
        </span>
        <span className="hidden sm:inline">{fullName ?? email}</span>
        <svg width="14" height="14" viewBox="0 0 14 14" fill="none" aria-hidden>
          <path
            d="M4 5.6 L7 8.6 L10 5.6"
            stroke="currentColor"
            strokeWidth="1.5"
            strokeLinecap="round"
            strokeLinejoin="round"
          />
        </svg>
      </button>

      {open ? (
        <div
          role="menu"
          className="absolute right-0 z-30 mt-1.5 w-72 rounded-lg border border-ink-200 bg-white py-1.5 shadow-[0_1px_2px_rgb(30_42_68/0.04),0_12px_28px_rgb(30_42_68/0.1)]"
        >
          <div className="border-b border-ink-100 px-4 pb-3 pt-2">
            <p className="text-sm font-medium text-ink-900">{fullName ?? '—'}</p>
            <p className="truncate text-xs text-ink-500">{email}</p>
            <p className="mt-1.5 text-xs text-teal-600">{roleLabel}</p>
          </div>

          <Link
            href="/admin/parametres"
            role="menuitem"
            onClick={() => setOpen(false)}
            className="flex items-center gap-2.5 px-4 py-2.5 text-sm text-ink-700 hover:bg-ink-100"
          >
            <GearIcon />
            Paramètres du compte
          </Link>

          {canSettleOrganization ? (
            <Link
              href="/admin/parametres#organisation"
              role="menuitem"
              onClick={() => setOpen(false)}
              className="flex items-center gap-2.5 px-4 py-2.5 text-sm text-ink-700 hover:bg-ink-100"
            >
              <BuildingIcon />
              Mon organisation
            </Link>
          ) : null}

          <div className="mt-1 border-t border-ink-100 pt-1">
            <button
              type="button"
              role="menuitem"
              onClick={signOut}
              className="flex w-full items-center gap-2.5 px-4 py-2.5 text-left text-sm text-ink-700 hover:bg-ink-100"
            >
              <ExitIcon />
              Se déconnecter
            </button>
          </div>
        </div>
      ) : null}
    </div>
  )
}

function GearIcon() {
  return (
    <svg width="17" height="17" viewBox="0 0 18 18" fill="none" aria-hidden className="shrink-0">
      <rect x="8.2" y="0.9" width="1.6" height="3.1" rx="0.6" fill="currentColor" transform="rotate(0 9 9)" />
      <rect x="8.2" y="0.9" width="1.6" height="3.1" rx="0.6" fill="currentColor" transform="rotate(45 9 9)" />
      <rect x="8.2" y="0.9" width="1.6" height="3.1" rx="0.6" fill="currentColor" transform="rotate(90 9 9)" />
      <rect x="8.2" y="0.9" width="1.6" height="3.1" rx="0.6" fill="currentColor" transform="rotate(135 9 9)" />
      <rect x="8.2" y="0.9" width="1.6" height="3.1" rx="0.6" fill="currentColor" transform="rotate(180 9 9)" />
      <rect x="8.2" y="0.9" width="1.6" height="3.1" rx="0.6" fill="currentColor" transform="rotate(225 9 9)" />
      <rect x="8.2" y="0.9" width="1.6" height="3.1" rx="0.6" fill="currentColor" transform="rotate(270 9 9)" />
      <rect x="8.2" y="0.9" width="1.6" height="3.1" rx="0.6" fill="currentColor" transform="rotate(315 9 9)" />
      <circle cx="9" cy="9" r="5.1" stroke="currentColor" strokeWidth="1.4" />
      <circle cx="9" cy="9" r="1.9" stroke="currentColor" strokeWidth="1.4" />
    </svg>
  )
}

function BuildingIcon() {
  return (
    <svg width="17" height="17" viewBox="0 0 18 18" fill="none" aria-hidden className="shrink-0">
      <path d="M3 15.4 V4.1 L10 2 V15.4" stroke="currentColor" strokeWidth="1.4" strokeLinejoin="round" />
      <path d="M10 7.2 H15 V15.4" stroke="currentColor" strokeWidth="1.4" strokeLinejoin="round" />
      <path d="M1.6 15.4 H16.4" stroke="currentColor" strokeWidth="1.4" strokeLinecap="round" />
      <path d="M5.6 6.6 V7.9 M5.6 10 V11.3 M12.4 10 V11.3" stroke="currentColor" strokeWidth="1.3" strokeLinecap="round" />
    </svg>
  )
}

function ExitIcon() {
  return (
    <svg width="17" height="17" viewBox="0 0 18 18" fill="none" aria-hidden className="shrink-0">
      <path d="M7 2.6 H3.6 V15.4 H7" stroke="currentColor" strokeWidth="1.4" strokeLinecap="round" strokeLinejoin="round" />
      <path d="M11 5.8 L14.4 9 L11 12.2" stroke="currentColor" strokeWidth="1.4" strokeLinecap="round" strokeLinejoin="round" />
      <path d="M14.4 9 H7" stroke="currentColor" strokeWidth="1.4" strokeLinecap="round" />
    </svg>
  )
}

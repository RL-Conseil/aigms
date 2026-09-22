'use client'

import { useEffect, useState } from 'react'
import { createClient } from '@/lib/supabase/client'
import { ControlToolingForm, type ControlToolingView } from '@/components/governance/tooling-forms'

/**
 * « Avec quoi il se tient », depuis le registre.
 *
 * La vue d'un controle — ce que le referentiel suggere, ce que l'organisation
 * a pose, ce qui est retenu — ne se charge qu'a l'ouverture : la lire pour
 * chacun des cent-vingt controles du registre serait cent-vingt requetes
 * pour un geste rare.
 */
export function ControlToolingModal({
  organizationId,
  controlId,
  controlCode,
}: {
  organizationId: string
  controlId: string
  controlCode: string
}) {
  const [view, setView] = useState<ControlToolingView | null>(null)
  const [open, setOpen] = useState(false)

  useEffect(() => {
    if (!open || view) return
    let cancelled = false
    void createClient()
      .rpc('control_tooling_view', { p_control_id: controlId })
      .then(({ data }) => {
        if (!cancelled && data) setView(data as unknown as ControlToolingView)
      })
    return () => {
      cancelled = true
    }
  }, [open, view, controlId])

  if (!open) {
    return (
      <button type="button" onClick={() => setOpen(true)} className="text-xs text-brand-600 hover:underline">
        Avec quoi il se tient
      </button>
    )
  }

  if (!view) return <span className="text-xs text-ink-400">Lecture…</span>

  return (
    <ControlToolingForm
      organizationId={organizationId}
      controlId={controlId}
      controlCode={controlCode}
      view={view}
    />
  )
}

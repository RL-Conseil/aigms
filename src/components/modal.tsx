'use client'

import { useEffect, useRef, useState, type ReactNode } from 'react'

/**
 * Fenetre de saisie contextuelle.
 *
 * Elle sert un cas precis, et un seul : saisir un objet qui n'existe QUE par ce
 * qu'on est en train de lire — un risque appartient a son cas d'usage, et
 * quitter la page ferait perdre de vue les autres risques qu'on vient de lire.
 *
 * C'est la difference avec un processus ou une activite, qui ont leur page :
 * ceux-la se decrivent une fois et se lisent des annees, hors du contexte ou on
 * les a crees. La regle n'est donc pas « modale ou page » mais : **la saisie
 * reste dans la page quand son objet n'a de sens que dans cette page.**
 *
 * Elle se ferme par Echap, par le fond, par le bouton — et rend le defilement
 * a la page qu'elle recouvre.
 */
export function Modal({
  trigger,
  title,
  description,
  hideTrigger = false,
  triggerLabel,
  triggerClassName,
  closeOnSuccess = true,
  children,
}: {
  /**
   * Se ferme d'elle-meme apres un enregistrement reussi — le temps de lire la
   * confirmation. A desactiver quand la fenetre sert a enchainer plusieurs
   * actes (retenir des propositions) ou a lire un resultat (une transition).
   */
  closeOnSuccess?: boolean
  /** Libelle du bouton qui l'ouvre — ou une icone, avec `triggerLabel`. */
  trigger: ReactNode
  /** Nom accessible, quand le libelle visible est un signe (« + »). */
  triggerLabel?: string
  /** Remplace le style du bouton d'ouverture. */
  triggerClassName?: string
  title: string
  description?: string
  /**
   * Masque le bouton sans demonter la fenetre. Sert au cas ou l'acte qu'elle
   * porte vient d'etre accompli : la revalidation retire le declencheur, et
   * sans cela la confirmation partirait avec lui — au moment precis ou elle
   * informe.
   */
  hideTrigger?: boolean
  /** Recoit une fonction de fermeture, a appeler apres un enregistrement. */
  children: (close: () => void) => ReactNode
}) {
  const [open, setOpen] = useState(false)
  const panel = useRef<HTMLDivElement>(null)

  // Un enregistrement reussi ferme la fenetre : on attend que la page ait
  // repris la main, pas que l'utilisateur cherche la croix. La confirmation
  // (FormFeedback, data-outcome="ok") reste lisible une seconde.
  useEffect(() => {
    if (!open || !closeOnSuccess || !panel.current) return
    let timer: ReturnType<typeof setTimeout> | undefined
    const observer = new MutationObserver(() => {
      if (timer) return
      if (panel.current?.querySelector('[role="status"][data-outcome="ok"]')) {
        timer = setTimeout(() => setOpen(false), 1200)
      }
    })
    observer.observe(panel.current, { childList: true, subtree: true, attributes: true, attributeFilter: ['data-outcome'] })
    return () => {
      observer.disconnect()
      if (timer) clearTimeout(timer)
    }
  }, [open, closeOnSuccess])

  useEffect(() => {
    if (!open) return

    const onKey = (event: KeyboardEvent) => {
      if (event.key === 'Escape') setOpen(false)
    }
    document.addEventListener('keydown', onKey)

    // Le fond ne doit pas defiler sous la fenetre : on perdrait sa place.
    const previous = document.body.style.overflow
    document.body.style.overflow = 'hidden'
    panel.current?.focus()

    return () => {
      document.removeEventListener('keydown', onKey)
      document.body.style.overflow = previous
    }
  }, [open])

  return (
    <>
      {hideTrigger ? null : (
        <button
          type="button"
          onClick={() => setOpen(true)}
          aria-label={triggerLabel}
          title={triggerLabel}
          className={
            triggerClassName ??
            'rounded-md border border-ink-200 px-3.5 py-1.5 text-xs font-medium text-ink-700 hover:bg-ink-100'
          }
        >
          {trigger}
        </button>
      )}

      {open ? (
        <div
          className="fixed inset-0 z-50 flex items-start justify-center overflow-y-auto bg-night-950/40 p-4 sm:p-8"
          onMouseDown={(event) => {
            if (event.target === event.currentTarget) setOpen(false)
          }}
        >
          <div
            ref={panel}
            role="dialog"
            aria-modal="true"
            aria-label={title}
            tabIndex={-1}
            className="w-full max-w-2xl rounded-lg border border-ink-200 bg-white shadow-[0_1px_2px_rgb(30_42_68/0.04),0_24px_48px_rgb(30_42_68/0.18)] outline-none"
          >
            <header className="flex items-start justify-between gap-4 border-b border-ink-100 px-5 py-3.5">
              <div>
                <h2 className="text-sm font-semibold text-ink-900">{title}</h2>
                {description ? (
                  <p className="mt-0.5 text-xs text-ink-500">{description}</p>
                ) : null}
              </div>
              <button
                type="button"
                aria-label="Fermer"
                onClick={() => setOpen(false)}
                className="shrink-0 rounded p-1 text-ink-400 hover:bg-ink-100 hover:text-ink-700"
              >
                <svg width="16" height="16" viewBox="0 0 16 16" fill="none" aria-hidden>
                  <path
                    d="M4 4 L12 12 M12 4 L4 12"
                    stroke="currentColor"
                    strokeWidth="1.6"
                    strokeLinecap="round"
                  />
                </svg>
              </button>
            </header>

            <div className="px-5 py-5">{children(() => setOpen(false))}</div>
          </div>
        </div>
      ) : null}
    </>
  )
}

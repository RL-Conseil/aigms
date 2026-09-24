'use client'

import Script from 'next/script'
import { useEffect, useId, useRef, useState } from 'react'

/**
 * Captcha Cloudflare Turnstile.
 *
 * DEUX REGLAGES, ET LE SECOND EST CELUI QUI PROTEGE. Le premier est la cle
 * publique `NEXT_PUBLIC_TURNSTILE_SITE_KEY` : elle fait apparaitre le defi. Le
 * second est cote Supabase (Authentication > Attack protection > Enable
 * Captcha, fournisseur Turnstile, cle secrete) : c'est lui qui fait REFUSER une
 * authentification sans jeton valide.
 *
 * Sans le second, le jeton est envoye mais jamais verifie. Un captcha
 * decoratif vaut moins que pas de captcha, parce qu'il fait croire a une
 * protection : d'ou ce commentaire, et la note dans docs/security.
 *
 * Absente, la cle publique laisse la mire fonctionner telle quelle — en
 * developpement, en Preview et dans les tests de bout en bout.
 */

declare global {
  interface Window {
    turnstile?: {
      render: (
        container: string | HTMLElement,
        options: {
          sitekey: string
          callback: (token: string) => void
          'expired-callback'?: () => void
          'error-callback'?: () => void
          theme?: 'light' | 'dark' | 'auto'
        },
      ) => string
      reset: (widgetId?: string) => void
    }
  }
}

export function Turnstile({
  siteKey,
  onToken,
  resetSignal = 0,
}: {
  siteKey: string
  onToken: (token: string | null) => void
  /**
   * UN JETON NE SERT QU'UNE FOIS. Apres un echec d'authentification, la page
   * reste ouverte et le jeton deja consomme : reessayer avec le meme se ferait
   * refuser par Cloudflare, et l'utilisateur verrait un second echec sans
   * comprendre pourquoi. Le formulaire incremente ce nombre a chaque echec ;
   * le widget se rearme et rend un jeton neuf.
   */
  resetSignal?: number
}) {
  const containerId = useId().replace(/:/g, '')
  const widgetRef = useRef<string | null>(null)
  const [ready, setReady] = useState(false)
  // `onToken` change a chaque rendu du parent : le garder dans une ref evite de
  // re-rendre le widget, qui perdrait le defi resolu. L'ecriture se fait dans
  // un effet, jamais pendant le rendu.
  const callbackRef = useRef(onToken)
  useEffect(() => {
    callbackRef.current = onToken
  }, [onToken])

  useEffect(() => {
    if (!ready || widgetRef.current || !window.turnstile) return
    const element = document.getElementById(containerId)
    if (!element) return

    widgetRef.current = window.turnstile.render(element, {
      sitekey: siteKey,
      theme: 'light',
      callback: (token) => callbackRef.current(token),
      'expired-callback': () => callbackRef.current(null),
      'error-callback': () => callbackRef.current(null),
    })
  }, [ready, siteKey, containerId])

  // `resetSignal` a 0 est l'etat initial : on ne rearme pas un widget qui vient
  // de naitre, sans quoi le premier defi serait jete avant d'etre resolu.
  useEffect(() => {
    if (!resetSignal || !widgetRef.current || !window.turnstile) return
    window.turnstile.reset(widgetRef.current)
    callbackRef.current(null)
  }, [resetSignal])

  return (
    <div>
      <Script
        src="https://challenges.cloudflare.com/turnstile/v0/api.js?render=explicit"
        strategy="afterInteractive"
        onReady={() => setReady(true)}
      />
      <div id={containerId} />
    </div>
  )
}

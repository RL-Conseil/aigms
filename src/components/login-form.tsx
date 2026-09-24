'use client'

import { useState } from 'react'
import { useRouter, useSearchParams } from 'next/navigation'
import { createClient } from '@/lib/supabase/client'
import { Turnstile } from '@/components/turnstile'

/**
 * Mire d'authentification : une adresse, puis un mot de passe OU l'annuaire de
 * l'organisation.
 *
 * Le message d'echec ne distingue pas un compte inconnu d'un mot de passe
 * errone : le formulaire ne doit pas servir a enumerer les comptes ouverts.
 * La connexion par annuaire repond en revanche sur le DOMAINE — « aucun
 * annuaire declare pour client.fr ». Un domaine n'est pas un compte : le dire
 * n'enumere rien et evite a la personne de chercher pourquoi rien ne se passe.
 *
 * LE CAPTCHA n'apparait que si `NEXT_PUBLIC_TURNSTILE_SITE_KEY` est renseignee,
 * et il ne protege que si Supabase est configure pour exiger le jeton
 * (Authentication > Attack protection). Le jeton part dans tous les cas ou il
 * existe : c'est Supabase qui refuse, pas cet ecran — meme principe que pour
 * les regles de gouvernance.
 */
export function LoginForm({ captchaSiteKey }: { captchaSiteKey?: string }) {
  const router = useRouter()
  const params = useSearchParams()
  const [email, setEmail] = useState('')
  const [error, setError] = useState<string | null>(
    params.get('erreur') === 'annuaire'
      ? 'La connexion par l’annuaire n’a pas abouti. Réessayez, ou utilisez votre mot de passe.'
      : null,
  )
  const [pending, setPending] = useState<'password' | 'sso' | null>(null)
  const [captchaToken, setCaptchaToken] = useState<string | null>(null)
  /**
   * Un jeton de captcha ne sert qu'une fois. Apres un echec, le rearmement
   * rend un jeton neuf — sans quoi la seconde tentative serait refusee par
   * Cloudflare, et non par le mot de passe.
   */
  const [captchaTour, setCaptchaTour] = useState(0)
  const rearmerCaptcha = () => {
    setCaptchaToken(null)
    setCaptchaTour((n) => n + 1)
  }

  /** Le captcha, quand il existe, vaut pour les deux chemins de connexion. */
  function captchaManquant() {
    if (captchaSiteKey && !captchaToken) {
      setError('Merci de valider le contrôle anti-robot.')
      return true
    }
    return false
  }

  async function onSubmit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault()
    setError(null)
    if (captchaManquant()) return
    setPending('password')

    const password = String(new FormData(event.currentTarget).get('password') ?? '')
    const supabase = createClient()
    const { error } = await supabase.auth.signInWithPassword({
      email,
      password,
      ...(captchaToken ? { options: { captchaToken } } : {}),
    })

    if (error) {
      setError('Identifiants invalides.')
      setPending(null)
      if (captchaSiteKey) rearmerCaptcha()
      return
    }

    const next = params.get('next')
    router.push(next?.startsWith('/admin') ? next : '/admin')
    router.refresh()
  }

  /**
   * Connexion par l'annuaire : le domaine de l'adresse designe le fournisseur
   * d'identite. C'est Supabase qui tient la correspondance domaine -> IdP ;
   * l'application n'en garde aucune liste, et rien n'est a redeployer quand un
   * client branche le sien.
   */
  async function onAnnuaire() {
    setError(null)
    const domain = email.trim().split('@')[1]?.toLowerCase()
    if (!domain || !domain.includes('.')) {
      setError('Indiquez d’abord votre adresse professionnelle.')
      return
    }
    if (captchaManquant()) return
    setPending('sso')

    const next = params.get('next')
    const retour = new URL('/auth/callback', window.location.origin)
    if (next?.startsWith('/admin')) retour.searchParams.set('next', next)

    const supabase = createClient()
    const { data, error } = await supabase.auth.signInWithSSO({
      domain,
      options: {
        redirectTo: retour.toString(),
        ...(captchaToken ? { captchaToken } : {}),
      },
    })

    if (error || !data?.url) {
      setError(`Aucun annuaire n’est déclaré pour ${domain}. Utilisez votre mot de passe.`)
      setPending(null)
      if (captchaSiteKey) rearmerCaptcha()
      return
    }

    window.location.assign(data.url)
  }

  return (
    <form onSubmit={onSubmit} className="flex flex-col gap-5">
      <div>
        <label htmlFor="email" className="mb-1.5 block text-sm font-medium">
          Adresse électronique
        </label>
        <input
          id="email"
          name="email"
          type="email"
          required
          autoComplete="email"
          autoFocus
          value={email}
          onChange={(event) => setEmail(event.target.value)}
          className="w-full rounded-md border border-ink-200 bg-white px-3.5 py-2.5 text-[15px] outline-none focus:border-brand-500 focus:ring-2 focus:ring-brand-500/20"
        />
      </div>

      <div>
        <label htmlFor="password" className="mb-1.5 block text-sm font-medium">
          Mot de passe
        </label>
        <input
          id="password"
          name="password"
          type="password"
          required
          autoComplete="current-password"
          className="w-full rounded-md border border-ink-200 bg-white px-3.5 py-2.5 text-[15px] outline-none focus:border-brand-500 focus:ring-2 focus:ring-brand-500/20"
        />
      </div>

      {captchaSiteKey ? (
        <Turnstile siteKey={captchaSiteKey} onToken={setCaptchaToken} resetSignal={captchaTour} />
      ) : null}

      {error ? (
        <p role="alert" className="rounded-md bg-rose-50 px-4 py-3 text-sm text-rose-800">
          {error}
        </p>
      ) : null}

      <button
        type="submit"
        disabled={pending !== null}
        className="rounded-lg bg-night-900 px-6 py-3.5 text-base font-medium text-white hover:bg-night-800 disabled:opacity-60"
      >
        {pending === 'password' ? 'Connexion…' : 'Se connecter'}
      </button>

      {/*
        Second chemin, pas second formulaire : le mot de passe reste `required`
        pour l'envoi du formulaire, et ce bouton `type="button"` ne declenche
        aucune validation. La personne saisit son adresse, puis choisit.
      */}
      <div className="flex items-center gap-3 text-[12px] uppercase tracking-[0.08em] text-ink-400">
        <span className="h-px grow bg-ink-200" />
        ou
        <span className="h-px grow bg-ink-200" />
      </div>

      <button
        type="button"
        onClick={onAnnuaire}
        disabled={pending !== null}
        className="rounded-lg border border-ink-300 px-6 py-3 text-[15px] font-medium text-ink-800 hover:border-ink-400 hover:bg-ink-50 disabled:opacity-60"
      >
        {pending === 'sso' ? 'Redirection…' : 'Se connecter avec l’annuaire de mon organisation'}
      </button>
    </form>
  )
}

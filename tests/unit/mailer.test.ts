import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { accountOpenedEmail } from '../../src/lib/email/messages'

/**
 * Courrier systeme.
 *
 * Deux proprietes se testent ici, et ce sont les deux qui comptent : l'envoi ne
 * fait jamais echouer l'appelant, et aucun secret ne part par courriel.
 */

const KEY = 'RESEND_API_KEY'
const FROM = 'SYSTEM_EMAIL_FROM'

async function loadMailer() {
  vi.resetModules()
  return import('../../src/lib/email/mailer')
}

let previous: Record<string, string | undefined>

beforeEach(() => {
  previous = { [KEY]: process.env[KEY], [FROM]: process.env[FROM] }
})

afterEach(() => {
  for (const [name, value] of Object.entries(previous)) {
    if (value === undefined) delete process.env[name]
    else process.env[name] = value
  }
  vi.unstubAllGlobals()
})

describe('Envoi', () => {
  it('se tait proprement quand rien n’est configuré', async () => {
    // C'est l'etat du poste de developpement et de l'integration continue :
    // aucune cle, et surtout aucune exception.
    delete process.env[KEY]
    delete process.env[FROM]

    const { sendSystemEmail, isMailerConfigured } = await loadMailer()
    expect(isMailerConfigured()).toBe(false)

    const result = await sendSystemEmail({ to: 'a@b.fr', subject: 'x', text: 'y' })
    expect(result).toEqual({ sent: false, reason: 'not_configured' })
  })

  it('adresse le message depuis le compte système, sans le laisser deviner', async () => {
    process.env[KEY] = 'test-key'
    process.env[FROM] = 'AIGMS <contact@caritis.fr>'

    const fetchMock = vi.fn(
      async (_url: string, _init: RequestInit) =>
        new Response(JSON.stringify({ id: 'msg_1' }), { status: 200 }),
    )
    vi.stubGlobal('fetch', fetchMock)

    const { sendSystemEmail } = await loadMailer()
    const result = await sendSystemEmail({ to: 'destinataire@exemple.fr', subject: 'Sujet', text: 'Corps' })

    expect(result).toEqual({ sent: true, id: 'msg_1' })

    const init = fetchMock.mock.calls[0]![1]
    const body = JSON.parse(String(init.body))
    expect(body.from).toBe('AIGMS <contact@caritis.fr>')
    expect(body.to).toEqual(['destinataire@exemple.fr'])
  })

  it('rend un refus plutôt que de lever', async () => {
    // Un compte declare l'est meme si le fournisseur de courriel repond mal.
    process.env[KEY] = 'test-key'
    process.env[FROM] = 'AIGMS <contact@caritis.fr>'
    vi.stubGlobal(
      'fetch',
      vi.fn(async () => new Response('domaine non vérifié', { status: 403 })),
    )

    const { sendSystemEmail } = await loadMailer()
    const result = await sendSystemEmail({ to: 'a@b.fr', subject: 'x', text: 'y' })

    expect(result.sent).toBe(false)
    if (!result.sent) expect(result.reason).toBe('refused')
  })

  it('rend un échec de transport plutôt que de lever', async () => {
    process.env[KEY] = 'test-key'
    process.env[FROM] = 'AIGMS <contact@caritis.fr>'
    vi.stubGlobal(
      'fetch',
      vi.fn(async () => {
        throw new Error('réseau indisponible')
      }),
    )

    const { sendSystemEmail } = await loadMailer()
    const result = await sendSystemEmail({ to: 'a@b.fr', subject: 'x', text: 'y' })

    expect(result.sent).toBe(false)
    if (!result.sent) expect(result.reason).toBe('unreachable')
  })
})

describe('Ouverture d’accès', () => {
  const message = accountOpenedEmail({
    fullName: 'Camille Duval',
    role: 'system_owner',
    siteUrl: 'https://aigms.example',
    organizationName: 'IzarLink Demo',
  })

  it('porte l’adresse de connexion, le rôle et le périmètre', () => {
    expect(message.text).toContain('Camille Duval')
    expect(message.text).toContain('https://aigms.example')
    expect(message.text).toContain('IzarLink Demo')
    expect(message.text).toMatch(/Votre rôle/)
  })

  it('ne transporte aucun moyen d’accès', () => {
    // La regle vaut pour tout courriel systeme : ce qui part est une
    // information, jamais un moyen d'entrer.
    expect(message.text).toMatch(/transmis séparément/)
    expect(message.text).not.toMatch(/mot de passe provisoire\s*:/i)
    expect(message.text).not.toMatch(/token|jeton d|https:\/\/\S*access_token/i)
  })
})

#!/usr/bin/env node
/**
 * Activer le captcha Turnstile — cote Supabase, la ou il protege.
 *
 * OU VA LA CLE SECRETE, ET POURQUOI PAS SUR VERCEL. AIGMS n'appelle jamais
 * `siteverify` lui-meme : la mire envoie le jeton a `signInWithPassword`, et
 * c'est SUPABASE AUTH qui le verifie aupres de Cloudflare, avec la cle secrete
 * configuree sur le projet. Poser un `TURNSTILE_SECRET_KEY` dans
 * l'environnement de l'application ne protegerait donc rien : aucune ligne de
 * code ne le lirait.
 *
 * LE SECRET NE TRANSITE PAS. Il se lit dans `.env.local`, ignore par Git,
 * n'est jamais affiche, jamais passe en argument de commande, jamais journalise.
 * Le script ne rend que des booleens.
 *
 * ORDRE DES OPERATIONS. La cle est posee AVANT l'activation : un captcha active
 * sans secret fait refuser toute authentification par Supabase — la mire se
 * fermerait pour tout le monde.
 *
 * Usage :
 *   TURNSTILE_SECRET_KEY=... SUPABASE_ACCESS_TOKEN=... node scripts/activer-captcha.mjs
 *   ... node scripts/activer-captcha.mjs --production   # sur la production
 *   ... node scripts/activer-captcha.mjs --etat          # ne change rien, dit l'etat
 *
 * APRES : la cle publique doit etre posee sur Vercel
 * (`NEXT_PUBLIC_TURNSTILE_SITE_KEY`) et le deploiement refait, sinon la mire
 * n'affiche aucun defi et Supabase refusera toutes les connexions.
 */
const SUPABASE_TOKEN = process.env.SUPABASE_ACCESS_TOKEN
const SECRET = process.env.TURNSTILE_SECRET_KEY?.trim()

const PREPROD = 'xahqdxwmlewyjpsiuzux'
const PRODUCTION = 'xsagbzrgoljzgorwvsir'

const surProduction = process.argv.includes('--production')
const etatSeulement = process.argv.includes('--etat')
const ref = surProduction ? PRODUCTION : PREPROD
const nom = surProduction ? 'production' : 'préprod'

if (!SUPABASE_TOKEN) {
  console.error('SUPABASE_ACCESS_TOKEN attendu. Le renseigner dans .env.local.')
  process.exit(1)
}

const api = (methode, corps) =>
  fetch(`https://api.supabase.com/v1/projects/${ref}/config/auth`, {
    method: methode,
    headers: {
      Authorization: `Bearer ${SUPABASE_TOKEN}`,
      ...(corps ? { 'Content-Type': 'application/json' } : {}),
    },
    ...(corps ? { body: JSON.stringify(corps) } : {}),
  })

async function etat() {
  const reponse = await api('GET')
  if (!reponse.ok) {
    console.error(`Lecture refusée : ${reponse.status} ${await reponse.text()}`)
    process.exit(1)
  }
  const config = await reponse.json()
  return {
    active: config.security_captcha_enabled === true,
    fournisseur: config.security_captcha_provider ?? '—',
    // Le secret n'est jamais rendu : on ne dit que sa presence.
    secret: Boolean(config.security_captcha_secret),
  }
}

const avant = await etat()
console.log(
  `${nom} — avant : captcha ${avant.active ? 'activé' : 'désactivé'}, ` +
    `fournisseur ${avant.fournisseur}, secret ${avant.secret ? 'posé' : 'absent'}`,
)

if (etatSeulement) process.exit(0)

if (!SECRET) {
  console.error(
    'TURNSTILE_SECRET_KEY attendue. La lire sur dash.cloudflare.com > Turnstile > le widget\n' +
      '> Settings, et la coller dans .env.local — jamais dans le dépôt, jamais dans une conversation.',
  )
  process.exit(1)
}

// Un secret Turnstile commence par `0x`. Ce controle n'est pas une validation
// cryptographique : il arrete la faute la plus probable — avoir colle la cle
// PUBLIQUE, qui commence pareil mais qui est bien plus courte.
if (!/^0x[A-Za-z0-9_-]{20,}$/.test(SECRET)) {
  console.error('La valeur de TURNSTILE_SECRET_KEY ne ressemble pas à une clé secrète Turnstile.')
  process.exit(1)
}
if (SECRET === process.env.NEXT_PUBLIC_TURNSTILE_SITE_KEY?.trim()) {
  console.error('TURNSTILE_SECRET_KEY est égale à la clé du site : c’est la clé publique, pas le secret.')
  process.exit(1)
}

const reponse = await api('PATCH', {
  security_captcha_provider: 'turnstile',
  security_captcha_secret: SECRET,
  security_captcha_enabled: true,
})

if (!reponse.ok) {
  // Le corps peut contenir ce qu'on vient d'envoyer : on ne l'affiche pas.
  console.error(`Écriture refusée : ${reponse.status}. Vérifier le jeton et le projet.`)
  process.exit(1)
}

const apres = await etat()
console.log(
  `${nom} — après : captcha ${apres.active ? 'activé' : 'désactivé'}, ` +
    `fournisseur ${apres.fournisseur}, secret ${apres.secret ? 'posé' : 'absent'}`,
)

if (!apres.active || apres.fournisseur !== 'turnstile' || !apres.secret) {
  console.error('L’état obtenu n’est pas celui attendu.')
  process.exit(1)
}

console.log(
  '\nLe captcha est actif : Supabase refuse désormais une authentification sans jeton valide.\n' +
    'Vérifier que NEXT_PUBLIC_TURNSTILE_SITE_KEY est posée sur Vercel et redéployer,\n' +
    'sinon la mire n’affichera aucun défi et plus personne ne pourra se connecter.',
)

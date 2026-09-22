#!/usr/bin/env node
/**
 * Poser sur Vercel les secrets que l'application attend.
 *
 * POURQUOI CE SCRIPT. Un secret ne s'ecrit pas dans le depot, ne se colle pas
 * dans une conversation, et ne se lit pas dans un journal. Celui-ci le prend
 * a sa source — l'API de gestion Supabase, qui rend les cles d'un projet — et
 * le pose sur Vercel sans jamais l'afficher. Il ne le garde nulle part.
 *
 * CE QU'IL POSE, par cible :
 *   preview + development -> la cle de service de la PREPROD
 *   production            -> la cle de service de la PRODUCTION
 *   CRON_SECRET           -> engendre au hasard, identique sur les trois
 *
 * Usage :
 *   SUPABASE_ACCESS_TOKEN=... VERCEL_TOKEN=... node scripts/poser-secrets-vercel.mjs
 *   ... node scripts/poser-secrets-vercel.mjs --production   # y ajoute la production
 *
 * Les deux jetons vivent dans .env.local, ignore par Git.
 *
 * APRES CE SCRIPT : redeployer. Une variable d'environnement n'entre en
 * vigueur qu'au deploiement suivant — `npm run deploy:preview`.
 */
import { randomBytes } from 'node:crypto'

const SUPABASE_TOKEN = process.env.SUPABASE_ACCESS_TOKEN
const VERCEL_TOKEN = process.env.VERCEL_TOKEN
const TEAM = process.env.VERCEL_TEAM_ID ?? 'team_EpSGhRhqme39AX6zVEfe57Y4'
const PROJECT_ID = process.env.VERCEL_PROJECT_ID ?? 'prj_E4fqSiDIhmsliWOmWUjiW73K2RbE'

const PREPROD = 'xahqdxwmlewyjpsiuzux'
const PRODUCTION = 'xsagbzrgoljzgorwvsir'

const withProduction = process.argv.includes('--production')

if (!SUPABASE_TOKEN || !VERCEL_TOKEN) {
  console.error('SUPABASE_ACCESS_TOKEN et VERCEL_TOKEN attendus. Les renseigner dans .env.local.')
  process.exit(1)
}

/** La cle de service d'un projet Supabase, prise a sa source. */
async function serviceRoleKey(ref) {
  const response = await fetch(`https://api.supabase.com/v1/projects/${ref}/api-keys`, {
    headers: { Authorization: `Bearer ${SUPABASE_TOKEN}` },
  })
  if (!response.ok) throw new Error(`Cles du projet ${ref} illisibles : ${response.status}`)
  const keys = await response.json()
  const key = keys.find((k) => k.name === 'service_role')?.api_key
  if (!key) throw new Error(`Aucune cle service_role sur le projet ${ref}.`)
  return key
}

const vercel = (path, init = {}) =>
  fetch(`https://api.vercel.com${path}${path.includes('?') ? '&' : '?'}teamId=${TEAM}`, {
    ...init,
    headers: {
      Authorization: `Bearer ${VERCEL_TOKEN}`,
      'Content-Type': 'application/json',
      ...(init.headers ?? {}),
    },
  })

/**
 * Pose une variable, en remplacant celle qui porte deja les memes cibles.
 * Vercel refuse un doublon ; on retire donc l'ancienne d'abord.
 */
async function put(key, value, targets) {
  const listing = await vercel(`/v9/projects/${PROJECT_ID}/env`)
  if (!listing.ok) throw new Error(`Variables illisibles : ${listing.status}`)
  const { envs } = await listing.json()

  for (const env of envs ?? []) {
    if (env.key !== key) continue
    const same = (env.target ?? []).some((t) => targets.includes(t))
    if (!same) continue
    const removed = await vercel(`/v9/projects/${PROJECT_ID}/env/${env.id}`, { method: 'DELETE' })
    if (!removed.ok) throw new Error(`Ancienne valeur de ${key} non retiree : ${removed.status}`)
  }

  const created = await vercel(`/v10/projects/${PROJECT_ID}/env`, {
    method: 'POST',
    body: JSON.stringify({ key, value, type: 'encrypted', target: targets }),
  })
  if (!created.ok) {
    throw new Error(`${key} non posee sur ${targets.join(', ')} : ${created.status} ${await created.text()}`)
  }
  console.log(`  ${key} -> ${targets.join(', ')}`)
}

console.log('Secrets posés sur Vercel (aucune valeur n’est affichée) :')

await put('SUPABASE_SERVICE_ROLE_KEY', await serviceRoleKey(PREPROD), ['preview', 'development'])
if (withProduction) {
  await put('SUPABASE_SERVICE_ROLE_KEY', await serviceRoleKey(PRODUCTION), ['production'])
}

// Le secret partage avec la tache planifiee : la route d'envoi des alertes
// refuse tout appel qui ne le porte pas.
await put('CRON_SECRET', randomBytes(32).toString('hex'), withProduction ? ['production', 'preview', 'development'] : ['preview', 'development'])

console.log('\nRedéployer pour qu’elles entrent en vigueur : npm run deploy:preview')

#!/usr/bin/env node
/**
 * Deploiement Vercel depuis la branche courante.
 *
 * Pourquoi ce script plutot que le CLI : le jeton dont dispose le projet est un
 * jeton de portee projet. Le CLI interroge /v2/user au demarrage, route a
 * laquelle ce jeton n'a pas acces, et refuse donc de fonctionner. L'API de
 * deploiement, elle, l'accepte.
 *
 * Il deviendra inutile le jour ou l'App GitHub de Vercel aura acces a
 * l'organisation RL-Conseil : les deploiements repartiront automatiquement a
 * chaque push. Voir docs/roadmap/IMPLEMENTATION_STATUS.md.
 *
 * Usage :
 *   VERCEL_TOKEN=... node scripts/deploy-vercel.mjs            # preview
 *   VERCEL_TOKEN=... node scripts/deploy-vercel.mjs production # production
 *
 * La production est reservee au proprietaire du depot : ce script refuse de la
 * cibler depuis une branche autre que main.
 */
import { createHash } from 'node:crypto'
import { readFileSync } from 'node:fs'
import { execFileSync } from 'node:child_process'

const TOKEN = process.env.VERCEL_TOKEN
const TEAM = process.env.VERCEL_TEAM_ID ?? 'team_EpSGhRhqme39AX6zVEfe57Y4'
const PROJECT = 'aigms'

/**
 * Le domaine de demonstration, pose EN PLUS de l'alias de branche quand on
 * deploie depuis `dev`.
 *
 * Pourquoi il faut le poser a chaque fois : le projet n'est pas relie par
 * branche a un depot Git, donc Vercel ne sait pas qu'un domaine doit suivre
 * `dev`. On l'attache au deploiement qu'on vient de faire.
 *
 * Pourquoi un domaine personnalise : la protection SSO de l'equipe couvre
 * `*.vercel.app` mais pas les domaines personnalises. C'est ce qui rend la
 * demonstration accessible a un partenaire sans l'inviter dans l'equipe
 * Vercel — et c'est aussi ce qui expose la mire de connexion a l'internet.
 */
const DEMO_DOMAIN = process.env.VERCEL_DEMO_DOMAIN ?? 'demo.aigms.eu'
const DEMO_BRANCH = 'dev'

if (!TOKEN) {
  console.error('VERCEL_TOKEN absente. La renseigner dans .env.local, ignore par Git.')
  process.exit(1)
}

const git = (...args) => execFileSync('git', args, { encoding: 'utf8' }).trim()

const branch = git('rev-parse', '--abbrev-ref', 'HEAD')
const target = process.argv[2] === 'production' ? 'production' : undefined

if (target === 'production' && branch !== 'main') {
  console.error(`Refus : la production se deploie depuis main, pas depuis ${branch}.`)
  process.exit(1)
}

if (git('status', '--porcelain')) {
  console.error('Arbre de travail non propre. Committer avant de deployer : le deploiement')
  console.error('envoie les fichiers suivis par Git, une modification non commitee serait perdue.')
  process.exit(1)
}

// -z : noms separes par NUL, sans echappement des accents ni des espaces.
const tracked = execFileSync('git', ['ls-files', '-z'], { encoding: 'utf8' })
  .split('\0')
  .filter(Boolean)

const files = tracked.map((path) => {
  const data = readFileSync(path)
  return { file: path, sha: createHash('sha1').update(data).digest('hex'), size: data.length, data }
})

const megabytes = (files.reduce((n, f) => n + f.size, 0) / 1024 / 1024).toFixed(1)
console.log(`Branche ${branch} — ${files.length} fichiers, ${megabytes} Mo`)

/**
 * N'envoyer que ce qui manque.
 *
 * Vercel stocke les fichiers par empreinte : un fichier deja connu n'a pas a
 * repartir, meme sous un autre chemin. Le script les envoyait pourtant tous a
 * chaque fois — 506 envois par deploiement, et le quota du compte (5 000 par
 * 24 heures) epuise en une journee de travail, avec ce message :
 * « api-upload-free : try again in 24 hours ».
 *
 * La creation du deploiement accepte la liste complete des empreintes et
 * repond ce qui lui manque. On n'envoie que cela, puis on recommence.
 */
async function creer() {
  return fetch(
    `https://api.vercel.com/v13/deployments?teamId=${TEAM}&skipAutoDetectionConfirmation=1`,
    {
      method: 'POST',
      headers: { Authorization: `Bearer ${TOKEN}`, 'Content-Type': 'application/json' },
      body: JSON.stringify(body),
    },
  )
}

async function envoyer(manquants) {
  const aEnvoyer = files.filter((f) => manquants.includes(f.sha))
  console.log(`${aEnvoyer.length} fichier(s) a envoyer sur ${files.length}`)
  for (const f of aEnvoyer) {
    const res = await fetch(`https://api.vercel.com/v2/files?teamId=${TEAM}`, {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${TOKEN}`,
        'Content-Length': String(f.size),
        'x-vercel-digest': f.sha,
      },
      body: f.data,
    })
    if (!res.ok) {
      console.error(`Echec de l'envoi de ${f.file} : ${res.status} ${await res.text()}`)
      process.exit(1)
    }
  }
}

const body = {
  name: PROJECT,
  project: PROJECT,
  files: files.map(({ file, sha, size }) => ({ file, sha, size })),
  projectSettings: { framework: 'nextjs' },
  gitMetadata: {
    remoteUrl: 'https://github.com/RL-Conseil/aigms',
    commitSha: git('rev-parse', 'HEAD'),
    commitMessage: git('log', '-1', '--format=%s'),
    commitRef: branch,
  },
}
if (target) body.target = target

let res = await creer()

// 400 `missing_files` : Vercel enumere les empreintes qu'il n'a pas. On les
// envoie, et une seule fois — s'il en redemande, c'est autre chose.
if (res.status === 400) {
  const { error } = await res.clone().json()
  if (error?.code === 'missing_files' && Array.isArray(error.missing)) {
    await envoyer(error.missing)
    res = await creer()
  }
}

const deployment = await res.json()
if (!res.ok) {
  console.error('Echec du deploiement :', JSON.stringify(deployment).slice(0, 600))
  process.exit(1)
}

console.log(`Deploiement ${deployment.id} (${deployment.target ?? 'preview'})`)
console.log(`URL         https://${deployment.url}`)

// Attente de la fin du build : un lien annonce doit etre un lien qui repond,
// et Vercel refuse d'aliaser un deploiement qui n'est pas encore pret.
process.stdout.write('Build ')
let ready = false
for (let i = 0; i < 120; i += 1) {
  const status = await fetch(
    `https://api.vercel.com/v13/deployments/${deployment.id}?teamId=${TEAM}`,
    { headers: { Authorization: `Bearer ${TOKEN}` } },
  ).then((r) => r.json())

  if (status.readyState === 'READY') {
    ready = true
    break
  }
  if (status.readyState === 'ERROR' || status.readyState === 'CANCELED') {
    console.log(`\nEchec du build : ${status.readyState}`)
    console.log(`Journal : https://vercel.com/${TEAM}/${PROJECT}/${deployment.id}`)
    process.exit(1)
  }
  process.stdout.write('.')
  await new Promise((r) => setTimeout(r, 5000))
}

if (!ready) {
  console.log('\nBuild toujours en cours. Suivre son avancement sur le tableau de bord Vercel.')
  process.exit(1)
}

console.log('\nPret.')

// Alias lisible et stable par branche : l'URL ne change pas d'un deploiement a
// l'autre, ce qui evite d'avoir a se repasser un lien a chaque fois. Il se pose
// une fois le build termine, jamais avant.
if (target) {
  console.log(`https://${deployment.url}`)
} else {
  const slug = branch.replace(/[^a-z0-9]+/gi, '-').replace(/^-|-$/g, '').toLowerCase()
  const alias = `${PROJECT}-${slug}.vercel.app`
  const aliasRes = await fetch(
    `https://api.vercel.com/v2/deployments/${deployment.id}/aliases?teamId=${TEAM}`,
    {
      method: 'POST',
      headers: { Authorization: `Bearer ${TOKEN}`, 'Content-Type': 'application/json' },
      body: JSON.stringify({ alias }),
    },
  )
  if (aliasRes.ok) {
    console.log(`https://${alias}`)
  } else {
    console.log(`Alias non pose (${aliasRes.status}) : ${await aliasRes.text()}`)
    console.log(`https://${deployment.url}`)
  }

  // La demonstration suit toujours `dev` : une seule URL a transmettre, qui
  // ne change pas d'un deploiement a l'autre. Si le domaine n'est pas encore
  // ajoute au projet, on le dit sans faire echouer le deploiement.
  if (branch === DEMO_BRANCH && DEMO_DOMAIN) {
    const demoRes = await fetch(
      `https://api.vercel.com/v2/deployments/${deployment.id}/aliases?teamId=${TEAM}`,
      {
        method: 'POST',
        headers: { Authorization: `Bearer ${TOKEN}`, 'Content-Type': 'application/json' },
        body: JSON.stringify({ alias: DEMO_DOMAIN }),
      },
    )
    if (demoRes.ok) {
      console.log(`https://${DEMO_DOMAIN}`)
    } else {
      const detail = await demoRes.text()
      console.log(
        `Demonstration non alias\u00e9e (${demoRes.status}) : ajouter ${DEMO_DOMAIN} au projet dans Vercel > Settings > Domains, puis relancer.`,
      )
      if (process.env.VERCEL_VERBOSE) console.log(detail)
    }
  }
}

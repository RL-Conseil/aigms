import { Client } from 'pg'

/**
 * Utilitaires de test pour la base.
 *
 * Les tests d'isolation n'utilisent jamais le client Supabase applicatif : ils
 * ouvrent une connexion Postgres et endossent le role `authenticated` avec le
 * claim JWT `sub` de l'utilisateur simule. C'est exactement le contexte dans
 * lequel PostgREST evalue les politiques RLS, sans dependre de la couche HTTP.
 */

export const DEMO = {
  tenantA: 'aaaaaaaa-0000-4000-8000-000000000001',
  tenantB: 'bbbbbbbb-0000-4000-8000-000000000002',
  orgA: 'cccccccc-0000-4000-8000-000000000001',
  orgB: 'dddddddd-0000-4000-8000-000000000002',
  officerA: '11111111-1111-4111-8111-111111111111',
  systemOwnerA: '22222222-2222-4222-8222-222222222222',
  riskOwnerA: '33333333-3333-4333-8333-333333333333',
  auditorA: '44444444-4444-4444-8444-444444444444',
  officerB: '55555555-5555-4555-8555-555555555555',
  useCaseProduction: 'b1000000-0000-4000-8000-000000000001',
  useCasePilot: 'b1000000-0000-4000-8000-000000000002',
  useCaseTriage: 'b1000000-0000-4000-8000-000000000003',
  acceptedRisk: 'b3000000-0000-4000-8000-000000000003',
  untreatedRisk: 'b3000000-0000-4000-8000-000000000005',
  changeRequest: 'b8000000-0000-4000-8000-000000000001',
} as const

function connectionString(): string {
  const url = process.env.DATABASE_URL
  if (!url) {
    throw new Error('DATABASE_URL absente. Lancer `npx supabase start` puis renseigner .env.local.')
  }
  return url
}

export async function connect(): Promise<Client> {
  const client = new Client({ connectionString: connectionString() })
  await client.connect()
  return client
}

/**
 * Execute une requete dans le contexte d'un utilisateur authentifie.
 *
 * La transaction est systematiquement annulee : un test ne laisse jamais de
 * trace dans le jeu de donnees partage.
 */
export async function asUser<T>(
  client: Client,
  userId: string | null,
  run: (client: Client) => Promise<T>,
): Promise<T> {
  await client.query('begin')
  try {
    await client.query("select set_config('role', 'authenticated', true)")
    if (userId) {
      await client.query("select set_config('request.jwt.claims', $1, true)", [
        JSON.stringify({ sub: userId, role: 'authenticated' }),
      ])
    } else {
      await client.query("select set_config('request.jwt.claims', '', true)")
    }
    return await run(client)
  } finally {
    await client.query('rollback')
  }
}

/** Compte les lignes visibles pour l'utilisateur courant. */
export async function countVisible(client: Client, table: string): Promise<number> {
  const { rows } = await client.query<{ n: string }>(`select count(*)::text as n from public.${table}`)
  return Number(rows[0]?.n ?? '0')
}

/**
 * Capture l'erreur Postgres d'une requete attendue en echec.
 *
 * L'appel est encadre d'un point de reprise : une erreur Postgres avorte la
 * transaction courante, et sans cela un test ne pourrait plus rien faire apres
 * avoir verifie un refus. Le point de reprise rend la transaction de nouveau
 * utilisable.
 */
let savepointCounter = 0

export async function expectFailure(
  client: Client,
  sql: string,
  params: unknown[] = [],
): Promise<{ message: string; code?: string }> {
  const savepoint = `expect_failure_${(savepointCounter += 1)}`
  let inTransaction = true

  try {
    await client.query(`savepoint ${savepoint}`)
  } catch {
    // Hors transaction : l'appelant n'a pas ouvert de bloc, rien a proteger.
    inTransaction = false
  }

  try {
    await client.query(sql, params)
  } catch (error) {
    if (inTransaction) await client.query(`rollback to savepoint ${savepoint}`)
    const e = error as { message: string; code?: string }
    return { message: e.message, code: e.code }
  }

  if (inTransaction) await client.query(`release savepoint ${savepoint}`)
  throw new Error(`La requete aurait du echouer : ${sql}`)
}

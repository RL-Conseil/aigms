import { expect, test } from '@playwright/test'
import { readFileSync } from 'node:fs'

/**
 * Espace d'administration technique : connecteurs et referentiels de controles.
 */

const ADMIN = { email: 'admin@rl-conseil.demo', password: 'Demo!Passw0rd' }
const OFFICER = { email: 'officer@rl-conseil.demo', password: 'Demo!Passw0rd' }

async function signIn(page: import('@playwright/test').Page, who: typeof ADMIN) {
  await page.goto('/login')
  await page.getByLabel('Adresse électronique').fill(who.email)
  await page.getByLabel('Mot de passe').fill(who.password)
  await page.getByRole('button', { name: 'Se connecter' }).click()
  await expect(page.getByRole('heading', { name: 'Organisations' })).toBeVisible()
}

test('la mire de connexion renvoie vers l’administration, pas vers l’officer', async ({ page }) => {
  await page.goto('/login')

  await expect(
    page.getByRole('heading', { name: 'Accès à l’espace de gouvernance' }),
  ).toBeVisible()
  await expect(
    page.getByText('L’accès est réservé aux comptes ouverts par l’administration de la plateforme.'),
  ).toBeVisible()
  await expect(page.getByText(/adressez-vous à l’administration de la\s+plateforme/)).toBeVisible()
})

test('un connecteur se déclare sans jamais saisir de secret', async ({ page }) => {
  await signIn(page, ADMIN)
  await page.getByRole('link', { name: 'Connecteurs' }).click()

  await expect(page.getByText('Lecture seule et moindre privilège.')).toBeVisible()
  await expect(page.getByText('Ne collez jamais le secret ici.')).toBeVisible()

  const name = `Vanta E2E ${Date.now()}`
  await page.getByLabel('Plateforme').selectOption('vanta')
  await page.getByLabel('Nom du connecteur').fill(name)
  await page.getByLabel('URL de base').fill('https://api.vanta.com')
  await page.getByRole('button', { name: 'Déclarer le connecteur' }).click()

  await expect(page.getByRole('status')).toContainText(name)
  // Le nom figure aussi dans le message de confirmation : on cible la liste.
  await expect(page.getByRole('listitem').filter({ hasText: name })).toBeVisible({
    timeout: 10_000,
  })
  await expect(page.getByText('CONNECTOR_VANTA_TOKEN').first()).toBeVisible()
})

test('la base refuse une valeur ressemblant à un secret', async ({ page }) => {
  await signIn(page, ADMIN)
  await page.goto('/admin/connecteurs')

  await page.getByLabel('Nom du connecteur').fill(`Rejet ${Date.now()}`)
  const envField = page.getByLabel('Variable d’environnement du secret')
  await envField.fill('sk_live_secret_value')
  // Le champ porte un motif : on contourne la validation du navigateur pour
  // verifier que le serveur refuse aussi.
  await envField.evaluate((el: HTMLInputElement) => el.removeAttribute('pattern'))
  await page.getByRole('button', { name: 'Déclarer le connecteur' }).click()

  await expect(page.getByRole('status')).toContainText(/NOM de variable/)
})

test('un référentiel de 120 contrôles s’importe et se publie', async ({ page }) => {
  await signIn(page, ADMIN)
  await page.getByRole('link', { name: 'Référentiels' }).click()

  await expect(page.getByRole('heading', { name: 'Importer un référentiel' })).toBeVisible()

  await page.getByLabel('Fichier du référentiel').setInputFiles(
    'knowledge/frameworks/aigms/v0.1/aigms_control_framework_v0.1.json',
  )
  await page.getByRole('button', { name: 'Déposer et valider' }).click()

  await expect(page.getByText(/12 domaine\(s\), 120 contrôle\(s\)/)).toBeVisible({ timeout: 15_000 })

  await page.getByRole('button', { name: 'Importer le référentiel' }).click()
  await expect(page.getByText(/120 contrôle\(s\) répartis en 12 domaine\(s\)/)).toBeVisible({
    timeout: 20_000,
  })
})

test('un document dont le compte est faux est refusé et expliqué', async ({ page }) => {
  await signIn(page, ADMIN)
  await page.goto('/admin/referentiels')

  const source = JSON.parse(
    readFileSync('knowledge/frameworks/aigms/v0.1/aigms_control_framework_v0.1.json', 'utf8'),
  ) as { controls: unknown[] }
  source.controls = source.controls.slice(0, 5)

  await page.getByLabel('Fichier du référentiel').setInputFiles({
    name: 'tronque.json',
    mimeType: 'application/json',
    buffer: Buffer.from(JSON.stringify(source)),
  })
  await page.getByRole('button', { name: 'Déposer et valider' }).click()

  await expect(page.getByText(/Document refusé/)).toBeVisible({ timeout: 15_000 })
  await expect(page.getByText(/120 contrôles et en porte 5/)).toBeVisible()
})

test("un rôle de gouvernance n'accède ni aux connecteurs ni aux référentiels", async ({ page }) => {
  await signIn(page, OFFICER)

  await page.goto('/admin/connecteurs')
  await expect(page.getByRole('heading', { name: 'Accès réservé' })).toBeVisible()

  await page.goto('/admin/referentiels')
  await expect(page.getByRole('heading', { name: 'Accès réservé' })).toBeVisible()
})

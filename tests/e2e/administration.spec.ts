import { expect, test } from '@playwright/test'

/**
 * Espace d'administration : ce qu'il montre, et ce qu'il refuse.
 */

const ADMIN = { email: 'admin@rl-conseil.demo', password: 'Demo!Passw0rd' }
const OFFICER = { email: 'officer@rl-conseil.demo', password: 'Demo!Passw0rd' }

async function signIn(page: import('@playwright/test').Page, who: typeof ADMIN) {
  await page.goto('/login')
  await page.getByLabel('Adresse électronique').fill(who.email)
  await page.getByLabel('Mot de passe').fill(who.password)
  await page.getByRole('button', { name: 'Se connecter' }).click()
  await expect(page.getByRole('heading', { name: 'Portefeuille' })).toBeVisible()
}

test("le bandeau annonce le mode administration des la connexion", async ({ page }) => {
  await signIn(page, ADMIN)

  await expect(page.getByText('Administration de la plateforme.')).toBeVisible()
  await expect(
    page.getByText('Vous ouvrez les accès : organisations, comptes et rôles.'),
  ).toBeVisible()
})

test("le menu de l'administration ne propose pas le pilotage", async ({ page }) => {
  await signIn(page, ADMIN)

  await expect(page.getByRole('link', { name: 'Comptes et rôles' })).toBeVisible()
  await expect(page.getByRole('link', { name: 'Demandes' })).toBeVisible()
  await expect(page.getByRole('link', { name: 'Pilotage' })).toHaveCount(0)
})

test("le pilotage refuse explicitement l'administration", async ({ page }) => {
  await signIn(page, ADMIN)
  await page.goto('/admin/pilotage')

  await expect(page.getByRole('heading', { name: 'Hors de votre périmètre' })).toBeVisible()
  await expect(page.getByText(/ouvre les accès et n’instruit aucun dossier/)).toBeVisible()
})

test("l'administration crée une organisation", async ({ page }) => {
  await signIn(page, ADMIN)
  await page.getByRole('link', { name: 'Nouvelle organisation' }).click()

  const name = `Cliente E2E ${Date.now()}`
  await page.getByLabel('Nom d’usage').fill(name)
  await page.getByLabel('Secteur').fill('Services')
  await page.getByRole('button', { name: 'Créer l’organisation' }).click()

  await expect(page.getByRole('status')).toContainText(name)
  await expect(page.getByRole('link', { name })).toBeVisible({ timeout: 10_000 })
})

test('la page des comptes liste les rôles attribués', async ({ page }) => {
  await signIn(page, ADMIN)
  await page.getByRole('link', { name: 'Comptes et rôles' }).click()

  await expect(page.getByRole('heading', { name: 'Comptes déclarés' })).toBeVisible()
  await expect(page.getByText('officer@rl-conseil.demo')).toBeVisible()
  await expect(page.getByText('Non modifiable depuis l’application')).toBeVisible()
})

test("le menu donne accès aux paramètres et à la déconnexion", async ({ page }) => {
  await signIn(page, OFFICER)

  await page.getByRole('button', { name: /Camille Rousset/ }).click()
  await expect(page.getByRole('menuitem', { name: 'Paramètres du compte' })).toBeVisible()
  await expect(page.getByRole('menuitem', { name: 'Mon organisation' })).toBeVisible()

  await page.getByRole('menuitem', { name: 'Paramètres du compte' }).click()
  await expect(page.getByRole('heading', { name: 'Paramètres' })).toBeVisible()
  await expect(page.getByRole('heading', { name: 'Votre rôle' })).toBeVisible()
  await expect(page.getByText('AI Governance Officer').first()).toBeVisible()
})

test("un rôle de gouvernance n'accède pas à la gestion des comptes", async ({ page }) => {
  await signIn(page, OFFICER)
  await page.goto('/admin/comptes')

  await expect(page.getByRole('heading', { name: 'Accès réservé' })).toBeVisible()
})

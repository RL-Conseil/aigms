import { expect, test } from '@playwright/test'

/**
 * Espace d'administration : ce qu'il montre, et ce qu'il refuse.
 */

const ADMIN = { email: 'admin@rl-conseil.demo', password: 'Demo!Passw0rd' }
const OFFICER = { email: 'officer@rl-conseil.demo', password: 'Demo!Passw0rd' }

async function signIn(page: import('@playwright/test').Page, who: typeof ADMIN) {
  await page.goto('/')
  await page.getByLabel('Adresse électronique').fill(who.email)
  await page.getByLabel('Mot de passe').fill(who.password)
  await page.getByRole('button', { name: 'Se connecter' }).click()
  await expect(page.getByRole('heading', { name: 'Organisations' })).toBeVisible()
}

test("le bandeau annonce le mode administration des la connexion", async ({ page }) => {
  await signIn(page, ADMIN)

  await expect(page.getByText('Administration de la plateforme.')).toBeVisible()
  await expect(
    page.getByText('Vous ouvrez les accès : organisations, comptes et rôles.'),
  ).toBeVisible()
})

test("le sous-titre distingue administrer et gouverner", async ({ page }) => {
  await signIn(page, ADMIN)
  await expect(page.getByText('Les organisations déclarées sur la plateforme.')).toBeVisible()

  await page.getByRole('button', { name: /Inès Duhamel/ }).click()
  await page.getByRole('menuitem', { name: 'Se déconnecter' }).click()
  // `/login` redirige vers l'accueil : viser l'URL de passage rend le parcours
  // dependant du moment ou on l'observe. On vise l'etat atteint.
  await expect(page.getByRole('heading', { name: 'Accès à l’espace de gouvernance' })).toBeVisible()

  await signIn(page, OFFICER)
  await expect(
    page.getByText('Les organisations dont vous pilotez la gouvernance de l’IA.'),
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

  // Le role vis-a-vis de l'IA commande les typologies de preuves attendues :
  // il se renseigne a la creation, et le formulaire l'exige.
  await page.getByLabel(/Rôle vis-à-vis de l’IA/).selectOption('integrator_consultant')

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

test('le rôle vis-à-vis de l’IA se change depuis la fiche de l’organisation', async ({ page }) => {
  await signIn(page, OFFICER)
  await page.goto('/admin/organizations/cccccccc-0000-4000-8000-000000000001')

  const carte = page.locator('section').filter({ hasText: 'Rôle vis-à-vis de l’IA' })
  await expect(carte.getByText('Hébergeur / Infrastructure').first()).toBeVisible()

  // Le role commande la criticite : ce qu'il rend exigeant s'affiche a cote.
  await expect(carte.getByText('Ce que ce rôle rend exigeant')).toBeVisible()
  await expect(carte.getByText(/Isolation et souveraineté physique/)).toBeVisible()
  await expect(carte.getByText(/Empreinte environnementale/)).toBeVisible()

  // Le changer recalcule ce qui est attendu. On attend l'etat, non le message :
  // celui du precedent enregistrement est encore a l'ecran, et l'attendre
  // laisserait le parcours s'achever avant que la seconde ecriture aboutisse.
  await carte.getByLabel(/Rôle vis-à-vis de l’IA/).selectOption('model_developer')
  await carte.getByRole('button', { name: 'Enregistrer le rôle' }).click()
  await expect(carte.getByText(/Éthique, biais et équité/)).toBeVisible()

  // Remis dans l'etat du jeu de demonstration.
  await carte.getByLabel(/Rôle vis-à-vis de l’IA/).selectOption('infrastructure_host')
  await carte.getByRole('button', { name: 'Enregistrer le rôle' }).click()
  await expect(carte.getByText(/Isolation et souveraineté physique/)).toBeVisible()
  await expect(carte.getByText(/Éthique, biais et équité/)).toHaveCount(0)
})

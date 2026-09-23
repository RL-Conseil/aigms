import { expect, test } from '@playwright/test'

/**
 * Surface ouverte de l'application.
 *
 * AIGMS est une application : la vitrine vit sur le site commercial. La seule
 * page accessible sans session est la mire de connexion, qui est aussi
 * l'accueil. Ces tests verrouillent cette frontiere — c'est une propriete de
 * securite autant qu'un choix de produit.
 */

test('l’accueil est la mire de connexion', async ({ page, context }) => {
  await context.clearCookies()
  await page.goto('/')

  await expect(page.getByRole('heading', { name: 'Accès à votre espace de gouvernance' })).toBeVisible()
  await expect(page.getByLabel('Adresse électronique')).toBeVisible()
  await expect(page.getByRole('button', { name: 'Se connecter', exact: true })).toBeVisible()

  // Une accroche, pas une page de vente : le discours commercial vit ailleurs.
  await expect(page.getByText(/ce que vous pouvez montrer/)).toBeVisible()

  // Le seul appel commercial, et il pointe hors de l'application.
  await expect(
    page.getByRole('link', { name: /Demandez votre atelier de qualification/ }),
  ).toHaveAttribute('href', 'https://www.caritis.fr/realisations/aigms')
})

test('la connexion par l’annuaire de l’organisation est offerte', async ({ page, context }) => {
  await context.clearCookies()
  await page.goto('/')

  const annuaire = page.getByRole('button', { name: 'Se connecter avec l’annuaire de mon organisation' })
  await expect(annuaire).toBeVisible()

  // Sans adresse, rien ne part : le domaine designe le fournisseur d'identite.
  await annuaire.click()
  await expect(page.getByRole('alert')).toHaveText(/Indiquez d’abord votre adresse professionnelle/)

  // Un domaine sans annuaire declare le dit, et renvoie au mot de passe.
  await page.getByLabel('Adresse électronique').fill('personne@domaine-sans-annuaire.test')
  await annuaire.click()
  await expect(page.getByRole('alert')).toHaveText(/Aucun annuaire n’est déclaré pour domaine-sans-annuaire\.test/)
})

test('les comptes ne s’ouvrent pas librement', async ({ page, context }) => {
  await context.clearCookies()
  await page.goto('/')

  // Pas d'inscription : les comptes sont declares par l'administration, qui
  // attribue les roles. Un formulaire d'inscription contredirait le modele.
  await expect(page.getByText(/Les\s+comptes ne s’ouvrent pas librement/)).toBeVisible()
  await expect(page.getByRole('link', { name: /inscription|créer un compte/i })).toHaveCount(0)
})

test('/login redirige vers l’accueil en conservant la destination', async ({ page, context }) => {
  await context.clearCookies()
  await page.goto('/login?next=%2Fadmin%2Fpilotage')

  await expect(page).toHaveURL(/\/\?next=%2Fadmin%2Fpilotage/)
  await expect(page.getByRole('heading', { name: 'Accès à votre espace de gouvernance' })).toBeVisible()
})

test('l’espace de gouvernance est fermé sans session', async ({ page, context }) => {
  await context.clearCookies()
  await page.goto('/admin/pilotage')

  await expect(page).toHaveURL(/\/\?next=/)
  await expect(page.getByRole('heading', { name: 'Accès à votre espace de gouvernance' })).toBeVisible()
})

test('la vitrine et le formulaire de contact ne sont plus servis', async ({ page, context }) => {
  await context.clearCookies()
  const response = await page.goto('/contact')
  expect(response?.status()).toBe(404)
})

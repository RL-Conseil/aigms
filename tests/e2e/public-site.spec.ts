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

  await expect(page.getByRole('heading', { name: 'Accès à l’espace de gouvernance' })).toBeVisible()
  await expect(page.getByLabel('Adresse électronique')).toBeVisible()
  await expect(page.getByRole('button', { name: 'Se connecter' })).toBeVisible()

  // Un abstract, pas une page de vente : le discours commercial vit ailleurs.
  await expect(page.getByText('Gouverner l’IA. Décider. Prouver. Améliorer.')).toBeVisible()
  await expect(page.getByRole('link', { name: 'caritis.fr' })).toBeVisible()

  // Precaution produit : aucune promesse de certification.
  await expect(page.getByText(/ne remplace ni un avis juridique/)).toBeVisible()
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
  await expect(page.getByRole('heading', { name: 'Accès à l’espace de gouvernance' })).toBeVisible()
})

test('l’espace de gouvernance est fermé sans session', async ({ page, context }) => {
  await context.clearCookies()
  await page.goto('/admin/pilotage')

  await expect(page).toHaveURL(/\/\?next=/)
  await expect(page.getByRole('heading', { name: 'Accès à l’espace de gouvernance' })).toBeVisible()
})

test('la vitrine et le formulaire de contact ne sont plus servis', async ({ page, context }) => {
  await context.clearCookies()
  const response = await page.goto('/contact')
  expect(response?.status()).toBe(404)
})

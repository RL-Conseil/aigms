import { expect, test } from '@playwright/test'

/**
 * Site public : la page principale, le parcours vers le formulaire de contact
 * et le depot d'une demande.
 */

test('la page principale presente AIGMS et son appel a l action', async ({ page }) => {
  await page.goto('/')

  await expect(
    page.getByRole('heading', { name: /Gouverner l’IA/ }),
  ).toBeVisible()
  await expect(page.getByText('Part des salariés utilisant des outils d’IA non approuvés')).toBeVisible()
  await expect(page.getByRole('heading', { name: 'Le registre de décisions' })).toBeVisible()
  await expect(
    page.getByRole('heading', { name: 'AIGMS ne remplace pas vos outils. Il les fait converger.' }),
  ).toBeVisible()

  // Precaution produit : aucune promesse de certification ou de conformite garantie.
  await expect(page.getByText(/ne délivre aucune\s+certification/)).toBeVisible()
})

test('la page principale est consultable sans session', async ({ page, context }) => {
  await context.clearCookies()
  await page.goto('/')
  await expect(page).toHaveURL(/\/$/)
  await expect(page.getByRole('link', { name: 'Se connecter' })).toBeVisible()
})

test('le formulaire de contact enregistre une demande', async ({ page }) => {
  await page.goto('/')
  await page.getByRole('link', { name: 'Commençons par 2 cas d’usage réels' }).click()

  await expect(
    page.getByRole('heading', { name: 'Commençons par deux cas d’usage réels.' }),
  ).toBeVisible()

  // Adresse unique : l'index quotidien refuse un second depot le meme jour.
  const email = `visiteur-${Date.now()}@exemple-test.fr`

  await page.getByLabel('Nom et prénom').fill('Claire Dubourg')
  await page.getByLabel('Organisation').fill('Manufacture Dubourg')
  await page.getByLabel('Adresse électronique professionnelle').fill(email)
  await page.getByLabel('Vous êtes').selectOption('dsi_rssi_dpo')
  await page.getByLabel(/Vos usages d’IA/).fill('Assistant de rédaction sur 40 postes.')
  await page.getByRole('button', { name: 'Demander à être rappelé' }).click()

  await expect(page.getByRole('heading', { name: 'Votre demande est enregistrée.' })).toBeVisible()
})

test('un champ manquant est signale sans perdre la saisie', async ({ page }) => {
  await page.goto('/contact')
  await page.getByLabel('Nom et prénom').fill('A')
  await page.getByLabel('Organisation').fill('Exemple')
  await page.getByLabel('Adresse électronique professionnelle').fill('test@exemple-test.fr')
  await page.getByRole('button', { name: 'Demander à être rappelé' }).click()

  await expect(page.getByText('Merci d’indiquer votre nom.')).toBeVisible()
})

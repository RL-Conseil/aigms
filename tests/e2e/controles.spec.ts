import { expect, test } from '@playwright/test'

/**
 * Dispositif de maitrise.
 *
 * Tout ce que la plateforme sait lire — couverture, graphe, chemin du risque,
 * Declaration d'Applicabilite — repose sur des controles qu'on ne pouvait pas
 * creer. Ce parcours verifie la chaine complete : creer, statuer, rattacher,
 * traiter.
 */

const OFFICER = { email: 'officer@rl-conseil.demo', password: 'Demo!Passw0rd' }
const ORG = 'cccccccc-0000-4000-8000-000000000001'

test.beforeEach(async ({ page }) => {
  await page.goto('/')
  await page.getByLabel('Adresse électronique').fill(OFFICER.email)
  await page.getByLabel('Mot de passe').fill(OFFICER.password)
  await page.getByRole('button', { name: 'Se connecter' }).click()
  await expect(page.getByRole('heading', { name: /IzarLink Demo/ })).toBeVisible()
})

test('un contrôle se crée, change d’état et se rattache à une exigence', async ({ page }) => {
  await page.goto(`/admin/organizations/${ORG}/controles`)
  await expect(page.getByRole('heading', { name: 'Référentiel' })).toBeVisible()

  const code = `CTL-E${Date.now().toString().slice(-5)}`
  await page.getByRole('link', { name: 'Créer un contrôle' }).click()

  await page.getByLabel('Code').fill(code)
  await page.getByLabel('Intitulé').fill('Relecture humaine avant envoi')
  await page
    .getByLabel('Objectif')
    .fill('Garantir qu’aucune réponse générée n’atteint un client sans relecture humaine.')
  await page.getByLabel('État').selectOption('implemented')
  await page.getByRole('button', { name: 'Créer le contrôle' }).click()
  await expect(page.getByRole('status')).toContainText(code)

  // Le contrôle apparaît, et signale qu'aucune exigence ne le rattache encore.
  await page.goto(`/admin/organizations/${ORG}/controles`)
  const ligne = page.locator('li').filter({ hasText: code }).first()
  await expect(ligne.getByText(/Aucune exigence rattachée/)).toBeVisible()

  // Son état se change depuis sa ligne.
  await ligne.getByRole('button', { name: 'Changer l’état' }).click()
  const etat = page.getByRole('dialog', { name: new RegExp(`${code} — état du contrôle`) })
  await etat.getByLabel('État').selectOption('operating')
  await etat.getByRole('button', { name: 'Enregistrer l’état' }).click()
  await expect(page.getByRole('status')).toContainText('État du contrôle enregistré')

  // Et il se rattache à une exigence de l'Annexe A.
  await page.goto(`/admin/organizations/${ORG}/controles`)
  const ligne2 = page.locator('li').filter({ hasText: code }).first()
  await ligne2.getByRole('button', { name: 'Rattacher une exigence' }).click()
  const mapping = page.getByRole('dialog', { name: new RegExp(`${code} — exigence satisfaite`) })
  await mapping.getByLabel('Exigence').selectOption({ index: 1 })
  await mapping.getByRole('button', { name: 'Rattacher' }).click()
  await expect(page.getByRole('status')).toContainText('Correspondance enregistrée')
})

test('une exclusion d’applicabilité ne passe pas sans justification', async ({ page }) => {
  await page.goto('/admin/use-cases/b1000000-0000-4000-8000-000000000001')

  const controles = page.locator('section').filter({ hasText: 'Contrôles affectés' }).first()
  await controles.getByRole('button', { name: /Contrôles affectés/ }).click()
  await controles.getByRole('button', { name: 'Statuer un contrôle' }).click()

  const fenetre = page.getByRole('dialog', { name: 'Applicabilité d’un contrôle' })
  await fenetre.getByLabel('Contrôle').selectOption({ index: 1 })
  await fenetre.getByLabel('Applicabilité').selectOption('not_applicable')
  await fenetre.getByLabel('Justification').fill('Non.')
  await fenetre.getByRole('button', { name: 'Statuer' }).click()

  await expect(fenetre.getByText(/Une exclusion se motive/)).toBeVisible()
})

test('un traitement de risque désigne le contrôle qui l’exécute', async ({ page }) => {
  await page.goto('/admin/use-cases/b1000000-0000-4000-8000-000000000002')

  // `hasText` compare sans tenir compte de la casse : « 2 risques ni traites »
  // dans l'avertissement de transition ferait mouche avant la carte cherchee.
  // On vise donc le titre.
  const risques = page
    .locator('section')
    .filter({ has: page.getByRole('heading', { name: 'Risques', exact: true }) })
  await risques.getByRole('button', { name: 'Traiter' }).first().click()

  const fenetre = page.getByRole('dialog', { name: 'Traitement du risque' })
  await expect(fenetre.getByText(/le chemin du risque s’arrête à l’intention/)).toBeVisible()

  await fenetre
    .getByLabel('Ce qui sera fait')
    .fill('Revue humaine systématique des candidatures écartées, avec journal des arbitrages.')
  await fenetre.getByLabel('Contrôle qui le met en œuvre').selectOption({ index: 1 })
  await fenetre.getByRole('button', { name: 'Enregistrer le traitement' }).click()

  await expect(page.getByRole('status')).toContainText(/avec le contrôle qui le met en œuvre/)
})

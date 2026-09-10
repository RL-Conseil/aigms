import { expect, test } from '@playwright/test'

/**
 * Declaration d'Applicabilite ajustee a la criticite.
 *
 * Deux choses se verifient : que la regle d'or est visible — aucune exigence
 * sans decision — et que le regime de preuve exige decoule du profil
 * d'activite, non d'un choix d'ecran.
 */

const OFFICER = { email: 'officer@rl-conseil.demo', password: 'Demo!Passw0rd' }
const ORG = 'cccccccc-0000-4000-8000-000000000001'

test.beforeEach(async ({ page }) => {
  await page.goto('/')
  await page.getByLabel('Adresse électronique').fill(OFFICER.email)
  await page.getByLabel('Mot de passe').fill(OFFICER.password)
  await page.getByRole('button', { name: 'Se connecter' }).click()
  await expect(page.getByRole('heading', { name: 'Organisations' })).toBeVisible()
})

test('la Déclaration exige une décision par exigence et nomme le régime de preuve', async ({
  page,
}) => {
  await page.goto(`/admin/organizations/${ORG}/declaration-applicabilite`)

  await expect(
    page.getByText('Aucune case vide : chaque exigence est sélectionnée ou exclue, et justifiée'),
  ).toBeVisible()
  await expect(page.getByText(/profil.*Hébergeur \/ Infrastructure/)).toBeVisible()
  await expect(page.getByText('Sans décision portée')).toBeVisible()

  // Le regime attendu figure sur chaque exigence.
  await expect(page.getByText('Preuve technique').first()).toBeVisible()
  await expect(page.getByText('Exclusion à réexaminer').first()).toBeVisible()
})

test('une décision se porte, justifiée et nominative', async ({ page }) => {
  await page.goto(`/admin/organizations/${ORG}/declaration-applicabilite`)

  // Le volet s'ouvre de lui-meme sur une exigence sans decision. Le parcours
  // ecrit de vraies donnees : au second passage, la decision existe deja et le
  // volet est replie — les deux etats sont donc admis.
  const exigence = page.locator('li').filter({ hasText: 'A.3.2' }).first()
  const volet = exigence.getByText(/Décider — sélectionner ou exclure|Modifier la décision/)
  await expect(volet).toBeVisible()

  const justification = exigence.getByRole('textbox')
  if (!(await justification.isVisible())) await volet.click()

  // Une justification qui tient en trois mots est refusee.
  await justification.fill('Trop court.')
  await exigence.getByRole('button', { name: 'Porter la décision' }).click()
  await expect(page.getByText(/ne se défend pas devant un auditeur/)).toBeVisible()

  await justification
    .fill(
      'Les rôles en matière d’IA sont attribués par note de service et revus annuellement en comité de direction.',
    )
  await exigence.getByRole('button', { name: 'Porter la décision' }).click()
  await expect(page.getByText(/justification enregistrée en votre nom/)).toBeVisible()

  const portee = page.locator('li').filter({ hasText: 'A.3.2' }).first()
  await expect(portee.getByText(/Sélectionnée par/)).toBeVisible()
})

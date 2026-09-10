import { expect, test } from '@playwright/test'

/**
 * Depot de preuves.
 *
 * Le parcours suit ce qu'un porteur de systeme fait reellement : il depose la
 * piece, elle arrive « a valider », quelqu'un la valide en son nom, et le
 * controle cesse d'etre demuni.
 */

const OFFICER = { email: 'officer@rl-conseil.demo', password: 'Demo!Passw0rd' }
const ORG = 'cccccccc-0000-4000-8000-000000000001'

test.beforeEach(async ({ page }) => {
  await page.goto('/login')
  await page.getByLabel('Adresse électronique').fill(OFFICER.email)
  await page.getByLabel('Mot de passe').fill(OFFICER.password)
  await page.getByRole('button', { name: 'Se connecter' }).click()
  await expect(page.getByRole('heading', { name: 'Organisations' })).toBeVisible()
})

test('une preuve se dépose, reste à valider, puis se valide nominativement', async ({ page }) => {
  await page.goto(`/admin/organizations/${ORG}/preuves`)
  await expect(page.getByRole('heading', { name: 'Registre des preuves' })).toBeVisible()

  const titre = `Rapport de test de biais ${Date.now()}`
  const depot = page.locator('section').filter({ hasText: 'Déposer une preuve' })

  await depot.getByLabel('Ce que la preuve démontre').fill(titre)
  await depot.getByLabel('Origine').fill('Recette applicative')
  await depot.getByLabel('Fichier').setInputFiles({
    name: 'rapport-biais.txt',
    mimeType: 'text/plain',
    buffer: Buffer.from('Taux de sélection par groupe — écart mesuré 2,1 %.'),
  })

  // Le contrôle choisi au dépôt est rattaché du même geste.
  const choix = depot.getByLabel('Contrôle démontré')
  await choix.selectOption({ index: 1 })
  const rattache = ((await choix.inputValue()) && (await choix.locator('option:checked').textContent()))!
  const codeRattache = rattache.trim().split(' — ')[0]!

  await depot.getByRole('button', { name: 'Déposer la preuve' }).click()

  await expect(page.getByText(/un dépôt n’est pas une validation/i)).toBeVisible()

  const ligne = page.locator('li').filter({ hasText: titre }).first()
  await expect(ligne.getByText('À valider', { exact: true })).toBeVisible()
  await expect(ligne.getByText(/^sha256:/)).toBeVisible()
  await expect(ligne.getByRole('link', { name: 'Télécharger' })).toBeVisible()

  await ligne.getByRole('button', { name: 'Valider en mon nom' }).click()
  await expect(page.getByText(/Preuve validée en votre nom/)).toBeVisible()

  const validee = page.locator('li').filter({ hasText: titre }).first()
  await expect(validee.getByText('Validée', { exact: true })).toBeVisible()
  await expect(validee.getByText(/Validée par/)).toBeVisible()
  await expect(validee.getByText(codeRattache)).toBeVisible()

  // Une preuve sert plusieurs contrôles, jamais deux fois le meme : celui qui
  // est deja rattache ne se represente pas dans la liste.
  await validee.getByText('Rattacher à un autre contrôle').click()
  const restants = validee.getByLabel('Contrôle à rattacher')
  await expect(restants).toBeVisible()
  await expect(restants.locator('option', { hasText: codeRattache })).toHaveCount(0)
})

test('une preuve sans pièce ni lien est refusée', async ({ page }) => {
  await page.goto(`/admin/organizations/${ORG}/preuves`)

  const depot = page.locator('section').filter({ hasText: 'Déposer une preuve' })
  await depot.getByLabel('Ce que la preuve démontre').fill('Preuve sans rien derrière')
  await depot.getByLabel('Origine').fill('Néant')
  await depot.getByRole('button', { name: 'Déposer la preuve' }).click()

  await expect(page.getByText(/Une preuve doit être atteignable/)).toBeVisible()
})

test('le registre pointe les contrôles qu’aucune preuve ne démontre', async ({ page }) => {
  await page.goto(`/admin/organizations/${ORG}/preuves`)

  const manques = page.locator('section').filter({ hasText: 'Contrôles sans preuve valide' })
  await expect(manques.getByText('Opérants, mais rien ne le démontre.')).toBeVisible()

  // Le parcours ecrit de vraies donnees : selon l'ordre d'execution, la liste
  // peut etre vide. Les deux etats sont legitimes, et tous deux se disent.
  const demunis = await manques.getByRole('link').count()
  if (demunis === 0) {
    await expect(
      manques.getByText('Tous les contrôles opérants sont adossés à une preuve valide.'),
    ).toBeVisible()
  }

  // Le prechargement du controle, lui, se verifie sans dependre de cet etat.
  const selection = page.getByLabel('Contrôle démontré')
  const cible = await selection.locator('option').nth(1).getAttribute('value')
  expect(cible).toBeTruthy()

  await page.goto(`/admin/organizations/${ORG}/preuves?controle=${cible}`)
  await expect(page.getByLabel('Contrôle démontré')).toHaveValue(cible!)
})

test('la matrice des preuves oriente le dépôt selon le profil d’activité', async ({ page }) => {
  await page.goto(`/admin/organizations/${ORG}/preuves`)

  // La matrice, classee par criticite pour le profil de l'organisation.
  const matrice = page.locator('section').filter({ hasText: 'Preuves attendues' })
  await expect(matrice.getByText(/Profil « Hébergeur \/ Infrastructure »/)).toBeVisible()

  // Choisir une typologie affiche ce qu'il faut consigner et le livrable attendu.
  const depot = page.locator('section').filter({ hasText: 'Déposer une preuve' })
  await depot.getByLabel('Typologie de preuve').selectOption({ index: 1 })

  await expect(depot.getByText('À consigner')).toBeVisible()
  await expect(depot.getByText('Livrables qui font preuve')).toBeVisible()

  // Les references que le referentiel charge ne porte pas sont nommees.
  await matrice.getByText(/Références que le référentiel chargé ne porte pas/).click()
  await expect(matrice.getByText(/A\.10\.5/)).toBeVisible()
})

import { expect, test } from '@playwright/test'

/**
 * Depot de preuves.
 *
 * Le parcours suit ce qu'un porteur de systeme fait reellement : il depose la
 * piece, elle arrive « a valider », quelqu'un la valide en son nom, et le
 * controle cesse d'etre demuni.
 */

const OFFICER = { email: 'officer@aigms.eu', password: 'Demo!Passw0rd' }
const ORG = 'cccccccc-0000-4000-8000-000000000001'

test.beforeEach(async ({ page }) => {
  await page.goto('/')
  await page.getByLabel('Adresse électronique').fill(OFFICER.email)
  await page.getByLabel('Mot de passe').fill(OFFICER.password)
  await page.getByRole('button', { name: 'Se connecter' }).click()
  await expect(page.getByRole('heading', { name: /Pilotage|Organisations gérées/ })).toBeVisible()
})

test('une preuve se dépose, reste à valider, puis se valide nominativement', async ({ page }) => {
  await page.goto(`/admin/organizations/${ORG}/preuves`)
  await expect(page.getByRole('heading', { name: 'Registre des preuves', level: 1 })).toBeVisible()

  // Le registre s'imprime, en entier ou par typologie, avec l'en-tete de l'organisation.
  const menu = page.locator('details').filter({ hasText: 'Imprimer le registre' })
  await menu.locator('summary').click()
  await menu.getByRole('link', { name: /Isolation et souveraineté physique/ }).click()
  await expect(page).toHaveURL(/impression\/preuves\?typologie=/)
  await expect(page.getByRole('heading', { name: 'Registre des preuves', level: 1 })).toBeVisible()
  await expect(page.getByText(/Typologie « Isolation et souveraineté physique/)).toBeVisible()
  await expect(page.getByText('IzarLink SAS').first()).toBeVisible()
  await page.getByRole('link', { name: /Retour au registre/ }).click()
  await expect(page).toHaveURL(/preuves\?typologie=/)

  // Le depot a sa propre page : on consulte un registre cent fois pour y
  // deposer une fois.
  await page.getByRole('link', { name: 'Déposer une preuve' }).click()
  await expect(page).toHaveURL(/preuves\/deposer/)

  const titre = `Rapport de test de biais ${Date.now()}`
  const depot = page.locator('section').filter({ hasText: 'La pièce et ce qu’elle démontre' })

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

  await expect(page.getByRole('status')).toContainText('déposée', { timeout: 10_000 })

  await page.goto(`/admin/organizations/${ORG}/preuves`)
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
  await page.goto(`/admin/organizations/${ORG}/preuves/deposer`)

  const depot = page.locator('section').filter({ hasText: 'La pièce et ce qu’elle démontre' })
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
  await page.goto(`/admin/organizations/${ORG}/preuves/deposer`)
  const selection = page.getByLabel('Contrôle démontré')
  const cible = await selection.locator('option').nth(1).getAttribute('value')
  expect(cible).toBeTruthy()

  await page.goto(`/admin/organizations/${ORG}/preuves/deposer?controle=${cible}`)
  await expect(page.getByLabel('Contrôle démontré')).toHaveValue(cible!)
})

test('la matrice des preuves oriente le dépôt selon le rôle vis-à-vis de l’IA', async ({ page }) => {
  await page.goto(`/admin/organizations/${ORG}/preuves`)

  // La matrice, classee par criticite pour le profil de l'organisation.
  const matrice = page.locator('section').filter({ hasText: 'Preuves attendues' })
  await expect(matrice.getByText(/Rôle « Hébergeur \/ Infrastructure »/)).toBeVisible()

  // Les references que le referentiel charge ne porte pas sont nommees.
  await matrice.getByText(/Références que le référentiel chargé ne porte pas/).click()
  await expect(matrice.getByText(/A\.10\.5/)).toBeVisible()

  // Choisir une typologie affiche ce qu'il faut consigner et le livrable attendu.
  await page.goto(`/admin/organizations/${ORG}/preuves/deposer`)
  const depot = page.locator('section').filter({ hasText: 'La pièce et ce qu’elle démontre' })
  await depot.getByLabel('Typologie de preuve').selectOption({ index: 1 })

  await expect(depot.getByText('À consigner')).toBeVisible()
  await expect(depot.getByText('Livrables qui font preuve')).toBeVisible()

})

test('le registre se restreint par état et par typologie', async ({ page }) => {
  const base = `/admin/organizations/${ORG}/preuves`
  await page.goto(base)

  const parEtat = page.getByRole('navigation', { name: 'Filtrer par état' })
  const parTypologie = page.getByRole('navigation', { name: 'Filtrer par typologie de preuve' })
  await expect(parEtat).toBeVisible()
  await expect(parTypologie).toBeVisible()

  // Le filtre par etat restreint reellement la liste.
  await parEtat.getByRole('link', { name: /À renouveler/ }).click()
  await expect(page).toHaveURL(/etat=a-renouveler/)
  const registre = page.locator('section').filter({ hasText: 'Registre des preuves' })
  const echues = registre.getByText(/Échue|Bientôt échue/)
  expect(await echues.count()).toBeGreaterThan(0)
  await expect(registre.getByText('À valider', { exact: true })).toHaveCount(0)

  // Les deux filtres se combinent.
  await parTypologie.getByRole('link', { name: 'Sans typologie' }).click()
  await expect(page).toHaveURL(/etat=a-renouveler/)
  await expect(page).toHaveURL(/typologie=aucune/)

  // Une combinaison vide le dit plutôt que d'afficher une carte muette.
  await page.goto(`${base}?etat=rejetees`)
  const vide = page.locator('section').filter({ hasText: 'Registre des preuves' })
  await expect(vide.getByText('Aucune pièce dans ce filtre.')).toBeVisible()
  await vide.getByRole('link', { name: 'Revenir au registre complet' }).click()
  await expect(page).toHaveURL(new RegExp(`${ORG}/preuves$`))
})

test('le registre s’explique sans quitter la page', async ({ page }) => {
  await page.goto(`/admin/organizations/${ORG}/preuves`)

  await page.getByRole('button', { name: 'Comment lire ce registre' }).click()
  const note = page.getByRole('dialog', { name: 'Comment lire ce registre' })

  // D'ou vient le classement des typologies, et d'ou viennent les controles.
  await expect(
    note.getByText(/quatre rôles vis-à-vis de l’IA au sens\s+d’ISO\/IEC 42001/),
  ).toBeVisible()
  await expect(note.getByText(/soit\s+créés à la main, soit importés depuis un catalogue publié/)).toBeVisible()
  await expect(note.getByText(/jamais deux fois le même/)).toBeVisible()

  await page.keyboard.press('Escape')
  await expect(note).toHaveCount(0)
})

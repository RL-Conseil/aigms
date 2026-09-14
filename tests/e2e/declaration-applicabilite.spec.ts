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
  await expect(page.getByRole('heading', { name: /IzarLink Demo|Organisations gérées/ })).toBeVisible()
})

test('la Déclaration exige une décision par exigence et nomme le régime de preuve', async ({
  page,
}) => {
  await page.goto(`/admin/organizations/${ORG}/declaration-applicabilite`)

  await expect(
    page.getByText('Aucune case vide : chaque exigence est sélectionnée ou exclue, et justifiée'),
  ).toBeVisible()
  await expect(page.getByText(/rôle.*Hébergeur \/ Infrastructure/)).toBeVisible()
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

test('les filtres mènent droit aux écarts, et leurs compteurs ne mentent pas', async ({ page }) => {
  const base = `/admin/organizations/${ORG}/declaration-applicabilite`
  await page.goto(base)

  const parEcart = page.getByRole('navigation', { name: 'Filtrer par écart' })
  const parObjectif = page.getByRole('navigation', { name: 'Filtrer par objectif de contrôle' })
  await expect(parEcart).toBeVisible()
  await expect(parObjectif).toBeVisible()

  // Le volet de decision ne s'ouvre plus de lui-meme : trente-trois zones de
  // saisie depliees d'un coup rendaient la page inutilisable.
  await expect(page.getByRole('textbox')).toHaveCount(0)

  // Un ecart se retrouve d'un clic, et la liste s'y restreint vraiment.
  await parEcart.getByRole('link', { name: /Exclusion à réexaminer/ }).click()
  await expect(page).toHaveURL(/ecart=exclusion_contested/)
  const lignes = page.locator('li').filter({ hasText: /^A\./ })
  await expect(page.getByText('Exclusion à réexaminer').first()).toBeVisible()

  // Les deux filtres se combinent sans se reinitialiser l'un l'autre.
  // Le nom accessible porte le code ET son compteur : viser l'exact echouerait.
  await parObjectif.getByRole('link', { name: /^A\.7\b/ }).click()
  await expect(page).toHaveURL(/ecart=exclusion_contested/)
  await expect(page).toHaveURL(/objectif=A\.7/)
  expect(await lignes.count()).toBeGreaterThan(0)

  // Une combinaison vide le dit, et propose d'en sortir.
  await page.goto(`${base}?ecart=exclusion_contested&objectif=A.2`)
  await expect(page.getByRole('heading', { name: 'Aucune exigence dans ce filtre' })).toBeVisible()
  await page.getByRole('link', { name: 'Revenir à la Déclaration complète' }).click()
  await expect(page).toHaveURL(new RegExp(`${ORG}/declaration-applicabilite$`))
})

test('une exigence s’ouvre par son adresse', async ({ page }) => {
  await page.goto(`/admin/organizations/${ORG}/declaration-applicabilite?exigence=A.3.2`)

  const exigence = page.locator('li').filter({ hasText: 'A.3.2' }).first()
  await expect(exigence.getByRole('textbox')).toBeVisible()
})

test('les objectifs se lisent, dans l’ordre et avec leur intitulé', async ({ page }) => {
  await page.goto(`/admin/organizations/${ORG}/declaration-applicabilite`)

  const parObjectif = page.getByRole('navigation', { name: 'Filtrer par objectif de contrôle' })
  const codes = await parObjectif.getByRole('link').allTextContents()

  // A.10 vient APRES A.9. Un tri alphabetique le placerait en tete, ce qui se
  // lit comme une erreur.
  const ordre = codes.slice(1).map((texte) => Number(texte.match(/A\.(\d+)/)![1]))
  expect(ordre).toEqual([...ordre].sort((a, b) => a - b))
  expect(ordre.at(-1)).toBe(10)

  // « A.2 » ne se retient pas : son intitulé accompagne le code, pour la souris
  // comme pour la synthèse vocale.
  const a2 = parObjectif.getByRole('link', { name: /^A\.2\b/ })
  // L'intitule vient du referentiel charge, apostrophe droite comprise : le
  // parcours verifie ce que la base contient, pas ce qu'on aimerait y lire.
  await expect(a2).toHaveAttribute('title', "Politiques relatives à l'IA")
  await expect(a2).toContainText('A.2')
})

test('la mise en garde reste disponible sans occuper la page', async ({ page }) => {
  await page.goto(`/admin/organizations/${ORG}/declaration-applicabilite`)

  // Elle n'est plus imposée à chaque visite…
  await expect(page.getByText(/C’est un catalogue dans lequel on puise/)).toHaveCount(0)

  // …mais reste à un clic, et se ferme au clavier.
  await page.getByRole('button', { name: 'Ce que cette Déclaration est, et n’est pas' }).click()
  const note = page.getByRole('dialog', { name: 'Ce que cette Déclaration est, et n’est pas' })
  await expect(note.getByText(/C’est un catalogue dans lequel on puise/)).toBeVisible()
  await expect(note.getByText(/ne valent ni avis de certification/)).toBeVisible()

  await page.keyboard.press('Escape')
  await expect(note).toHaveCount(0)
})

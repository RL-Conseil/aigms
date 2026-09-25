import { expect, test } from '@playwright/test'

/**
 * Registre : fournisseurs, actifs d'IA, supervision humaine, evaluation
 * d'impact.
 *
 * Quatre objets qui completent le dossier d'un cas d'usage, et dont aucun ne
 * pouvait etre saisi. Deux vivent dans le referentiel de l'organisation, deux
 * n'existent que par le cas d'usage : le parcours suit cette difference.
 */

const OFFICER = { email: 'officer@aigms.eu', password: 'Demo!Passw0rd' }
const ORG = 'cccccccc-0000-4000-8000-000000000001'
const USE_CASE = 'b1000000-0000-4000-8000-000000000001'

test.beforeEach(async ({ page }) => {
  await page.goto('/')
  await page.getByLabel('Adresse électronique').fill(OFFICER.email)
  await page.getByLabel('Mot de passe').fill(OFFICER.password)
  await page.getByRole('button', { name: 'Se connecter' }).click()
  await expect(page.getByRole('heading', { name: /Pilotage|Organisations gérées/ })).toBeVisible()
})

test('un fournisseur se déclare, puis sa revue tiers se prononce', async ({ page }) => {
  await page.goto(`/admin/organizations/${ORG}?inventaire=fournisseurs`)
  await page.getByRole('link', { name: 'Déclarer un fournisseur' }).click()

  const name = `Éditeur de test ${Date.now().toString().slice(-6)}`
  await page.getByLabel('Nom').fill(name)
  await page.getByLabel('Criticité').selectOption('high')
  await page.getByLabel('Pays').fill('IE')
  await page.getByRole('button', { name: 'Enregistrer le fournisseur' }).click()

  // Le message rappelle que la revue reste a conduire : c'est une precondition.
  await expect(page.getByRole('status')).toContainText(/revue tiers reste à conduire/)

  await page.goto(`/admin/organizations/${ORG}?inventaire=fournisseurs`)
  const ligne = page.locator('li').filter({ hasText: name }).first()
  await expect(ligne.getByText('Revue non commencée')).toBeVisible()

  await ligne.getByRole('button', { name: 'Revue tiers' }).click()
  const revue = page.getByRole('dialog', { name: new RegExp(`${name} — revue tiers`) })
  await revue.getByLabel('Résultat de la revue').selectOption('approved')
  await revue.getByRole('button', { name: 'Enregistrer la revue' }).click()
  await expect(page.getByRole('status')).toContainText('Revue tiers enregistrée')
})

test('un actif d’IA s’inscrit et se rattache à un cas d’usage', async ({ page }) => {
  await page.goto(`/admin/organizations/${ORG}/registre/nouveau?nature=actif`)

  const name = `Modèle de test ${Date.now().toString().slice(-6)}`
  // « Nature » nomme aussi le selecteur d'inscription en en-tete : on vise le
  // champ du formulaire.
  await page.getByLabel('Nature', { exact: true }).selectOption('ai_model')
  await page.getByLabel('Nom').fill(name)
  await page.getByRole('button', { name: 'Inscrire l’actif' }).click()
  await expect(page.getByRole('status')).toContainText('registre des actifs')

  await page.goto(`/admin/use-cases/${USE_CASE}`)
  await page.getByRole('button', { name: 'Rattacher un actif' }).click()
  const fenetre = page.getByRole('dialog', { name: 'Actif d’IA employé par ce cas d’usage' })
  await fenetre.getByLabel('Actif').selectOption({ label: name })
  await fenetre.getByRole('button', { name: 'Rattacher' }).click()
  await expect(page.getByRole('status')).toContainText('Actif rattaché')
})

test('une supervision non applicable exige sa justification', async ({ page }) => {
  await page.goto(`/admin/use-cases/${USE_CASE}?onglet=supervision`)

  await page.getByRole('button', { name: /Modifier le plan|Décrire la supervision/ }).click()
  const plan = page.getByRole('dialog', { name: 'Plan de supervision humaine' })

  // Le champ de justification n'apparaît que lorsqu'il devient exigible.
  await expect(plan.getByLabel(/Pourquoi la supervision ne s’applique pas/)).toHaveCount(0)
  await plan.getByLabel('État du plan').selectOption('not_applicable')
  await expect(plan.getByLabel(/Pourquoi la supervision ne s’applique pas/)).toBeVisible()
})

test('une étude d’impact se conduit sur sa page, au format du modèle', async ({ page }) => {
  // Depuis la page des cas d'usage : un bouton, la page des etudes.
  await page.goto('/admin/organizations/cccccccc-0000-4000-8000-000000000001')
  await page.getByRole('link', { name: 'Conduire une étude d’impact IA' }).click()
  await expect(page.getByRole('heading', { name: 'Études d’impact IA' })).toBeVisible()
  await expect(page.getByRole('button', { name: 'Qu’est-ce qu’une étude d’impact IA' })).toBeVisible()

  // L'etude en cours du scoring se poursuit : ses quatre sections.
  await page
    .locator('li')
    .filter({ hasText: 'Scoring de candidatures' })
    .getByRole('link', { name: 'Poursuivre' })
    .click()
  await expect(page.getByRole('heading', { name: /^Étude d’impact — Scoring de candidatures/ })).toBeVisible()
  for (const heading of ['1. Cadrage et contexte', '1.1 Parties prenantes', '2. Analyse croisée des impacts', '3. Plan de gouvernance et remédiation']) {
    await expect(page.getByRole('heading', { name: heading })).toBeVisible()
  }

  // Un prejudice grave sans mesure est refuse : il en porte une.
  await page.getByRole('button', { name: 'Ajouter un constat' }).click()
  const fenetre = page.getByRole('dialog', { name: '2. Constat : bénéfice ou préjudice' })
  await fenetre.getByLabel('Domaine').selectOption('equality_non_discrimination')
  await fenetre.getByLabel('Description').fill('Écart de taux de présélection entre groupes de candidats.')
  await fenetre.getByLabel('Gravité').selectOption('severe')
  await fenetre.getByRole('button', { name: 'Ajouter le constat' }).click()
  await expect(fenetre.getByText(/porte une mesure de réduction/)).toBeVisible()
})

test('le registre des actifs se lit, s’imprime, et chaque actif a sa fiche', async ({ page }) => {
  await page.goto(`/admin/organizations/cccccccc-0000-4000-8000-000000000001/actifs`)
  await expect(page.getByRole('heading', { name: 'Actifs d’IA et fournisseurs' })).toBeVisible()
  await expect(page.getByRole('button', { name: 'Déclarer un actif d’IA' })).toBeVisible()
  await expect(page.getByRole('heading', { name: 'Fournisseurs' })).toBeVisible()
  await expect(page.getByRole('navigation', { name: 'Filtrer par nature' })).toBeVisible()
  // La barre des registres le porte.
  await page.getByRole('navigation', { name: 'Navigation principale' }).getByRole('button', { name: /^Registres/ }).click()
  await expect(page.getByRole('menuitem', { name: /Actifs d’IA/ })).toHaveAttribute('aria-current', 'page')
  await page.keyboard.press('Escape')
  // La fiche d'un actif : identite, mesures, cas d'usage.
  const first = page.locator('section').filter({ has: page.getByRole('heading', { name: 'Actifs' }) }).getByRole('link').first()
  await first.click()
  await expect(page.getByRole('heading', { name: 'Mesures techniques posées sur cet actif' })).toBeVisible()
  await expect(page.getByRole('heading', { name: 'Cas d’usage qui l’emploient' })).toBeVisible()
  await expect(page.getByRole('button', { name: 'Modifier la fiche' })).toBeVisible()
})

test('les revues de gouvernance se planifient à la cadence attendue, et se tiennent avec un compte rendu', async ({ page }) => {
  await page.goto(`/admin/organizations/cccccccc-0000-4000-8000-000000000001/revues`)
  await expect(page.getByRole('heading', { name: 'Revues de gouvernance' })).toBeVisible()
  // La cadence se constate : classe 1, comite trimestriel.
  await expect(page.getByText(/Classe 1 —/)).toBeVisible()
  await expect(page.getByText(/attendue : trimestrielle/)).toBeVisible()

  await page.getByRole('button', { name: 'Planifier une revue' }).click()
  const plan = page.getByRole('dialog', { name: 'Planifier une revue de gouvernance' })
  await plan.getByLabel('Présidée par').selectOption({ index: 1 })
  await plan.getByRole('button', { name: 'Planifier' }).click()
  await expect(plan.getByRole('status')).toContainText('planifiée')

  await page.locator('section').filter({ has: page.getByRole('heading', { name: 'Planifiées' }) }).getByRole('link').first().click()
  await expect(page.getByRole('heading', { name: 'Ordre du jour' })).toBeVisible()
  await page.getByRole('button', { name: 'Tenir la revue' }).click()
  const hold = page.getByRole('dialog', { name: 'Tenir la revue' })
  await hold.getByLabel('Présents').fill('Camille Rousset\nSacha Belarbi')
  await hold.getByLabel('Compte rendu').fill('Revue des décisions du trimestre, des CAPA en cours et des risques élevés ouverts. Le scoring reste en revue jusqu’au test de biais.')
  await hold.getByRole('button', { name: 'Enregistrer la revue tenue' }).click()
  await expect(hold.getByRole('status')).toContainText('compte rendu est déposé')
})

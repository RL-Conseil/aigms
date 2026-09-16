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
  await expect(page.getByRole('heading', { name: /Pilotage|Organisations gérées/ })).toBeVisible()
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
  await expect(page.getByRole('heading', { name: 'Accès à votre espace de gouvernance' })).toBeVisible()

  // Un role de gouvernance n'atterrit plus sur la liste mais sur son
  // organisation courante : le sous-titre se lit la ou la liste vit desormais.
  await signIn(page, OFFICER)
  await page.goto('/admin/organizations')
  await expect(
    page.getByText('Celles sur lesquelles l’administration vous a attribué un rôle.'),
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

test('le rôle vis-à-vis de l’IA se lit sur la fiche et se change en administration', async ({ page }) => {
  // Sur la fiche, un role de gouvernance le lit ; il ne le change pas.
  await signIn(page, OFFICER)
  await page.goto('/admin/organizations/cccccccc-0000-4000-8000-000000000001')

  const carte = page.locator('section').filter({ hasText: 'Rôle vis-à-vis de l’IA' })
  await expect(carte.getByText('Hébergeur / Infrastructure').first()).toBeVisible()
  await expect(carte.getByRole('button', { name: 'Enregistrer le rôle' })).toHaveCount(0)

  // Le role commande la criticite : ce qu'il rend exigeant s'affiche a cote.
  await expect(carte.getByText('Ce que ce rôle rend exigeant')).toBeVisible()
  await expect(carte.getByText(/Isolation et souveraineté physique/)).toBeVisible()
  await expect(carte.getByText(/Empreinte environnementale/)).toBeVisible()

  // L'administration n'y est pas conviee non plus : l'ecran lui est reserve.
  await page.goto('/admin/organizations/cccccccc-0000-4000-8000-000000000001/administration')
  await expect(page.getByRole('heading', { name: 'Accès réservé' })).toBeVisible()
})

test('l’administration change le rôle vis-à-vis de l’IA, et ce qui est exigé suit', async ({ page }) => {
  await signIn(page, ADMIN)
  await page.goto('/admin/organizations/cccccccc-0000-4000-8000-000000000001/administration')
  await expect(page.getByRole('heading', { name: /Administrer IzarLink Demo/ })).toBeVisible()

  const carte = page.locator('section').filter({ hasText: 'Rôle vis-à-vis de l’IA' })

  // On attend l'etat, non le message : celui du precedent enregistrement est
  // encore a l'ecran, et l'attendre laisserait le parcours s'achever avant que
  // la seconde ecriture aboutisse.
  await carte.getByLabel(/Rôle vis-à-vis de l’IA/).selectOption('model_developer')
  await carte.getByRole('button', { name: 'Enregistrer le rôle' }).click()
  await expect(carte.getByText('Développeur / Éditeur d’IA', { exact: false }).first()).toBeVisible()

  // Remis dans l'etat du jeu de demonstration.
  await carte.getByLabel(/Rôle vis-à-vis de l’IA/).selectOption('infrastructure_host')
  await carte.getByRole('button', { name: 'Enregistrer le rôle' }).click()
  await expect(carte.getByText('Hébergeur / Infrastructure', { exact: false }).first()).toBeVisible()
})

test('le pilotage nomme le client, et « Toutes » rend le portefeuille', async ({ page }) => {
  await signIn(page, OFFICER)
  await page.getByRole('link', { name: 'Pilotage' }).click()

  await expect(page.getByRole('heading', { name: 'Pilotage' })).toBeVisible()
  // Sans choix explicite : l'organisation courante.
  await expect(page.getByText(/Ce qui appelle une action chez IzarLink Demo/)).toBeVisible()

  // Les listes ne sont plus ici : elles vivent la ou l'on agit.
  await expect(page.getByRole('heading', { name: 'Risques élevés sans traitement abouti' })).toHaveCount(0)

  // Le filtre n'apparait qu'a partir de deux organisations suivies ; « Toutes »
  // demande explicitement le portefeuille, avec sa ventilation.
  const filtre = page.getByRole('navigation', { name: 'Filtrer par organisation' })
  if (await filtre.isVisible()) {
    await filtre.getByRole('link', { name: /^Toutes/ }).click()
    await expect(page).toHaveURL(/organisation=toutes/)
    await expect(page.getByRole('heading', { name: 'Chez qui' })).toBeVisible()
  }
})

test('on arrive sur le pilotage, « Cas d’usage » ouvre l’organisation courante', async ({ page }) => {
  await signIn(page, OFFICER)

  // L'accueil, c'est le pilotage — place sur l'organisation courante.
  await expect(page).toHaveURL(/\/admin\/pilotage/)
  await expect(page.getByText(/Ce qui appelle une action chez IzarLink Demo/)).toBeVisible()

  // « Cas d'usage » conduit a l'organisation courante sans passer par la liste.
  await page.getByRole('navigation', { name: 'Navigation principale' }).getByRole('link', { name: 'Cas d’usage' }).click()
  await expect(page).toHaveURL(/\/admin\/organizations\/cccccccc/)
  await expect(page.getByRole('heading', { name: 'IzarLink Demo' })).toBeVisible()

  // Le contexte identifie l'organisation sous son nom, il n'est plus une rubrique.
  await expect(page.getByText(/ORG-2026-0001 — IzarLink SAS · Logistique/)).toBeVisible()

  // Les deux inventaires se lisent par onglets.
  const inventaire = page.getByRole('navigation', { name: 'Inventaire' })
  await inventaire.getByRole('link', { name: /Fournisseurs/ }).click()
  await expect(page).toHaveURL(/inventaire=fournisseurs/)
  await expect(page.getByRole('heading', { name: 'Fournisseurs' })).toBeVisible()

  // La liste des organisations gérées a quitté le menu principal.
  const principal = page.getByRole('navigation', { name: 'Navigation principale' })
  await expect(principal.getByRole('link', { name: 'Cas d’usage' })).toBeVisible()
  await expect(principal.getByRole('link', { name: /Organisations/ })).toHaveCount(0)

  await page.getByRole('button', { name: /Camille|Rôle|@/ }).first().click()
  await page.getByRole('menuitem', { name: 'Organisations gérées' }).click()
  await expect(page.getByRole('heading', { name: 'Organisations gérées' })).toBeVisible()
})

test('le journal d’audit se lit, se filtre et s’exporte depuis l’administration', async ({ page }) => {
  await signIn(page, ADMIN)
  await page.getByRole('link', { name: 'Journal' }).click()
  await expect(page.getByRole('heading', { name: 'Journal d’audit' })).toBeVisible()

  // Le jeu de demonstration a ete pose par le seed : des creations, au moins.
  await page.getByLabel('Action').selectOption('create')
  await page.getByRole('button', { name: 'Filtrer' }).click()
  await expect(page).toHaveURL(/action=create/)
  await expect(page.getByRole('list').getByText('Création', { exact: true }).first()).toBeVisible()

  // Une ligne se deplie sur son detail.
  await page.getByRole('button', { name: 'Détail' }).first().click()
  await expect(page.getByRole('button', { name: 'Replier' })).toBeVisible()

  // L'export porte les filtres et repond en JSON.
  const [download] = await Promise.all([
    page.waitForEvent('download'),
    page.getByRole('link', { name: /Exporter en JSON/ }).click(),
  ])
  expect(download.suggestedFilename()).toMatch(/aigms-journal-.*\.json/)
})

test('un rôle de gouvernance ne lit pas le journal de la plateforme', async ({ page }) => {
  await signIn(page, OFFICER)
  await page.goto('/admin/journal')
  await expect(page.getByRole('heading', { name: 'Accès réservé' })).toBeVisible()
})

import { expect, test } from '@playwright/test'

/**
 * Smoke du vertical slice :
 * Organisation -> cas d'usage -> classification -> risques -> impact ->
 * supervision -> decisions -> gate -> journal d'audit -> pilotage.
 */

const OFFICER = { email: 'officer@rl-conseil.demo', password: 'Demo!Passw0rd' }

test.beforeEach(async ({ page }) => {
  await page.goto('/login')
  await page.getByLabel('Adresse électronique').fill(OFFICER.email)
  await page.getByLabel('Mot de passe').fill(OFFICER.password)
  await page.getByRole('button', { name: 'Se connecter' }).click()
  await expect(page.getByRole('heading', { name: 'Organisations' })).toBeVisible()
})

test("l'espace d'administration exige une session", async ({ page, context }) => {
  await context.clearCookies()
  await page.goto('/admin')
  await expect(page).toHaveURL(/\/login/)
})

test('le parcours de gouvernance est consultable de bout en bout', async ({ page }) => {
  await page.getByRole('link', { name: 'IzarLink Demo' }).click()
  await expect(page.getByRole('heading', { name: 'IzarLink Demo' })).toBeVisible()

  // Le cas d'usage en production porte l'ensemble du dossier.
  await page.getByRole('link', { name: 'Assistant support client' }).click()
  await expect(page.getByRole('heading', { name: 'Assistant support client' })).toBeVisible()

  await expect(page.getByRole('heading', { name: 'Pré-classification réglementaire' })).toBeVisible()
  await expect(page.getByRole('heading', { name: 'Risques' })).toBeVisible()
  await expect(page.getByRole('heading', { name: "Évaluation d'impact" })).toBeVisible()
  await expect(page.getByRole('heading', { name: 'Supervision humaine' })).toBeVisible()
  await expect(page.getByRole('heading', { name: 'Décisions de gouvernance' })).toBeVisible()
  await expect(page.getByRole('heading', { name: 'Changements et réévaluations' })).toBeVisible()
  await expect(page.getByRole('heading', { name: "Journal d'audit" })).toBeVisible()

  // Le gate production est satisfait pour ce cas d'usage.
  await expect(page.getByText('Préconditions satisfaites')).toBeVisible()

  // La reevaluation declenchee par le changement d'autonomie est visible.
  await expect(page.getByText('Moteur : Réévaluation complète')).toBeVisible()
})

test('le gate refuse la mise en production et explique ce qui manque', async ({ page }) => {
  await page.getByRole('link', { name: 'IzarLink Demo' }).click()
  await page.getByRole('link', { name: 'Scoring de candidatures' }).click()

  await expect(page.getByText('Préconditions non satisfaites')).toBeVisible()
  await expect(page.getByText('Revue fournisseur close pour chaque tiers impliqué')).toBeVisible()

  // La demande de transition est refusee cote serveur, avec son motif.
  await page.getByLabel('Transition demandée').selectOption('PRODUCTION')
  await page
    .getByLabel('Justification')
    .fill('Demande de généralisation soumise par l’exploitation.')
  await page.getByRole('button', { name: 'Demander la transition' }).click()

  await expect(page.getByRole('status')).toContainText('Préconditions non satisfaites')
  await expect(page.getByRole('heading', { name: 'Scoring de candidatures' })).toBeVisible()
})

test('le tableau de bord remonte ce qui appelle une action', async ({ page }) => {
  await page.getByRole('link', { name: 'Pilotage' }).click()

  await expect(page.getByRole('heading', { name: 'Pilotage' })).toBeVisible()
  await expect(page.getByText('Risques élevés ouverts')).toBeVisible()
  await expect(page.getByText('Preuves à renouveler')).toBeVisible()
  await expect(page.getByRole('heading', { name: 'Incidents ouverts' })).toBeVisible()
  await expect(page.getByRole('heading', { name: 'Gates refusés récemment' })).toBeVisible()
})

test('la Déclaration d’Applicabilité rend compte de la couverture ISO 42001', async ({ page }) => {
  await page.getByRole('link', { name: 'IzarLink Demo' }).click()
  await page.getByRole('link', { name: 'Déclaration d’Applicabilité' }).click()

  await expect(
    page.getByRole('heading', { name: 'Déclaration d’Applicabilité' }),
  ).toBeVisible()
  await expect(page.getByText('ISO/IEC 42001:2023, Annexe A')).toBeVisible()

  // Les neuf objectifs de l'Annexe A sont presentes.
  await expect(page.getByRole('heading', { name: /^A\.2 —/ })).toBeVisible()
  await expect(page.getByRole('heading', { name: /^A\.10 —/ })).toBeVisible()

  // Les quatre etats de couverture coexistent sur le jeu de demonstration.
  await expect(page.getByText('Couverte et prouvée').first()).toBeVisible()
  await expect(page.getByText('Non couverte').first()).toBeVisible()

  // La precaution de non-reproduction du texte normatif est affichee.
  await expect(page.getByText(/ne reproduisent pas le texte de la norme/)).toBeVisible()
  await expect(page.getByText('L’Annexe A n’est pas une liste à cocher.')).toBeVisible()
})

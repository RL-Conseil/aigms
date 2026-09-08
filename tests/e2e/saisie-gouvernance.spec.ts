import { expect, test } from '@playwright/test'

/**
 * Increment 1 : la saisie devient possible.
 *
 * Le parcours suit celui d'un cadrage reel — cartographier, declarer, trier,
 * classifier, coter — et verifie que les gates repondent a la saisie.
 */

const OFFICER = { email: 'officer@rl-conseil.demo', password: 'Demo!Passw0rd' }

test.beforeEach(async ({ page }) => {
  await page.goto('/login')
  await page.getByLabel('Adresse électronique').fill(OFFICER.email)
  await page.getByLabel('Mot de passe').fill(OFFICER.password)
  await page.getByRole('button', { name: 'Se connecter' }).click()
  await expect(page.getByRole('heading', { name: 'Organisations' })).toBeVisible()
})

test('la cartographie montre les processus, activités et usages rattachés', async ({ page }) => {
  await page.getByRole('link', { name: 'IzarLink Demo' }).click()
  await page.getByRole('link', { name: 'Processus' }).click()

  await expect(page.getByRole('heading', { name: 'Cartographie des processus' })).toBeVisible()
  await expect(page.getByRole('heading', { name: /Servir le client/ })).toBeVisible()
  await expect(page.getByText('Traitement des demandes clients')).toBeVisible()
  await expect(page.getByRole('link', { name: 'Assistant support client' })).toBeVisible()

  // Une activité sans usage invite à en déclarer un plutôt que de rester muette.
  await expect(page.getByText('Aucun usage d’IA déclaré sur cette activité.').first()).toBeVisible()
})

test('un processus et une activité se créent depuis la carte', async ({ page }) => {
  await page.goto('/admin/organizations/cccccccc-0000-4000-8000-000000000001/processus')

  const processName = `Acheter ${Date.now()}`
  await page.getByLabel('Nom du processus').fill(processName)
  await page.getByLabel('Code').fill('ACH')
  await page.getByLabel('Nature').selectOption('support')
  await page.getByRole('button', { name: 'Créer le processus' }).click()

  await expect(page.getByRole('status')).toContainText(processName)
  await expect(page.getByRole('heading', { name: new RegExp(processName) })).toBeVisible({
    timeout: 10_000,
  })

  const activityName = `Sélection des fournisseurs ${Date.now()}`
  await page.getByLabel('Processus de rattachement').selectOption({ label: processName })
  await page.getByLabel('Nom de l’activité').fill(activityName)
  await page.getByRole('button', { name: 'Créer l’activité' }).click()

  await expect(page.getByRole('listitem').filter({ hasText: activityName }).first()).toBeVisible({
    timeout: 10_000,
  })
})

test('un cas d’usage se déclare, se trie, se classifie et reçoit un risque', async ({ page }) => {
  // Plusieurs volets portent des champs de même nom — « Justification »
  // notamment. Chaque interaction est donc bornée à son volet.
  const panel = (name: RegExp) =>
    page.locator('section').filter({ has: page.getByRole('button', { name }) })

  await page.goto('/admin/organizations/cccccccc-0000-4000-8000-000000000001/processus')
  await page.getByRole('link', { name: 'Déclarer un cas d’usage' }).click()

  const name = `Analyse des réclamations ${Date.now()}`
  await page.getByLabel('Nom du cas d’usage').fill(name)
  await page
    .getByLabel('Finalité')
    .fill('Regrouper les réclamations par motif afin d’orienter les actions correctives du support.')
  await page
    .getByLabel('Activité servie')
    .selectOption({ label: 'Servir le client › Gestion des réclamations' })
  await page.getByLabel('Propriétaire').selectOption({ index: 1 })
  await page.getByLabel('Responsable redevable').selectOption({ index: 1 })
  await page.getByRole('button', { name: 'Déclarer le cas d’usage' }).click()

  // La création mène directement au dossier.
  await expect(page.getByRole('heading', { name })).toBeVisible({ timeout: 15_000 })
  await expect(page.getByText(/Servir le client › Gestion des réclamations/)).toBeVisible()

  // --- Triage : ouvert d'emblée, c'est ce qui reste à faire -----------------
  const triage = panel(/Trier le cas d’usage/)
  await triage.getByLabel('Criticité').selectOption('moderate')
  await triage
    .getByLabel('Justification')
    .fill('Usage interne d’analyse, sans décision automatisée affectant un client.')
  await triage.getByRole('button', { name: 'Enregistrer le triage' }).click()
  await expect(triage.getByRole('status')).toContainText('Triage enregistré')

  // --- Pré-classification ----------------------------------------------------
  const classification = panel(/Qualifier au regard du règlement/)
  const classificationToggle = classification.getByRole('button', {
    name: /Qualifier au regard du règlement/,
  })
  if ((await classificationToggle.getAttribute('aria-expanded')) !== 'true') {
    await classificationToggle.click()
  }
  await classification.getByRole('checkbox', { name: 'Obligations de transparence' }).check()
  await classification
    .getByLabel('Justification')
    .fill(
      'Analyse interne de réclamations déjà collectées, sans profilage ni décision individuelle : aucune pratique interdite ni cas listé comme à haut risque identifié.',
    )
  await classification.getByRole('button', { name: 'Enregistrer la classification' }).click()
  await expect(classification.getByRole('status')).toContainText('Pré-classification enregistrée')

  // --- Risque ----------------------------------------------------------------
  const risk = panel(/Identifier un risque/)
  const riskToggle = risk.getByRole('button', { name: /Identifier un risque/ })
  if ((await riskToggle.getAttribute('aria-expanded')) !== 'true') {
    await riskToggle.click()
  }
  await risk.getByLabel('Intitulé').fill('Motif de réclamation mal regroupé')
  await risk
    .getByLabel('Scénario')
    .fill(
      'Le regroupement fusionne deux motifs distincts, une cause réelle passe inaperçue et l’action corrective se trompe de cible.',
    )
  await risk.getByLabel('Catégorie').selectOption('accuracy_robustness')
  await risk.getByLabel('Responsable du risque').selectOption({ index: 1 })
  await risk.getByRole('button', { name: 'Enregistrer le risque' }).click()
  await expect(risk.getByRole('status')).toContainText('Risque enregistré et coté')

  // Le gate de passage en revue est désormais satisfait : classification
  // présente et au moins un risque identifié.
  await expect(page.getByText('RSK-')).toBeVisible()
})

test('un risque ne s’accepte pas sans justification ni date de revue', async ({ page }) => {
  await page.goto('/admin/use-cases/b1000000-0000-4000-8000-000000000002')

  // Le formulaire d'acceptation exige les deux champs : le navigateur bloque,
  // et la base les exigerait de toute façon.
  const rationale = page.getByLabel('Justification de l’acceptation').first()
  await expect(rationale).toHaveAttribute('required', '')
  await expect(page.getByLabel('Date de revue').first()).toHaveAttribute('required', '')
  await expect(page.getByText(/Accepter un risque vous engage nominativement/).first()).toBeVisible()
})

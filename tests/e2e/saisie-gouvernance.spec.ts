import { expect, test } from '@playwright/test'

/**
 * Increment 1 : la saisie devient possible.
 *
 * Le parcours suit celui d'un cadrage reel — cartographier, declarer, trier,
 * classifier, coter — et verifie que les gates repondent a la saisie.
 */

const OFFICER = { email: 'officer@rl-conseil.demo', password: 'Demo!Passw0rd' }

test.beforeEach(async ({ page }) => {
  await page.goto('/')
  await page.getByLabel('Adresse électronique').fill(OFFICER.email)
  await page.getByLabel('Mot de passe').fill(OFFICER.password)
  await page.getByRole('button', { name: 'Se connecter' }).click()
  await expect(page.getByRole('heading', { name: 'Organisations' })).toBeVisible()
})

test('la cartographie montre les processus, activités et usages rattachés', async ({ page }) => {
  await page.getByRole('link', { name: 'IzarLink Demo' }).click()
  await page.getByRole('link', { name: 'Processus' }).click()

  await expect(page.getByRole('heading', { name: 'Processus et risques' })).toBeVisible()
  await expect(page.getByRole('heading', { name: /Servir le client/ })).toBeVisible()

  // L'arbre porte les activités ; les usages qu'elles servent apparaissent dans
  // le panneau, à la sélection.
  await expect(page.getByRole('link', { name: /Traitement des demandes clients/ })).toBeVisible()
  await expect(page.getByText('Aucun usage d’IA déclaré.').first()).toBeVisible()

  await page.getByRole('link', { name: /Traitement des demandes clients/ }).click()
  await expect(page.getByRole('link', { name: 'Assistant support client' })).toBeVisible()
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

test('la carte annote chaque activité et son panneau détaille ce qui s’y joue', async ({ page }) => {
  await page.goto('/admin/organizations/cccccccc-0000-4000-8000-000000000001/processus')

  // L'arbre porte les indicateurs directement sur les activités.
  await expect(page.getByRole('heading', { name: /Servir le client/ })).toBeVisible()
  await expect(page.getByText(/contrôles \d+\/\d+/).first()).toBeVisible()
  await expect(page.getByText(/preuves? à renouveler/).first()).toBeVisible()

  // L'indice porte son cadrage, jamais présenté comme un taux de conformité.
  await expect(page.getByText(/pas un taux de conformité/)).toBeVisible()
  await expect(page.getByText(/entretien du dispositif/).first()).toBeVisible()

  // Sélection d'une activité : le panneau s'ouvre, l'URL le retient.
  await page.getByRole('link', { name: /Présélection des candidatures/ }).click()
  await expect(page).toHaveURL(/activite=/)
  const panelPlay = page
    .locator('section')
    .filter({ has: page.getByRole('heading', { name: 'Ce qui s’y joue' }) })
  await expect(panelPlay).toBeVisible()
  await expect(panelPlay.getByText('Risques élevés ouverts')).toBeVisible()
  await expect(page.getByRole('link', { name: 'Scoring de candidatures' })).toBeVisible()

  // Le panneau propose de déclarer un usage sur cette activité précise.
  await page.getByRole('link', { name: '+ Déclarer' }).click()
  await expect(page.getByRole('heading', { name: 'Déclarer un cas d’usage' })).toBeVisible()
  await expect(page.getByLabel('Activité servie')).toHaveValue(
    'c2000000-0000-4000-8000-000000000003',
  )
})

test('l’indice de santé n’est pas produit sans usage déclaré', async ({ page }) => {
  // « Intégration des nouveaux arrivants » reste sans usage : les autres tests
  // du fichier en rattachent, celle-ci non.
  await page.goto(
    '/admin/organizations/cccccccc-0000-4000-8000-000000000001/processus?activite=c2000000-0000-4000-8000-000000000004',
  )

  await expect(page.getByRole('heading', { name: 'Intégration des nouveaux arrivants' })).toBeVisible()
  await expect(page.getByText('Aucun usage d’IA déclaré sur ce périmètre.')).toBeVisible()
})

test('trois lectures du même modèle : processus, couverture, risques', async ({ page }) => {
  await page.goto('/admin/organizations/cccccccc-0000-4000-8000-000000000001/processus')

  // --- Couverture ------------------------------------------------------------
  await page.getByRole('link', { name: 'Couverture', exact: true }).click()
  await expect(page).toHaveURL(/vue=couverture/)
  await expect(page.getByRole('heading', { name: 'Couverture des contrôles' })).toBeVisible()
  await expect(
    page.getByText(/opérant et prouvé par une preuve validée non échue/),
  ).toBeVisible()

  const row = page.getByRole('row').filter({ hasText: 'Présélection des candidatures' })
  await expect(row.getByText('75 %')).toBeVisible()
  await expect(row.getByText(/\d+ j/)).toBeVisible()

  // --- Risques ---------------------------------------------------------------
  await page.getByRole('link', { name: 'Risques', exact: true }).click()
  await expect(page).toHaveURL(/vue=risques/)
  await expect(page.getByRole('heading', { name: 'Répartition des risques' })).toBeVisible()
  await expect(page.getByRole('columnheader', { name: 'Critique' })).toBeVisible()
  await expect(
    page.getByRole('rowheader', { name: 'Gérer les ressources humaines' }),
  ).toBeVisible()

  // Un risque accepté n'est pas compté comme ouvert : c'est une décision.
  await expect(page.getByText(/l’acceptation est une\s+décision assumée/)).toBeVisible()
  await expect(page.getByRole('heading', { name: 'Risques ouverts les plus élevés' })).toBeVisible()

  // --- Retour à l'arbre ------------------------------------------------------
  await page.getByRole('link', { name: 'Processus', exact: true }).click()
  await expect(page.getByRole('heading', { name: /Servir le client/ })).toBeVisible()
})

test('le graphe relie les couches et le chemin d’un risque nomme sa rupture', async ({ page }) => {
  await page.goto('/admin/organizations/cccccccc-0000-4000-8000-000000000001/processus?vue=graphe')

  await expect(page.getByRole('heading', { name: 'Graphe de gouvernance' })).toBeVisible()
  await expect(page.locator('.react-flow__node').first()).toBeVisible()

  // Les couches s'activent : masquer les preuves retire des noeuds du canevas.
  const before = await page.locator('.react-flow__node').count()
  await page.getByRole('checkbox', { name: /^Preuves/ }).uncheck()
  await expect
    .poll(() => page.locator('.react-flow__node').count())
    .toBeLessThan(before)
  await page.getByRole('checkbox', { name: /^Preuves/ }).check()

  const picker = page.locator('section').filter({ hasText: 'Suivre un risque' })

  // --- Une chaîne qui s'arrête à l'intention ---------------------------------
  await picker.getByRole('link', { name: /Transfert de données de candidats/ }).click()
  await expect(page).toHaveURL(/risque=/)
  await expect(page.getByText('Chaîne de maîtrise rompue')).toBeVisible()
  await expect(page.getByText(/aucun contrôle ne le met en œuvre/)).toBeVisible()
  await expect(page.getByText('Désigner le contrôle qui met en œuvre le traitement prévu.')).toBeVisible()

  // --- Un risque accepté n'est pas une chaîne rompue -------------------------
  await picker.getByRole('link', { name: /Dépendance au fournisseur/ }).click()
  await expect(page.getByText('Risque accepté', { exact: true })).toBeVisible()
  await expect(page.getByText(/l’acceptation est nominative, justifiée et datée/)).toBeVisible()

  // --- Une chaîne complète ---------------------------------------------------
  await picker.getByRole('link', { name: /Réponse erronée transmise au client/ }).click()
  await expect(page.getByText('Chaîne de maîtrise complète')).toBeVisible()
  await expect(page.getByRole('heading', { name: 'Ce qui le tient' })).toBeVisible()
})

test('la navigation porte l’avancement et les retards', async ({ page }) => {
  await page.goto('/admin')

  // La liste des organisations dit d'emblee laquelle demande du travail.
  const ligne = page.locator('li').filter({ hasText: 'IzarLink Demo' }).first()
  await expect(ligne.getByText(/exigences sans décision|preuve|risque|action/)).toBeVisible()

  await page.getByRole('link', { name: 'IzarLink Demo' }).click()

  // Second niveau de navigation : les sections de l'organisation.
  const sections = page.getByRole('navigation', { name: 'Sections de l’organisation' })
  await expect(sections.getByRole('link', { name: /Vue d’ensemble/ })).toBeVisible()
  await expect(sections.getByRole('link', { name: /Processus et risques/ })).toBeVisible()
  await expect(sections.getByRole('link', { name: /Déclaration d’Applicabilité/ })).toBeVisible()

  // Ce qui appelle une action se lit avant le contenu, et s'atteint d'un clic.
  await page.getByRole('link', { name: /exigences sans décision/ }).click()
  await expect(page).toHaveURL(/declaration-applicabilite/)
  await expect(sections.getByRole('link', { name: /Déclaration/ })).toHaveAttribute(
    'aria-current',
    'page',
  )
})

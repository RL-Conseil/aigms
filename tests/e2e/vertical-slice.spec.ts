import { expect, test } from '@playwright/test'

/**
 * Smoke du vertical slice :
 * Organisation -> cas d'usage -> classification -> risques -> impact ->
 * supervision -> decisions -> gate -> journal d'audit -> pilotage.
 */

const OFFICER = { email: 'officer@rl-conseil.demo', password: 'Demo!Passw0rd' }

test.beforeEach(async ({ page }) => {
  await page.goto('/')
  await page.getByLabel('Adresse électronique').fill(OFFICER.email)
  await page.getByLabel('Mot de passe').fill(OFFICER.password)
  await page.getByRole('button', { name: 'Se connecter' }).click()
  await expect(page.getByRole('heading', { name: /IzarLink Demo|Organisations gérées/ })).toBeVisible()
})

test("l'espace d'administration exige une session", async ({ page, context }) => {
  await context.clearCookies()
  await page.goto('/admin')
  // La mire est desormais l'accueil ; la destination demandee est conservee.
  await expect(page).toHaveURL(/\/\?next=%2Fadmin/)
  await expect(page.getByRole('heading', { name: 'Accès à l’espace de gouvernance' })).toBeVisible()
})

test('le parcours de gouvernance est consultable de bout en bout', async ({ page }) => {
  await page.goto('/admin/organizations')
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
  await expect(page.getByRole('heading', { name: 'Journal d’audit' })).toBeVisible()

  // Le gate production est satisfait pour ce cas d'usage.
  await expect(page.getByText('Préconditions satisfaites')).toBeVisible()

  // La reevaluation declenchee par le changement d'autonomie reste accessible :
  // le dossier de reference est repliable, pas absent.
  const changements = page
    .locator('section')
    .filter({ hasText: 'Changements et réévaluations' })
    .first()
  await changements.getByRole('button', { name: /Changements et réévaluations/ }).click()
  await expect(changements.getByText('Moteur : Réévaluation complète')).toBeVisible()
})

test('le gate refuse la mise en production et explique ce qui manque', async ({ page }) => {
  await page.goto('/admin/organizations')
  await page.getByRole('link', { name: 'IzarLink Demo' }).click()
  await page.getByRole('link', { name: 'Scoring de candidatures' }).click()

  await expect(page.getByText('Préconditions non satisfaites')).toBeVisible()
  await expect(page.getByText('Revue fournisseur close pour chaque tiers impliqué')).toBeVisible()

  // La demande de transition est refusee cote serveur, avec son motif.
  await page.getByLabel('Transition demandée').selectOption('PRODUCTION')
  await page
    .getByLabel('Motif de la transition')
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
  await page.goto('/admin/organizations')
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

  // La mise en garde et la precaution de non-reproduction du texte normatif
  // vivent desormais derriere l'icone, a cote du titre.
  await page.getByRole('button', { name: 'Ce que cette Déclaration est, et n’est pas' }).click()
  await expect(page.getByText(/C’est un catalogue dans lequel on puise/)).toBeVisible()
  await expect(page.getByText(/ne reproduisent pas le texte de la norme/)).toBeVisible()
})

test('la fiche d’un cas d’usage ouvre sur ce qu’il y a à faire', async ({ page }) => {
  await page.goto('/admin/organizations')
  await page.getByRole('link', { name: 'IzarLink Demo' }).click()
  await page.getByRole('link', { name: 'Assistant support client' }).click()

  // Les chiffres saillants precedent le dossier.
  await expect(page.getByText('Risques élevés ouverts')).toBeVisible()
  await expect(page.getByText('Contrôles obligatoires non statués')).toBeVisible()
  await expect(page.getByText('Décisions à instruire')).toBeVisible()

  // Le dossier de reference est repliable : il ne s'impose plus au premier coup
  // d'oeil, mais reste a un clic.
  // L'identite du cas d'usage se lit en clair : replier ce qui dit de quoi
  // l'on parle obligeait a ouvrir un volet pour le savoir.
  await expect(page.getByText('Bénéfice attendu')).toBeVisible()
  await expect(page.getByText('Portée de la décision')).toBeVisible()

  // Ce qui appelle une action reste ouvert.
  await expect(page.getByRole('heading', { name: 'Risques' })).toBeVisible()
  await expect(page.getByRole('heading', { name: 'Gate production' })).toBeVisible()
})

test('la frise marque les jalons obligatoires et porte l’action qui la fait avancer', async ({
  page,
}) => {
  await page.goto('/admin/organizations')
  await page.getByRole('link', { name: 'IzarLink Demo' }).click()

  // Le bouton de declaration se trouve aussi la ou l'on lit l'inventaire.
  await expect(page.getByRole('link', { name: 'Déclarer un cas d’usage' })).toBeVisible()

  await page.getByRole('link', { name: 'Assistant support client' }).click()

  // La frise porte un libelle, et nomme ce qu'elle signale.
  await expect(page.getByText('Fil conducteur du cas d’usage')).toBeVisible()
  await expect(page.getByText(/Jalon obligatoire — le passage est refusé côté serveur/)).toBeVisible()

  // Revue et Production sont marquees, les autres non.
  const frise = page.getByRole('listitem').filter({ hasText: 'Production' }).first()
  await expect(frise).toContainText('jalon obligatoire')
  const triage = page.getByRole('listitem').filter({ hasText: 'Triage' }).first()
  await expect(triage).not.toContainText('jalon obligatoire')

  // L'action qui fait avancer se lit a cote de la frise, pas en bas de page.
  await expect(page.getByRole('heading', { name: 'Faire évoluer le cas d’usage' })).toBeVisible()

  // Gate et controles se replient : ce sont des constats, pas des actions.
  const controles = page.locator('section').filter({ hasText: 'Contrôles affectés' }).first()
  await expect(controles.getByText('CTL-01')).toHaveCount(0)
  await controles.getByRole('button', { name: /Contrôles affectés/ }).click()
  await expect(controles.getByText('CTL-01')).toBeVisible()
})

test('le fil d’Ariane d’un cas d’usage ramène à son organisation', async ({ page }) => {
  await page.goto('/admin/organizations')
  await page.getByRole('link', { name: 'IzarLink Demo' }).click()
  await page.getByRole('link', { name: 'Agent de planification des tournées' }).click()

  const fil = page.getByRole('navigation', { name: "Fil d'Ariane" })

  // La page courante se nomme, mais ne se clique pas.
  await expect(fil).toContainText('Agent de planification des tournées')
  await expect(
    fil.getByRole('link', { name: 'Agent de planification des tournées' }),
  ).toHaveCount(0)

  // Le lien vers l'organisation menait sur un 404 : il lui manquait /admin.
  await fil.getByRole('link', { name: 'IzarLink Demo' }).click()
  await expect(page).toHaveURL(/\/admin\/organizations\/cccccccc/)
  await expect(page.getByRole('heading', { name: 'IzarLink Demo' })).toBeVisible()

  // Et « Organisations » mène bien à la liste, comme son libellé l'annonce.
  await page.getByRole('navigation', { name: "Fil d'Ariane" }).getByRole('link', { name: 'Organisations' }).click()
  await expect(page).toHaveURL(/\/admin\/organizations$/)
  await expect(page.getByRole('heading', { name: 'Organisations gérées' })).toBeVisible()
})

test('chaque rubrique du dossier s’explique sur place', async ({ page }) => {
  await page.goto('/admin/use-cases/b1000000-0000-4000-8000-000000000001')

  // Le volet de classification porte le terme etabli, pas un synonyme.
  await expect(page.getByText('Pré-classifier au regard du règlement')).toBeVisible()

  // Sa note distingue « haut risque » au sens du reglement de la cotation d'un
  // risque : c'est la confusion la plus couteuse de l'ecran.
  await page.getByRole('button', { name: 'À quoi sert la pré-classification' }).click()
  const note = page.getByRole('dialog', { name: 'À quoi sert la pré-classification' })
  await expect(note.getByText(/« Haut risque » n’est pas un niveau de\s+risque/)).toBeVisible()
  await page.keyboard.press('Escape')

  // Les autres rubriques en portent une aussi.
  for (const label of [
    'À quoi sert le triage',
    'À quoi sert le registre des risques',
    'À quoi sert le gate',
    'À quoi sert le journal',
  ]) {
    await expect(page.getByRole('button', { name: label })).toBeVisible()
  }

  // Ouvrir une note ne replie pas le volet qui la porte.
  const journal = page.locator('section').filter({ hasText: 'Journal d’audit' }).first()
  await journal.getByRole('button', { name: 'À quoi sert le journal' }).click()
  await expect(page.getByRole('dialog', { name: 'À quoi sert le journal' })).toBeVisible()
})

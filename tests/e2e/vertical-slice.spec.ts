import { expect, test } from '@playwright/test'

/**
 * Smoke du vertical slice :
 * Organisation -> cas d'usage -> classification -> risques -> impact ->
 * supervision -> decisions -> gate -> journal d'audit -> pilotage.
 */

const OFFICER = { email: 'officer@aigms.eu', password: 'Demo!Passw0rd' }

test.beforeEach(async ({ page }) => {
  await page.goto('/')
  await page.getByLabel('Adresse électronique').fill(OFFICER.email)
  await page.getByLabel('Mot de passe').fill(OFFICER.password)
  await page.getByRole('button', { name: 'Se connecter' }).click()
  await expect(page.getByRole('heading', { name: /Pilotage|Organisations gérées/ })).toBeVisible()
})

test("l'espace d'administration exige une session", async ({ page, context }) => {
  await context.clearCookies()
  await page.goto('/admin')
  // La mire est desormais l'accueil ; la destination demandee est conservee.
  await expect(page).toHaveURL(/\/\?next=%2Fadmin/)
  await expect(page.getByRole('heading', { name: 'Accès à votre espace de gouvernance' })).toBeVisible()
})

test('le parcours de gouvernance est consultable de bout en bout', async ({ page }) => {
  await page.goto('/admin/organizations')
  await page.getByRole('link', { name: 'IzarLink Demo' }).click()
  await expect(page.getByRole('heading', { name: 'IzarLink Demo' })).toBeVisible()

  // Le cas d'usage en production porte l'ensemble du dossier.
  await page.getByRole('link', { name: 'Assistant support client' }).click()
  await expect(page.getByRole('heading', { name: 'Assistant support client' })).toBeVisible()

  // La fiche se lit par rubrique : le fil conducteur d'abord, puis chacune
  // a son onglet. Le bandeau et le fil restent en place.
  const rubriques = page.getByRole('navigation', { name: 'Rubriques du cas d’usage' })
  await expect(page.getByRole('heading', { name: 'Qualification réglementaire' })).toBeVisible()
  // La qualification se relit en francais, pas en codes.
  await expect(page.getByText('Rôle : Déployeur')).toBeVisible()
  await expect(page.getByText('Obligations de transparence')).toBeVisible()
  // Le jalon Production porte lui-meme ses preconditions.
  await page.getByRole('button', { name: 'Préconditions du jalon Production' }).click()
  await expect(page.getByRole('dialog', { name: 'Préconditions du jalon Production' })).toContainText(
    'préconditions satisfaites',
  )
  await page.keyboard.press('Escape')

  for (const [tab, heading] of [
    [/^Risques/, 'Risques'],
    [/^Actions et incidents/, 'Actions'],
    [/Supervision humaine/, 'Supervision humaine'],
    [/^Décisions et changements/, 'Décisions et changements'],
  ] as const) {
    await rubriques.getByRole('link', { name: tab }).click()
    await expect(page.getByRole('heading', { name: heading, exact: true })).toBeVisible()
  }

  // Le journal a quitte la fiche : il se lit par organisation, filtre sur ce
  // cas d'usage, depuis un lien de l'en-tete.
  await page.getByRole('link', { name: 'Journal', exact: true }).click()
  await expect(page.getByRole('heading', { name: 'Journal d’audit' })).toBeVisible()
  await expect(page).toHaveURL(/\/journal\?cas=/)
  await expect(page.getByRole('button', { name: 'À quoi sert le journal' })).toBeVisible()
  await page.goBack()

  // Decisions et changements se lisent dans un seul fil : le changement
  // d'autonomie, son verdict, et la decision qu'il a appelee.
  await rubriques.getByRole('link', { name: /^Décisions et changements/ }).click()
  await expect(page).toHaveURL(/onglet=decisions/)
  await expect(page.getByText('Réévaluation complète').first()).toBeVisible()
  await expect(page.getByText(/Décision DEC-IA-\d{4}-\d{4} : Approuvée/)).toBeVisible()
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

test('le tableau de bord se place sur l’organisation courante et ses libellés conduisent aux listes', async ({ page }) => {
  await page.getByRole('link', { name: 'Pilotage' }).click()

  await expect(page.getByRole('heading', { name: 'Pilotage' })).toBeVisible()
  // Sans choix explicite : l'organisation courante, nommee dans le sous-titre.
  await expect(page.getByText(/Ce qui appelle une action chez IzarLink Demo/)).toBeVisible()

  // Le graphique porte les compteurs ; chaque libelle ouvre la liste filtree.
  const chart = page.locator('section').filter({ has: page.getByRole('heading', { name: 'Ce qui appelle une action' }) })
  await expect(chart.getByRole('link', { name: /preuves? à renouveler/ })).toBeVisible()
  await chart.getByRole('link', { name: /actions? échues?/ }).click()
  await expect(page).toHaveURL(/suivi\?vue=actions&etat=echues/)
  await expect(page.getByRole('heading', { name: 'Suivi d’actions', exact: true })).toBeVisible()

  // Le refus de gate reste trace sur le tableau de bord.
  await page.goto('/admin/pilotage')
  await expect(page.getByRole('heading', { name: 'Gates refusés récemment' })).toBeVisible()
})

test('la Déclaration d’Applicabilité rend compte de la couverture ISO 42001', async ({ page }) => {
  await page.goto('/admin/organizations')
  await page.getByRole('link', { name: 'IzarLink Demo' }).click()
  await page.getByRole('navigation', { name: 'Navigation principale' }).getByRole('button', { name: /^Registres/ }).click()
  await page.getByRole('menuitem', { name: /Déclaration d’Applicabilité/ }).click()

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
  await expect(page.getByText('Risques élevés ouverts', { exact: true })).toBeVisible()
  await expect(page.getByText('Contrôles obligatoires non statués')).toBeVisible()
  await expect(page.getByText('Décisions à instruire')).toBeVisible()

  // Le dossier de reference est repliable : il ne s'impose plus au premier coup
  // d'oeil, mais reste a un clic.
  // L'identite du cas d'usage se lit en clair : replier ce qui dit de quoi
  // l'on parle obligeait a ouvrir un volet pour le savoir.
  await expect(page.getByText('Bénéfice attendu')).toBeVisible()
  await expect(page.getByText('Portée de la décision')).toBeVisible()

  // Les jalons obligatoires portent leurs preconditions, en infobulle.
  await expect(page.getByRole('button', { name: 'Préconditions du jalon Revue' })).toBeVisible()
  await expect(page.getByRole('button', { name: 'Préconditions du jalon Production' })).toBeVisible()
})

test('la frise marque les jalons obligatoires et porte l’action qui la fait avancer', async ({
  page,
}) => {
  await page.goto('/admin/organizations')
  await page.getByRole('link', { name: 'IzarLink Demo' }).click()

  // Le bouton de declaration se trouve aussi la ou l'on lit l'inventaire.
  await expect(page.getByRole('link', { name: 'Déclarer un cas d’usage', exact: true })).toBeVisible()

  await page.getByRole('link', { name: 'Assistant support client' }).click()

  // La frise porte un libelle, et nomme ce qu'elle signale.
  await expect(page.getByText('Avancement du cas d’usage')).toBeVisible()
  await expect(page.getByText(/Jalon obligatoire — le passage est refusé côté serveur/)).toBeVisible()

  // Revue et Production sont marquees, les autres non.
  const frise = page.getByRole('listitem').filter({ hasText: 'Production' }).first()
  await expect(frise).toContainText('jalon obligatoire')
  const triage = page.getByRole('listitem').filter({ hasText: 'Triage' }).first()
  await expect(triage).not.toContainText('jalon obligatoire')

  // L'action qui fait avancer se demande depuis l'en-tete, quelle que soit
  // la rubrique ouverte.
  await page.getByRole('button', { name: 'Faire évoluer' }).click()
  const porte = page.getByRole('dialog', { name: 'Faire évoluer le cas d’usage' })
  await expect(porte.getByRole('button', { name: /^Franchir un jalon/ })).toBeVisible()
  await expect(porte.getByRole('button', { name: /^Décider/ })).toBeVisible()
  await expect(porte.getByRole('button', { name: /^Prévoir un changement/ })).toBeVisible()
  await page.keyboard.press('Escape')

  // Les controles ont leur rubrique : un constat, a portee d'un clic.
  await page
    .getByRole('navigation', { name: 'Rubriques du cas d’usage' })
    .getByRole('link', { name: /Contrôles affectés/ })
    .click()
  await expect(page.getByText('CTL-01')).toBeVisible()
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
  const rubriques = page.getByRole('navigation', { name: 'Rubriques du cas d’usage' })

  // La qualification se pose depuis le fil conducteur, et nomme le reglement.
  await expect(page.getByRole('heading', { name: 'Qualification réglementaire' })).toBeVisible()
  await expect(page.getByText(/Règlement \(UE\) 2024\/1689/).first()).toBeVisible()

  // Sa note distingue « haut risque » au sens du reglement de la cotation d'un
  // risque : c'est la confusion la plus couteuse de l'ecran.
  await page.getByRole('button', { name: 'À quoi sert la qualification' }).click()
  const note = page.getByRole('dialog', { name: 'À quoi sert la qualification' })
  await expect(note.getByText(/« Haut risque » n’est pas un niveau de\s+risque/)).toBeVisible()
  await page.keyboard.press('Escape')

  // Les autres rubriques en portent une aussi, chacune dans son onglet.
  for (const [tab, label] of [
    [/^Avancement/, 'À quoi sert la criticité'],
    [/^Avancement/, 'Préconditions du jalon Production'],
    [/^Risques/, 'À quoi sert le registre des risques'],
  ] as const) {
    await rubriques.getByRole('link', { name: tab }).click()
    await expect(page.getByRole('button', { name: label })).toBeVisible()
  }

  await page.getByRole('button', { name: 'À quoi sert le journal' }).click()
  await expect(page.getByRole('dialog', { name: 'À quoi sert le journal' })).toBeVisible()
})

test('une transition sans motif est refusée', async ({ page }) => {
  await page.goto('/admin/use-cases/b1000000-0000-4000-8000-000000000003')

  await page.getByRole('button', { name: 'Faire évoluer' }).click()
  const evolution = page.getByRole('dialog', { name: 'Faire évoluer le cas d’usage' })
  // Trois intentions, une porte : franchir un jalon simple se demande ici.
  await evolution.getByRole('button', { name: /^Franchir un jalon/ }).click()
  await expect(evolution.getByText(/C’est la seule phrase qui dira/)).toBeVisible()

  // Le navigateur bloque d'abord, sur `required`.
  const motif = evolution.getByLabel('Motif de la transition')
  await expect(motif).toHaveAttribute('required', '')

  // Le serveur tranche ensuite. Douze espaces satisfont `minLength` — le
  // navigateur laisse donc passer — et ne survivent pas au `trim` : c'est
  // exactement la que la contrainte d'ecran doit ceder a celle du serveur.
  await motif.fill('            ')
  await evolution.getByRole('button', { name: /Demander la transition/ }).click()
  await expect(page.getByText(/doit pouvoir se relire dans six mois/)).toBeVisible()
})

test('les alertes sont nominatives et se lisent depuis le bandeau', async ({ page }) => {
  await page.goto('/admin/pilotage')
  await page.getByRole('link', { name: /^Mes alertes/ }).click()
  await expect(page).toHaveURL(/\/admin\/alertes/)
  await expect(page.getByRole('heading', { name: 'Mes alertes' })).toBeVisible()
  await expect(page.getByRole('heading', { name: 'À lire' })).toBeVisible()
})

test('la fiche se corrige d’un crayon, à côté du nom', async ({ page }) => {
  await page.goto('/admin/use-cases/b1000000-0000-4000-8000-000000000001')
  await page.getByRole('button', { name: 'Modifier la fiche' }).click()
  await expect(page.getByRole('dialog', { name: 'Corriger la fiche' })).toBeVisible()
  await expect(page.getByRole('button', { name: 'Changer' })).toHaveCount(0)
})

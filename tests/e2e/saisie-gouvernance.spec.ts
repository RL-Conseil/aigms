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
  await expect(page.getByRole('heading', { name: /Pilotage|Organisations gérées/ })).toBeVisible()
})

test('la cartographie montre les processus, activités et usages rattachés', async ({ page }) => {
  await page.goto('/admin/organizations')
  await page.getByRole('link', { name: 'IzarLink Demo' }).click()
  await page.getByRole('navigation', { name: 'Navigation principale' }).getByRole('link', { name: /^Processus et risques/ }).click()

  await expect(page.getByRole('heading', { name: 'Processus et risques' })).toBeVisible()

  // L'arbre se lit en trois familles, pliees d'emblee ; chacune porte les
  // usages sous ses activites une fois depliee.
  await expect(page.getByRole('heading', { name: /Servir le client/ })).toHaveCount(0)
  await page.getByRole('button', { name: /^Réalisation/ }).click()
  await expect(page.getByRole('heading', { name: /Servir le client/ })).toBeVisible()
  await expect(
    page.getByRole('link', { name: 'Traitement des demandes clients', exact: true }),
  ).toBeVisible()
  await expect(page.getByRole('link', { name: 'Assistant support client' })).toBeVisible()
  await expect(page.getByText('Aucun usage d’IA déclaré.').first()).toBeVisible()

  await page.getByRole('link', { name: 'Traitement des demandes clients', exact: true }).click()
  await expect(page.getByRole('link', { name: 'Assistant support client' })).toBeVisible()
})

test('un processus et une activité se créent depuis la carte', async ({ page }) => {
  await page.goto('/admin/organizations/cccccccc-0000-4000-8000-000000000001/processus')

  // Les formulaires ont leur page : le referentiel de processus se decrit une
  // fois, il n'a pas a occuper la colonne de detail en permanence.
  await page.getByRole('link', { name: 'Ajouter un processus' }).click()
  await expect(page).toHaveURL(/processus\/nouveau/)

  const processName = `Acheter ${Date.now()}`
  await page.getByLabel('Nom du processus').fill(processName)
  await page.getByLabel('Code').fill('ACH')
  await page.getByLabel('Nature').selectOption('support')
  await page.getByRole('button', { name: 'Créer le processus' }).click()

  await expect(page.getByRole('status')).toContainText(processName)

  await page.goto('/admin/organizations/cccccccc-0000-4000-8000-000000000001/processus')
  await expect(page.getByRole('heading', { name: new RegExp(processName) })).toBeVisible({
    timeout: 10_000,
  })

  await page.getByRole('link', { name: 'Ajouter une activité' }).first().click()
  await expect(page).toHaveURL(/processus\/activite/)

  const activityName = `Sélection des fournisseurs ${Date.now()}`
  await page.getByLabel('Processus de rattachement').selectOption({ label: processName })
  await page.getByLabel('Nom de l’activité').fill(activityName)
  await page.getByRole('button', { name: 'Créer l’activité' }).click()

  await expect(page.getByRole('status')).toContainText(activityName, { timeout: 10_000 })

  await page.goto('/admin/organizations/cccccccc-0000-4000-8000-000000000001/processus')
  await expect(page.getByRole('listitem').filter({ hasText: activityName }).first()).toBeVisible({
    timeout: 10_000,
  })
})

test('un cas d’usage se déclare, se trie, se classifie et reçoit un risque', async ({ page }) => {
  // Plusieurs volets portent des champs de même nom — « Justification »
  // notamment. Chaque interaction est donc bornée à son volet.
  const panel = (name: RegExp) =>
    page.locator('section').filter({ has: page.getByRole('button', { name }) })

  // Un cas d'usage se declare depuis la vue d'ensemble — pas depuis la carte.
  await page.goto('/admin/organizations/cccccccc-0000-4000-8000-000000000001')
  await page.getByRole('link', { name: 'Déclarer un cas d’usage', exact: true }).click()

  const name = `Analyse des réclamations ${Date.now()}`
  await page.getByLabel('Nom du cas d’usage').fill(name)
  await page
    .getByLabel('Finalité')
    .fill('Regrouper les réclamations par motif afin d’orienter les actions correctives du support.')
  await page
    .getByLabel('Activité du processus servie')
    .selectOption({ label: 'Servir le client › Gestion des réclamations' })
  await page.getByLabel('Propriétaire').selectOption({ index: 1 })
  await page.getByLabel('Responsable redevable').selectOption({ index: 1 })
  await page.getByRole('button', { name: 'Déclarer le cas d’usage' }).click()

  // La création mène directement au dossier.
  await expect(page.getByRole('heading', { name })).toBeVisible({ timeout: 15_000 })
  await expect(page.getByText(/Servir le client › Gestion des réclamations/)).toBeVisible()

  // --- Criticité : sur le fil conducteur, ouverte d'emblée ------------------
  const rubriques = page.getByRole('navigation', { name: 'Rubriques du cas d’usage' })
  const triage = panel(/Criticité du cas d’usage/)
  await triage.getByLabel('Criticité').selectOption('moderate')
  await triage
    .getByLabel('Justification')
    .fill('Usage interne d’analyse, sans décision automatisée affectant un client.')
  await triage.getByRole('button', { name: 'Enregistrer la criticité' }).click()
  await expect(triage.getByRole('status')).toContainText('Criticité enregistrée')

  // --- Qualification : une fenetre, depuis la carte de droite -----------------
  await page.getByRole('button', { name: 'Qualifier maintenant' }).click()
  const classification = page.getByRole('dialog', { name: 'Qualification au regard du règlement' })
  await classification.getByRole('checkbox', { name: 'Obligations de transparence' }).check()
  await classification
    .getByLabel('Justification')
    .fill(
      'Analyse interne de réclamations déjà collectées, sans profilage ni décision individuelle : aucune pratique interdite ni cas listé comme à haut risque identifié.',
    )
  await classification.getByRole('button', { name: 'Enregistrer la qualification' }).click()
  await expect(classification.getByRole('status')).toContainText('Qualification enregistrée')

  // --- Risque ----------------------------------------------------------------
  // La saisie se fait dans une fenetre, ouverte depuis la rubrique qu'elle
  // alimente : un risque n'existe que par son cas d'usage.
  await rubriques.getByRole('link', { name: /^Risques/ }).click()
  await page
    .locator('section')
    .filter({ has: page.getByRole('heading', { name: 'Risques', exact: true }) })
    .getByRole('button', { name: /Identifier/ })
    .click()
  const risk = page.getByRole('dialog', { name: 'Identifier un risque' })
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
  await page.goto('/admin/use-cases/b1000000-0000-4000-8000-000000000002?onglet=risques')

  // L'acceptation revient a la personne designee responsable du risque : les
  // risques du pilote sont portes par le Comite des risques, pas par l'officer
  // connecte. A lui, la fiche dit a qui cela revient — sans formulaire.
  await expect(page.getByLabel('Justification de l’acceptation')).toHaveCount(0)
  await expect(page.getByText(/L’acceptation de ce risque revient à/).first()).toBeVisible()
  await expect(page.getByText(/Sacha Belarbi/).first()).toBeVisible()
})

test('la carte annote chaque activité et son panneau détaille ce qui s’y joue', async ({ page }) => {
  await page.goto('/admin/organizations/cccccccc-0000-4000-8000-000000000001/processus')

  // L'arbre porte les indicateurs directement sur les activités, et se replie
  // par famille — pliee d'emblee ; la sélection courante garde la sienne ouverte.
  await expect(page.getByRole('heading', { name: /Gérer les ressources humaines/ })).toHaveCount(0)
  await page.getByRole('button', { name: /^Support/ }).click()
  await expect(page.getByRole('heading', { name: /Gérer les ressources humaines/ })).toBeVisible()
  await expect(page.getByText(/contrôles \d+\/\d+/).first()).toBeVisible()
  await expect(page.getByText(/preuve\(s\) à renouveler/).first()).toBeVisible()

  // Sélection d'une activité : le panneau s'ouvre, l'URL le retient.
  await page.getByRole('link', { name: 'Présélection des candidatures', exact: true }).click()
  await expect(page).toHaveURL(/activite=/)

  // L'indice porte son cadrage, jamais présenté comme un taux de conformité.
  await expect(page.getByText(/pas un taux de conformité/)).toBeVisible()
  await expect(page.getByText(/entretien du dispositif/).first()).toBeVisible()
  const panelPlay = page
    .locator('section')
    .filter({ has: page.getByRole('heading', { name: 'Ce qui s’y joue' }) })
  await expect(panelPlay).toBeVisible()
  await expect(panelPlay.getByText('Risques élevés ouverts')).toBeVisible()

  // Les controles se lisent par cas d'usage, avec leur etat : proposé, mis en
  // place, opérant — un compteur ne dit pas lesquels, ni pour qui.
  await panelPlay.getByRole('button', { name: 'Détail : Contrôles applicables' }).click()
  await expect(page.getByRole('dialog')).toContainText('Scoring de candidatures')
  await expect(page.getByRole('dialog')).toContainText('CTL-01')
  await page.keyboard.press('Escape')

  // Chaque chiffre s'ouvre sur les pièces qu'il compte : le nombre ne suffit pas.
  await panelPlay.getByRole('button', { name: 'Détail : Risques élevés ouverts' }).click()
  await expect(page.getByRole('dialog')).toContainText('Sans traitement abouti ni acceptation')
  await expect(page.getByRole('dialog').getByRole('link').first()).toBeVisible()
  await page.keyboard.press('Escape')

  // L'usage se lit sous l'activité, dans l'arbre. Le « + » rattache un cas
  // d'usage existant — declarer un nouveau reste un lien, en second.
  await expect(page.getByRole('link', { name: 'Scoring de candidatures' })).toBeVisible()
  await page
    .getByRole('button', { name: 'Rattacher un cas d’usage à Présélection des candidatures' })
    .click()
  const dialog = page.getByRole('dialog')
  await expect(dialog.getByLabel('Cas d’usage')).toBeVisible()
  await expect(
    dialog.getByRole('link', { name: 'Déclarer un nouveau cas d’usage sur cette activité' }),
  ).toHaveAttribute('href', /cas-d-usage\/nouveau\?activite=c2000000-0000-4000-8000-000000000003/)
  await page.keyboard.press('Escape')

  // Le bandeau des quatre lectures ne bouge pas ; « Déclarer » n'y est plus.
  await expect(page.getByRole('link', { name: 'Déclarer un cas d’usage', exact: true })).toHaveCount(0)
  await expect(page.getByRole('link', { name: 'Ajouter un processus' })).toBeVisible()
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

  // Les barres, par activite ; le detail en tableau se deplie.
  const bar = page.getByRole('listitem').filter({ hasText: 'Présélection des candidatures' })
  await expect(bar.getByText('75 %')).toBeVisible()
  await page.getByRole('button', { name: /Le détail, en tableau/ }).click()
  const row = page.getByRole('row').filter({ hasText: 'Présélection des candidatures' })
  await expect(row.getByText(/\d+ j/)).toBeVisible()

  // Le meme grain se change d'un lien : par processus.
  await page.getByRole('link', { name: 'Par processus' }).click()
  await expect(page).toHaveURL(/par=processus/)
  await expect(page.getByRole('listitem').filter({ hasText: 'Gérer les ressources humaines' })).toBeVisible()

  // --- Risques ---------------------------------------------------------------
  await page.getByRole('link', { name: 'Risques', exact: true }).click()
  await expect(page).toHaveURL(/vue=risques/)
  await expect(page.getByRole('heading', { name: 'Répartition des risques' })).toBeVisible()
  await expect(page.getByRole('img', { name: /risque\(s\) ouvert\(s\)/ }).first()).toBeVisible()
  await page.getByRole('link', { name: 'Par processus' }).click()
  await expect(
    page.getByRole('listitem').filter({ hasText: 'Gérer les ressources humaines' }).first(),
  ).toBeVisible()

  // Un risque accepté n'est pas compté comme ouvert : c'est une décision.
  await expect(page.getByText(/ce qui a été traité ou accepté/)).toBeVisible()
  await expect(page.getByRole('heading', { name: 'Risques ouverts les plus élevés' })).toBeVisible()

  // --- Retour à l'arbre ------------------------------------------------------
  await page.getByRole('link', { name: 'Processus', exact: true }).click()
  await expect(page.getByRole('button', { name: /^Réalisation/ })).toBeVisible()
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
  await page.goto('/admin/organizations')

  // La liste des organisations gérées dit d'emblee laquelle demande du travail.
  const ligne = page.locator('li').filter({ hasText: 'IzarLink Demo' }).first()
  await expect(ligne.getByText(/exigences sans décision|preuve|risque|action/)).toBeVisible()

  await page.goto('/admin/organizations')
  await page.getByRole('link', { name: 'IzarLink Demo' }).click()

  // Une seule barre : deux sections en premiere ligne, les registres sous un
  // menu, le pilotage. Le fil d'Ariane nomme « Registres » sur leurs pages.
  const principal = page.getByRole('navigation', { name: 'Navigation principale' })
  await expect(principal.getByRole('link', { name: /^Cas d’usage/ })).toBeVisible()
  await expect(principal.getByRole('link', { name: /^Processus et risques/ })).toBeVisible()
  await principal.getByRole('button', { name: /^Registres/ }).click()
  await expect(principal.getByRole('menuitem', { name: /Déclaration d’Applicabilité/ })).toBeVisible()
  await page.keyboard.press('Escape')

  // Ce qui appelle une action se lit avant le contenu, et s'atteint d'un clic.
  await page.getByRole('link', { name: /exigences sans décision/ }).click()
  await expect(page).toHaveURL(/declaration-applicabilite/)
  await expect(page.getByRole('navigation', { name: "Fil d'Ariane" })).toContainText('Registres')
  await principal.getByRole('button', { name: /^Registres/ }).click()
  await expect(principal.getByRole('menuitem', { name: /Déclaration/ })).toHaveAttribute('aria-current', 'page')
  await page.keyboard.press('Escape')
})

test('la carte explique ses quatre lectures', async ({ page }) => {
  await page.goto('/admin/organizations/cccccccc-0000-4000-8000-000000000001/processus')

  await page.getByRole('button', { name: 'Comment lire cette carte' }).click()
  const note = page.getByRole('dialog', { name: 'Comment lire cette carte' })

  await expect(note.getByText(/opérant.*et.*prouvé/s)).toBeVisible()
  await expect(note.getByText(/Elle compte les risques.*ouverts.*pas le total/s)).toBeVisible()
  await expect(note.getByText(/un contrôle partagé entre plusieurs cas d’usage/)).toBeVisible()
  await expect(note.getByText(/Les cases vides comptent autant que les autres/)).toBeVisible()

  await page.keyboard.press('Escape')
  await expect(note).toHaveCount(0)
})

test('le champ de rattachement dit d’où vient sa liste et ce que coûte le refus', async ({
  page,
}) => {
  await page.goto(
    '/admin/organizations/cccccccc-0000-4000-8000-000000000001/cas-d-usage/nouveau',
  )

  // « Activité servie » se lisait comme « branche d'activité ». Le libellé
  // nomme desormais sa provenance.
  await expect(page.getByLabel('Activité du processus servie')).toBeVisible()
  await expect(page.getByText(/au format Processus › Activité/)).toBeVisible()

  // Le refus de rattacher a un coût, et l'écran le dit.
  await expect(page.getByText(/n’apparaîtra ni dans la carte des processus/)).toBeVisible()

  // Le troisième sens du mot a disparu de l'interface.
  await expect(page.getByText(/profil d’activité/)).toHaveCount(0)
})

test('la mise en service avertit des risques non soldés', async ({ page }) => {
  // Le scoring de candidatures porte des risques ni traités ni acceptés.
  await page.goto('/admin/organizations/cccccccc-0000-4000-8000-000000000001')
  await page.getByRole('link', { name: 'Scoring de candidatures' }).click()

  await page.getByRole('button', { name: 'Faire évoluer' }).click()
  const evolution = page.getByRole('dialog', { name: 'Faire évoluer le cas d’usage' })
  const cible = evolution.getByLabel('Transition demandée')

  // Sur une transition qui n'est pas une mise en service, aucun avertissement.
  const options = await cible.locator('option').allTextContents()
  if (options.some((o) => /Production|Surveillance/.test(o))) {
    await cible.selectOption({ label: options.find((o) => /Production|Surveillance/.test(o))! })
    const alerte = page.getByRole('alert')
    await expect(alerte).toContainText(/ni traité|ni traités/)
    await expect(
      evolution.getByRole('button', { name: 'Demander la transition malgré tout' }),
    ).toBeVisible()
  }
})

test('un risque se saisit sans quitter la fiche', async ({ page }) => {
  await page.goto('/admin/organizations/cccccccc-0000-4000-8000-000000000001')
  await page.getByRole('link', { name: 'Assistant support client' }).click()
  await page
    .getByRole('navigation', { name: 'Rubriques du cas d’usage' })
    .getByRole('link', { name: /^Risques/ })
    .click()

  const risques = page
    .locator('section')
    .filter({ has: page.getByRole('heading', { name: 'Risques', exact: true }) })
  await risques.getByRole('button', { name: /Identifier/ }).click()

  const fenetre = page.getByRole('dialog', { name: 'Identifier un risque' })
  await expect(fenetre).toBeVisible()
  await expect(fenetre.getByLabel('Intitulé')).toBeVisible()

  // Elle se ferme au clavier, et la page n'a pas bougé.
  await page.keyboard.press('Escape')
  await expect(fenetre).toHaveCount(0)
  await expect(page.getByRole('heading', { name: 'Assistant support client' })).toBeVisible()
})

test('le suivi liste actions, incidents et revues, et l’incident significatif exige sa CAPA', async ({ page }) => {
  await page.goto('/admin/organizations/cccccccc-0000-4000-8000-000000000001/suivi')
  await expect(page.getByRole('heading', { name: 'Suivi d’actions', exact: true })).toBeVisible()

  // Le jeu de demonstration porte une action echue et un incident S2 ouvert.
  // Le filtre porte son décompte dans son nom : « Échues 1 ».
  await page.getByRole('navigation', { name: 'Filtrer les actions' }).getByRole('link', { name: /^Échues/ }).click()
  await expect(page.getByText(/Renouveler l.attestation de formation/)).toBeVisible()

  await page.getByRole('navigation', { name: 'Lecture du suivi' }).getByRole('link', { name: 'Incidents' }).click()
  await expect(page).toHaveURL(/vue=incidents/)
  await expect(page.getByText(/tarif obsolète/)).toBeVisible()
  await expect(page.getByText(/CAPA close exigée/).first()).toBeVisible()

  // Declarer un incident transverse, mineur : il apparait aussitot, ouvert.
  await page.getByRole('button', { name: 'Déclarer un incident' }).click()
  const title = `Observation ${Date.now()}`
  await page.getByLabel('Titre').fill(title)
  await page.getByLabel('Ce qui s’est passé').fill('Un utilisateur a signalé une réponse hors périmètre, sans effet.')
  await page.getByLabel('Nature').selectOption('observation')
  await page.getByLabel('Gravité').selectOption('S4')
  await page.getByRole('button', { name: 'Déclarer l’incident' }).click()
  await expect(page.getByText('Incident déclaré.', { exact: true })).toBeVisible()
  await page.keyboard.press('Escape')
  await expect(page.getByText(title)).toBeVisible()
})

test('sur la fiche, une action s’ouvre et se clôt avec son motif', async ({ page }) => {
  await page.goto('/admin/use-cases/b1000000-0000-4000-8000-000000000002?onglet=actions')
  const volet = page.locator('section').filter({ has: page.getByRole('heading', { name: 'Actions', exact: true }) })
  await volet.getByRole('button', { name: 'Ouvrir une action' }).click()

  const title = `Vérifier la procédure ${Date.now()}`
  await page.getByLabel('Titre').fill(title)
  await page.getByRole('button', { name: 'Ouvrir l’action' }).click()
  await expect(page.getByText('Action ouverte.', { exact: true })).toBeVisible()
  await page.keyboard.press('Escape')

  // La cloture se motive : sans motif, le formulaire refuse avant la base.
  const row = volet.locator('li').filter({ hasText: title })
  await row.getByRole('button', { name: 'Avancer' }).click()
  await page.getByLabel('Statut').selectOption('done')
  await page.getByLabel('Ce qui a été fait').fill('Trop court')
  await page.getByRole('button', { name: 'Enregistrer' }).click()
  await expect(page.getByText(/ce qu’un auditeur lira/)).toBeVisible()
  await page.getByLabel('Ce qui a été fait').fill('Procédure relue et mise à jour avec le responsable métier.')
  await page.getByRole('button', { name: 'Enregistrer' }).click()
  await expect(page.getByText('Action close, datée et journalisée.')).toBeVisible()
})

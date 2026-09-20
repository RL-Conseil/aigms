import { expect, test } from '@playwright/test'

/**
 * Registre de decisions.
 *
 * La piece que la page commerciale presente comme le differenciateur, et dont
 * le socle serveur attendait son ecran depuis la migration 0010. Le parcours
 * verifie ce qui fait sa valeur : la separation des roles, prononcee par la
 * base et non par l'ecran.
 */

const OFFICER = { email: 'officer@rl-conseil.demo', password: 'Demo!Passw0rd' }
// Se prononcer releve de `app.roles_review()` : officer, client_admin,
// reviewer. Un responsable du risque cote et accepte des risques, il ne tranche
// pas les decisions de gouvernance.
const REVIEWER = { email: 'reviewer@izarlink.demo', password: 'Demo!Passw0rd' }
const ORG = 'cccccccc-0000-4000-8000-000000000001'

async function signIn(page: import('@playwright/test').Page, who: typeof OFFICER) {
  // Une session ouverte renvoie l'accueil vers l'espace de travail : il n'y a
  // plus de mire ou saisir. Changer de compte suppose donc de la fermer.
  await page.context().clearCookies()
  await page.goto('/')
  await page.getByLabel('Adresse électronique').fill(who.email)
  await page.getByLabel('Mot de passe').fill(who.password)
  await page.getByRole('button', { name: 'Se connecter' }).click()
  await expect(page.getByRole('heading', { name: /Pilotage|Organisations gérées/ })).toBeVisible()
}

test('le registre rassemble les décisions, transverses comprises', async ({ page }) => {
  await signIn(page, OFFICER)
  await page.goto(`/admin/organizations/${ORG}/decisions`)

  await expect(page.getByRole('heading', { name: 'Registre de décisions' })).toBeVisible()
  await expect(page.getByText('Sans élément probant')).toBeVisible()

  // Le filtre mène aux décisions qui attendent quelqu'un.
  const filtre = page.getByRole('navigation', { name: 'Filtrer par état' })
  await filtre.getByRole('link', { name: /En vigueur/ }).click()
  await expect(page).toHaveURL(/etat=en-vigueur/)
})

test('l’auteur d’une mise en production ne peut pas l’approuver', async ({ page }) => {
  await signIn(page, OFFICER)
  await page.goto(`/admin/organizations/${ORG}/decisions/nouvelle`)

  const objet = `Mise en production de test ${Date.now().toString().slice(-6)}`
  await page.getByLabel('Type de décision').selectOption('go_production')

  // Le formulaire annonce la règle avant la saisie, pas après le refus.
  await expect(page.getByText(/vous ne pourrez\s+pas l’approuver vous-même/)).toBeVisible()

  await page.getByLabel('Objet').fill(objet)
  // Une decision transverse : sans cas d'usage, pas de jalon a verifier.
  await page.getByLabel('Cas d’usage concerné').selectOption('')
  await page.getByLabel('Contexte').fill('Le pilote est terminé et le comité demande la mise en service.')
  await page
    .getByLabel('Ce qui est décidé')
    .fill('Mise en service de l’assistant sur le périmètre du support niveau 1.')
  await page
    .getByLabel('Justification')
    .fill('Préconditions réunies, revue d’échantillon prévue pendant trois mois.')
  // Une mise en production s'appuie sur une preuve validee : la premiere.
  await page.getByRole('checkbox', { name: /EVD-/ }).first().check()
  await page.getByRole('button', { name: 'Soumettre la décision' }).click()
  await expect(page.getByRole('status')).toContainText('Décision soumise')

  // Le même compte tente de se prononcer : la base refuse.
  await page.goto(`/admin/organizations/${ORG}/decisions?etat=a-instruire`)
  const ligne = page.locator('li').filter({ hasText: objet }).first()
  await ligne.getByRole('button', { name: 'Se prononcer' }).click()

  const verdict = page.getByRole('dialog', { name: 'Se prononcer sur la décision' })
  await verdict.getByLabel('Motif du verdict').fill('Les préconditions sont réunies, j’approuve.')
  await verdict.getByLabel('Date d’effet').fill('2026-12-01')
  await verdict.getByLabel('Date de revue').fill('2027-06-01')
  await verdict.getByRole('button', { name: 'Enregistrer le verdict' }).click()

  await expect(verdict.getByText(/Séparation des rôles/)).toBeVisible()
})

test('une autre personne peut se prononcer', async ({ page }) => {
  // Le parcours est autonome : il soumet sa propre decision, puis change de
  // compte. Dependre de l'etat laisse par un autre test rend l'echec illisible.
  const objet = `Acceptation de risque ${Date.now().toString().slice(-6)}`

  await signIn(page, OFFICER)
  await page.goto(`/admin/organizations/${ORG}/decisions/nouvelle`)
  await page.getByLabel('Type de décision').selectOption('risk_acceptance')
  await page.getByLabel('Objet').fill(objet)
  await page.getByLabel('Contexte').fill('Le fournisseur de modèle ne peut pas être remplacé à court terme.')
  await page
    .getByLabel('Ce qui est décidé')
    .fill('Le risque de dépendance au fournisseur est accepté pour douze mois.')
  await page
    .getByLabel('Justification')
    .fill('Mode dégradé manuel documenté et réversibilité contractuelle vérifiée.')
  await page.getByRole('button', { name: 'Soumettre la décision' }).click()
  await expect(page.getByRole('status')).toContainText('Décision soumise')

  // Un autre role tranche : c'est tout l'objet de la separation.
  await signIn(page, REVIEWER)
  // Depuis le registre complet : sous le filtre « à instruire », la ligne quitte
  // la liste des qu'elle est tranchee, et la confirmation part avec elle.
  await page.goto(`/admin/organizations/${ORG}/decisions`)

  const ligne = page.locator('li').filter({ hasText: objet }).first()
  await expect(ligne).toBeVisible()
  await ligne.getByRole('button', { name: 'Se prononcer' }).click()

  const verdict = page.getByRole('dialog', { name: 'Se prononcer sur la décision' })
  await verdict.getByLabel('Motif du verdict').fill('Préconditions vérifiées, j’approuve.')
  await verdict.getByLabel('Date d’effet').fill('2026-12-01')
  await verdict.getByLabel('Date de revue').fill('2027-06-01')
  await verdict.getByRole('button', { name: 'Enregistrer le verdict' }).click()

  // La confirmation survit a la revalidation, qui retire pourtant le bouton.
  await expect(page.getByRole('status')).toContainText(/approuvée en votre nom/)

  // Et l'effet est bien la, pas seulement le message.
  await page.goto(`/admin/organizations/${ORG}/decisions`)
  const tranchee = page.locator('li').filter({ hasText: objet }).first()
  await expect(tranchee.getByText('Approuvée', { exact: true })).toBeVisible()
  await expect(tranchee.getByText(/approuvée le/)).toBeVisible()
})

test('une approbation sous conditions énonce ses conditions', async ({ page }) => {
  await signIn(page, OFFICER)
  await page.goto(`/admin/organizations/${ORG}/decisions?etat=a-instruire`)

  const ligne = page.locator('li').filter({ hasText: /DEC-IA-/ }).first()
  if (await ligne.count()) {
    await ligne.getByRole('button', { name: 'Se prononcer' }).click()
    const verdict = page.getByRole('dialog', { name: 'Se prononcer sur la décision' })

    // Le champ n'apparaît que lorsqu'il devient exigible.
    await expect(verdict.getByLabel('Conditions')).toHaveCount(0)
    // « Motif du verdict » contient aussi le mot : on vise l'etiquette exacte.
    await verdict.getByLabel('Verdict', { exact: true }).selectOption('approved_with_conditions')
    await expect(verdict.getByLabel('Conditions')).toBeVisible()
  }
})

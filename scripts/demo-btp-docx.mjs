#!/usr/bin/env node
/**
 * Le script de demonstration BTP, en Word.
 * Le Markdown fait foi ; ceci en est la remise, pour la presentation.
 */
import { readFileSync, writeFileSync } from 'node:fs'
import { createRequire } from 'node:module'
const require = createRequire('/tmp/claude-1000/tools/')
const {
  AlignmentType, Document, HeadingLevel, ImageRun, Packer, Paragraph,
  Table, TableCell, TableRow, TextRun, WidthType, BorderStyle, ShadingType,
} = require('docx')

const IMG = 'docs/commercial/images'
const FONT = 'Calibri'
const GRID = { style: BorderStyle.SINGLE, size: 4, color: 'BFBFBF' }
const BORDERS = { top: GRID, bottom: GRID, left: GRID, right: GRID }

const t = (text, o = {}) => new TextRun({ text, font: FONT, size: o.size ?? 20, bold: o.bold, italics: o.italics, color: o.color })
const p = (text, o = {}) => new Paragraph({ children: [t(text, o)], spacing: { after: o.after ?? 120 }, alignment: o.align })
const h = (text, level = HeadingLevel.HEADING_1) => new Paragraph({
  heading: level, spacing: { before: 300, after: 140 },
  children: [t(text, { bold: true, size: level === HeadingLevel.HEADING_1 ? 28 : 24, color: '0C2036' })],
})
const puce = (text, o = {}) => new Paragraph({ children: [t(text, o)], bullet: { level: 0 }, spacing: { after: 80 } })

/** Ce qu'il faut dire, encadre : c'est ce qu'on relit avant d'entrer. */
const insister = (text) => new Paragraph({
  children: [t('À dire : ', { bold: true, color: '09AEAE' }), t(text, { italics: true })],
  spacing: { before: 120, after: 160 },
  shading: { type: ShadingType.CLEAR, fill: 'E8F8F8' },
  border: { left: { style: BorderStyle.SINGLE, size: 18, color: '09AEAE', space: 8 } },
})

const cell = (value, o = {}) => new TableCell({
  borders: BORDERS,
  shading: o.header ? { type: ShadingType.CLEAR, fill: '0C2036' }
    : o.saisie ? { type: ShadingType.CLEAR, fill: 'F2F6FA' } : undefined,
  margins: { top: 60, bottom: 60, left: 100, right: 100 },
  children: (Array.isArray(value) ? value : [value]).map((l) =>
    new Paragraph({ children: [t(l, { size: 18, bold: o.header, color: o.header ? 'FFFFFF' : undefined })] })),
})
const table = (rows) => new Table({ width: { size: 100, type: WidthType.PERCENTAGE }, rows })
const ligne = (cells, o = {}) => new TableRow({ children: cells.map((c) => cell(c, o)) })

function figure(nom, legende) {
  const data = readFileSync(`${IMG}/${nom}.png`)
  const width = data.readUInt32BE(16)
  const height = data.readUInt32BE(20)
  const w = 620
  return [
    new Paragraph({ alignment: AlignmentType.CENTER, spacing: { before: 200, after: 60 },
      children: [new ImageRun({ data, type: 'png', transformation: { width: w, height: Math.round((height / width) * w) } })] }),
    new Paragraph({ alignment: AlignmentType.CENTER, spacing: { after: 220 },
      children: [t(legende, { size: 16, italics: true, color: '595959' })] }),
  ]
}

/** Une etape : titre, ou l'on est, ce qu'on saisit, ce qu'on dit. */
const etape = (num, nom, duree, ou, saisies, aDire) => [
  h(`Étape ${num} — ${nom}`, HeadingLevel.HEADING_2),
  new Paragraph({ spacing: { after: 100 }, children: [
    t(`${duree}  ·  `, { bold: true, color: '09AEAE', size: 18 }), t(ou, { size: 18, color: '535C66' }),
  ]}),
  ...(saisies.length ? [table([ligne(['Champ', 'À saisir'], { header: true }),
    ...saisies.map((s) => ligne(s, { saisie: true }))]), p('')] : []),
  insister(aDire),
]

const doc = new Document({
  creator: 'AIGMS — CARITIS',
  title: 'Script de démonstration — Shadow AI dans le BTP',
  styles: { default: { document: { run: { font: FONT, size: 20 } } } },
  sections: [{
    properties: { page: { margin: { top: 1000, bottom: 1000, left: 900, right: 900 } } },
    children: [
      new Paragraph({ alignment: AlignmentType.CENTER, spacing: { after: 80 },
        children: [t('Script de démonstration', { bold: true, size: 36, color: '0C2036' })] }),
      new Paragraph({ alignment: AlignmentType.CENTER, spacing: { after: 60 },
        children: [t('Shadow AI dans le BTP — la génération de devis', { size: 26, color: '09AEAE' })] }),
      new Paragraph({ alignment: AlignmentType.CENTER, spacing: { after: 280 },
        children: [t('BATIVAL Construction · 12 minutes, 15 avec l’option · Version 1, 25 septembre 2026', { size: 18, italics: true, color: '595959' })] }),

      p('Des commerciaux génèrent leurs devis sur des comptes ChatGPT personnels, en y versant d’anciens devis, des grilles de prix fournisseurs et des marges.'),
      p('Cette démonstration ne montre pas des écrans. Elle montre une chaîne de responsabilité qui se termine par un courriel qu’une personne nommée reçoit, lit et assume — en direct, devant le prospect.', { bold: true }),

      ...figure('btp-1-avant-apres', 'Ce que le prospect vit aujourd’hui, et ce qu’AIGMS en fait'),

      h('1. Ce qui est déjà en place'),
      p('Rien de cette section ne se déroule devant le prospect. C’est le décor, monté à l’avance — il est déjà dans la base de démonstration.', { bold: true }),

      h('La société', HeadingLevel.HEADING_2),
      table([
        ligne(['Raison sociale', 'BATIVAL Construction SAS (fictive)'], {}),
        ligne(['Secteur', 'Bâtiment et travaux publics']),
        ligne(['Effectif', '340 salariés, Bordeaux']),
        ligne(['Rôle vis-à-vis de l’IA', 'Exploitant de solution tierce']),
      ]),
      p(''),
      p('Ce dernier point commande tout le reste : BATIVAL n’entraîne aucun modèle. AIGMS ne lui demandera donc aucune preuve de code, d’apprentissage ou de jeu de données — seulement des preuves d’usage, de contrat et de surveillance. C’est exactement ce que dit la fiche de conformité du prospect.'),
      insister('Votre outil ne va pas vous demander ce que vous ne pouvez pas produire.'),

      h('Les huit comptes', HeadingLevel.HEADING_2),
      p('Mot de passe commun : Demo!Passw0rd'),
      table([
        ligne(['Adresse', 'Nom', 'Rôle', 'Dans la démonstration'], { header: true }),
        ligne(['admin@aigms.eu', 'Inès Duhamel', 'Administrateur de la plateforme', 'Ouvre les accès. Ne gouverne rien']),
        ligne(['officer@aigms.eu', 'Camille Rousset', 'AI Governance Officer', 'Conduit les étapes 1 à 8']),
        ligne(['dsi-admin@aigms.eu', 'Marc Lecomte', 'Administrateur client', 'Reçoit le courriel et approuve']),
        ligne(['devsecops@aigms.eu', 'Dominique Etchart', 'Porteur de l’IA', 'Accepte les risques résiduels']),
        ligne(['risk-comity@aigms.eu', 'Sacha Belarbi', 'Comité des risques', 'Répond du risque coté']),
        ligne(['rssi@aigms.eu', 'Yann Cazaux', 'Expert métier (DPO / RSSI)', 'Cité, non sollicité']),
        ligne(['direction@aigms.eu', 'Élodie Marchetti', 'Comité de direction', 'Citée, non sollicitée']),
        ligne(['audit@aigms.eu', 'Noa Lasserre', 'Auditeur', 'Cité, non sollicité']),
      ]),
      p(''),
      p('Ce sont les mêmes personnes que sur l’autre organisation de démonstration. Ce n’est pas un raccourci : une adresse de courriel ne porte qu’une identité, et c’est la réalité d’un cabinet — un officer, plusieurs clients. Si le prospect le remarque, c’est une occasion : ouvrez le Pilotage, il verra le portefeuille entier sur un écran.'),

      h('À vérifier dix minutes avant', HeadingLevel.HEADING_2),
      puce('Les deux organisations apparaissent dans le menu utilisateur.'),
      puce('La boîte dsi-admin@aigms.eu est ouverte dans un onglet, déjà connectée.'),
      puce('Un second navigateur est prêt : basculer d’identité est le geste le plus lent de la démonstration.'),

      h('2. Le fil — huit gestes'),
      ...figure('btp-2-parcours', 'Chaque étape a un acteur nommé. C’est ce qui distingue un registre d’un tableur'),

      ...etape('1', 'Déclarer l’usage', '1 min 30',
        'officer@aigms.eu · se placer sur BATIVAL Construction · Cas d’usage → Déclarer un cas d’usage',
        [
          ['Nom', 'Génération de devis par IA générative'],
          ['Finalité', 'Rédiger les devis clients à partir d’anciens devis et des grilles de prix fournisseurs, pour réduire le délai de réponse aux appels d’offres.'],
          ['Processus métier', 'Commercial — réponse aux appels d’offres'],
          ['Bénéfice attendu', 'Délai de réponse divisé par deux'],
          ['Porteur de l’IA', 'Dominique Etchart'],
          ['Responsable redevable', 'Marc Lecomte'],
          ['Utilisateurs', 'Les quatorze commerciaux et chargés d’affaires'],
          ['Personnes concernées', 'Les clients, dont les devis portent les coordonnées'],
          ['Données traitées', 'Anciens devis, grilles de prix fournisseurs, marges, coordonnées clients'],
          ['Niveau d’autonomie', 'L1 — il propose, un humain valide'],
        ],
        'Je déclare un usage que personne n’a autorisé, qui tourne déjà, et dont la direction ignore l’existence. Le registre ne l’interdit pas : il le rend visible. On n’encadre que ce qu’on a nommé.'),

      ...etape('2', 'Trier : la criticité', '1 min 30',
        'Onglet Avancement → carte Criticité → la grille',
        [
          ['Qui subit une erreur du système ?', 'Des clients ou partenaires identifiés'],
          ['Une erreur se rattrape…', 'Avec un coût ou un délai'],
          ['Que fait le système de sa sortie ?', 'Il propose : un humain valide chaque cas'],
          ['Quelles données traite-t-il ?', 'Des données personnelles'],
          ['Criticité retenue', 'Élevée'],
          ['Justification', 'Un devis erroné engage l’entreprise sur un prix. Les données versées sortent du périmètre contractuel.'],
        ],
        'Regardez ce que la dernière réponse vient de faire. Elle n’a pas seulement calculé un niveau : elle a écrit un fait sur la fiche. À partir de maintenant, l’étude d’impact est exigée, l’AIPD se pré-coche, et les contrôles de protection des données se proposent d’eux-mêmes. La grille ne décore pas, elle déclenche.'),

      ...etape('3', 'Qualifier au regard du règlement', '1 min',
        'Onglet Avancement → Qualification réglementaire',
        [
          ['Rôle de l’organisation', 'Déployeur'],
          ['Cases à cocher', 'Impact sur la vie privée · Fournisseur hors Union européenne'],
          ['Justification', 'BATIVAL exploite une solution tierce. Il ne répond pas de l’entraînement du modèle, mais de l’usage qu’il en fait et des données qu’il y verse.'],
        ],
        'AIGMS ne décide pas de votre qualification. Il l’enregistre, avec son motif, sa date et son auteur. Le jour où une autorité pose la question, vous n’avez pas à vous souvenir : vous ouvrez la fiche.'),

      ...etape('4', 'Coter le risque', '1 min 30',
        'Onglet Risques → Ajouter un risque',
        [
          ['Titre', 'Fuite de données commerciales vers un tiers'],
          ['Description', 'Devis, marges et prix fournisseurs versés dans un service public, hors contrat, potentiellement réutilisés pour l’entraînement du modèle.'],
          ['Vraisemblance', 'Probable'],
          ['Gravité', 'Majeure'],
          ['Qui répond de ce risque', 'Sacha Belarbi'],
          ['Niveau inhérent obtenu', 'Critique'],
        ],
        'Le risque n’est pas une ligne dans un tableur. Il appelle des contrôles, et il retiendra la mise en production tant qu’il n’est ni traité ni accepté par quelqu’un qui en répond.'),

      h('Étape 5 — Retenir les contrôles, et dire avec quoi ils se tiennent', HeadingLevel.HEADING_2),
      new Paragraph({ spacing: { after: 100 }, children: [
        t('2 min  ·  ', { bold: true, color: '09AEAE', size: 18 }),
        t('Onglet Contrôles affectés → « Laisser l’assistant proposer »', { size: 18, color: '535C66' }),
      ]}),
      p('L’assistant rend 44 propositions, en deux groupes : déclenchées par les faits que vous venez de déclarer, et socle attendues de tout cas d’usage. Vous n’en retenez que quatre — celles qui répondent à la fiche du prospect.'),
      insister('Quarante-quatre propositions, et je n’en garde que quatre. Un outil qui vous en impose quarante-quatre vous fait abandonner au bout de trois. Ici, c’est l’officer qui retient, et le référentiel n’est jamais modifié.'),

      h('Les quatre à cocher dans la liste', HeadingLevel.HEADING_3),
      table([
        ligne(['Code', 'Intitulé', 'Groupe', 'Pourquoi il est proposé'], { header: true }),
        ligne(['AIGMS-SUP-005', 'Utilisation des données par le fournisseur', 'déclenchée',
               'Des données personnelles transitent chez un fournisseur : leur usage se borne.'], { saisie: true }),
        ligne(['AIGMS-SEC-008', 'Prévention de l’exfiltration de données', 'déclenchée',
               'Des données personnelles sont mobilisées : le système ne doit pas les laisser sortir.'], { saisie: true }),
        ligne(['AIGMS-SEC-006', 'Journalisation de sécurité des systèmes d’IA', 'socle, obligatoire',
               'Attendu de tout cas d’usage.'], { saisie: true }),
        ligne(['AIGMS-HUM-001', 'Niveau de supervision humaine', 'socle, obligatoire',
               'Attendu de tout cas d’usage.'], { saisie: true }),
      ]),
      p(''),
      insister('Les deux premières lignes sont marquées « déclenchée », avec leur motif écrit en clair. Personne n’a coché une case pour les faire apparaître : elles sont là parce que j’ai répondu « données personnelles » dans la grille de criticité, il y a quatre minutes.'),

      h('Le cinquième ne se trouve pas dans les propositions', HeadingLevel.HEADING_3),
      p('AIGMS-GOV-008 — Politique d’usage acceptable de l’IA porte la charte signée qu’exige la fiche du prospect. Il n’est pas proposé : le moteur le range au socle de l’organisation, pas du cas d’usage.'),
      table([
        ligne(['Où aller', 'Registres → Contrôles et outillages → Ajouter un contrôle → onglet « Depuis le référentiel »'], { saisie: true }),
        ligne(['Comment le trouver', 'Filtrer le domaine GOV — Gouvernance, ou taper GOV-008 dans la recherche'], { saisie: true }),
        ligne(['Ce que contient le catalogue', '120 contrôles-types du référentiel AIGMS-CF v0.4, dont 12 en GOV'], { saisie: true }),
      ]),
      p(''),
      insister('L’assistant propose ; il ne décide pas. Ce qui relève de la politique d’entreprise ne se déduit pas d’un cas d’usage — c’est l’officer qui l’inscrit.'),

      h('Statuer l’applicabilité, puis déclarer l’outillage', HeadingLevel.HEADING_3),
      p('De retour sur la fiche, onglet Contrôles affectés : chaque ligne porte un crayon à gauche du code. Statuez Applicable sur les quatre — la justification n’est obligatoire que pour une exclusion.'),
      table([
        ligne(['Famille d’outillage', 'Produit à déclarer', 'Le contrôle qui la retient'], { header: true }),
        ligne(['Passerelle d’appels IA (AI Gateway)', 'ChatGPT Enterprise', 'AIGMS-SUP-005'], { saisie: true }),
        ligne(['Prévention des fuites (DLP)', 'Netskope', 'AIGMS-SEC-008'], { saisie: true }),
        ligne(['Journalisation (SIEM)', 'Splunk', 'AIGMS-SEC-006'], { saisie: true }),
      ]),
      p(''),
      p('AIGMS-SEC-008 affiche déjà les familles attendues — AI Gateway et DLP — avant même que vous ayez rien déclaré.'),
      insister('Votre référentiel dit « ce contrôle se tient avec un outil de prévention des fuites ». C’est une typologie : elle dit où chercher, pas ce que vous employez. Ici, le contrôle dit « se tient avec Netskope, chez nous » — et l’auditeur sait où aller prendre la preuve.'),

      ...etape('6', 'Produire une preuve', '1 min 30',
        'Retour sur le cas d’usage → onglet Contrôles affectés',
        [
          ['1. Montrer', 'L’en-tête du groupe : « 4 applicables · 4 sans preuve »'],
          ['2. Filtrer', 'Cocher Sans preuve — la liste se réduit'],
          ['3. Ouvrir', 'L’icône de pièce, rouge, sur le contrôle d’encadrement'],
          ['Titre de la preuve', 'Charte d’utilisation de l’IA générative — version 1'],
          ['Typologie', 'Politique / charte'],
          ['Valide jusqu’au', 'Dans douze mois'],
        ],
        'Faites remarquer l’icône qui passe au vert et le compte qui descend à 3. Le contrôle n’est pas tenu parce qu’on l’a déclaré opérant : il est tenu parce qu’une pièce validée et non échue le démontre. C’est la même règle partout dans l’outil.'),

      ...etape('7', 'Conduire l’étude d’impact', '2 min',
        'Cas d’usage → Conduire une étude d’impact IA, puis bascule sur devsecops@aigms.eu',
        [
          ['Parties prenantes', 'Clients (environ 900 devis par an) · Commerciaux'],
          ['Constat', 'Prix ou normes obsolètes dans un devis émis'],
          ['Gravité · vraisemblance', 'Sévère · probable — un constat sévère ouvre une action bloquante'],
          ['Mesure', 'Relecture humaine obligatoire avant envoi, échéance à trente jours'],
          ['Officer', 'Viser la méthode'],
          ['Porteur (Dominique Etchart)', 'Accepter les risques résiduels : « J’assume l’écart sous relecture systématique, avec audit trimestriel. »'],
        ],
        'Deux actes, deux signataires. L’officer atteste que l’étude est bien conduite ; le porteur dit que l’organisation assume ce qui reste. La base refuse que la même personne pose les deux — ce n’est pas un réglage d’écran.'),

      h('Étape 8 — Décider : le moment qui emporte la décision', HeadingLevel.HEADING_2),
      new Paragraph({ spacing: { after: 100 }, children: [
        t('2 min 30  ·  ', { bold: true, color: '09AEAE', size: 18 }),
        t('officer@aigms.eu → onglet Décisions → Soumettre une décision → Mise en production', { size: 18, color: '535C66' }),
      ]}),
      ...figure('btp-3-ecart-de-preuve', 'Une mise en production à laquelle il manque des preuves : AIGMS ne l’interdit pas, il la fait assumer'),
      p('Le formulaire affiche l’écart : les contrôles applicables sans preuve, nommés par leur code. Il exige que vous disiez ce qu’il en est.'),
      table([
        ligne(['Champ', 'À saisir'], { header: true }),
        ligne(['Ce que vous en dites', 'Charte signée le 12/11. Console Enterprise livrée, option de rétention désactivée. Passerelle DLP en recette, bascule prévue le 30/11.'], { saisie: true }),
        ligne(['Personne appelée à se prononcer', 'Marc Lecomte — proposé par défaut : c’est la DSI côté client qui met en service'], { saisie: true }),
      ]),
      p(''),
      h('Maintenant, ouvrez la boîte de réception', HeadingLevel.HEADING_2),
      p('dsi-admin@aigms.eu a reçu le courriel sur-le-champ — pas à la prochaine tâche planifiée. Il porte les codes des contrôles manquants et votre phrase de remédiation.'),
      insister('Laissez le silence s’installer. Ce n’est pas une maquette. Ce message est parti il y a quinze secondes.'),
      h('Puis connectez-vous en dsi-admin@aigms.eu', HeadingLevel.HEADING_2),
      puce('Mes alertes → la décision l’attend'),
      puce('Il lit l’écart et la parole de l’officer'),
      puce('Il coche « J’ai pris connaissance de cet écart de preuve et l’assume en approuvant »'),
      puce('Il approuve'),
      insister('Sans cette case, la base refuse l’approbation — pas l’écran, la base. Et l’écart reste au dossier, figé tel qu’il était au moment de la soumission : une preuve déposée demain ne réécrit pas ce que Marc a lu aujourd’hui. Voilà ce que vous pourrez montrer à un auditeur.'),

      h('3. Option — si le temps le permet'),
      p('1 min 30 · admin@aigms.eu → Organisations → BATIVAL Construction → Administration → carte « Preuves exigées à la mise en production ».'),
      p('Posez une date à moins de trente jours, puis enregistrez. Trois choses partent immédiatement : l’officer et l’Administrateur client sont avertis, chaque cas d’usage qui porte un écart reçoit sa relance nominative, et deux rappels sont posés à J-30 et J-7. La date étant proche, le rappel J-30 est déjà dû : il se lit tout de suite dans Mes alertes.'),
      insister('Jusqu’ici l’écart s’assumait. À partir de cette date, il retient la mise en production. Vous fixez la date, pas nous — c’est un engagement, il se négocie.'),

      h('4. Les quatre preuves de votre fiche, et où elles atterrissent'),
      ...figure('btp-4-quatre-preuves', 'La fiche de conformité du prospect devient une liste de contrôles, chacun avec sa pièce'),
      table([
        ligne(['Preuve exigée', 'Criticité', 'Référence', 'Dans AIGMS'], { header: true }),
        ligne(['Charte d’usage signée', 'Critique', 'ISO 42001 A.5', 'AIGMS-GOV-008 — Politique d’usage acceptable']),
        ligne(['Console Enterprise, rétention désactivée', 'Critique', 'A.7.2 · ISO 27001 A.18', 'AIGMS-SUP-005 — Utilisation des données par le fournisseur']),
        ligne(['Journaux de la passerelle DLP', 'Élevé', 'A.10.6 · AI Act art. 12', 'AIGMS-SEC-008 + AIGMS-SEC-006']),
        ligne(['Rapport d’AIIA signé', 'Critique', 'ISO 42001 6.1.2', 'Étude d’impact + AIGMS-HUM-001']),
      ]),

      h('5. Ce qu’il ne faut pas faire'),
      puce('Dérouler l’administration devant le prospect : créer une organisation et déclarer huit comptes ne démontre rien et coûte cinq minutes.'),
      puce('Promettre un connecteur qui n’existe pas. Ce qui se voit à l’écran est ce qui fonctionne ; le reste se dit au conditionnel.'),
      puce('Parler de certification. AIGMS aide au cadrage, à la pré-classification, à la documentation et à la preuve. Il ne remplace ni un avis juridique, ni la décision d’un responsable, ni un audit.'),
      puce('Improviser une bascule de compte : c’est le geste le plus lent. Deux navigateurs, préparés à l’avance.'),

      h('6. Après la démonstration'),
      p('Le cas d’usage créé reste dans BATIVAL Construction. Pour repartir d’une organisation vierge, supprimez-le depuis sa fiche.'),
      p('Ne touchez jamais à IzarLink Demo : elle porte le jeu de données complet dont dépendent les autres démonstrations et les tests automatisés.', { bold: true }),
    ],
  }],
})

writeFileSync('docs/commercial/SCRIPT_DEMO_BTP_SHADOW_AI.docx', await Packer.toBuffer(doc))
console.log('SCRIPT_DEMO_BTP_SHADOW_AI.docx écrit')

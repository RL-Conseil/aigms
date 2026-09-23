#!/usr/bin/env node
/**
 * L'architecture d'identite, en Word.
 * Le Markdown fait foi (docs/architecture/IDENTITE_V1.md) ; ceci en est la
 * remise, pour IZARRALDE.
 */
import { readFileSync, writeFileSync } from 'node:fs'
import {
  AlignmentType, Document, HeadingLevel, ImageRun, Packer, Paragraph,
  Table, TableCell, TableRow, TextRun, WidthType, BorderStyle, ShadingType,
} from 'docx'

const IMG = 'docs/architecture/images'
const FONT = 'Calibri'
const GRID = { style: BorderStyle.SINGLE, size: 4, color: 'BFBFBF' }
const BORDERS = { top: GRID, bottom: GRID, left: GRID, right: GRID }

const t = (text, o = {}) => new TextRun({ text, font: FONT, size: o.size ?? 20, bold: o.bold, italics: o.italics, color: o.color })
const p = (text, o = {}) => new Paragraph({ children: [t(text, o)], spacing: { after: o.after ?? 120 }, alignment: o.align })
const h = (text, level = HeadingLevel.HEADING_1) => new Paragraph({
  heading: level, spacing: { before: 280, after: 140 },
  children: [t(text, { bold: true, size: level === HeadingLevel.HEADING_1 ? 28 : 24, color: '1F3864' })],
})
const puce = (text) => new Paragraph({ children: [t(text)], bullet: { level: 0 }, spacing: { after: 80 } })
const cell = (value, o = {}) => new TableCell({
  borders: BORDERS,
  shading: o.header ? { type: ShadingType.CLEAR, fill: '1F3864' } : o.alerte ? { type: ShadingType.CLEAR, fill: 'FCE4D6' } : o.bon ? { type: ShadingType.CLEAR, fill: 'E2EFDA' } : undefined,
  margins: { top: 60, bottom: 60, left: 100, right: 100 },
  children: (Array.isArray(value) ? value : [value]).map((l) =>
    new Paragraph({ children: [t(l, { size: 18, bold: o.header, color: o.header ? 'FFFFFF' : undefined })] })),
})
const table = (rows) => new Table({ width: { size: 100, type: WidthType.PERCENTAGE }, rows })
const ligne = (cells, o = {}) => new TableRow({ children: cells.map((c) => cell(c, o)) })

function figure(nom, legende, lien) {
  const data = readFileSync(`${IMG}/${nom}.png`)
  const width = data.readUInt32BE(16)
  const height = data.readUInt32BE(20)
  const w = 620
  return [
    new Paragraph({ alignment: AlignmentType.CENTER, spacing: { before: 160, after: 60 },
      children: [new ImageRun({ data, type: 'png', transformation: { width: w, height: Math.round((height / width) * w) } })] }),
    new Paragraph({ alignment: AlignmentType.CENTER, spacing: { after: 200 },
      children: [t(legende, { size: 16, italics: true, color: '595959' }), t(` — ${lien}`, { size: 13, color: '7F7F7F' })] }),
  ]
}

const doc = new Document({
  creator: 'AIGMS',
  title: 'Architecture d’identité AIGMS',
  styles: { default: { document: { run: { font: FONT, size: 20 } } } },
  sections: [{
    properties: { page: { margin: { top: 1000, bottom: 1000, left: 900, right: 900 } } },
    children: [
      new Paragraph({ alignment: AlignmentType.CENTER, spacing: { after: 80 },
        children: [t('Architecture d’identité AIGMS', { bold: true, size: 36, color: '1F3864' })] }),
      new Paragraph({ alignment: AlignmentType.CENTER, spacing: { after: 240 },
        children: [t('Un annuaire par client, un AI Governance Officer, 40 à 50 comptes — Version 1, 23 septembre 2026', { size: 20, italics: true, color: '595959' })] }),

      h('1. La question posée'),
      p('« Un VPS par client chez IZARRALDE, potentiellement 40 ou 50 clients ? Et le responsable AI Officer qui doit se connecter à ces 40 ou 50 comptes, avec 1 LDAP par client — quelle architecture d’identité ? »', { italics: true }),
      p('Deux questions sont enchevêtrées, et il faut les séparer avant de répondre, sous peine de résoudre la mauvaise :'),
      puce('Combien d’instances ? Une pour tous, quelques-unes, ou une par client.'),
      puce('Combien d’identités pour l’officer ? Une, ou une par client.'),
      p('La seconde n’est pas commandée par la première. C’est le point central de ce document.', { bold: true }),

      h('2. Le constat qui change tout : un annuaire ≠ une instance'),
      p('AIGMS sépare déjà, en base, deux choses que l’on confond souvent :'),
      table([
        ligne(['Question', 'Qui y répond', 'Où cela vit'], { header: true }),
        ligne(['Qui êtes-vous ?', 'l’annuaire du client (Entra ID, AD, Okta, LDAP)', 'à l’extérieur d’AIGMS']),
        ligne(['Que pouvez-vous faire, et où ?', 'role_assignment', 'dans AIGMS']),
      ]),
      p(''),
      p('Le déclencheur on_auth_user_created (migration 0002) crée un profil à la première connexion — avec aucun rôle. Une connexion réussie n’ouvre aucune porte tant que l’administration n’a pas posé une affectation. C’est une décision d’architecture, pas un oubli : l’annuaire atteste l’identité, AIGMS décide des droits.'),
      p('Or Supabase Auth résout l’annuaire par domaine d’adresse : signInWithSSO({ domain }) envoie marie@clientA.fr vers l’IdP du client A et paul@clientB.com vers celui du client B — sur une seule instance. Un tenant Supabase accepte autant de fournisseurs SAML que l’on en déclare.'),
      p('Cinquante annuaires ne réclament pas cinquante plateformes. Ils réclament cinquante déclarations SAML sur la même plateforme.', { bold: true }),

      h('3. Ce qu’une instance par client coûterait vraiment'),
      p('Le pilotage disparaît.', { bold: true }),
      p('app.attention_by_organization() (migration 0031) énumère les organisations par app.has_tenant_access(tenant_id) : l’officer voit, sur un seul écran, les actions en retard, les revues dues, les preuves périmées, les incidents ouverts et les risques élevés de tout son portefeuille. C’est ce qui rend tenable un modèle à 4 jours par an et par client. Cinquante bases séparées, c’est cinquante tableaux de bord et zéro portefeuille : il faudrait reconstruire une console d’agrégation (5 à 8 jours, plus son exploitation et sa surface d’attaque).'),
      p('L’exploitation est multipliée par cinquante.', { bold: true }),
      p('Chaque version d’AIGMS, c’est 50 déploiements et 50 passages de migrations. Chaque correctif de sécurité Postgres, c’est 50 fenêtres de maintenance. Chaque sauvegarde, c’est 50 restaurations à répéter pour être crédible.'),
      p('Le coût.', { bold: true }),
      p('Environ 40 €/mois par VPS capable de tenir AIGMS + Postgres + n8n : ~2 000 €/mois pour 50 clients, contre ~120 €/mois pour deux ou trois cellules mutualisées. Cela vend du VPS ; cela consomme aussi le temps que vous vendez.'),
      p('Ce que cela n’achète pas.', { bold: true }),
      p('L’isolation existe déjà : RLS forcée sur toutes les tables métier, 130 politiques, 293 tests. Un VPS par client ajoute une frontière matérielle, pas une frontière logique qui manquerait.'),

      h('4. Trois architectures'),
      h('A. Mutualisé — recommandé', HeadingLevel.HEADING_2),
      ...figure('05-identite-mutualise', 'Identité en mutualisé : un annuaire par client, une seule plateforme', 'excalidraw.com/#json=PgVPDXRq3XL4AZWADmTEZ'),
      p('Une plateforme AIGMS. Un annuaire par client, déclaré en SAML sur le domaine du client. L’officer et les consultants vivent dans l’Entra ID de CARITIS.'),
      table([
        ligne(['Qui', 'Comment il se connecte'], { header: true }),
        ligne(['AI Governance Officer, consultants', 'OIDC « Microsoft » sur l’Entra ID de CARITIS — une identité, une connexion'], { bon: true }),
        ligne(['Utilisateurs du client A', 'SAML, annuaire du client A, résolu par le domaine de l’adresse']),
        ligne(['Utilisateurs du client B', 'SAML, annuaire du client B']),
        ligne(['Client sans annuaire', 'compte local AIGMS, mot de passe, captcha']),
      ]),
      p(''),
      puce('Ce que l’officer obtient : une connexion, un pilotage qui couvre les 50 organisations, un basculement d’organisation sans se reconnecter.'),
      puce('Pour n8n : une instance, et un compte d’automatisation par organisation (jamais un service_role). Chaque scénario s’authentifie sur PostgREST avec le compte de son organisation, et la RLS fait le reste.'),
      puce('Ce qui reste à développer : le bouton « Se connecter avec l’annuaire de mon organisation » sur la mire — une demi-journée, aucune migration. C’est le seul manque : signInWithSSO n’apparaît aujourd’hui nulle part dans le code.'),
      puce('Ce qu’il faut acheter : le plan Supabase Pro (ou l’équivalent self-hosted) pour SAML ; l’OIDC est disponible sur tous les plans.'),
      puce('Le prérequis de gouvernance : « Assignment required = Yes » sur chaque application d’entreprise — un départ dans l’annuaire du client coupe l’accès immédiatement, sans action d’AIGMS.'),

      h('B. Cellules — le compromis commercial', HeadingLevel.HEADING_2),
      ...figure('07-cellules', 'Cellules : un serveur par segment, pas par client', 'excalidraw.com/#json=gA_PdtVBaTG2djTJ1l9aa'),
      table([
        ligne(['Cellule', 'Contenu', 'Pour qui'], { header: true }),
        ligne(['STANDARD', 'AIGMS + Postgres + n8n, 15 à 20 organisations', 'la majorité']),
        ligne(['SOUVERAINE', 'idem, données en France, engagement contractuel', 'secteur public, santé']),
        ligne(['DÉDIÉE', 'idem, une seule organisation', 'le client qui l’exige — et qui la paie']),
        ligne(['PRÉPROD', 'démonstration, recette', 'CARITIS']),
      ]),
      p(''),
      p('L’identité ne change pas : l’officer reste sur l’Entra ID de CARITIS, les clients sur leur annuaire. Quatre connexions au lieu de cinquante, quatre sauvegardes au lieu de cinquante. Vous vendez quand même du VPS à IZARRALDE — quatre ou cinq, avec une marge et une exploitation tenable.'),
      p('La cellule dédiée devient une option tarifée, pas la règle. C’est exactement la position commerciale d’Iubenda, OneTrust ou Credo AI : mutualisé par défaut, dédié au catalogue.'),

      h('C. Un VPS par client — si c’est imposé', HeadingLevel.HEADING_2),
      ...figure('06-identite-par-client', 'Un VPS par client : le courtier d’identité devient obligatoire', 'excalidraw.com/#json=kaOP5w4HyBT4nd7Z_nuaY'),
      p('Si un client ou un appel d’offres impose l’instance dédiée, l’identité exige un courtier. Sans lui, l’officer gère 50 mots de passe : intenable et insauvegardable.'),
      p('Keycloak comme courtier d’identité, hébergé une fois chez IZARHOST :', { bold: true }),
      puce('Un realm par client. Dans chaque realm, l’annuaire du client est déclaré en amont (identity provider SAML/OIDC, ou fédération LDAP directe pour un AD classique).'),
      puce('Chaque instance AIGMS est un relying party OIDC de son realm, via un fournisseur OIDC générique pointant sur https://sso.caritis.eu/realms/<client>.'),
      puce('L’officer a une identité unique dans un realm CARITIS, déclarée comme IdP amont de chaque realm client. Il se connecte une fois ; les 50 instances le reconnaissent.'),
      puce('n8n consomme le même courtier (OIDC natif), ou reste sur ses comptes d’automatisation.'),
      p('Ce que le courtier résout : une connexion, un annuaire de secours, une révocation centrale, une trace de connexion unique.'),
      p('Ce qu’il ne résout pas : 50 livraisons, 50 migrations, 50 jeux de sauvegardes, 50 n8n — et surtout pas la vue portefeuille, qui reste à construire.', { bold: true }),
      p('Ce que cela ajoute au devis : le VPS Keycloak (~20 €/mois), son exploitation, un certificat par realm à renouveler, et la console d’agrégation (5 à 8 jours de développement, puis maintenance).'),

      h('5. Comparaison'),
      table([
        ligne(['', 'A. Mutualisé', 'B. Cellules', 'C. Un VPS par client'], { header: true }),
        ligne(['Connexions pour l’officer', '1', '1', '1 (avec courtier), 50 sans']),
        ligne(['VPS à tenir', '1', '4 à 5', '50']),
        ligne(['Coût d’infrastructure / mois', '~60 €', '~120 €', '~2 000 € (+ courtier)']),
        ligne(['Déploiements par version', '1', '4 à 5', '50']),
        ligne(['Vue portefeuille (pilotage)', 'native', 'native par cellule', 'à développer (5-8 j)'], { alerte: true }),
        ligne(['Développement d’identité requis', 'bouton SSO (½ j)', 'bouton SSO (½ j)', 'bouton SSO + Keycloak + console']),
        ligne(['Isolation', 'RLS (130 politiques, 293 tests)', 'RLS', 'RLS + machine']),
        ligne(['Argument commercial « dédié »', 'option tarifée', 'segment SOUVERAIN / DÉDIÉ', 'par défaut']),
        ligne(['Surface d’attaque', '1 plateforme', '4 à 5', '50 + le courtier']),
      ]),
      p(''),
      p('Ordres de grandeur, à confirmer avec les tarifs d’IZARHOST.', { italics: true, size: 16, color: '757575' }),

      h('6. Comment un client arrive — la procédure'),
      p('Quel que soit le scénario retenu, la séquence d’accueil ne change pas :'),
      table([
        ligne(['Étape', 'Qui', 'Contenu'], { header: true }),
        ligne(['1', 'DSI du client', 'Déclare AIGMS dans son annuaire : application d’entreprise SAML, Entity ID et Reply URL du projet Supabase, claims email et name, « Assignment required = Yes ».']),
        ligne(['2', 'CARITIS', 'Déclare le domaine côté Supabase : supabase sso add --type saml --metadata-url <métadonnées> --domains client.fr']),
        ligne(['3', 'Les personnes', 'Se connectent — un profil se crée, sans rôle.']),
        ligne(['4', 'Administration', 'Pose les six rôles (migration 0056 : une organisation n’est opérationnelle qu’avec ses six rôles tenus), plus le client_admin si le client administre ses propres comptes.']),
        ligne(['5', 'Au départ d’une personne', 'Accès coupé dans l’annuaire du client ; valid_until = now() sur l’affectation dans AIGMS — jamais de suppression, le journal garde qui a eu quel rôle et quand.']),
      ]),

      h('7. Le provisionnement automatique des rôles — ce qui viendrait ensuite'),
      p('Les trois scénarios laissent l’étape 4 manuelle. Pour l’automatiser, le niveau C de docs/admin/COMPTES_ET_ANNUAIRE.md reste valide et ne dépend pas du scénario d’hébergement :'),
      puce('une convention de groupes dans l’annuaire, AIGMS-<organisation>-<rôle> ;'),
      puce('une table directory_group_mapping (groupe → organisation, rôle), administrée depuis Connecteurs, journalisée ;'),
      puce('une synchronisation par Microsoft Graph, déclenchée à la main et par tâche planifiée ;'),
      puce('des garde-fous : ne jamais toucher platform_admin, refuser de laisser une organisation sans AI Governance Officer, rendre compte dans le journal.'),
      p('Ordre de grandeur : une migration, une action serveur, un écran. À faire quand le nombre de clients le justifie — pas avant.'),

      h('8. Recommandation'),
      p('Mutualisé par défaut, dédié comme option tarifée.', { bold: true, size: 24 }),
      p('Concrètement, ce que je propose de dire à IZARRALDE :'),
      puce('deux VPS au départ (une cellule STANDARD, une PRÉPROD), plutôt qu’un par client — le revenu d’hébergement se construit sur la croissance des cellules, pas sur leur multiplication ;'),
      puce('une cellule SOUVERAINE dès qu’un client public ou santé le demande, ce qui est un vrai argument de vente et un troisième VPS ;'),
      puce('une cellule DÉDIÉE au catalogue, facturée, pour le client qui l’exige ;'),
      puce('Keycloak seulement si le dédié devient la règle — et dans ce cas, chiffrer aussi la console d’agrégation, sans quoi le service à 4 jours/an/client ne tient plus.'),
      p('Le seul développement que cette architecture réclame aujourd’hui est le bouton « Se connecter avec l’annuaire de mon organisation » : une demi-journée, sans migration. Tout le reste est de la configuration.', { bold: true }),

      h('9. En une phrase'),
      p('Un annuaire par client n’impose pas une instance par client : Supabase résout l’IdP par domaine d’adresse, et AIGMS sépare déjà l’identité (l’annuaire) de l’autorisation (role_assignment). Multiplier les instances multiplie l’exploitation, le coût et la surface d’attaque — et détruit le pilotage de portefeuille qui fait tenir le modèle de service.', { bold: true }),
    ],
  }],
})

writeFileSync('docs/architecture/IDENTITE_V1.docx', await Packer.toBuffer(doc))
console.log('IDENTITE_V1.docx écrit')

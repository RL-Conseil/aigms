#!/usr/bin/env node
/**
 * La documentation d'architecture n8n, en Word.
 *
 * Le Markdown fait foi ; ce fichier n'en est que la remise. Il reprend les
 * memes textes et les memes images, pour qui lit dans Word plutot que dans
 * un depot.
 *
 * Usage : node scripts/architecture-n8n-docx.mjs
 */
import { readFileSync, writeFileSync } from 'node:fs'
import {
  AlignmentType, Document, HeadingLevel, ImageRun, Packer, Paragraph,
  Table, TableCell, TableRow, TextRun, WidthType, BorderStyle, ShadingType,
} from 'docx'

const IMG = 'docs/automatisation/images'
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
  width: o.width ? { size: o.width, type: WidthType.PERCENTAGE } : undefined,
  shading: o.header ? { type: ShadingType.CLEAR, fill: '1F3864' } : undefined,
  margins: { top: 60, bottom: 60, left: 100, right: 100 },
  children: (Array.isArray(value) ? value : [value]).map((l) =>
    new Paragraph({ children: [t(l, { size: 18, bold: o.header, color: o.header ? 'FFFFFF' : undefined })] })),
})
const table = (rows) => new Table({ width: { size: 100, type: WidthType.PERCENTAGE }, rows })
const ligne = (cells, o = {}) => new TableRow({ children: cells.map((c) => cell(c, o)) })

/** Une image pleine largeur, avec sa legende et le lien vers la source. */
function figure(nom, legende, lien) {
  const data = readFileSync(`${IMG}/${nom}.png`)
  // Les PNG font 2400 a 3000 px de large : on les pose a 620 pt, largeur utile.
  const { width, height } = tailleePng(data)
  const w = 620
  return [
    new Paragraph({
      alignment: AlignmentType.CENTER,
      spacing: { before: 160, after: 60 },
      children: [new ImageRun({ data, type: 'png', transformation: { width: w, height: Math.round((height / width) * w) } })],
    }),
    new Paragraph({
      alignment: AlignmentType.CENTER,
      spacing: { after: 200 },
      children: [t(legende, { size: 16, italics: true, color: '595959' }), t(` — source : ${lien}`, { size: 14, color: '7F7F7F' })],
    }),
  ]
}

/** Dimensions d'un PNG, lues dans son en-tete IHDR. */
function tailleePng(buffer) {
  return { width: buffer.readUInt32BE(16), height: buffer.readUInt32BE(20) }
}

const doc = new Document({
  creator: 'AIGMS',
  title: "Architecture d'automatisation AIGMS — VPS ou hébergée",
  styles: { default: { document: { run: { font: FONT, size: 20 } } } },
  sections: [{
    properties: { page: { margin: { top: 1000, bottom: 1000, left: 900, right: 900 } } },
    children: [
      new Paragraph({ alignment: AlignmentType.CENTER, spacing: { after: 80 },
        children: [t("Architecture d'automatisation AIGMS", { bold: true, size: 36, color: '1F3864' })] }),
      new Paragraph({ alignment: AlignmentType.CENTER, spacing: { after: 240 },
        children: [t('VPS ou hébergée — complément au guide n8n · Version 1, 23 septembre 2026', { size: 20, italics: true, color: '595959' })] }),

      h('1. Le principe, avant les schémas'),
      p("AIGMS reste le système de référence : il porte le registre, les risques, les contrôles, les preuves, les décisions, et il applique ses règles en base — 223 déclencheurs, une journalisation qui ne se réécrit pas. L'orchestrateur ne gouverne rien : il transporte l'information et agit sur d'autres systèmes, puis rapporte."),
      p('Trois phrases valent pour les deux architectures :'),
      puce("n8n interroge, AIGMS n'émet rien. Il n'existe pas de webhook sortant : tout repose sur une lecture périodique (15 minutes est le bon compromis)."),
      puce("n8n a son propre compte AIGMS, avec un rôle de gouvernance minimal. Ses écritures sont nominatives au journal d'audit."),
      puce("La clé service_role n'entre jamais dans un workflow. Elle contourne la sécurité par ligne ; le compte et la RLS suffisent."),

      h('2. Architecture auto-hébergée (VPS)'),
      ...figure('01-architecture-vps', 'Architecture auto-hébergée', 'https://excalidraw.com/#json=bfAwftqTnwtlF4LCtnJ5M,PWkEu4SZBcXRJukPl4SOlg'),
      table([
        ligne(['Composant', 'Rôle', 'Remarque'], { header: true }),
        ligne(['Traefik ou Nginx', 'Terminaison TLS, certificat Let’s Encrypt', 'n8n ne doit jamais être exposé en clair']),
        ligne(['n8n (conteneur)', 'Ordonnanceur et workflows', 'Une instance suffit jusqu’à quelques milliers d’exécutions par jour']),
        ligne(['PostgreSQL de n8n', 'Exécutions, identifiants chiffrés', 'Distinct de la base AIGMS : ne jamais les mélanger']),
        ligne(['Sauvegarde chiffrée', 'Workflows, identifiants, historique', 'La perte des identifiants oblige à tout reconstruire']),
      ]),
      p(''),
      p('Dimensionnement : 2 vCPU, 4 Go de mémoire, 40 Go de disque suffisent pour les cinq scénarios du guide. La consommation vient des exécutions concurrentes, pas du volume AIGMS.'),
      p('Ce qu’elle apporte :', { bold: true }),
      puce('Les secrets restent chez vous : mot de passe du compte d’automatisation, jetons ITSM, clés M365.'),
      puce('L’accès au réseau interne : un ITSM sur site est joignable sans être publié.'),
      puce('La localisation des traitements est connue et contractualisable.'),
      p('Ce qu’elle coûte : un serveur à tenir — mises à jour, surveillance, sauvegarde vérifiée. C’est la charge que porte un infogéreur.'),

      h('3. Architecture hébergée (n8n Cloud)'),
      ...figure('02-architecture-hebergee', 'Architecture hébergée', 'https://excalidraw.com/#json=qnistroUM16HLHNJOvQKh,JFzDp_YCW2o87WUGYxq8bg'),
      table([
        ligne(['Point', 'Conséquence'], { header: true }),
        ligne(['Les identifiants vivent chez l’éditeur', 'Le mot de passe du compte d’automatisation sort de votre périmètre. À arbitrer, et à consigner comme dépendance fournisseur dans AIGMS']),
        ligne(['Aucun accès au réseau interne', 'Un ITSM sur site n’est joignable que s’il est publié : passerelle, VPN sortant, ou renoncement']),
        ligne(['Localisation des exécutions', 'Déterminée par l’offre, rarement choisie']),
        ligne(['Rien à tenir', 'Pas de mise à jour, pas de certificat, disponibilité assurée']),
      ]),
      p(''),
      p('Le réflexe de gouvernance : si vous retenez cette architecture, déclarez n8n Cloud comme fournisseur dans AIGMS et conduisez sa revue — DPA, localisation, sous-traitants, réversibilité. Un outil qui détient un compte de gouvernance est un tiers impliqué, et sa revue devient une précondition de production pour les cas d’usage qui en dépendent.'),

      h('4. Comparaison, pour trancher'),
      table([
        ligne(['Critère', 'VPS', 'Hébergée'], { header: true }),
        ligne(['Secrets dans votre périmètre', 'Oui', 'Non']),
        ligne(['Accès à un SI interne', 'Oui', 'Non, sauf publication']),
        ligne(['Charge d’exploitation', 'À porter', 'Nulle']),
        ligne(['Délai de mise en service', '1 à 2 jours', '1 heure']),
        ligne(['Convient à une démonstration', 'Oui', 'Oui, le plus rapide']),
        ligne(['Convient à une remédiation sur SI interne', 'Oui', 'Non']),
      ]),
      p(''),
      p('Recommandation : commencer en hébergé pour les scénarios de lecture et de notification, basculer sur VPS dès qu’un scénario touche un système interne ou manipule des preuves sensibles.', { bold: true }),

      h('5. Comment n8n parle à AIGMS'),
      ...figure('03-authentification', 'Authentification et appel', 'https://excalidraw.com/#json=jAbMKz8D_hSneRzlR1WNA,4kaV937l6BuMNZK2nOyzSg'),
      p('La chaîne, en sept temps :'),
      puce('Le nœud « Jeton » présente l’e-mail et le mot de passe du compte d’automatisation à POST /auth/v1/token?grant_type=password.'),
      puce('Supabase Auth rend un access_token valable une heure.'),
      puce('Les nœuds suivants portent deux en-têtes : apikey (clé publique anon) et Authorization: Bearer <jeton>.'),
      puce('Les appels vont à PostgREST : /rest/v1/<table> pour les registres, /rest/v1/rpc/<fonction> pour ce que la plateforme sait calculer.'),
      puce('La RLS décide : le compte ne voit et n’écrit que ce que son rôle permet.'),
      puce('Les déclencheurs en base produisent leurs effets : alertes nominatives, courriels, actions ouvertes.'),
      puce('Le journal d’audit enregistre l’écriture, avec l’auteur et l’heure.'),
      p('Ce que la base refuse, quoi qu’un workflow tente : approuver une décision, accepter un risque, viser une étude d’impact, valider une preuve, franchir un jalon.', { bold: true }),

      h('6. Un scénario de bout en bout'),
      ...figure('04-scenario-action-ticket', 'Action bloquante et ticket ITSM', 'https://excalidraw.com/#json=3NrRivl-_TV2jkck8Nutj,5RfDUZHkX8p3lZYLHFr7sg'),
      p('Le partage des rôles se lit d’un coup d’œil : l’humain ouvre l’action et la clôt ; n8n ouvre le ticket, marque l’action, rapporte la fermeture. La clôture n’est jamais automatique — elle lève une précondition de mise en production, elle se décide.'),

      h('Annexe A — Mise en service d’un VPS', HeadingLevel.HEADING_2),
      p('Un utilisateur dédié (jamais root) · docker-compose avec n8n, PostgreSQL 16 et Traefik · N8N_ENCRYPTION_KEY fixée et sauvegardée hors serveur · pare-feu limité à 80 et 443 · sauvegarde quotidienne chiffrée du volume et de la configuration.'),
      p('Trois pièges :', { bold: true }),
      puce('N8N_ENCRYPTION_KEY non fixée : tous les identifiants deviennent illisibles au premier redémarrage.'),
      puce('SQLite par défaut : tient un temps, puis se corrompt sous charge — poser Postgres dès le départ.'),
      puce('Sauvegarde non vérifiée : une restauration jamais essayée n’est pas une sauvegarde.'),

      h('Annexe B — Les variables à poser dans n8n', HeadingLevel.HEADING_2),
      table([
        ligne(['Variable', 'Valeur', 'Où la trouver'], { header: true }),
        ligne(['AIGMS_URL', 'https://<ref>.supabase.co', 'Supabase → Project Settings → API']),
        ligne(['AIGMS_ANON_KEY', 'Clé anon (publique)', 'Idem']),
        ligne(['AIGMS_APP', 'https://demo.aigms.eu ou l’URL de production', '—']),
      ]),
      p(''),
      p('Le mot de passe du compte d’automatisation va dans les Credentials de n8n, jamais dans un nœud ni dans une variable d’environnement.'),

      h('Annexe C — Ce que l’architecture ne résout pas', HeadingLevel.HEADING_2),
      p('L’absence de webhook sortant. Quelle que soit l’architecture, n8n interroge :'),
      table([
        ligne(['Période', 'Latence moyenne', 'Appels par jour et par workflow'], { header: true }),
        ligne(['5 minutes', '2,5 min', '288']),
        ligne(['15 minutes', '7,5 min', '96 — recommandé']),
        ligne(['1 heure', '30 min', '24']),
      ]),
      p(''),
      p('Pour l’urgence, AIGMS envoie déjà un courriel immédiat : arrêt d’urgence recommandé, incident à qualifier, décision qui retient un jalon, criticité dépassée, preuve échue. n8n n’est pas le canal d’urgence.'),
      p('Une à deux journées de développement — une table webhook_endpoint et une expédition depuis la route planifiée existante — transformeraient l’interrogation en événement. C’est une décision de feuille de route.'),

      h('Annexe D — Les sources des diagrammes', HeadingLevel.HEADING_2),
      p('Les quatre diagrammes sont versionnés dans docs/automatisation/images/ sous trois formes : .excalidraw (modifiable), .svg (vectoriel) et .png (cette remise). Ils se régénèrent par : node scripts/diagrammes-n8n.mjs'),
      p('Le script porte la définition des quatre schémas ; modifier un libellé se fait là, pas dans l’image.'),
    ],
  }],
})

const buffer = await Packer.toBuffer(doc)
writeFileSync('docs/automatisation/ARCHITECTURE_N8N_V1.docx', buffer)
console.log(`ARCHITECTURE_N8N_V1.docx — ${Math.round(buffer.length / 1024)} Ko`)

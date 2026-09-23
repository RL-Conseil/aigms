#!/usr/bin/env node
/**
 * La proposition d'hebergement sur VPS, en Word.
 * Le Markdown fait foi ; ceci en est la remise, pour IZARRALDE.
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
  shading: o.header ? { type: ShadingType.CLEAR, fill: '1F3864' } : o.alerte ? { type: ShadingType.CLEAR, fill: 'FCE4D6' } : undefined,
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
  title: 'Héberger AIGMS sur VPS',
  styles: { default: { document: { run: { font: FONT, size: 20 } } } },
  sections: [{
    properties: { page: { margin: { top: 1000, bottom: 1000, left: 900, right: 900 } } },
    children: [
      new Paragraph({ alignment: AlignmentType.CENTER, spacing: { after: 80 },
        children: [t('Héberger AIGMS sur VPS', { bold: true, size: 36, color: '1F3864' })] }),
      new Paragraph({ alignment: AlignmentType.CENTER, spacing: { after: 240 },
        children: [t('Développement, livraison versionnée, exploitation — proposition pour IZARHOST · Version 1, 23 septembre 2026', { size: 20, italics: true, color: '595959' })] }),

      h('1. Pourquoi la question se pose'),
      puce('Revendre : « votre plateforme, chez votre infogéreur » est un argument commercial.'),
      puce('Souveraineté : AIGMS porte des registres de risques, des preuves et des décisions nominatives. Le client demandera où cela réside.'),
      puce('Coût prévisible : un abonnement à l’usage s’annonce mal quand on facture un forfait annuel.'),
      puce('Maîtrise : un correctif urgent ne dépend plus d’un fournisseur.'),
      p('Contrepartie, à nommer d’emblée : ce qui est aujourd’hui assuré par un éditeur devient votre astreinte.', { bold: true }),

      h('2. Ce que la plateforme exige réellement'),
      p('Vérifié dans le code, pas supposé :'),
      table([
        ligne(['Besoin', 'Réalité mesurée'], { header: true }),
        ligne(['Runtime applicatif', 'Next.js 16, Node 22. Aucune dépendance à une API Vercel']),
        ligne(['Base', 'PostgreSQL 17 · 64 tables · 130 politiques RLS · 223 déclencheurs · 92 migrations']),
        ligne(['Services Supabase employés', 'Deux seulement : authentification et stockage de fichiers. Ni Realtime, ni Edge Functions, ni Vector']),
        ligne(['Tâche planifiée', 'Une route HTTP appelée chaque jour, protégée par un secret']),
        ligne(['Courriel', 'Resend, par API — indépendant de l’hébergement']),
      ]),
      p(''),
      p('Conclusion technique : la dépendance à l’hébergeur actuel est faible. La migration est un travail d’exploitation, pas une réécriture.', { bold: true }),

      h('3. La cible d’exécution'),
      ...figure('01-cible-vps', 'La cible sur VPS', 'https://excalidraw.com/#json=azpyNKHIz8aJDAPuz5e2k,tW8t0A08YlehO4-L3QB9FQ'),
      table([
        ligne(['Charge', 'vCPU', 'Mémoire', 'Disque'], { header: true }),
        ligne(['Préprod ou démonstration', '2', '4 Go', '40 Go']),
        ligne(['Production, 1 à 5 organisations', '4', '8 Go', '80 Go']),
        ligne(['Production, 20 organisations', '4', '16 Go', '160 Go']),
      ]),
      p(''),
      p('Deux ports ouverts, 80 et 443. Postgres n’est jamais exposé : les conteneurs se parlent sur un réseau interne, et l’accès administrateur passe par un tunnel SSH.'),

      h('4. Docker : nécessaire, et où exactement'),
      p('Pour livrer : oui.', { bold: true }),
      puce('Une image fige le runtime et rend la livraison reproductible.'),
      puce('Le retour arrière devient trivial : relancer l’image précédente prend trente secondes.'),
      puce('Une image porte une étiquette qui porte un commit : « quelle version tourne chez ce client ? » a une réponse exacte.'),
      puce('La pile Supabase auto-hébergée est elle-même une composition de conteneurs.'),
      p('Pour développer : non, et c’est déconseillé.', { bold: true }),
      puce('Le rechargement à chaud reste immédiat en npm run dev.'),
      puce('La machine de développement n’a pas à faire tourner un conteneur de plus.'),
      puce('Il n’y a pas d’écart d’environnement à réconcilier : un seul développeur.'),
      p('À noter : supabase start fait déjà tourner huit conteneurs Docker sur le poste. Docker est donc utilisé sans qu’une seule commande Docker soit tapée — c’est le rapport à garder avec lui.'),
      p('Obligatoire ? Non. Une livraison sans conteneur est possible (Node + PM2, Postgres par paquet) ; on y perd la reproductibilité, le retour arrière immédiat et l’isolation. Déconseillé, non interdit.'),

      h('5. La chaîne de livraison versionnée'),
      ...figure('02-chaine-de-livraison', 'La chaîne de livraison', 'https://excalidraw.com/#json=x8qP66ielXKzzZPUtMXmK,42qfHSBBRWDcue1Tx09JRw'),
      p('Ce que fait le développeur — rien de nouveau au quotidien :', { bold: true }),
      puce('npm run typecheck · lint · test, puis supabase db reset'),
      puce('git push origin dev'),
      puce('Pour livrer : git tag v1.4.0 puis git push origin v1.4.0. C’est tout — aucune commande Docker, aucune connexion au serveur.'),
      p('Ce que fait la machine :', { bold: true }),
      puce('1. Vérifier — types, lint, tests unitaires, tests RLS contre une base jetable. Un échec arrête tout.'),
      puce('2. Construire — docker build, sur une machine rapide, jamais celle du développeur.'),
      puce('3. Publier — l’image part dans le dépôt privé GitHub, avec l’empreinte du commit.'),
      puce('4. Déployer la préprod — récupération de l’image, migrations, bascule.'),
      puce('5. Attendre pour la production — la bascule se déclenche à la main, après sauvegarde vérifiée.'),
      p('Retour arrière : docker compose up -d aigms:v1.3.0 — trente secondes. Mais les migrations ne reviennent pas en arrière : une correction se livre par une migration de plus.', { bold: true }),
      p('Reste à écrire : Dockerfile, docker-compose.yml et le workflow de livraison. Le dépôt n’a aucun workflow CI aujourd’hui. Compter deux à trois jours.'),

      h('6. Les environnements et qui décide'),
      ...figure('03-environnements', 'Environnements et promotion', 'https://excalidraw.com/#json=6T5yvrth0UU-Br5k4Xuw-,kCmAQ_fbPhQjInrK3p5Tww'),
      table([
        ligne(['Environnement', 'Migrations', 'Qui décide'], { header: true }),
        ligne(['Poste', 'Rejouées à volonté', 'Le développeur']),
        ligne(['Préprod', 'Appliquées automatiquement à chaque étiquette', 'Le développeur']),
        ligne(['Production', 'Appliquées à la main, après sauvegarde vérifiée', 'Le propriétaire seul'], { alerte: true }),
      ]),
      p(''),
      p('État à connaître : la production est arrêtée à la migration 16, la préprod en porte 92. La bascule vers le VPS ne doit pas servir à rattraper ce retard en une fois.', { bold: true }),

      h('7. Ce que l’on perd en quittant Vercel'),
      table([
        ligne(['Perdu', 'À reconstruire', 'Effort'], { header: true }),
        ligne(['Déploiement automatique par branche', 'Le workflow GitHub Actions', 'Inclus']),
        ligne(['Preview par commit', 'Rien d’équivalent à coût raisonnable', 'Accepter la perte'], { alerte: true }),
        ligne(['TLS automatique', 'Traefik + Let’s Encrypt', 'Une fois']),
        ligne(['Réseau de diffusion mondial', 'Sans objet : utilisateurs en France', '—']),
      ]),
      p(''),
      p('Recommandation : garder Vercel pour la branche de travail et la démonstration (coût nul), VPS pour ce qui est livré aux clients. Les deux cohabitent sans conflit.', { bold: true }),

      h('8. Ce que l’on perd en quittant supabase.com — le point sérieux'),
      table([
        ligne(['Assuré aujourd’hui par l’éditeur', 'Devient votre charge'], { header: true }),
        ligne(['Sauvegardes quotidiennes, restauration à un instant donné', 'Dump chiffré, et restauration testée'], { alerte: true }),
        ligne(['Correctifs de sécurité de Postgres', 'Veille et application']),
        ligne(['Mises à jour majeures (17 → 18)', 'Planification, essai, bascule']),
        ligne(['Surveillance et alertes', 'À monter']),
        ligne(['Réplique de lecture, bascule automatique', 'Inexistant sans travail supplémentaire']),
      ]),
      p(''),
      p('Une sauvegarde jamais restaurée n’est pas une sauvegarde. Pour une plateforme dont la valeur est l’intégrité de ses registres et de son journal, c’est l’engagement principal.', { bold: true }),
      ...figure('04-comparaison', 'Comparaison des hébergements', 'https://excalidraw.com/#json=vyjqto3FzjoMKc2KK94bF,4kNcazyME-4oJcD-tQLgNg'),
      p('La voie intermédiaire à examiner : application sur VPS, base gérée par un opérateur — Supabase Cloud ou PostgreSQL géré européen, complété de PostgREST et GoTrue en conteneurs. On déplace ce qui est facile à déplacer, on laisse à un opérateur ce qui demande une astreinte de nuit.'),
      table([
        ligne(['Critère', 'Tout Vercel/Supabase', 'Tout VPS', 'Mixte'], { header: true }),
        ligne(['Revendable en marque propre', 'Non', 'Oui', 'Oui']),
        ligne(['Astreinte base de données', 'Éditeur', 'Vous', 'Opérateur']),
        ligne(['Coût mensuel, 7 clients', '~200 €', '~120 €', '~180 €']),
        ligne(['Effort de mise en place', '—', '5 à 8 j', '3 à 4 j']),
      ]),
      p(''),
      p('Ordres de grandeur, à confirmer avec les tarifs d’IZARHOST.', { italics: true, size: 16, color: '757575' }),

      h('9. Sécurité et conformité'),
      puce('Chiffrement au repos : volume chiffré. Les preuves y résident.'),
      puce('Secrets : jamais dans l’image, jamais dans Git. Fichier en droits 600, ou coffre.'),
      puce('Accès administrateur : SSH par clé seulement, pas de root direct, connexions journalisées.'),
      puce('Journal d’audit : déjà append-only en base — un déclencheur refuse UPDATE et DELETE, y compris pour la clé de service. Identique sur VPS.'),
      puce('RGPD : un hébergeur français simplifie le registre des traitements et les mentions de sous-traitance.'),
      puce('Cloisonnement des clients : la plateforme est multi-tenant et la RLS le garantit (293 tests). Un VPS par client est un choix commercial, pas une exigence de sécurité.'),

      h('10. Plan de migration, réversible'),
      table([
        ligne(['Étape', 'Contenu', 'Durée'], { header: true }),
        ligne(['1', 'Dockerfile, docker-compose.yml, workflow de livraison', '2–3 j']),
        ligne(['2', 'VPS de préprod, pile complète, restauration d’un dump', '1 j']),
        ligne(['3', 'Les deux préprods en parallèle une à deux semaines', '—']),
        ligne(['4', 'Sauvegarde, restauration testée, supervision, astreinte définie', '1–2 j']),
        ligne(['5', 'Premier client sur VPS, la préprod Vercel restant en démonstration', '1 j']),
      ]),
      p(''),
      p('À aucune étape on ne coupe l’existant. Le retour en arrière consiste à repointer un nom de domaine.', { bold: true }),

      h('11. Ce que je déconseille'),
      puce('Basculer la production actuelle en même temps que l’hébergement : deux ruptures simultanées rendent tout diagnostic impossible.'),
      puce('Auto-héberger la base sans astreinte définie : si personne n’est nommé pour restaurer un dimanche, c’est un risque, pas une maîtrise.'),
      puce('Un VPS par client dès le départ : sept serveurs à tenir sans bénéfice de sécurité.'),
      puce('Développer en conteneur : aucun bénéfice pour un développeur seul.'),
      puce('Renoncer à Vercel tout de suite : il ne coûte rien pour la démonstration et rend la Preview par commit.'),

      h('12. En une phrase'),
      p('Oui, AIGMS se déplace sur un VPS sans réécriture — la dépendance mesurée à l’hébergeur actuel est faible. Docker est nécessaire pour livrer, inutile pour développer, et la construction se fait chez GitHub, jamais sur le poste du développeur. Le vrai engagement n’est pas technique mais opérationnel : auto-héberger la base, c’est prendre l’astreinte des sauvegardes et des restaurations.', { bold: true }),
    ],
  }],
})

writeFileSync('docs/architecture/HEBERGEMENT_VPS_V1.docx', await Packer.toBuffer(doc))
console.log('HEBERGEMENT_VPS_V1.docx écrit')

#!/usr/bin/env node
/**
 * Les diagrammes de l'architecture d'hebergement sur VPS.
 *
 * Meme principe que les diagrammes n8n : une seule source, trois sorties —
 * Excalidraw (modifiable), SVG (vectoriel), PNG (pour Word). Le rendu SVG est
 * repris tel quel de scripts/diagrammes-n8n.mjs.
 *
 * Usage : node scripts/diagrammes-hebergement.mjs
 */
import { mkdirSync, writeFileSync } from 'node:fs'

const OUT = 'docs/architecture/images'
mkdirSync(OUT, { recursive: true })

const C = {
  bleu: '#4a9eed', ambre: '#f59e0b', vert: '#22c55e', rouge: '#ef4444',
  violet: '#8b5cf6', cyan: '#06b6d4', encre: '#1e1e1e', gris: '#757575',
  fBleu: '#a5d8ff', fVert: '#b2f2bb', fOrange: '#ffd8a8', fViolet: '#d0bfff',
  fRouge: '#ffc9c9', fJaune: '#fff3bf', fTeal: '#c3fae8', fRose: '#eebefa',
  zBleu: '#dbe4ff', zViolet: '#e5dbff', zVert: '#d3f9d8',
}

let n = 0
const id = (p) => `${p}${(n += 1)}`
const zone = (x, y, w, h, fill, stroke, titre) => [
  { type: 'rectangle', id: id('z'), x, y, width: w, height: h, backgroundColor: fill,
    fillStyle: 'solid', roundness: { type: 3 }, strokeColor: stroke, strokeWidth: 1, opacity: 35 },
  { type: 'text', id: id('zt'), x: x + 16, y: y + 10, text: titre, fontSize: 16, strokeColor: stroke },
]
const boite = (x, y, w, h, texte, fill, stroke, fontSize = 16) => ({
  type: 'rectangle', id: id('b'), x, y, width: w, height: h, backgroundColor: fill,
  fillStyle: 'solid', roundness: { type: 3 }, strokeColor: stroke, label: { text: texte, fontSize },
})
const fleche = (x, y, dx, dy, stroke, texte, tirets) => ({
  type: 'arrow', id: id('a'), x, y, width: dx, height: dy, points: [[0, 0], [dx, dy]],
  strokeColor: stroke, strokeWidth: 2, endArrowhead: 'arrow',
  ...(tirets ? { strokeStyle: 'dashed' } : {}), ...(texte ? { label: { text: texte, fontSize: 14 } } : {}),
})
const titre = (x, y, texte, fontSize = 26) => ({ type: 'text', id: id('t'), x, y, text: texte, fontSize, strokeColor: C.encre })
const note = (x, y, texte, fontSize = 14, couleur = C.gris) => ({ type: 'text', id: id('n'), x, y, text: texte, fontSize, strokeColor: couleur })

// =============================================================================
// H1 — La cible d'execution sur un VPS
// =============================================================================
const h1 = [
  { type: 'cameraUpdate', width: 1600, height: 1200, x: -40, y: -40 },
  titre(40, 0, 'AIGMS hébergé sur VPS — un environnement', 28),
  note(40, 40, 'Tout ce qui tourne chez IZARHOST pour un client. Même composition pour la préprod et la production.', 16),

  ...zone(40, 100, 1080, 560, C.zViolet, C.violet, 'VPS — Docker Compose'),

  boite(80, 160, 380, 70, 'Traefik — TLS, Let’s Encrypt\naigms.client.fr', C.fViolet, C.violet),
  fleche(270, 230, 0, 50, C.violet),
  boite(80, 290, 380, 90, 'Application AIGMS\nNext.js 16 — image versionnée', C.fBleu, C.bleu),
  note(80, 395, 'Une image = un commit.\nRetour arrière en 30 secondes.', 14, C.bleu),

  ...zone(520, 150, 560, 460, C.zBleu, C.bleu, 'Pile Supabase auto-hébergée'),
  boite(550, 200, 240, 60, 'Kong — passerelle', C.fBleu, C.bleu),
  boite(810, 200, 240, 60, 'GoTrue — comptes', C.fBleu, C.bleu),
  boite(550, 280, 240, 60, 'PostgREST — /rest/v1', C.fBleu, C.bleu),
  boite(810, 280, 240, 60, 'Storage — preuves', C.fBleu, C.bleu),
  boite(550, 370, 500, 100, 'PostgreSQL 17\nRLS · 223 déclencheurs · journal append-only', C.fTeal, C.cyan),
  boite(550, 490, 500, 70, 'Volume chiffré — données et fichiers', C.fTeal, C.cyan),

  fleche(460, 335, 90, -35, C.bleu, 'interne'),

  ...zone(40, 700, 1080, 180, C.zVert, C.vert, 'Autour du serveur'),
  boite(80, 750, 300, 70, 'Sauvegarde chiffrée\nhors du serveur', C.fVert, C.vert),
  boite(410, 750, 300, 70, 'Supervision\ndisque, mémoire, TLS', C.fVert, C.vert),
  boite(740, 750, 340, 70, 'Resend — courriels sortants', C.fOrange, C.ambre),

  fleche(760, 560, 0, 190, C.vert, 'dump quotidien', true),
  note(40, 910, 'Ce qui ne change pas en quittant Vercel : le code, les migrations, les règles en base, les tests.', 15, C.encre),
  note(40, 940, 'Ce qui change de responsable : les certificats, les sauvegardes, les mises à jour de Postgres.', 15, C.rouge),
]

// =============================================================================
// H2 — La chaine de livraison versionnee
// =============================================================================
const h2 = [
  { type: 'cameraUpdate', width: 1600, height: 1200, x: -40, y: -40 },
  titre(40, 0, 'Chaîne de livraison — votre poste n’y figure pas', 28),
  note(40, 40, 'Vous codez et vous posez une étiquette. La machine fait le reste.', 16),

  ...zone(40, 100, 320, 420, C.zVert, C.vert, 'Votre poste'),
  boite(70, 150, 260, 70, 'npm run dev\nsupabase start', C.fVert, C.vert),
  boite(70, 240, 260, 70, 'typecheck · lint · test\nsupabase db reset', C.fVert, C.vert),
  boite(70, 330, 260, 60, 'git push sur dev', C.fVert, C.vert),
  boite(70, 410, 260, 70, 'git tag v1.4.0\ngit push origin v1.4.0', C.fJaune, C.ambre),
  note(70, 495, 'Aucune commande Docker.', 14, C.gris),

  ...zone(410, 100, 380, 420, C.zViolet, C.violet, 'GitHub Actions'),
  boite(440, 150, 320, 60, '1. Tests et types', C.fViolet, C.violet),
  boite(440, 230, 320, 70, '2. docker build\nimage: aigms:v1.4.0', C.fViolet, C.violet),
  boite(440, 320, 320, 70, '3. Publication\nghcr.io/rl-conseil/aigms', C.fViolet, C.violet),
  boite(440, 410, 320, 70, '4. Migrations jouées\nsur la préprod', C.fViolet, C.violet),

  ...zone(840, 100, 280, 420, C.zBleu, C.bleu, 'VPS'),
  boite(870, 200, 220, 70, 'docker pull\nde l’image', C.fBleu, C.bleu),
  boite(870, 300, 220, 70, 'Bascule\nsans coupure', C.fBleu, C.bleu),
  boite(870, 400, 220, 70, 'Version en ligne\nv1.4.0', C.fBleu, C.bleu),

  fleche(330, 440, 110, -260, C.ambre, 'déclenche'),
  fleche(760, 355, 110, -110, C.violet, 'image'),
  fleche(980, 270, 0, 30, C.bleu),
  fleche(980, 370, 0, 30, C.bleu),

  note(40, 580, 'Retour arrière :', 16, C.rouge),
  note(40, 610, 'docker compose up -d aigms:v1.3.0 — la version précédente reprend la main en trente secondes.', 15, C.encre),
  note(40, 650, 'Les migrations, elles, ne reviennent pas en arrière : une correction se livre par une migration de plus.', 15, C.encre),
]

// =============================================================================
// H3 — Environnements et promotion
// =============================================================================
const h3 = [
  { type: 'cameraUpdate', width: 1600, height: 1200, x: -40, y: -40 },
  titre(40, 0, 'Trois environnements, une seule direction', 28),
  note(40, 40, 'Qui décide de quoi, et où les migrations s’appliquent.', 16),

  boite(40, 120, 300, 100, 'Poste de développement\nSupabase local (CLI)', C.fVert, C.vert),
  note(40, 235, 'Migrations rejouées\nà volonté.', 14, C.gris),

  fleche(340, 170, 120, 0, C.vert, 'git push dev'),

  boite(480, 120, 320, 100, 'Préprod\nVPS ou Vercel + Supabase', C.fJaune, C.ambre),
  note(480, 235, 'Migrations appliquées\nautomatiquement.\nJeu de démonstration.', 14, C.gris),

  fleche(800, 170, 140, 0, C.rouge, 'décision humaine'),

  boite(960, 120, 320, 100, 'Production\nVPS client', C.fBleu, C.bleu),
  note(960, 235, 'Migrations appliquées\nsur étiquette, après\nsauvegarde vérifiée.', 14, C.gris),

  ...zone(40, 330, 1240, 230, C.zBleu, C.bleu, 'Ce que chaque bascule exige'),
  boite(80, 390, 360, 60, 'Préprod : tests verts', C.fBleu, C.bleu),
  boite(470, 390, 360, 60, 'Production : sauvegarde restaurable', C.fBleu, C.bleu),
  boite(860, 390, 380, 60, 'Production : décision du propriétaire', C.fRouge, C.rouge),
  note(80, 480, 'La production ne se déploie jamais depuis une branche de travail, et jamais sans étiquette.', 15, C.encre),

  note(40, 610, 'Aujourd’hui : préprod = Vercel + Supabase Cloud (91 migrations), production = arrêtée à la 16e.', 15, C.rouge),
  note(40, 640, 'La bascule sur VPS ne change pas cette règle : elle change seulement où les conteneurs tournent.', 15, C.encre),
]

// =============================================================================
// H4 — Comparaison des deux hebergements
// =============================================================================
const h4 = [
  { type: 'cameraUpdate', width: 1600, height: 1200, x: -40, y: -40 },
  titre(40, 0, 'Vercel + Supabase Cloud, ou VPS chez IZARHOST', 28),
  note(40, 40, 'Ce qu’on gagne, ce qu’on doit tenir, et ce qui change de responsable.', 16),

  ...zone(40, 100, 560, 620, C.zBleu, C.bleu, 'Aujourd’hui — Vercel + Supabase Cloud'),
  boite(80, 160, 480, 60, 'Déploiement automatique par branche', C.fBleu, C.bleu),
  boite(80, 240, 480, 60, 'Preview par commit, TLS automatique', C.fBleu, C.bleu),
  boite(80, 320, 480, 60, 'Sauvegardes et correctifs gérés', C.fBleu, C.bleu),
  boite(80, 400, 480, 60, 'Mises à jour de Postgres gérées', C.fBleu, C.bleu),
  boite(80, 480, 480, 70, 'Données hors de votre périmètre\n(régions au choix, éditeur américain)', C.fRouge, C.rouge),
  boite(80, 570, 480, 70, 'Coût à l’usage, non revendable en marque propre', C.fOrange, C.ambre),

  ...zone(660, 100, 560, 620, C.zViolet, C.violet, 'Cible — VPS chez IZARHOST'),
  boite(700, 160, 480, 60, 'Données chez l’hébergeur choisi', C.fVert, C.vert),
  boite(700, 240, 480, 60, 'Revendable : hébergement + service', C.fVert, C.vert),
  boite(700, 320, 480, 60, 'Coût fixe et prévisible', C.fVert, C.vert),
  boite(700, 400, 480, 70, 'Sauvegardes, restaurations, correctifs :\nà votre charge', C.fRouge, C.rouge),
  boite(700, 490, 480, 70, 'Mises à jour majeures de Postgres :\nà votre charge', C.fRouge, C.rouge),
  boite(700, 580, 480, 60, 'Preview par commit : à reconstruire', C.fOrange, C.ambre),

  note(40, 760, 'Voie intermédiaire, la plus sûre : application sur VPS, base sur Supabase Cloud ou Postgres géré européen.', 16, C.encre),
  note(40, 795, 'Elle déplace ce qui est facile à déplacer, et laisse à un opérateur ce qui demande une astreinte.', 15, C.gris),
]

// --- Rendu SVG (identique a celui des diagrammes n8n) ------------------------
const esc = (s) => String(s).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;')
function versSvg(elements, marge = 40) {
  const dessines = elements.filter((e) => e.type !== 'cameraUpdate' && e.type !== 'delete')
  let maxX = 0
  let maxY = 0
  for (const e of dessines) {
    maxX = Math.max(maxX, (e.x ?? 0) + (e.width ?? (e.text ? e.text.length * (e.fontSize ?? 16) * 0.55 : 0)))
    maxY = Math.max(maxY, (e.y ?? 0) + (e.height ?? (e.fontSize ?? 16) * 1.4))
  }
  const W = Math.ceil(maxX + marge)
  const H = Math.ceil(maxY + marge)
  const out = [
    `<svg xmlns="http://www.w3.org/2000/svg" width="${W}" height="${H}" viewBox="0 0 ${W} ${H}" font-family="Segoe UI, Helvetica, Arial, sans-serif">`,
    `<rect width="${W}" height="${H}" fill="#ffffff"/>`,
  ]
  for (const e of dessines) {
    if (e.type === 'rectangle') {
      const o = (e.opacity ?? 100) / 100
      out.push(`<rect x="${e.x}" y="${e.y}" width="${e.width}" height="${e.height}" rx="${e.roundness ? 12 : 0}" fill="${e.backgroundColor ?? 'none'}" fill-opacity="${o}" stroke="${e.strokeColor ?? C.encre}" stroke-width="${e.strokeWidth ?? 2}" stroke-opacity="${o}"/>`)
      if (e.label) {
        const lignes = String(e.label.text).split('\n')
        const fs = e.label.fontSize ?? 16
        const y0 = e.y + e.height / 2 - ((lignes.length - 1) * fs * 1.25) / 2 + fs * 0.35
        lignes.forEach((l, i) => out.push(`<text x="${e.x + e.width / 2}" y="${y0 + i * fs * 1.25}" font-size="${fs}" fill="${C.encre}" text-anchor="middle">${esc(l)}</text>`))
      }
    } else if (e.type === 'text') {
      const fs = e.fontSize ?? 16
      String(e.text).split('\n').forEach((l, i) => out.push(`<text x="${e.x}" y="${e.y + fs + i * fs * 1.3}" font-size="${fs}" fill="${e.strokeColor ?? C.encre}">${esc(l)}</text>`))
    } else if (e.type === 'arrow') {
      const [x1, y1] = [e.x, e.y]
      const [x2, y2] = [e.x + e.width, e.y + e.height]
      const m = `m${Math.abs(x1 + y1 * 3 + x2 * 5 + y2 * 7) | 0}`
      out.push(
        `<defs><marker id="${m}" markerWidth="8" markerHeight="8" refX="7" refY="3" orient="auto"><path d="M0,0 L7,3 L0,6 z" fill="${e.strokeColor ?? C.encre}"/></marker></defs>`,
        `<line x1="${x1}" y1="${y1}" x2="${x2}" y2="${y2}" stroke="${e.strokeColor ?? C.encre}" stroke-width="${e.strokeWidth ?? 2}" ${e.strokeStyle === 'dashed' ? 'stroke-dasharray="8 6"' : ''} marker-end="url(#${m})"/>`,
      )
      if (e.label) {
        const fs = e.label.fontSize ?? 14
        const cx = (x1 + x2) / 2
        const cy = (y1 + y2) / 2
        const largeur = String(e.label.text).length * fs * 0.55
        out.push(
          `<rect x="${cx - largeur / 2 - 6}" y="${cy - fs}" width="${largeur + 12}" height="${fs + 8}" fill="#ffffff" opacity="0.92"/>`,
          `<text x="${cx}" y="${cy + fs * 0.25}" font-size="${fs}" fill="${e.strokeColor ?? C.encre}" text-anchor="middle">${esc(e.label.text)}</text>`,
        )
      }
    }
  }
  out.push('</svg>')
  return out.join('\n')
}

const diagrammes = [
  ['01-cible-vps', 'La cible d’exécution sur VPS', h1],
  ['02-chaine-de-livraison', 'La chaîne de livraison versionnée', h2],
  ['03-environnements', 'Environnements et promotion', h3],
  ['04-comparaison', 'Vercel/Supabase Cloud ou VPS', h4],
]

for (const [nom, libelle, elements] of diagrammes) {
  writeFileSync(`${OUT}/${nom}.excalidraw`, JSON.stringify({
    type: 'excalidraw', version: 2, source: 'AIGMS',
    elements: elements.filter((e) => e.type !== 'cameraUpdate'),
    appState: { viewBackgroundColor: '#ffffff', gridSize: null }, files: {},
  }, null, 2))
  writeFileSync(`${OUT}/${nom}.svg`, versSvg(elements))
  console.log(`${libelle} -> ${nom}`)
}

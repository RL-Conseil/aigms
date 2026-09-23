#!/usr/bin/env node
/**
 * Les diagrammes de l'architecture d'identite.
 *
 * Meme fabrique que les autres : une source, trois sorties (Excalidraw, SVG,
 * PNG). Le rendu SVG est celui de scripts/diagrammes-n8n.mjs.
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
  { type: 'rectangle', id: id('z'), x, y, width: w, height: h, backgroundColor: fill, fillStyle: 'solid',
    roundness: { type: 3 }, strokeColor: stroke, strokeWidth: 1, opacity: 35 },
  { type: 'text', id: id('zt'), x: x + 16, y: y + 10, text: titre, fontSize: 16, strokeColor: stroke },
]
const boite = (x, y, w, h, texte, fill, stroke, fontSize = 16) => ({
  type: 'rectangle', id: id('b'), x, y, width: w, height: h, backgroundColor: fill, fillStyle: 'solid',
  roundness: { type: 3 }, strokeColor: stroke, label: { text: texte, fontSize },
})
const fleche = (x, y, dx, dy, stroke, texte, tirets) => ({
  type: 'arrow', id: id('a'), x, y, width: dx, height: dy, points: [[0, 0], [dx, dy]],
  strokeColor: stroke, strokeWidth: 2, endArrowhead: 'arrow',
  ...(tirets ? { strokeStyle: 'dashed' } : {}), ...(texte ? { label: { text: texte, fontSize: 14 } } : {}),
})
const titre = (x, y, texte, fontSize = 26) => ({ type: 'text', id: id('t'), x, y, text: texte, fontSize, strokeColor: C.encre })
const note = (x, y, texte, fontSize = 14, couleur = C.gris) => ({ type: 'text', id: id('n'), x, y, text: texte, fontSize, strokeColor: couleur })

// =============================================================================
// I1 — L'identite en mutualise : un officer, N annuaires
// =============================================================================
const i1 = [
  { type: 'cameraUpdate', width: 1600, height: 1200, x: -40, y: -40 },
  titre(40, 0, 'Identité en mutualisé — un annuaire par client, une seule plateforme', 26),
  note(40, 40, 'L’annuaire dit QUI vous êtes. AIGMS dit CE QUE vous avez le droit de faire.', 16),

  ...zone(40, 100, 380, 480, C.zVert, C.vert, 'Les annuaires'),
  boite(70, 155, 320, 60, 'Entra ID — CARITIS', C.fVert, C.vert),
  note(70, 225, 'L’AI Governance Officer,\nles consultants.', 14, C.gris),
  boite(70, 290, 320, 55, 'AD / Entra — Client A', C.fVert, C.vert),
  boite(70, 360, 320, 55, 'Okta — Client B', C.fVert, C.vert),
  boite(70, 430, 320, 55, 'Sans annuaire — Client C', C.fOrange, C.ambre),
  note(70, 500, 'Comptes locaux, mot de passe.', 14, C.gris),

  boite(500, 230, 300, 90, 'Supabase Auth (GoTrue)\nSSO par domaine d’adresse', C.fBleu, C.bleu),
  fleche(390, 185, 110, 70, C.vert, 'OIDC'),
  fleche(390, 317, 110, -20, C.vert, 'SAML'),
  fleche(390, 387, 110, -50, C.vert, 'SAML'),
  fleche(390, 457, 110, -100, C.ambre, 'mot de passe'),

  boite(500, 380, 300, 80, 'Profil créé,\nAUCUN rôle', C.fJaune, C.ambre),
  fleche(650, 320, 0, 60, C.bleu),
  note(500, 475, 'Une connexion n’ouvre aucune porte :\nc’est l’administration qui rattache.', 14, C.rouge),

  ...zone(880, 100, 480, 480, C.zBleu, C.bleu, 'AIGMS — une seule instance'),
  boite(910, 155, 420, 70, 'role_assignment\nqui, où, quel rôle, jusqu’à quand', C.fBleu, C.bleu),
  boite(910, 250, 200, 55, 'Client A', C.fBleu, C.bleu),
  boite(1130, 250, 200, 55, 'Client B', C.fBleu, C.bleu),
  boite(910, 320, 200, 55, 'Client C', C.fBleu, C.bleu),
  boite(1130, 320, 200, 55, '… 50 clients', C.fBleu, C.bleu),
  boite(910, 400, 420, 70, 'RLS — l’isolation, vérifiée\npar 293 tests', C.fTeal, C.cyan),
  note(910, 490, 'L’officer voit son portefeuille entier\ndans un seul pilotage.', 14, C.vert),

  fleche(800, 275, 110, -60, C.bleu, 'jeton'),
]

// =============================================================================
// I2 — Un VPS par client : ce que cela impose
// =============================================================================
const i2 = [
  { type: 'cameraUpdate', width: 1600, height: 1200, x: -40, y: -40 },
  titre(40, 0, 'Un VPS par client — le courtier d’identité devient obligatoire', 26),
  note(40, 40, 'Et même alors, la vue portefeuille reste à construire.', 16),

  boite(40, 130, 280, 80, 'AI Governance Officer\nune seule personne', C.fJaune, C.ambre),
  fleche(320, 170, 140, 0, C.violet, '1 connexion'),
  boite(480, 120, 320, 100, 'Keycloak — courtier\nun realm par client', C.fViolet, C.violet),

  ...zone(40, 280, 760, 300, C.zVert, C.vert, 'Les annuaires clients, en amont du courtier'),
  boite(80, 340, 200, 55, 'AD Client A', C.fVert, C.vert),
  boite(300, 340, 200, 55, 'Okta Client B', C.fVert, C.vert),
  boite(520, 340, 240, 55, 'Entra Client C', C.fVert, C.vert),
  boite(80, 430, 680, 55, '… 50 annuaires, 50 realms', C.fVert, C.vert),
  fleche(400, 340, 100, -110, C.vert, 'fédération'),

  ...zone(880, 100, 480, 620, C.zBleu, C.bleu, 'Les instances'),
  boite(910, 160, 420, 55, 'VPS Client A — AIGMS + n8n', C.fBleu, C.bleu),
  boite(910, 235, 420, 55, 'VPS Client B — AIGMS + n8n', C.fBleu, C.bleu),
  boite(910, 310, 420, 55, 'VPS Client C — AIGMS + n8n', C.fBleu, C.bleu),
  boite(910, 385, 420, 55, '… 50 VPS', C.fBleu, C.bleu),
  boite(910, 470, 420, 90, 'Console d’agrégation\nÀ DÉVELOPPER — 5 à 8 jours', C.fRouge, C.rouge),
  note(910, 575, 'Sans elle : 50 tableaux de bord,\naucun portefeuille.', 14, C.rouge),
  boite(910, 620, 420, 70, 'Compte de service par instance\n— une surface d’attaque de plus', C.fRouge, C.rouge),

  fleche(800, 170, 110, 0, C.violet, 'OIDC'),
  fleche(800, 190, 110, 60, C.violet),
  fleche(800, 210, 110, 130, C.violet),

  note(40, 640, 'Ce que le courtier résout : une seule connexion pour l’officer.', 15, C.vert),
  note(40, 670, 'Ce qu’il ne résout pas : 50 livraisons, 50 migrations, 50 sauvegardes, 50 n8n — et la vue portefeuille.', 15, C.rouge),
]

// =============================================================================
// I3 — Les cellules : le compromis
// =============================================================================
const i3 = [
  { type: 'cameraUpdate', width: 1600, height: 1200, x: -40, y: -40 },
  titre(40, 0, 'Cellules — vendre du VPS sans multiplier l’identité', 26),
  note(40, 40, 'Un serveur par segment, pas par client. Quatre connexions au lieu de cinquante.', 16),

  boite(40, 120, 300, 80, 'Entra ID — CARITIS\nl’officer, une identité', C.fJaune, C.ambre),

  ...zone(40, 250, 1320, 300, C.zViolet, C.violet, 'Les cellules, chez IZARHOST'),
  boite(80, 310, 290, 90, 'Cellule STANDARD\n15 à 20 clients', C.fViolet, C.violet),
  boite(400, 310, 290, 90, 'Cellule SOUVERAINE\ndonnées en France', C.fViolet, C.violet),
  boite(720, 310, 290, 90, 'Cellule DÉDIÉE\n1 client exigeant', C.fOrange, C.ambre),
  boite(1040, 310, 280, 90, 'Cellule PRÉPROD\ndémonstration', C.fTeal, C.cyan),
  note(80, 420, 'Chaque cellule : AIGMS + n8n + Postgres, et N organisations isolées par la RLS.', 15, C.encre),
  note(80, 450, 'La cellule dédiée se facture — c’est une option, pas la règle.', 15, C.ambre),

  fleche(190, 200, 30, 110, C.bleu, 'SSO'),
  fleche(290, 200, 240, 110, C.bleu),
  fleche(330, 200, 520, 110, C.bleu),

  ...zone(40, 620, 1320, 210, C.zVert, C.vert, 'Ce que l’officer garde'),
  boite(80, 680, 400, 70, 'Un pilotage par cellule', C.fVert, C.vert),
  boite(510, 680, 400, 70, 'Le portefeuille entier\ndans la cellule standard', C.fVert, C.vert),
  boite(940, 680, 380, 70, '4 connexions, 1 identité', C.fVert, C.vert),

  note(40, 870, 'Vous vendez 4 VPS au lieu de 50, et vous tenez 4 sauvegardes au lieu de 50.', 16, C.encre),
]

// --- Rendu SVG ---------------------------------------------------------------
const esc = (s) => String(s).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;')
function versSvg(elements, marge = 40) {
  const dessines = elements.filter((e) => e.type !== 'cameraUpdate')
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
      const m = `m${Math.abs(x1 * 2 + y1 * 3 + x2 * 5 + y2 * 7) | 0}`
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

for (const [nom, libelle, elements] of [
  ['05-identite-mutualise', 'Identité en mutualisé', i1],
  ['06-identite-par-client', 'Un VPS par client', i2],
  ['07-cellules', 'Les cellules', i3],
]) {
  writeFileSync(`${OUT}/${nom}.excalidraw`, JSON.stringify({
    type: 'excalidraw', version: 2, source: 'AIGMS',
    elements: elements.filter((e) => e.type !== 'cameraUpdate'),
    appState: { viewBackgroundColor: '#ffffff', gridSize: null }, files: {},
  }, null, 2))
  writeFileSync(`${OUT}/${nom}.svg`, versSvg(elements))
  console.log(`${libelle} -> ${nom}`)
}

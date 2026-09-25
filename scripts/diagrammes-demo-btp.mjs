#!/usr/bin/env node
/**
 * Les schemas du scenario de demonstration BTP.
 *
 * Meme fabrique que les autres diagrammes du depot : une source, deux sorties
 * (.excalidraw et .svg), le PNG par sharp. Voir scripts/diagrammes-identite.mjs.
 */
import { mkdirSync, writeFileSync } from 'node:fs'

const OUT = 'docs/commercial/images'
mkdirSync(OUT, { recursive: true })

const C = {
  nuit: '#0c2036', nuitClair: '#1d344e', teal: '#09aeae',
  bleu: '#4a9eed', ambre: '#f59e0b', vert: '#22c55e', rouge: '#ef4444',
  violet: '#8b5cf6', encre: '#101c28', gris: '#535c66',
  fBleu: '#a5d8ff', fVert: '#b2f2bb', fOrange: '#ffd8a8', fViolet: '#d0bfff',
  fRouge: '#ffc9c9', fJaune: '#fff3bf', fTeal: '#c3fae8',
  zBleu: '#dbe4ff', zViolet: '#e5dbff', zVert: '#d3f9d8', zRouge: '#ffe3e3',
}
let n = 0
const id = (p) => `${p}${(n += 1)}`
const zone = (x, y, w, h, fill, stroke, titre) => [
  { type: 'rectangle', id: id('z'), x, y, width: w, height: h, backgroundColor: fill, fillStyle: 'solid',
    roundness: { type: 3 }, strokeColor: stroke, strokeWidth: 1, opacity: 35 },
  { type: 'text', id: id('zt'), x: x + 16, y: y + 10, text: titre, fontSize: 16, strokeColor: stroke },
]
const boite = (x, y, w, h, texte, fill, stroke, fontSize = 15) => ({
  type: 'rectangle', id: id('b'), x, y, width: w, height: h, backgroundColor: fill, fillStyle: 'solid',
  roundness: { type: 3 }, strokeColor: stroke, label: { text: texte, fontSize },
})
const fleche = (x, y, dx, dy, stroke, texte, tirets) => ({
  type: 'arrow', id: id('a'), x, y, width: dx, height: dy, points: [[0, 0], [dx, dy]],
  strokeColor: stroke, strokeWidth: 2, endArrowhead: 'arrow',
  ...(tirets ? { strokeStyle: 'dashed' } : {}), ...(texte ? { label: { text: texte, fontSize: 13 } } : {}),
})
const titre = (x, y, texte, fontSize = 26) => ({ type: 'text', id: id('t'), x, y, text: texte, fontSize, strokeColor: C.encre })
const note = (x, y, texte, fontSize = 14, couleur = C.gris) => ({ type: 'text', id: id('n'), x, y, text: texte, fontSize, strokeColor: couleur })

// =============================================================================
// 1 — Ce que le prospect vit aujourd'hui, et ce qu'AIGMS en fait
// =============================================================================
const d1 = [
  titre(40, 0, 'De l’usage sauvage au cadre — le cas BATIVAL', 26),
  note(40, 40, 'Des commerciaux génèrent leurs devis sur ChatGPT personnel, avec d’anciens devis en pièce jointe.', 16),

  ...zone(40, 100, 480, 420, C.zRouge, C.rouge, 'Aujourd’hui — personne ne sait'),
  boite(70, 160, 420, 60, 'Comptes ChatGPT personnels', C.fRouge, C.rouge),
  boite(70, 240, 420, 60, 'Devis, marges, prix fournisseurs', C.fRouge, C.rouge),
  boite(70, 320, 420, 60, 'Serveurs publics, hors contrat', C.fRouge, C.rouge),
  note(70, 400, 'Aucune trace. Aucun responsable désigné.\nAucune preuve à montrer si le sujet remonte.', 15, C.rouge),

  fleche(540, 300, 110, 0, C.teal, 'déclarer'),

  ...zone(670, 100, 620, 420, C.zVert, C.vert, 'Avec AIGMS — l’usage est tenu'),
  boite(700, 155, 270, 55, 'Cas d’usage au registre', C.fVert, C.vert),
  boite(1000, 155, 260, 55, 'Criticité et qualification', C.fVert, C.vert),
  boite(700, 230, 270, 55, 'Risque coté et traité', C.fVert, C.vert),
  boite(1000, 230, 260, 55, 'Contrôles et outillage', C.fVert, C.vert),
  boite(700, 305, 270, 55, 'Preuves rattachées', C.fVert, C.vert),
  boite(1000, 305, 260, 55, 'Étude d’impact signée', C.fVert, C.vert),
  boite(700, 380, 560, 60, 'Décision de mise en production, assumée nommément', C.fTeal, C.teal),
  note(700, 460, 'Le registre ne bloque pas l’usage : il le rend visible, puis exigible.', 15, C.vert),
]

// =============================================================================
// 2 — Le parcours de la démonstration, dans l'ordre et avec les acteurs
// =============================================================================
const etapes = [
  ['1', 'Déclarer', 'Officer', 'Le cas d’usage entre\nau registre'],
  ['2', 'Trier', 'Officer', 'La grille de criticité\nécrit des faits'],
  ['3', 'Qualifier', 'Officer', 'Déployeur, données\npersonnelles'],
  ['4', 'Coter le risque', 'Comité des risques', 'Fuite de données\ncommerciales'],
  ['5', 'Retenir les contrôles', 'Officer', 'Et dire avec quoi\nils se tiennent'],
  ['6', 'Produire les preuves', 'Porteur', 'La pastille passe\nau vert'],
  ['7', 'Conduire l’AIIA', 'Officer + Porteur', 'Deux signatures,\ndeux actes'],
  ['8', 'Décider', 'Administrateur client', 'Il reçoit, il lit,\nil assume'],
]
const d2 = [
  titre(40, 0, 'Le parcours de démonstration — huit gestes, douze minutes', 26),
  note(40, 40, 'Chaque étape a un acteur nommé. C’est ce qui distingue un registre d’un tableur.', 16),
  ...etapes.flatMap((e, i) => {
    const x = 40 + (i % 4) * 330
    const y = 110 + Math.floor(i / 4) * 230
    return [
      boite(x, y, 290, 110, `${e[0]}. ${e[1]}\n\n${e[3]}`, i === 7 ? C.fTeal : C.fBleu, i === 7 ? C.teal : C.bleu),
      note(x + 8, y + 118, `↳ ${e[2]}`, 13, C.gris),
      ...(i % 4 < 3 && i < 7 ? [fleche(x + 296, y + 55, 26, 0, C.bleu)] : []),
    ]
  }),
  note(40, 580, 'Les étapes 6 et 8 portent les confirmations visibles : la pastille de preuve, et le courriel reçu en direct.', 15, C.teal),
]

// =============================================================================
// 3 — Le moment clé : l'écart de preuve et sa double lecture
// =============================================================================
const d3 = [
  titre(40, 0, 'Le moment qui emporte la décision', 26),
  note(40, 40, 'Une mise en production à laquelle il manque des preuves. AIGMS ne l’interdit pas — il la fait assumer.', 16),

  boite(40, 110, 330, 70, 'L’officer soumet\nla mise en production', C.fBleu, C.bleu),
  fleche(380, 145, 80, 0, C.ambre),
  boite(470, 100, 380, 90, 'Le gate compte 3 contrôles\napplicables sans preuve\nCTL-05, CTL-08, CTL-09', C.fOrange, C.ambre),
  note(470, 200, 'Avertissement — il ne retient pas le jalon.', 14, C.ambre),

  fleche(660, 245, 0, 60, C.ambre, 'obligatoire'),
  boite(470, 320, 380, 70, 'L’officer DOIT dire\nce qu’il en est', C.fJaune, C.ambre),
  note(470, 400, '« Charte signée le 12/11, console\nEnterprise livrée, DLP en recette. »', 14, C.gris),

  fleche(870, 355, 90, -180, C.teal, 'alerte + courriel'),
  ...zone(980, 90, 420, 400, C.zBleu, C.bleu, 'Marc Lecomte — Administrateur client'),
  boite(1010, 145, 360, 60, 'Reçoit le courriel,\nimmédiatement', C.fTeal, C.teal),
  boite(1010, 225, 360, 60, 'Lit les contrôles nommés\net la parole de l’officer', C.fBleu, C.bleu),
  boite(1010, 305, 360, 60, '☑ J’ai pris connaissance\nde cet écart', C.fBleu, C.bleu),
  boite(1010, 385, 360, 60, 'Approuve — daté, nominatif', C.fVert, C.vert),
  note(980, 505, 'Sans la case cochée, la base refuse l’approbation. Ce n’est pas un écran, c’est une règle.', 15, C.encre),

  note(40, 505, 'À montrer en direct : la boîte de réception. C’est ce qui fait la différence\navec une démonstration de maquette.', 15, C.teal),
]

// =============================================================================
// 4 — Les quatre preuves de la fiche, telles qu'AIGMS les porte
// =============================================================================
const preuves = [
  ['Charte d’usage de l’IA', 'signée par les collaborateurs', 'ISO 42001 A.5', 'Critique', C.fRouge, C.rouge],
  ['Console Enterprise', 'rétention désactivée, non-réentraînement', 'A.7.2 · ISO 27001 A.18', 'Critique', C.fRouge, C.rouge],
  ['Journaux de la passerelle', 'DLP bloquant SIRET et données financières', 'A.10.6 · AI Act art. 12', 'Élevé', C.fOrange, C.ambre],
  ['Rapport d’AIIA signé', 'relecture humaine obligatoire avant envoi', 'ISO 42001 6.1.2', 'Critique', C.fRouge, C.rouge],
]
const d4 = [
  titre(40, 0, 'Les quatre preuves exigées, et où elles vivent dans AIGMS', 26),
  note(40, 40, 'La fiche de conformité du prospect devient une liste de contrôles, chacun avec sa pièce.', 16),
  ...preuves.flatMap((p, i) => {
    const y = 110 + i * 130
    return [
      boite(40, y, 380, 100, `${i + 1}. ${p[0]}\n${p[1]}`, p[4], p[5], 15),
      boite(450, y + 20, 200, 60, p[3], p[4], p[5]),
      boite(680, y + 20, 280, 60, p[2], C.fBleu, C.bleu, 14),
      fleche(980, y + 50, 70, 0, C.teal),
      boite(1070, y + 15, 300, 70, 'Contrôle au registre\n+ preuve rattachée', C.fTeal, C.teal),
    ]
  }),
  note(40, 650, 'Le registre ne demande aucune preuve de code : BATIVAL exploite une solution tierce,\nil ne répond pas de l’entraînement d’un modèle qu’il n’entraîne pas.', 15, C.encre),
]

// --- Rendu SVG (identique aux autres diagrammes du depot) --------------------
const esc = (s) => String(s).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;')
function versSvg(elements, marge = 40) {
  let maxX = 0, maxY = 0
  for (const e of elements) {
    maxX = Math.max(maxX, (e.x ?? 0) + (e.width ?? (e.text ? e.text.split('\n').reduce((m, l) => Math.max(m, l.length), 0) * (e.fontSize ?? 16) * 0.55 : 0)))
    maxY = Math.max(maxY, (e.y ?? 0) + (e.height ?? (e.text ? e.text.split('\n').length * (e.fontSize ?? 16) * 1.35 : 0)))
  }
  const W = Math.ceil(maxX + marge), H = Math.ceil(maxY + marge)
  const out = [`<svg xmlns="http://www.w3.org/2000/svg" width="${W}" height="${H}" viewBox="0 0 ${W} ${H}" font-family="Segoe UI, Helvetica, Arial, sans-serif">`,
    `<rect width="${W}" height="${H}" fill="#ffffff"/>`]
  for (const e of elements) {
    if (e.type === 'rectangle') {
      const o = (e.opacity ?? 100) / 100
      out.push(`<rect x="${e.x}" y="${e.y}" width="${e.width}" height="${e.height}" rx="${e.roundness ? 12 : 0}" fill="${e.backgroundColor ?? 'none'}" fill-opacity="${o}" stroke="${e.strokeColor ?? C.encre}" stroke-width="${e.strokeWidth ?? 2}" stroke-opacity="${o}"/>`)
      if (e.label) {
        const lignes = String(e.label.text).split('\n'), fs = e.label.fontSize ?? 15
        const y0 = e.y + e.height / 2 - ((lignes.length - 1) * fs * 1.3) / 2 + fs * 0.35
        lignes.forEach((l, i) => out.push(`<text x="${e.x + e.width / 2}" y="${y0 + i * fs * 1.3}" font-size="${fs}" fill="${C.encre}" text-anchor="middle">${esc(l)}</text>`))
      }
    } else if (e.type === 'text') {
      const fs = e.fontSize ?? 16
      String(e.text).split('\n').forEach((l, i) => out.push(`<text x="${e.x}" y="${e.y + fs + i * fs * 1.3}" font-size="${fs}" fill="${e.strokeColor ?? C.encre}">${esc(l)}</text>`))
    } else if (e.type === 'arrow') {
      const [x1, y1] = [e.x, e.y], [x2, y2] = [e.x + e.width, e.y + e.height]
      const m = `m${Math.abs(x1 * 2 + y1 * 3 + x2 * 5 + y2 * 7) | 0}`
      out.push(`<defs><marker id="${m}" markerWidth="8" markerHeight="8" refX="7" refY="3" orient="auto"><path d="M0,0 L7,3 L0,6 z" fill="${e.strokeColor ?? C.encre}"/></marker></defs>`,
        `<line x1="${x1}" y1="${y1}" x2="${x2}" y2="${y2}" stroke="${e.strokeColor ?? C.encre}" stroke-width="${e.strokeWidth ?? 2}" ${e.strokeStyle === 'dashed' ? 'stroke-dasharray="8 6"' : ''} marker-end="url(#${m})"/>`)
      if (e.label) {
        const fs = e.label.fontSize ?? 13, cx = (x1 + x2) / 2, cy = (y1 + y2) / 2
        const largeur = String(e.label.text).length * fs * 0.56
        out.push(`<rect x="${cx - largeur / 2 - 6}" y="${cy - fs}" width="${largeur + 12}" height="${fs + 8}" fill="#ffffff" opacity="0.92"/>`,
          `<text x="${cx}" y="${cy + fs * 0.25}" font-size="${fs}" fill="${e.strokeColor ?? C.encre}" text-anchor="middle">${esc(e.label.text)}</text>`)
      }
    }
  }
  out.push('</svg>')
  return out.join('\n')
}

for (const [nom, libelle, elements] of [
  ['btp-1-avant-apres', 'De l’usage sauvage au cadre', d1],
  ['btp-2-parcours', 'Le parcours de démonstration', d2],
  ['btp-3-ecart-de-preuve', 'Le moment clé', d3],
  ['btp-4-quatre-preuves', 'Les quatre preuves', d4],
]) {
  writeFileSync(`${OUT}/${nom}.excalidraw`, JSON.stringify({
    type: 'excalidraw', version: 2, source: 'AIGMS', elements,
    appState: { viewBackgroundColor: '#ffffff', gridSize: null }, files: {},
  }, null, 2))
  writeFileSync(`${OUT}/${nom}.svg`, versSvg(elements))
  console.log(`${libelle} -> ${nom}`)
}

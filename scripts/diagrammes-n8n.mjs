#!/usr/bin/env node
/**
 * Les diagrammes d'architecture du guide n8n.
 *
 * Une seule source pour deux sorties : le format Excalidraw (pour l'espace de
 * travail, ou l'on peut les reprendre a la main) et un SVG rendu ici (pour la
 * documentation Markdown et Word, qui ne peuvent pas afficher un lien).
 *
 * Usage :
 *   node scripts/diagrammes-n8n.mjs            # ecrit les .excalidraw et les .svg
 */
import { mkdirSync, writeFileSync } from 'node:fs'

const OUT = 'docs/automatisation/images'
mkdirSync(OUT, { recursive: true })

// --- Palette, celle du format Excalidraw -------------------------------------
const C = {
  bleu: '#4a9eed', ambre: '#f59e0b', vert: '#22c55e', rouge: '#ef4444',
  violet: '#8b5cf6', cyan: '#06b6d4', encre: '#1e1e1e', gris: '#757575',
  fBleu: '#a5d8ff', fVert: '#b2f2bb', fOrange: '#ffd8a8', fViolet: '#d0bfff',
  fRouge: '#ffc9c9', fJaune: '#fff3bf', fTeal: '#c3fae8', fRose: '#eebefa',
  zBleu: '#dbe4ff', zViolet: '#e5dbff', zVert: '#d3f9d8',
}

// --- Fabriques d'elements ----------------------------------------------------
let n = 0
const id = (p) => `${p}${(n += 1)}`

const zone = (x, y, w, h, fill, stroke, titre) => [
  { type: 'rectangle', id: id('z'), x, y, width: w, height: h, backgroundColor: fill,
    fillStyle: 'solid', roundness: { type: 3 }, strokeColor: stroke, strokeWidth: 1, opacity: 35 },
  { type: 'text', id: id('zt'), x: x + 16, y: y + 10, text: titre, fontSize: 16, strokeColor: stroke },
]

const boite = (x, y, w, h, texte, fill, stroke, fontSize = 16) => ({
  type: 'rectangle', id: id('b'), x, y, width: w, height: h, backgroundColor: fill,
  fillStyle: 'solid', roundness: { type: 3 }, strokeColor: stroke,
  label: { text: texte, fontSize },
})

const fleche = (x, y, dx, dy, stroke, texte, tirets) => ({
  type: 'arrow', id: id('a'), x, y, width: dx, height: dy, points: [[0, 0], [dx, dy]],
  strokeColor: stroke, strokeWidth: 2, endArrowhead: 'arrow',
  ...(tirets ? { strokeStyle: 'dashed' } : {}),
  ...(texte ? { label: { text: texte, fontSize: 14 } } : {}),
})

const titre = (x, y, texte, fontSize = 26) => ({
  type: 'text', id: id('t'), x, y, text: texte, fontSize, strokeColor: C.encre,
})

const note = (x, y, texte, fontSize = 14, couleur = C.gris) => ({
  type: 'text', id: id('n'), x, y, text: texte, fontSize, strokeColor: couleur,
})

// =============================================================================
// D1 — Architecture auto-hebergee (VPS)
// =============================================================================
const d1 = [
  { type: 'cameraUpdate', width: 1600, height: 1200, x: -40, y: -40 },
  titre(40, 0, 'Automatisation AIGMS — architecture auto-hébergée (VPS)', 28),
  note(40, 40, 'n8n tourne chez vous ou chez votre infogéreur. AIGMS reste le système de référence.', 16),

  ...zone(40, 90, 480, 420, C.zViolet, C.violet, 'VPS — votre infrastructure (IZARHOST)'),
  boite(70, 140, 300, 70, 'Traefik / Nginx — TLS', C.fViolet, C.violet),
  boite(70, 230, 300, 80, 'n8n (conteneur)\nordonnanceur + workflows', C.fViolet, C.violet),
  boite(70, 330, 300, 70, 'PostgreSQL de n8n\nexécutions, identifiants', C.fTeal, C.cyan),
  boite(70, 420, 300, 60, 'Sauvegarde chiffrée', C.fTeal, C.cyan),
  note(390, 330, 'Réseau\nprivé', 14, C.violet),

  ...zone(620, 90, 500, 300, C.zBleu, C.bleu, 'AIGMS — système de référence'),
  boite(650, 140, 200, 70, 'Application\n(Vercel)', C.fBleu, C.bleu),
  boite(880, 140, 210, 70, 'PostgREST\n/rest/v1', C.fBleu, C.bleu),
  boite(650, 240, 440, 120, 'Supabase Postgres\nRLS · 223 déclencheurs · journal append-only', C.fBleu, C.bleu),

  ...zone(620, 440, 500, 300, C.zVert, C.vert, 'Systèmes cibles — ce que n8n va toucher'),
  boite(650, 490, 200, 60, 'ITSM\n(GLPI, Jira)', C.fVert, C.vert),
  boite(880, 490, 210, 60, 'Entra ID · M365', C.fVert, C.vert),
  boite(650, 580, 200, 60, 'SIEM · Cloud', C.fVert, C.vert),
  boite(880, 580, 210, 60, 'Signature\nélectronique', C.fVert, C.vert),
  boite(650, 670, 440, 55, 'Teams · Slack', C.fVert, C.vert),

  fleche(370, 255, 280, -70, C.bleu, 'HTTPS — interroge et écrit'),
  fleche(370, 290, 280, 250, C.vert, 'agit'),
  fleche(650, 560, -280, -230, C.ambre, 'renvoie preuves et statuts', true),
  note(40, 540, "n8n n'écrit jamais dans le journal d'audit :\nla base l'alimente seule, et nomme l'auteur.", 14, C.gris),
]

// =============================================================================
// D2 — Architecture hebergee (n8n Cloud)
// =============================================================================
const d2 = [
  { type: 'cameraUpdate', width: 1600, height: 1200, x: -40, y: -40 },
  titre(40, 0, 'Automatisation AIGMS — architecture hébergée (n8n Cloud)', 28),
  note(40, 40, 'Aucun serveur à tenir. En contrepartie, tout doit être joignable depuis l’internet.', 16),

  ...zone(40, 90, 480, 330, C.zViolet, C.violet, 'n8n Cloud — chez l’éditeur'),
  boite(70, 140, 300, 70, 'Workflows + planification', C.fViolet, C.violet),
  boite(70, 230, 300, 70, 'Coffre d’identifiants\n(chez l’éditeur)', C.fRouge, C.rouge),
  note(70, 320, 'Vos identifiants AIGMS\nsortent de votre périmètre.', 14, C.rouge),

  ...zone(620, 90, 500, 300, C.zBleu, C.bleu, 'AIGMS — système de référence'),
  boite(650, 140, 200, 70, 'Application\n(Vercel)', C.fBleu, C.bleu),
  boite(880, 140, 210, 70, 'PostgREST\n/rest/v1', C.fBleu, C.bleu),
  boite(650, 240, 440, 120, 'Supabase Postgres\nRLS · compte d’automatisation nominatif', C.fBleu, C.bleu),

  ...zone(620, 440, 500, 240, C.zVert, C.vert, 'Systèmes cibles — exposés à l’internet'),
  boite(650, 490, 440, 60, 'SaaS : Jira, M365, Yousign, Teams…', C.fVert, C.vert),
  boite(650, 580, 440, 60, 'Sur site : seulement via passerelle exposée', C.fOrange, C.ambre),

  fleche(370, 175, 280, -10, C.bleu, 'HTTPS sortant'),
  fleche(370, 265, 280, 260, C.vert, 'agit'),
  note(40, 460, 'Ce que cette architecture interdit :', 16, C.rouge),
  note(40, 490, '• atteindre un SI interne sans le publier', 14, C.encre),
  note(40, 515, '• garder les secrets dans votre périmètre', 14, C.encre),
  note(40, 540, '• maîtriser la localisation des exécutions', 14, C.encre),
  note(40, 590, 'Ce qu’elle apporte :', 16, C.vert),
  note(40, 620, '• aucun serveur, aucune mise à jour à tenir', 14, C.encre),
  note(40, 645, '• disponibilité assurée par l’éditeur', 14, C.encre),
]

// =============================================================================
// D3 — Authentification et appel
// =============================================================================
const d3 = [
  { type: 'cameraUpdate', width: 1600, height: 1200, x: -40, y: -40 },
  titre(40, 0, 'Comment n8n parle à AIGMS', 28),
  note(40, 40, 'Un compte AIGMS, un jeton d’une heure, et la RLS qui décide de tout.', 16),

  boite(40, 110, 260, 70, 'n8n — nœud « Jeton »', C.fViolet, C.violet),
  fleche(300, 145, 240, 0, C.bleu, '1. e-mail + mot de passe'),
  boite(560, 110, 300, 70, 'Supabase Auth\n/auth/v1/token', C.fBleu, C.bleu),
  fleche(710, 180, 0, 90, C.bleu, '2. access_token (1 h)'),
  boite(560, 290, 300, 70, 'Jeton porteur\n+ clé anon', C.fJaune, C.ambre),
  fleche(560, 325, -220, 0, C.ambre, '3. en-têtes'),
  boite(40, 290, 260, 70, 'Nœud HTTP Request', C.fViolet, C.violet),
  fleche(300, 340, 260, 120, C.bleu, '4. GET / POST'),
  boite(560, 430, 300, 70, 'PostgREST\n/rest/v1/<table> · /rpc/<fn>', C.fBleu, C.bleu),
  fleche(710, 500, 0, 80, C.rouge, '5. RLS : ce que le rôle permet'),
  boite(560, 600, 300, 80, 'Postgres\ntables · fonctions · déclencheurs', C.fBleu, C.bleu),
  fleche(860, 620, 240, -60, C.vert, '6. alerte'),
  fleche(860, 660, 240, 0, C.cyan, '7. trace'),
  boite(1100, 520, 300, 70, 'Alertes nominatives\net courriels', C.fVert, C.vert),
  boite(1100, 620, 300, 70, 'Journal d’audit\n(append-only)', C.fTeal, C.cyan),
  note(40, 430, 'Jamais la clé service_role\ndans un workflow : elle\ncontourne la RLS.', 15, C.rouge),
  note(560, 720, 'Ce que la base refuse, quoi qu’un workflow tente : approuver une décision,', 14, C.encre),
  note(560, 745, 'accepter un risque, viser une étude, valider une preuve, franchir un jalon.', 14, C.encre),
]

// =============================================================================
// D4 — Le scenario 1, de bout en bout
// =============================================================================
const d4 = [
  { type: 'cameraUpdate', width: 1600, height: 1200, x: -40, y: -40 },
  titre(40, 0, 'Scénario — une action bloquante ouvre un ticket, et son statut revient', 26),
  note(40, 40, 'Ce que fait l’humain, ce que fait n8n, et ce que personne ne doit automatiser.', 16),

  ...zone(40, 90, 340, 620, C.zBleu, C.bleu, 'AIGMS — l’humain'),
  boite(70, 140, 280, 70, '1. Ouvrir une action\nbloquante', C.fBleu, C.bleu),
  boite(70, 560, 280, 90, '6. Clore l’action\n(geste humain, libère le jalon)', C.fBleu, C.bleu),
  note(70, 665, 'La clôture n’est jamais\nautomatique.', 14, C.rouge),

  ...zone(430, 90, 400, 620, C.zViolet, C.violet, 'n8n — toutes les 15 minutes'),
  boite(460, 140, 340, 70, '2. Lire les actions bloquantes\nsans marqueur ITSM', C.fViolet, C.violet),
  boite(460, 250, 340, 70, '3. Ouvrir le ticket', C.fViolet, C.violet),
  boite(460, 360, 340, 80, '4. Écrire [ITSM: id]\ndans la description de l’action', C.fViolet, C.violet),
  boite(460, 480, 340, 80, '5. Ticket fermé → commentaire\ndans l’action', C.fViolet, C.violet),

  ...zone(880, 90, 300, 400, C.zVert, C.vert, 'ITSM'),
  boite(910, 250, 240, 70, 'Ticket', C.fVert, C.vert),

  fleche(350, 175, 110, 0, C.bleu),
  fleche(630, 210, 0, 40, C.violet),
  fleche(800, 285, 110, 0, C.vert, 'API'),
  fleche(630, 320, 0, 40, C.violet),
  fleche(630, 440, 0, 40, C.violet),
  fleche(910, 320, -110, 190, C.ambre, 'fermé', true),
  fleche(460, 600, -110, 0, C.bleu),
  note(880, 520, 'Le ticket porte le lien\nvers l’action dans AIGMS :', 14, C.gris),
  note(880, 570, '/suivi?vue=actions&action=<id>', 14, C.encre),
]

// =============================================================================
// Rendu SVG — les memes elements, pour la documentation
// =============================================================================
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
      out.push(
        `<rect x="${e.x}" y="${e.y}" width="${e.width}" height="${e.height}" rx="${e.roundness ? 12 : 0}" ` +
          `fill="${e.backgroundColor ?? 'none'}" fill-opacity="${o}" stroke="${e.strokeColor ?? C.encre}" ` +
          `stroke-width="${e.strokeWidth ?? 2}" stroke-opacity="${o}"/>`,
      )
      if (e.label) {
        const lignes = String(e.label.text).split('\n')
        const fs = e.label.fontSize ?? 16
        const y0 = e.y + e.height / 2 - ((lignes.length - 1) * fs * 1.25) / 2 + fs * 0.35
        lignes.forEach((l, i) => {
          out.push(
            `<text x="${e.x + e.width / 2}" y="${y0 + i * fs * 1.25}" font-size="${fs}" fill="${C.encre}" ` +
              `text-anchor="middle">${esc(l)}</text>`,
          )
        })
      }
    } else if (e.type === 'text') {
      const fs = e.fontSize ?? 16
      String(e.text).split('\n').forEach((l, i) => {
        out.push(
          `<text x="${e.x}" y="${e.y + fs + i * fs * 1.3}" font-size="${fs}" fill="${e.strokeColor ?? C.encre}">${esc(l)}</text>`,
        )
      })
    } else if (e.type === 'arrow') {
      const [x1, y1] = [e.x, e.y]
      const [x2, y2] = [e.x + e.width, e.y + e.height]
      const marqueur = `m${Math.abs(x1 + y1 + x2 + y2) | 0}`
      out.push(
        `<defs><marker id="${marqueur}" markerWidth="8" markerHeight="8" refX="7" refY="3" orient="auto">` +
          `<path d="M0,0 L7,3 L0,6 z" fill="${e.strokeColor ?? C.encre}"/></marker></defs>`,
        `<line x1="${x1}" y1="${y1}" x2="${x2}" y2="${y2}" stroke="${e.strokeColor ?? C.encre}" ` +
          `stroke-width="${e.strokeWidth ?? 2}" ${e.strokeStyle === 'dashed' ? 'stroke-dasharray="8 6"' : ''} ` +
          `marker-end="url(#${marqueur})"/>`,
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
  ['01-architecture-vps', 'Architecture auto-hébergée (VPS)', d1],
  ['02-architecture-hebergee', 'Architecture hébergée (n8n Cloud)', d2],
  ['03-authentification', 'Comment n8n parle à AIGMS', d3],
  ['04-scenario-action-ticket', 'Action bloquante → ticket ITSM', d4],
]

for (const [nom, libelle, elements] of diagrammes) {
  writeFileSync(`${OUT}/${nom}.excalidraw`, JSON.stringify({
    type: 'excalidraw', version: 2, source: 'AIGMS', elements: elements.filter((e) => e.type !== 'cameraUpdate'),
    appState: { viewBackgroundColor: '#ffffff', gridSize: null }, files: {},
  }, null, 2))
  writeFileSync(`${OUT}/${nom}.svg`, versSvg(elements))
  writeFileSync(`${OUT}/${nom}.elements.json`, JSON.stringify(elements))
  console.log(`${libelle} -> ${nom}.excalidraw + .svg`)
}

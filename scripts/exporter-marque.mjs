#!/usr/bin/env node
/**
 * La marque AIGMS, en fichiers.
 *
 * Source unique : la geometrie de `src/components/logo.tsx` et la palette de
 * `src/app/globals.css`. Rien n'est redessine ici — si le glyphe change, ce
 * script le suit, et c'est la raison pour laquelle il existe plutot qu'un
 * dossier d'images deposees a la main.
 *
 * Le bloc-marque porte du texte en Newsreader. Il est CONVERTI EN COURBES :
 * un SVG qui reference une police s'affiche autrement chez qui ne l'a pas, et
 * une marque qui change de dessin selon le poste n'est plus une marque.
 *
 * Usage : node scripts/exporter-marque.mjs
 * Prerequis : opentype.js, sharp, png-to-ico, et les deux fichiers Newsreader
 * dans OUTILS (voir ci-dessous).
 */
import { mkdirSync, writeFileSync, readFileSync } from 'node:fs'
import { createRequire } from 'node:module'

const OUT = 'public/marque'
const OUTILS = '/tmp/claude-1000/tools'
const require = createRequire(`${OUTILS}/`)
const opentype = require('opentype.js')
const sharp = require('sharp')
const pngToIco = require('png-to-ico').default ?? require('png-to-ico')

mkdirSync(OUT, { recursive: true })

// --- La palette, telle que @theme la definit -------------------------------
// globals.css l'ecrit en oklch ; ces fichiers doivent etre autonomes.
function oklch(L, C, h) {
  const hr = (h * Math.PI) / 180
  const a = C * Math.cos(hr)
  const b = C * Math.sin(hr)
  const l = (L + 0.3963377774 * a + 0.2158037573 * b) ** 3
  const m = (L - 0.1055613458 * a - 0.0638541728 * b) ** 3
  const s = (L - 0.0894841775 * a - 1.291485548 * b) ** 3
  const lin = [
    4.0767416621 * l - 3.3077115913 * m + 0.2309699292 * s,
    -1.2684380046 * l + 2.6097574011 * m - 0.3413193965 * s,
    -0.0041960863 * l - 0.7034186147 * m + 1.707614701 * s,
  ]
  const f = (v) => {
    const c = v <= 0.0031308 ? 12.92 * v : 1.055 * Math.pow(v, 1 / 2.4) - 0.055
    return Math.round(Math.min(1, Math.max(0, c)) * 255)
  }
  return '#' + lin.map((v) => f(v).toString(16).padStart(2, '0')).join('')
}

const C = {
  night950: oklch(0.2, 0.045, 252),
  night900: oklch(0.24, 0.05, 252),
  night700: oklch(0.32, 0.055, 252),
  teal400: oklch(0.68, 0.115, 195),
  ink900: oklch(0.22, 0.03, 250),
  ink600: oklch(0.47, 0.02, 250),
  blanc: '#ffffff',
}

// --- Le glyphe -------------------------------------------------------------
// « Un A dont la barre transversale se prolonge en ligne de registre et
// s'acheve sur un jalon » — les coordonnees sont celles de LogoMark.
function glyphe({ plaque, trait, jalon }) {
  return [
    plaque ? `<rect width="32" height="32" rx="7" fill="${plaque}"/>` : '',
    `<path d="M9 23 L15 9 L18.2 16.4" stroke="${trait}" stroke-width="2.1" stroke-linecap="round" stroke-linejoin="round" fill="none"/>`,
    `<path d="M12.1 18.4 H25" stroke="${trait}" stroke-width="2.1" stroke-linecap="round"/>`,
    `<circle cx="25" cy="18.4" r="2.9" fill="${jalon}"/>`,
  ].filter(Boolean).join('\n  ')
}

const icone = (o, taille = 512) =>
  `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 32 32" width="${taille}" height="${taille}">
  ${glyphe(o)}
</svg>\n`

// --- Le bloc-marque --------------------------------------------------------
// `loadSync` est deprecie et rend undefined dans cette version : on lit le
// fichier nous-memes.
const serif600 = opentype.parse(readFileSync(`${OUTILS}/newsreader-600.ttf`).buffer)
const serif400 = opentype.parse(readFileSync(`${OUTILS}/newsreader-400.ttf`).buffer)

/**
 * Texte en courbes, et la largeur qu'il occupe.
 *
 * CHAQUE GLYPHE EST DESSINE A L'ORIGINE, puis translate. `toPathData` produit
 * des `NaN` au-dela d'une certaine abscisse — constate sur la vignette de
 * partage, ou le texte s'interrompait au milieu d'un mot passe x ≈ 570. En
 * gardant les coordonnees petites, le probleme ne se pose pas.
 */
function courbes(police, texte, taille, x, baseline, couleur, interlettre = 0) {
  let curseur = 0
  const morceaux = []
  for (const caractere of texte) {
    const d = police.getPath(caractere, 0, 0, taille).toPathData(3)
    if (/NaN/.test(d)) throw new Error(`Glyphe illisible : ${JSON.stringify(caractere)}`)
    if (d) morceaux.push(`<path d="${d}" transform="translate(${curseur.toFixed(3)},0)"/>`)
    curseur += police.getAdvanceWidth(caractere, taille) + interlettre
  }
  return {
    svg: `<g fill="${couleur}" transform="translate(${x},${baseline})">${morceaux.join('')}</g>`,
    largeur: curseur - interlettre,
  }
}

/**
 * Meme composition que le composant : glyphe, nom, mention de l'editeur.
 * `tagline` nulle : la marque blanche n'affiche que le nom.
 */
function blocMarque({ trait, jalon, plaque, nom, mention, tagline = '– by Caritis', nu = false }) {
  const M = 30 // le glyphe, comme dans l'en-tete
  const GAP = 12 // gap-3
  const TAILLE_NOM = 20 // text-xl
  const TAILLE_MENTION = 15 // text-[15px]
  const SERRE = -0.025 * TAILLE_NOM // tracking-tight

  // La hauteur de capitale du nom se centre sur le glyphe : c'est ce que fait
  // `items-center` a l'ecran, et cela survit au changement de taille.
  const hauteurCapitale = (serif600.tables.os2.sCapHeight / serif600.unitsPerEm) * TAILLE_NOM
  const baseline = M / 2 + hauteurCapitale / 2

  const xNom = M + GAP
  const nomRendu = courbes(serif600, 'AIGMS', TAILLE_NOM, xNom, baseline, nom, SERRE)

  let mentionRendue = { svg: '', largeur: 0 }
  if (tagline) {
    const xMention = xNom + nomRendu.largeur + 8 // gap-2
    mentionRendue = courbes(serif400, tagline, TAILLE_MENTION, xMention, baseline, mention)
    mentionRendue.largeur += 8
  }

  const largeur = Math.ceil(xNom + nomRendu.largeur + mentionRendue.largeur)
  const contenu = `<g transform="scale(${M / 32})">
  ${glyphe({ plaque, trait, jalon })}
  </g>
  ${nomRendu.svg}
  ${mentionRendue.svg}`
  // `nu` : le contenu seul, pour l'inserer dans une composition plus grande.
  if (nu) return contenu
  return `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 ${largeur} ${M}" width="${largeur}" height="${M}">
  ${contenu}
</svg>\n`
}

// --- Ce qui est produit ----------------------------------------------------
const fichiers = {
  // L'icone, telle que l'application l'affiche.
  'icone.svg': icone({ plaque: C.night900, trait: C.blanc, jalon: C.teal400 }),
  // Sur un fond deja sombre : la plaque s'eclaircit d'un ton, comme `tone="light"`.
  'icone-sur-fond-sombre.svg': icone({ plaque: C.night700, trait: C.blanc, jalon: C.teal400 }),
  // Sans plaque : pour poser le glyphe sur une couleur libre.
  'icone-sans-plaque-sombre.svg': icone({ plaque: null, trait: C.night900, jalon: C.teal400 }),
  'icone-sans-plaque-blanche.svg': icone({ plaque: null, trait: C.blanc, jalon: C.teal400 }),
  // Une seule encre : tampon, telecopie, gravure, impression a un ton.
  'icone-monochrome-sombre.svg': icone({ plaque: null, trait: C.night900, jalon: C.night900 }),
  'icone-monochrome-blanche.svg': icone({ plaque: null, trait: C.blanc, jalon: C.blanc }),

  'logo.svg': blocMarque({ plaque: C.night900, trait: C.blanc, jalon: C.teal400, nom: C.ink900, mention: C.ink600 }),
  'logo-sur-fond-sombre.svg': blocMarque({ plaque: C.night700, trait: C.blanc, jalon: C.teal400, nom: C.blanc, mention: '#ffffffb3' }),
  'logo-sans-mention.svg': blocMarque({ plaque: C.night900, trait: C.blanc, jalon: C.teal400, nom: C.ink900, mention: C.ink600, tagline: null }),
  'logo-sans-mention-sur-fond-sombre.svg': blocMarque({ plaque: C.night700, trait: C.blanc, jalon: C.teal400, nom: C.blanc, mention: C.blanc, tagline: null }),
}

for (const [nom, contenu] of Object.entries(fichiers)) writeFileSync(`${OUT}/${nom}`, contenu)

// --- Les rasters -----------------------------------------------------------
const TAILLES = [16, 32, 48, 64, 128, 180, 192, 256, 512, 1024]
const sourceIcone = Buffer.from(icone({ plaque: C.night900, trait: C.blanc, jalon: C.teal400 }, 1024))

for (const t of TAILLES) {
  await sharp(sourceIcone, { density: 600 }).resize(t, t).png().toFile(`${OUT}/icone-${t}.png`)
}

// Le logo en PNG : hauteur fixe, largeur libre. Fond transparent.
for (const [nom, source] of [['logo', fichiers['logo.svg']], ['logo-sur-fond-sombre', fichiers['logo-sur-fond-sombre.svg']]]) {
  for (const h of [64, 128, 256]) {
    await sharp(Buffer.from(source), { density: 600 }).resize({ height: h }).png().toFile(`${OUT}/${nom}-h${h}.png`)
  }
}

// favicon.ico : trois tailles dans un fichier, pour les navigateurs anciens.
writeFileSync(`${OUT}/favicon.ico`, await pngToIco([`${OUT}/icone-16.png`, `${OUT}/icone-32.png`, `${OUT}/icone-48.png`]))

/*
 * Icone « maskable » : Android la recadre en cercle, en goutte ou en carre
 * arrondi selon le constructeur. Le glyphe doit donc tenir dans les 80 %
 * centraux, et le fond couvrir toute la surface — sinon le coin est rogne.
 */
const maskable = `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 100 100" width="512" height="512">
  <rect width="100" height="100" fill="${C.night900}"/>
  <g transform="translate(23,23) scale(1.6875)">
  ${glyphe({ plaque: null, trait: C.blanc, jalon: C.teal400 })}
  </g>
</svg>\n`
writeFileSync(`${OUT}/icone-maskable.svg`, maskable)
await sharp(Buffer.from(maskable), { density: 600 }).resize(512, 512).png().toFile(`${OUT}/icone-maskable-512.png`)

/*
 * Vignette de partage : ce qu'un lien AIGMS montre dans une conversation.
 * Le bloc-marque y est repris tel quel, a l'echelle — le composer une seconde
 * fois le ferait deriver.
 */
const ECHELLE = 4.2
const og = `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 1200 630" width="1200" height="630">
  <rect width="1200" height="630" fill="${C.night950}"/>
  <g transform="translate(96,214) scale(${ECHELLE})">
  ${blocMarque({ plaque: C.night700, trait: C.blanc, jalon: C.teal400, nom: C.blanc, mention: '#ffffffb3', nu: true })}
  </g>
  ${courbes(serif400, 'Gouverner l’IA. Décider. Prouver.', 42, 98, 452, '#ffffffb3').svg}
</svg>\n`
writeFileSync(`${OUT}/partage-1200x630.svg`, og)
await sharp(Buffer.from(og), { density: 600 }).resize(1200, 630).png().toFile(`${OUT}/partage-1200x630.png`)

console.log(`Marque exportée dans ${OUT} — palette ${C.night900} / ${C.teal400}`)

# Marque AIGMS — fichiers

*Produits par `node scripts/exporter-marque.mjs`. Ne pas retoucher à la main :
la géométrie vient de `src/components/logo.tsx` et la palette de
`src/app/globals.css`. Le script suit la source ; un fichier corrigé à la main
ne la suivrait plus.*

## Le glyphe

Un **A** dont la barre transversale se prolonge en ligne de registre et
s'achève sur un jalon : l'usage déclaré, la trace qui court, la décision qui la
ponctue. Lisible à 16 px, taille du favicon.

## Palette

| | Hex | Usage |
|---|---|---|
| Bleu nuit | `#0c2036` | plaque de l'icône, sur fond clair |
| Bleu nuit clair | `#1d344e` | plaque, sur fond déjà sombre |
| Bleu-vert | `#09aeae` | le jalon — le seul accent |
| Encre | `#101c28` | le nom, sur fond clair |
| Encre grise | `#535c66` | « by Caritis », sur fond clair |

## L'icône

| Fichier | Pour quoi |
|---|---|
| `icone.svg` | la référence — plaque bleu nuit, trait blanc, jalon bleu-vert |
| `icone-sur-fond-sombre.svg` | plaque d'un ton plus clair, pour ne pas disparaître |
| `icone-sans-plaque-sombre.svg` · `-blanche.svg` | le glyphe seul, à poser sur une couleur libre |
| `icone-monochrome-sombre.svg` · `-blanche.svg` | une seule encre : tampon, télécopie, gravure |
| `icone-16` … `icone-1024.png` | 16, 32, 48, 64, 128, 180, 192, 256, 512, 1024 |
| `favicon.ico` | 16 + 32 + 48 dans un fichier, pour les navigateurs anciens |
| `icone-maskable-512.png` | Android : le glyphe tient dans les 80 % centraux, le fond couvre tout |

`icone-180.png` est la taille d'`apple-touch-icon`. `icone-192` et `icone-512`
sont celles d'un manifeste d'application web.

## Le bloc-marque

| Fichier | Pour quoi |
|---|---|
| `logo.svg` | glyphe + **AIGMS** + « – by Caritis », sur fond clair |
| `logo-sur-fond-sombre.svg` | la même, en blanc |
| `logo-sans-mention.svg` · `-sur-fond-sombre.svg` | sans « by Caritis » — revente en marque blanche |
| `logo-h64` · `-h128` · `-h256.png` | hauteur fixe, largeur libre, fond transparent |

Le texte est en **Newsreader**, **converti en courbes** : un SVG qui référence
une police s'affiche autrement chez qui ne l'a pas, et une marque qui change de
dessin selon le poste n'est plus une marque. Aucune police n'est donc à
installer.

## Partage

`partage-1200x630.png` — ce qu'un lien AIGMS montre dans une conversation ou
sur un réseau. Format `og:image`.

## Ce qu'on ne fait pas avec

- **Ne pas redessiner le glyphe** ni changer ses proportions. Pour une autre
  taille, prendre le SVG.
- **Ne pas recolorer le jalon.** C'est le seul accent de la marque ; le
  déplacer sur le trait enlève ce qu'il signale.
- **Ne pas poser l'icône sans plaque sur un fond qui la fait disparaître** —
  les variantes existent pour cela.
- **Marque blanche** : un tenant qui dépose son logo remplace le bloc entier
  (glyphe et nom), pas seulement le nom. Voir `Wordmark` et `tenantBranding`.

## Le favicon suit la palette

`src/app/icon.svg` — le favicon servi par l'application — portait `#1e2a44` et
`#3fb6c4`, écrits à la main, qui ne sont pas les équivalents de
`--color-night-900` et `--color-teal-400`. Il porte désormais `#0c2036` et
`#09aeae`, comme les fichiers de ce dossier : la marque ne se dédouble plus
selon l'endroit où on la regarde.

Il reste écrit à la main plutôt que produit par le script — un favicon est lu
par le compilateur de Next.js, qui exige un fichier à cet emplacement exact.

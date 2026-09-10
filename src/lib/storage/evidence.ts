/**
 * Emplacement des fichiers de preuve.
 *
 * Ces valeurs vivent hors des actions serveur : un module « use server » ne
 * peut exporter que des fonctions asynchrones, et la route de telechargement
 * comme les actions ont besoin du meme compartiment.
 *
 * La base ne stocke jamais d'URL, seulement le couple (compartiment, chemin) :
 * la meme arborescence se transpose telle quelle sur un stockage compatible S3,
 * ce qui rend un hebergement chez un tiers possible sans reprise de donnees.
 */

export const EVIDENCE_BUCKET = 'evidence'

/** Aligne sur la limite du compartiment posee par la migration 0028. */
export const MAX_EVIDENCE_BYTES = 25 * 1024 * 1024

/** Duree de validite d'un lien de telechargement signe. */
export const SIGNED_URL_TTL_SECONDS = 60

/**
 * Substitut de `server-only` pour les tests.
 *
 * Next fournit ce module par sa propre resolution : il n'existe pas dans
 * node_modules, et son role est de faire echouer la compilation si un module
 * serveur est tire dans un bundle client. Cette garantie est reelle en
 * production et sans objet sous Vitest, qui execute tout cote serveur.
 *
 * On le neutralise donc plutot que de retirer l'import : c'est l'import qui
 * empeche `mailer.ts`, qui lit la cle d'API, de partir vers le navigateur.
 */
export {}

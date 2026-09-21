import type { NextConfig } from 'next'

const nextConfig: NextConfig = {
  reactStrictMode: true,
  typescript: {
    // Les erreurs de type font echouer le build : aucune derogation.
    ignoreBuildErrors: false,
  },
  // Aucun secret ne doit transiter par le bundle client : seules les variables
  // NEXT_PUBLIC_* sont exposees, et elles se limitent a l'URL et a la cle
  // publiable Supabase.
  poweredByHeader: false,
  // Une preuve se depose par action serveur : le corps de la requete porte le
  // fichier. La limite par defaut (1 Mo) refusait un compte rendu signe ou un
  // rapport en PDF — en erreur serveur anonyme. 25 Mo, comme le compartiment.
  experimental: {
    serverActions: {
      bodySizeLimit: '26mb',
    },
  },
}

export default nextConfig

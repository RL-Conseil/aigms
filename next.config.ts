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
}

export default nextConfig

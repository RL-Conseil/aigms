import type { Metadata } from 'next'
import './globals.css'

export const metadata: Metadata = {
  title: 'AIGMS — AI Governance Management System',
  description:
    "Registre unique des usages d'IA, de leurs risques, décisions, contrôles et preuves.",
}

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="fr">
      <body className="min-h-screen antialiased">{children}</body>
    </html>
  )
}

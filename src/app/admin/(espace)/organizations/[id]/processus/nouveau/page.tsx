import Link from 'next/link'
import { notFound } from 'next/navigation'
import { createClient } from '@/lib/supabase/server'
import { Shell } from '@/components/shell'
import { Card } from '@/components/ui'
import { ProcessForm } from '@/components/governance/process-forms'

/**
 * Ajout d'un processus, sur sa propre page.
 *
 * Les deux formulaires vivaient dans la colonne de droite de la carte, visibles
 * en permanence alors qu'on decrit le referentiel de processus une fois pour
 * toutes puis qu'on l'amende rarement. Ils occupaient la place du panneau de
 * detail, qui est ce qu'on vient vraiment consulter.
 *
 * Une page plutot qu'une fenetre modale : c'est deja le motif de la declaration
 * d'un cas d'usage et de la creation d'une organisation, et une modale de
 * saisie longue se prete mal a la relecture — or un processus se nomme une fois
 * et se lit des annees.
 */
export default async function NewProcessPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params
  const supabase = await createClient()

  const { data: organization } = await supabase
    .from('organization')
    .select('id, name')
    .eq('id', id)
    .maybeSingle()

  if (!organization) notFound()

  return (
    <Shell
      breadcrumb={[
        { href: '/admin/organizations', label: 'Organisations' },
        { href: `/admin/organizations/${id}`, label: organization.name },
        { href: `/admin/organizations/${id}/processus`, label: 'Processus et risques' },
      ]}
      organization={{ id, section: 'processus' }}
      title="Ajouter un processus"
      subtitle="Ce que fait l’organisation, indépendamment de l’IA. Les usages s’y rattacheront."
      actions={
        <Link
          href={`/admin/organizations/${id}/processus`}
          className="rounded-md border border-ink-200 px-3.5 py-2 text-sm text-ink-700 hover:bg-ink-100"
        >
          Retour à la carte
        </Link>
      }
    >
      <div className="max-w-2xl">
        <Card
          title="Identité du processus"
          subtitle="Un processus sans activité ne porte aucun usage d’IA gouvernable : prévoyez d’en ajouter une ensuite."
        >
          <ProcessForm organizationId={id} />
        </Card>
      </div>
    </Shell>
  )
}

import Link from 'next/link'
import { notFound } from 'next/navigation'
import { createClient } from '@/lib/supabase/server'
import { Shell } from '@/components/shell'
import { Card } from '@/components/ui'
import { ControlForm } from '@/components/governance/control-forms'

/**
 * Creation d'un controle.
 *
 * Une page, pas une fenetre : un controle vit dans le referentiel de
 * l'organisation et se relit hors du contexte ou il a ete cree — c'est la meme
 * regle que pour un processus.
 */
export default async function NewControlPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params
  const supabase = await createClient()

  const [{ data: organization }, { data: memberships }] = await Promise.all([
    supabase.from('organization').select('id, name').eq('id', id).maybeSingle(),
    supabase
      .from('membership')
      .select('user:user_id (id, full_name, email, job_title)')
      .eq('status', 'active'),
  ])

  if (!organization) notFound()

  const people = (memberships ?? [])
    .map(
      (m) =>
        m.user as unknown as {
          id: string
          full_name: string | null
          email: string
          job_title: string | null
        } | null,
    )
    .filter((u): u is NonNullable<typeof u> => Boolean(u))
    .map((u) => ({
      id: u.id,
      label: u.full_name ? `${u.full_name}${u.job_title ? ` — ${u.job_title}` : ''}` : u.email,
    }))

  return (
    <Shell
      breadcrumb={[
        { href: '/admin', label: 'Organisations' },
        { href: `/admin/organizations/${id}`, label: organization.name },
        { href: `/admin/organizations/${id}/controles`, label: 'Contrôles' },
      ]}
      organization={{ id, section: 'controles' }}
      title="Créer un contrôle"
      subtitle="Une mesure de maîtrise du référentiel de l’organisation."
      actions={
        <Link
          href={`/admin/organizations/${id}/controles`}
          className="rounded-md border border-ink-200 px-3.5 py-2 text-sm text-ink-700 hover:bg-ink-100"
        >
          Retour au référentiel
        </Link>
      }
    >
      <div className="max-w-3xl">
        <Card
          title="Identité du contrôle"
          subtitle="Il faudra ensuite le rattacher aux exigences qu’il satisfait, et lui adosser une preuve."
        >
          <ControlForm organizationId={id} people={people} />
        </Card>
      </div>
    </Shell>
  )
}

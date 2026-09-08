import { notFound } from 'next/navigation'
import { createClient } from '@/lib/supabase/server'
import { Shell } from '@/components/shell'
import { Card } from '@/components/ui'
import { UseCaseForm } from '@/components/governance/use-case-form'

export default async function NewUseCasePage({
  params,
  searchParams,
}: {
  params: Promise<{ id: string }>
  searchParams: Promise<{ activite?: string }>
}) {
  const { id } = await params
  const { activite } = await searchParams
  const supabase = await createClient()

  const [{ data: organization }, { data: activities }, { data: memberships }] = await Promise.all([
    supabase.from('organization').select('id, name').eq('id', id).maybeSingle(),
    supabase
      .from('activity')
      .select('id, name, process:process_id (name)')
      .eq('organization_id', id)
      .order('display_order'),
    supabase
      .from('membership')
      .select('user:user_id (id, full_name, email, job_title)')
      .eq('status', 'active'),
  ])

  if (!organization) notFound()

  const people = (memberships ?? [])
    .map((m) => m.user as unknown as { id: string; full_name: string | null; email: string; job_title: string | null } | null)
    .filter((u): u is NonNullable<typeof u> => Boolean(u))
    .map((u) => ({
      id: u.id,
      label: u.full_name ? `${u.full_name}${u.job_title ? ` — ${u.job_title}` : ''}` : u.email,
    }))

  const activityOptions = (activities ?? []).map((a) => ({
    id: a.id,
    name: a.name,
    process_name: (a.process as unknown as { name: string } | null)?.name ?? '—',
  }))

  return (
    <Shell
      breadcrumb={[
        { href: '/admin', label: 'Organisations' },
        { href: `/admin/organizations/${id}`, label: organization.name },
        { href: `/admin/organizations/${id}/processus`, label: 'Processus' },
      ]}
      title="Déclarer un cas d’usage"
      subtitle="Un usage d’IA entre dans le registre. Sa gouvernance commence ici."
    >
      <div className="max-w-3xl">
        <Card title="Fiche d’intake">
          <UseCaseForm
            organizationId={id}
            activities={activityOptions}
            people={people}
            defaultActivityId={activite}
          />
        </Card>
      </div>
    </Shell>
  )
}

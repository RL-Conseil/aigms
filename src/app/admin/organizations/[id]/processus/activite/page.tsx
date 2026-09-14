import Link from 'next/link'
import { notFound } from 'next/navigation'
import { createClient } from '@/lib/supabase/server'
import { Shell } from '@/components/shell'
import { Card, Empty } from '@/components/ui'
import { ActivityForm } from '@/components/governance/process-forms'

/**
 * Ajout d'une activite, sur sa propre page.
 *
 * L'activite est le point de rattachement d'un cas d'usage : c'est elle qui
 * relie ce que fait l'organisation a ce qu'elle y met d'IA. Elle merite donc la
 * meme place qu'un processus, et le meme motif — une page, pas une fenetre.
 */
export default async function NewActivityPage({
  params,
  searchParams,
}: {
  params: Promise<{ id: string }>
  searchParams: Promise<{ processus?: string }>
}) {
  const { id } = await params
  const { processus } = await searchParams
  const supabase = await createClient()

  const [{ data: organization }, { data: processes }] = await Promise.all([
    supabase.from('organization').select('id, name').eq('id', id).maybeSingle(),
    supabase.from('process').select('id, name').eq('organization_id', id).order('display_order'),
  ])

  if (!organization) notFound()

  return (
    <Shell
      breadcrumb={[
        { href: '/admin', label: 'Organisations' },
        { href: `/admin/organizations/${id}`, label: organization.name },
        { href: `/admin/organizations/${id}/processus`, label: 'Processus et risques' },
      ]}
      organization={{ id, section: 'processus' }}
      title="Ajouter une activité"
      subtitle="Une activité se rattache à un processus, et accueille les usages d’IA."
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
        <Card title="Identité de l’activité">
          {processes?.length ? (
            <ActivityForm
              organizationId={id}
              processes={processes}
              defaultProcessId={processus}
            />
          ) : (
            <Empty>
              Aucun processus sur cette organisation. Une activité s’y rattache : commencez par{' '}
              <Link
                href={`/admin/organizations/${id}/processus/nouveau`}
                className="text-brand-600 hover:underline"
              >
                en créer un
              </Link>
              .
            </Empty>
          )}
        </Card>
      </div>
    </Shell>
  )
}

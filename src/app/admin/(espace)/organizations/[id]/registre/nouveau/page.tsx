import Link from 'next/link'
import { notFound } from 'next/navigation'
import { createClient } from '@/lib/supabase/server'
import { Shell } from '@/components/shell'
import { Card } from '@/components/ui'
import { SegmentedFilter } from '@/components/governance/segmented-filter'
import { AssetForm, VendorForm } from '@/components/governance/registry-forms'

/**
 * Inscription au registre : un fournisseur ou un actif d'IA.
 *
 * Une page, pas une fenetre : l'un comme l'autre vivent dans le referentiel de
 * l'organisation et se relisent hors du contexte ou ils ont ete crees — meme
 * regle que pour un processus ou un controle.
 *
 * Les deux partagent la page parce qu'ils se saisissent au meme moment : on
 * declare un fournisseur puis le modele qu'il fournit, et l'inverse oblige a
 * revenir.
 */
export default async function RegistryEntryPage({
  params,
  searchParams,
}: {
  params: Promise<{ id: string }>
  searchParams: Promise<{ nature?: string }>
}) {
  const { id } = await params
  const { nature } = await searchParams
  const kind = nature === 'actif' ? 'actif' : 'fournisseur'
  const supabase = await createClient()

  const [{ data: organization }, { data: vendors }, { data: memberships }] = await Promise.all([
    supabase.from('organization').select('id, name').eq('id', id).maybeSingle(),
    supabase.from('vendor').select('id, name').eq('organization_id', id).order('name'),
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
        { href: '/admin/organizations', label: 'Organisations' },
        { href: `/admin/organizations/${id}`, label: organization.name },
      ]}
      organization={{ id, section: 'apercu' }}
      title={kind === 'actif' ? 'Inscrire un actif d’IA' : 'Déclarer un fournisseur'}
      subtitle="Ce que l’organisation emploie, et de qui elle dépend."
      actions={
        <div className="flex items-center gap-3">
          <SegmentedFilter
            label="Nature de l’inscription"
            param="nature"
            basePath={`/admin/organizations/${id}/registre/nouveau`}
            selected={kind === 'actif' ? 'actif' : ''}
            options={[
              { key: '', label: 'Fournisseur' },
              { key: 'actif', label: 'Actif d’IA' },
            ]}
          />
          <Link
            href={`/admin/organizations/${id}`}
            className="rounded-md border border-ink-200 px-3.5 py-2 text-sm text-ink-700 hover:bg-ink-100"
          >
            Retour
          </Link>
        </div>
      }
    >
      <div className="max-w-3xl">
        {kind === 'actif' ? (
          <Card
            title="Identité de l’actif"
            subtitle="Système, modèle, agent ou jeu de données. Il se rattachera ensuite aux cas d’usage qui l’emploient."
          >
            <AssetForm
              organizationId={id}
              vendors={vendors ?? []}
              people={people}
            />
          </Card>
        ) : (
          <Card
            title="Identité du fournisseur"
            subtitle="La revue tiers se prononce séparément : c’est un acte, pas une propriété."
          >
            <VendorForm organizationId={id} />
          </Card>
        )}
      </div>
    </Shell>
  )
}

import Link from 'next/link'
import { notFound } from 'next/navigation'
import { createClient } from '@/lib/supabase/server'
import { Shell } from '@/components/shell'
import { Card } from '@/components/ui'
import { DecisionForm } from '@/components/governance/decision-forms'
import { describePerson, organizationPeople } from '@/lib/governance/people'

/**
 * Soumission d'une decision.
 *
 * Une page : une decision se relit des annees apres, hors du contexte ou elle a
 * ete prise — c'est meme sa raison d'etre. Et sa saisie est longue : enonce,
 * justification, options ecartees, conditions, dates.
 */
export default async function NewDecisionPage({
  params,
  searchParams,
}: {
  params: Promise<{ id: string }>
  searchParams: Promise<{ 'cas-d-usage'?: string }>
}) {
  const { id } = await params
  const search = await searchParams
  const supabase = await createClient()

  const [{ data: organization }, { data: useCases }, people, { data: evidence }] = await Promise.all([
    supabase.from('organization').select('id, name').eq('id', id).maybeSingle(),
    supabase
      .from('ai_use_case')
      .select('id, name, business_ref')
      .eq('organization_id', id)
      .order('business_ref'),
    organizationPeople(id, true),
    supabase
      .from('evidence')
      .select('id, business_ref, title')
      .eq('organization_id', id)
      .eq('validation_status', 'validated')
      .order('business_ref'),
  ])

  if (!organization) notFound()

  return (
    <Shell
      breadcrumb={[
        { href: '/admin/organizations', label: 'Organisations' },
        { href: `/admin/organizations/${id}`, label: organization.name },
        { href: `/admin/organizations/${id}/decisions`, label: 'Registre de décisions' },
      ]}
      organization={{ id, section: 'decisions' }}
      title="Soumettre une décision"
      subtitle="Elle naîtra soumise : l’approbation est un second acte."
      actions={
        <Link
          href={`/admin/organizations/${id}/decisions`}
          className="rounded-md border border-ink-200 px-3.5 py-2 text-sm text-ink-700 hover:bg-ink-100"
        >
          Retour au registre
        </Link>
      }
    >
      <div className="max-w-3xl">
        <Card
          title="La décision"
          subtitle="Ce qui est décidé, pourquoi, sous quelles conditions et jusqu’à quand."
        >
          <DecisionForm
            organizationId={id}
            useCases={useCases ?? []}
            evidence={evidence ?? []}
            people={people.map((person) => ({
              userId: person.userId,
              label: describePerson(person),
            }))}
            defaultUseCaseId={search['cas-d-usage']}
          />
        </Card>
      </div>
    </Shell>
  )
}

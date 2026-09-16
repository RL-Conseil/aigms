import Link from 'next/link'
import { notFound } from 'next/navigation'
import { createClient } from '@/lib/supabase/server'
import { Shell } from '@/components/shell'
import { Card } from '@/components/ui'
import { ControlForm } from '@/components/governance/control-forms'
import { CatalogPickForm, type CatalogChoice } from '@/components/governance/catalog-pick-form'
import { SegmentedFilter } from '@/components/governance/segmented-filter'

/**
 * Ajout d'un controle, par deux voies.
 *
 * DEPUIS UN REFERENTIEL — la voie premiere : un controle-type publie, de
 * l'editeur ou du cabinet, devient le controle operationnel de l'organisation,
 * lien conserve, correspondances ISO 42001 rattachees. LIBRE — pour ce qui
 * n'existe dans aucun referentiel.
 *
 * Une page, pas une fenetre : un controle vit dans la liste de l'organisation
 * et se relit hors du contexte ou il a ete cree.
 */
export default async function NewControlPage({
  params,
  searchParams,
}: {
  params: Promise<{ id: string }>
  searchParams: Promise<{ voie?: string }>
}) {
  const { id } = await params
  const { voie } = await searchParams
  const supabase = await createClient()

  const [{ data: organization }, { data: memberships }, { data: catalog }, { data: details }] =
    await Promise.all([
      supabase.from('organization').select('id, name').eq('id', id).maybeSingle(),
      supabase
        .from('membership')
        .select('user:user_id (id, full_name, email, job_title)')
        .eq('status', 'active'),
      supabase.rpc('catalog_controls_for', { p_organization_id: id }),
      // La fiche du controle-type — questions, preuves, correspondances — se
      // lit avant d'ajouter : un choix eclaire vaut mieux qu'un titre.
      supabase
        .from('catalog_control')
        .select('id, assessment_questions, expected_evidence, framework_mappings'),
    ])

  const detailById = new Map(
    (details ?? []).map((d) => [
      d.id,
      {
        assessment_questions: (d.assessment_questions as string[]) ?? [],
        expected_evidence: (d.expected_evidence as string[]) ?? [],
        framework_mappings:
          (d.framework_mappings as { framework: string; version?: string; reference: string }[]) ?? [],
      },
    ]),
  )
  const choices: CatalogChoice[] = ((catalog ?? []) as Omit<CatalogChoice, 'assessment_questions' | 'expected_evidence' | 'framework_mappings'>[]).map(
    (c) => ({
      ...c,
      ...(detailById.get(c.catalog_control_id) ?? {
        assessment_questions: [],
        expected_evidence: [],
        framework_mappings: [],
      }),
    }),
  )
  const free = voie === 'libre'

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
        { href: `/admin/organizations/${id}/controles`, label: 'Liste des contrôles opérationnels' },
      ]}
      organization={{ id, section: 'controles' }}
      title="Ajouter un contrôle"
      subtitle="Depuis un référentiel publié, ou librement pour ce qui n’y figure pas."
      actions={
        <Link
          href={`/admin/organizations/${id}/controles`}
          className="rounded-md border border-ink-200 px-3.5 py-2 text-sm text-ink-700 hover:bg-ink-100"
        >
          Retour à la liste
        </Link>
      }
    >
      <div className="max-w-3xl">
        <div className="mb-5">
          <SegmentedFilter
            label="Voie d’ajout"
            param="voie"
            basePath={`/admin/organizations/${id}/controles/nouveau`}
            selected={free ? 'libre' : ''}
            options={[
              { key: '', label: 'Depuis un référentiel', count: choices.length },
              { key: 'libre', label: 'Libre' },
            ]}
          />
        </div>

        {free ? (
          <Card
            title="Contrôle libre"
            subtitle="Pour une mesure propre à l’organisation. Il faudra ensuite le rattacher aux exigences qu’il satisfait, et lui adosser une preuve."
          >
            <ControlForm organizationId={id} people={people} />
          </Card>
        ) : (
          <Card
            title="Depuis un référentiel"
            subtitle="Le contrôle-type est repris tel quel — code, nom, objectif, fréquence — et ses correspondances ISO/IEC 42001 sont rattachées d’emblée."
          >
            <CatalogPickForm organizationId={id} choices={choices} people={people} />
          </Card>
        )}
      </div>
    </Shell>
  )
}

import Link from 'next/link'
import { notFound } from 'next/navigation'
import { createClient } from '@/lib/supabase/server'
import { Shell } from '@/components/shell'
import { Badge, Card, Empty, Stat, StatStrip } from '@/components/ui'
import { InfoTip } from '@/components/info-tip'
import { SegmentedFilter } from '@/components/governance/segmented-filter'
import {
  ControlStateForm,
  RequirementMappingForm,
} from '@/components/governance/control-forms'
import { CONTROL_STATUS_LABELS, formatDate } from '@/lib/domain/governance'

/**
 * Referentiel de controles de l'organisation.
 *
 * Tout ce que la plateforme sait lire — couverture, graphe, chemin du risque,
 * Declaration d'Applicabilite, registre des preuves — repose sur ces lignes.
 * Elles n'etaient creees que par le jeu de demonstration : sur un client reel,
 * la moitie des ecrans restait vide sans qu'on puisse y remedier.
 */

type Control = {
  id: string
  business_ref: string
  code: string
  name: string
  objective: string
  status: string
  is_mandatory: boolean
  frequency: string | null
  last_tested_at: string | null
  next_test_at: string | null
}

const STATE_FILTERS = [
  { key: '', label: 'Tous' },
  { key: 'operating', label: 'Opérants' },
  { key: 'implemented', label: 'Mis en place' },
  { key: 'proposed', label: 'Proposés' },
  { key: 'ineffective', label: 'Inefficaces' },
  { key: 'retired', label: 'Retirés' },
] as const

export default async function ControlsPage({
  params,
  searchParams,
}: {
  params: Promise<{ id: string }>
  searchParams: Promise<{ etat?: string }>
}) {
  const { id } = await params
  const { etat } = await searchParams
  const supabase = await createClient()

  const [{ data: organization }, { data: controlRows }, { data: requirementRows }, { data: links }] =
    await Promise.all([
      supabase.from('organization').select('id, name, business_ref').eq('id', id).maybeSingle(),
      supabase
        .from('control')
        .select(
          'id, business_ref, code, name, objective, status, is_mandatory, frequency, last_tested_at, next_test_at',
        )
        .eq('organization_id', id)
        .order('code'),
      supabase
        .from('requirement')
        .select('id, requirement_reference, title, framework:framework_id!inner(code, version)')
        .eq('framework.code', 'ISO_IEC_42001')
        .eq('framework.version', '2023')
        .order('display_order'),
      supabase
        .from('control_requirement_map')
        .select('control_id, requirement:requirement_id (requirement_reference)'),
    ])

  if (!organization) notFound()

  const controls = (controlRows ?? []) as Control[]
  const requirements = (requirementRows ?? []).map((r) => ({
    id: r.id,
    reference: r.requirement_reference,
    title: r.title,
  }))

  const mappedBy = new Map<string, string[]>()
  for (const link of links ?? []) {
    const requirement = link.requirement as unknown as { requirement_reference: string } | null
    if (!requirement) continue
    const list = mappedBy.get(link.control_id) ?? []
    list.push(requirement.requirement_reference)
    mappedBy.set(link.control_id, list)
  }

  const shown = etat ? controls.filter((c) => c.status === etat) : controls
  const operating = controls.filter((c) => c.status === 'operating').length
  const mandatory = controls.filter((c) => c.is_mandatory).length
  const unmapped = controls.filter((c) => !mappedBy.has(c.id)).length

  return (
    <Shell
      breadcrumb={[
        { href: '/admin', label: 'Organisations' },
        { href: `/admin/organizations/${id}`, label: organization.name },
      ]}
      organization={{ id, section: 'controles' }}
      title="Contrôles"
      subtitle="Le dispositif de maîtrise de l’organisation, et ce qu’il couvre."
      actions={
        <div className="flex items-center gap-3">
          <Link
            href={`/admin/organizations/${id}/controles/nouveau`}
            className="rounded-md bg-night-900 px-4 py-2.5 text-sm font-medium text-white hover:bg-night-800"
          >
            Créer un contrôle
          </Link>
          <InfoTip label="Comment lire ce référentiel" title="À quoi servent ces lignes">
            <div className="flex flex-col gap-3 text-sm leading-relaxed text-ink-600">
              <p>
                Ce référentiel est le socle de tout ce que la plateforme sait dire : taux de
                couverture, graphe de gouvernance, chemin d’un risque, Déclaration d’Applicabilité.
                Un contrôle qui n’existe pas ici ne peut être ni prouvé, ni rattaché, ni opposé.
              </p>
              <p>
                <strong className="font-medium text-ink-800">Trois gestes distincts.</strong> Créer
                le contrôle le décrit ; le déclarer <em>opérant</em> dit qu’il fonctionne ; y
                rattacher une preuve validée et non échue est ce qui le fait compter comme
                couvrant. Les trois sont nécessaires, et aucun ne remplace les autres.
              </p>
              <p>
                <strong className="font-medium text-ink-800">Les exigences.</strong> Rattacher un
                contrôle à une exigence de l’Annexe A alimente la Déclaration d’Applicabilité — un
                même contrôle en sert souvent plusieurs, et la preuve n’est collectée qu’une fois.
              </p>
            </div>
          </InfoTip>
        </div>
      }
    >
      <StatStrip>
        <Stat label="Contrôles" value={controls.length} />
        <Stat label="Opérants" value={operating} tone="ok" />
        <Stat label="Obligatoires" value={mandatory} />
        <Stat label="Sans exigence rattachée" value={unmapped} tone="warn" />
      </StatStrip>

      <div className="mb-5">
        <SegmentedFilter
          label="Filtrer par état"
          param="etat"
          basePath={`/admin/organizations/${id}/controles`}
          selected={etat}
          options={STATE_FILTERS.map((option) => ({
            key: option.key,
            label: option.label,
            count: option.key
              ? controls.filter((c) => c.status === option.key).length
              : controls.length,
          }))}
        />
      </div>

      <Card title="Référentiel" subtitle={`${shown.length} contrôle(s)`}>
        {shown.length ? (
          <ul className="flex flex-col divide-y divide-ink-100">
            {shown.map((control) => (
              <li key={control.id} className="py-4 first:pt-0 last:pb-0">
                <div className="flex flex-wrap items-start justify-between gap-3">
                  <div className="min-w-0">
                    <p className="text-sm font-medium text-ink-900">
                      <span className="mr-2 font-mono text-xs text-ink-400">{control.code}</span>
                      {control.name}
                    </p>
                    <p className="mt-1 text-sm leading-relaxed text-ink-600">{control.objective}</p>
                    <p className="mt-1.5 text-xs text-ink-500">
                      {control.business_ref}
                      {control.frequency ? ` · ${control.frequency}` : ''}
                      {control.last_tested_at
                        ? ` · dernier test le ${formatDate(control.last_tested_at)}`
                        : ' · jamais testé'}
                      {control.next_test_at
                        ? ` · prochain le ${formatDate(control.next_test_at)}`
                        : ''}
                    </p>
                    <p className="mt-1.5 text-xs text-ink-500">
                      {mappedBy.get(control.id)?.length
                        ? `Exigences : ${mappedBy.get(control.id)!.join(', ')}`
                        : 'Aucune exigence rattachée — ce contrôle ne compte dans aucune Déclaration.'}
                    </p>
                  </div>

                  <div className="flex shrink-0 flex-col items-end gap-2">
                    <div className="flex gap-2">
                      {control.is_mandatory ? <Badge tone="warn">Obligatoire</Badge> : null}
                      <Badge
                        tone={
                          control.status === 'operating'
                            ? 'ok'
                            : control.status === 'ineffective'
                              ? 'stop'
                              : 'neutral'
                        }
                      >
                        {CONTROL_STATUS_LABELS[control.status] ?? control.status}
                      </Badge>
                    </div>
                    <div className="flex flex-wrap justify-end gap-2">
                      <ControlStateForm
                        organizationId={id}
                        controlId={control.id}
                        code={control.code}
                        status={control.status}
                        lastTestedAt={control.last_tested_at}
                        nextTestAt={control.next_test_at}
                      />
                      <RequirementMappingForm
                        organizationId={id}
                        controlId={control.id}
                        code={control.code}
                        requirements={requirements}
                      />
                    </div>
                  </div>
                </div>
              </li>
            ))}
          </ul>
        ) : controls.length ? (
          <Empty>
            Aucun contrôle dans cet état.{' '}
            <Link
              href={`/admin/organizations/${id}/controles`}
              className="text-brand-600 hover:underline"
            >
              Revenir au référentiel complet
            </Link>
            .
          </Empty>
        ) : (
          <Empty>
            Aucun contrôle. Tant que ce référentiel est vide, la couverture, le graphe et la
            Déclaration d’Applicabilité n’ont rien à montrer.
          </Empty>
        )}
      </Card>
    </Shell>
  )
}

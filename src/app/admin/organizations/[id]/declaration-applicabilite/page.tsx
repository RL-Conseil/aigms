import Link from 'next/link'
import { notFound } from 'next/navigation'
import { createClient } from '@/lib/supabase/server'
import { Shell } from '@/components/shell'
import { Badge, Card, Empty } from '@/components/ui'

/**
 * Declaration d'Applicabilite.
 *
 * Le document qu'un auditeur ouvre en premier : pour chaque exigence du
 * referentiel, ce qui la couvre chez ce client, et dans quel etat. Les
 * exigences sans couverture sont affichees comme telles — une ligne vide
 * serait plus trompeuse qu'un aveu.
 */

type Coverage = 'uncovered' | 'declared' | 'operating_without_evidence' | 'evidenced'

type SoaRow = {
  objective_code: string
  objective_title: string
  requirement_reference: string
  requirement_title: string
  internal_summary: string
  expected_evidence: string | null
  display_order: number
  control_count: number
  operating_count: number
  evidence_count: number
  controls: { code: string; name: string; status: string; is_mandatory: boolean; evidences: number }[]
  coverage: Coverage
}

const COVERAGE: Record<Coverage, { label: string; tone: 'ok' | 'warn' | 'stop' | 'neutral'; help: string }> = {
  evidenced: {
    label: 'Couverte et prouvée',
    tone: 'ok',
    help: 'Un contrôle opérant, avec au moins une preuve rattachée.',
  },
  operating_without_evidence: {
    label: 'Opérante sans preuve',
    tone: 'warn',
    help: 'Le contrôle fonctionne, mais rien ne permet encore de le démontrer.',
  },
  declared: {
    label: 'Contrôle déclaré',
    tone: 'warn',
    help: 'Un contrôle est rattaché, sans être encore opérant.',
  },
  uncovered: {
    label: 'Non couverte',
    tone: 'stop',
    help: 'Aucun contrôle ne répond à cette exigence.',
  },
}

export default async function StatementOfApplicabilityPage({
  params,
}: {
  params: Promise<{ id: string }>
}) {
  const { id } = await params
  const supabase = await createClient()

  const [{ data: organization }, { data: rows }] = await Promise.all([
    supabase.from('organization').select('id, name, business_ref').eq('id', id).maybeSingle(),
    supabase.rpc('statement_of_applicability', {
      p_organization_id: id,
      p_framework_code: 'ISO_IEC_42001',
      p_framework_version: '2023',
    }),
  ])

  if (!organization) notFound()

  const soa = (rows ?? []) as SoaRow[]
  const byObjective = new Map<string, SoaRow[]>()
  for (const row of soa) {
    const list = byObjective.get(row.objective_code) ?? []
    list.push(row)
    byObjective.set(row.objective_code, list)
  }

  const tally = (coverage: Coverage) => soa.filter((r) => r.coverage === coverage).length
  const covered = tally('evidenced')
  const partial = tally('declared') + tally('operating_without_evidence')
  const uncovered = tally('uncovered')

  return (
    <Shell
      breadcrumb={[
        { href: '/admin', label: 'Organisations' },
        { href: `/admin/organizations/${id}`, label: organization.name },
      ]}
      title="Déclaration d’Applicabilité"
      subtitle="ISO/IEC 42001:2023, Annexe A — 38 contrôles de référence en 9 objectifs."
      actions={<Badge tone="info">{organization.business_ref}</Badge>}
    >
      <div className="mb-5 grid gap-3 sm:grid-cols-4">
        <Stat label="Couvertes et prouvées" value={covered} total={soa.length} tone="ok" />
        <Stat label="Partiellement couvertes" value={partial} total={soa.length} tone="warn" />
        <Stat label="Non couvertes" value={uncovered} total={soa.length} tone="stop" />
        <div className="rounded-lg border border-ink-200 bg-white px-4 py-3">
          <p className="text-2xl font-semibold tabular-nums text-ink-900">{soa.length}</p>
          <p className="mt-0.5 text-xs text-ink-600">Contrôles de référence</p>
        </div>
      </div>

      <div className="mb-5 rounded-lg border border-ink-200 bg-white px-5 py-4">
        <p className="text-sm leading-relaxed text-ink-600">
          <strong className="font-semibold text-ink-900">
            L’Annexe A n’est pas une liste à cocher.
          </strong>{' '}
          C’est un catalogue dans lequel on puise : le choix des contrôles retenus, comme celui des
          contrôles écartés, se justifie par l’appréciation des risques et l’évaluation d’impact.
          Une exclusion motivée est une réponse recevable ; une exigence laissée sans réponse ne
          l’est pas.
        </p>
        <p className="mt-3 text-[13px] leading-relaxed text-ink-500">
          Les intitulés et résumés présentés ici sont rédigés par AIGMS et expriment ce qu’une
          organisation doit pouvoir démontrer. Ils ne reproduisent pas le texte de la norme, qui
          s’obtient auprès de l’ISO, et ne valent ni avis de certification ni conclusion d’audit.
        </p>
      </div>

      {soa.length ? (
        <div className="flex flex-col gap-5">
          {[...byObjective.entries()].map(([code, requirements]) => (
            <Card
              key={code}
              title={`${code} — ${requirements[0]?.objective_title ?? ''}`}
              subtitle={`${requirements.filter((r) => r.coverage === 'evidenced').length} / ${requirements.length} couverte(s) et prouvée(s)`}
            >
              <ul className="divide-y divide-ink-100">
                {requirements.map((row) => (
                  <li key={row.requirement_reference} className="py-4">
                    <div className="flex flex-wrap items-start justify-between gap-3">
                      <div className="min-w-0 flex-1">
                        <p className="text-sm font-medium text-ink-900">
                          <span className="font-mono text-xs text-ink-500">
                            {row.requirement_reference}
                          </span>{' '}
                          {row.requirement_title}
                        </p>
                        <p className="mt-1.5 text-sm leading-relaxed text-ink-600">
                          {row.internal_summary}
                        </p>

                        {row.controls.length ? (
                          <ul className="mt-2.5 flex flex-wrap gap-1.5">
                            {row.controls.map((control) => (
                              <li
                                key={control.code}
                                className="rounded bg-ink-100 px-2 py-0.5 text-xs text-ink-600"
                                title={control.name}
                              >
                                {control.code}
                                {control.evidences > 0 ? ` · ${control.evidences} preuve(s)` : ''}
                              </li>
                            ))}
                          </ul>
                        ) : row.expected_evidence ? (
                          <p className="mt-2.5 text-xs text-ink-500">
                            Preuves habituellement attendues : {row.expected_evidence}
                          </p>
                        ) : null}
                      </div>

                      <Badge tone={COVERAGE[row.coverage].tone}>
                        {COVERAGE[row.coverage].label}
                      </Badge>
                    </div>
                  </li>
                ))}
              </ul>
            </Card>
          ))}
        </div>
      ) : (
        <Card title="Référentiel">
          <Empty>
            Le référentiel ISO/IEC 42001 n’est pas chargé sur cette instance, ou cette organisation
            n’est pas accessible depuis votre compte.
          </Empty>
        </Card>
      )}

      <p className="mt-6 text-[13px] text-ink-500">
        Pour rattacher un contrôle à une exigence, passez par la fiche du contrôle de{' '}
        <Link href={`/admin/organizations/${id}`} className="text-brand-600 hover:underline">
          {organization.name}
        </Link>
        .
      </p>
    </Shell>
  )
}

function Stat({
  label,
  value,
  total,
  tone,
}: {
  label: string
  value: number
  total: number
  tone: 'ok' | 'warn' | 'stop'
}) {
  const color =
    value === 0 ? 'text-ink-400' : tone === 'ok' ? 'text-emerald-700' : tone === 'warn' ? 'text-amber-700' : 'text-rose-700'

  return (
    <div className="rounded-lg border border-ink-200 bg-white px-4 py-3">
      <p className={`text-2xl font-semibold tabular-nums ${color}`}>
        {value}
        <span className="text-base font-normal text-ink-400"> / {total}</span>
      </p>
      <p className="mt-0.5 text-xs text-ink-600">{label}</p>
    </div>
  )
}

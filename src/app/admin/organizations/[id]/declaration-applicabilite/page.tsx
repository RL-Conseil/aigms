import Link from 'next/link'
import { notFound } from 'next/navigation'
import { createClient } from '@/lib/supabase/server'
import { Shell } from '@/components/shell'
import { Badge, Card, Empty, Stat, StatStrip } from '@/components/ui'
import { SoaDecisionForm } from '@/components/governance/soa-forms'
import { SegmentedFilter } from '@/components/governance/segmented-filter'
import { InfoTip } from '@/components/info-tip'
import {
  ACTIVITY_PROFILE_LABELS,
  CRITICALITY_LABELS,
  criticalityTone,
  GAP_LABELS,
  REGIME_LABELS,
  type ActivityProfile,
  type EvidenceCriticality,
} from '@/lib/domain/activity-profile'

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
  expected_criticality: EvidenceCriticality | null
  evidence_regime: 'technical' | 'organisational' | 'exclusion' | 'unspecified'
  typologies: { code: string; name: string; criticality: EvidenceCriticality | null }[]
  soa_status: 'selected' | 'excluded' | null
  soa_justification: string | null
  decided_by_name: string | null
  gap: string | null
  requirement_id?: string
}

type Readiness = {
  available: boolean
  profile?: ActivityProfile | null
  requirements?: number
  decided?: number
  selected?: number
  excluded?: number
  undecided?: number
  technical_expected?: number
  gaps?: Record<string, number>
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
  searchParams,
}: {
  params: Promise<{ id: string }>
  searchParams: Promise<{ ecart?: string; objectif?: string; exigence?: string }>
}) {
  const { id } = await params
  const { ecart, objectif, exigence } = await searchParams
  const supabase = await createClient()

  const [{ data: organization }, { data: rows }, { data: readinessData }, { data: requirementRows }] =
    await Promise.all([
      supabase
        .from('organization')
        .select('id, name, business_ref, ai_activity_profile')
        .eq('id', id)
        .maybeSingle(),
      supabase.rpc('statement_of_applicability', {
        p_organization_id: id,
        p_framework_code: 'ISO_IEC_42001',
        p_framework_version: '2023',
      }),
      supabase.rpc('soa_readiness', {
        p_organization_id: id,
        p_framework_code: 'ISO_IEC_42001',
        p_framework_version: '2023',
      }),
      // La fonction rend la reference, pas l'identifiant : la decision s'ecrit
      // sur l'exigence, il faut donc les rapprocher.
      supabase
        .from('requirement')
        .select('id, requirement_reference, framework:framework_id!inner(code, version)')
        .eq('framework.code', 'ISO_IEC_42001')
        .eq('framework.version', '2023'),
    ])

  if (!organization) notFound()

  const readiness = (readinessData ?? { available: false }) as Readiness
  const profile = (organization.ai_activity_profile ?? null) as ActivityProfile | null
  const requirementIds = new Map(
    (requirementRows ?? []).map((r) => [r.requirement_reference, r.id]),
  )
  const all = ((rows ?? []) as SoaRow[]).map((row) => ({
    ...row,
    requirement_id: requirementIds.get(row.requirement_reference),
  }))

  // Les filtres se lisent sur l'ENSEMBLE de la Déclaration : leurs compteurs ne
  // doivent pas dépendre l'un de l'autre, sinon on ne sait plus ce qu'on compte.
  const countGap = (gap: string) => all.filter((r) => r.gap === gap).length
  const gapFilters = [
    { key: '', label: 'Toutes', count: all.length },
    { key: 'undecided', label: 'À décider', count: countGap('undecided'), tone: 'warn' as const },
    {
      key: 'exclusion_contested',
      label: 'Exclusion à réexaminer',
      count: countGap('exclusion_contested'),
      tone: 'stop' as const,
    },
    {
      key: 'technical_evidence_missing',
      label: 'Preuve technique manquante',
      count: countGap('technical_evidence_missing'),
      tone: 'stop' as const,
    },
    {
      key: 'evidence_missing',
      label: 'Sans contrôle',
      count: countGap('evidence_missing'),
      tone: 'warn' as const,
    },
    {
      key: 'conformes',
      label: 'Sans écart',
      count: all.filter((r) => r.gap === null).length,
      tone: 'neutral' as const,
    },
  ]

  // Tri naturel : « A.10 » suit « A.9 ». Un tri alphabetique le placerait en
  // tete, entre « Tous » et « A.2 », ce qui se lit comme une erreur.
  const objectiveRank = (code: string) => Number(code.replace(/^A\./, '')) || 0
  const objectiveTitles = new Map(all.map((r) => [r.objective_code, r.objective_title]))
  const objectives = [...new Set(all.map((r) => r.objective_code))].sort(
    (a, b) => objectiveRank(a) - objectiveRank(b),
  )
  const objectiveFilters = [
    { key: '', label: 'Tous les objectifs' },
    ...objectives.map((code) => ({
      key: code,
      label: code,
      // « A.2 » ne se retient pas ; son intitule si.
      hint: objectiveTitles.get(code),
      count: all.filter((r) => r.objective_code === code && r.gap !== null).length,
      tone: 'warn' as const,
    })),
  ]

  const soa = all.filter((row) => {
    if (objectif && row.objective_code !== objectif) return false
    if (!ecart) return true
    if (ecart === 'conformes') return row.gap === null
    return row.gap === ecart
  })
  const byObjective = new Map<string, SoaRow[]>()
  for (const row of soa) {
    const list = byObjective.get(row.objective_code) ?? []
    list.push(row)
    byObjective.set(row.objective_code, list)
  }

  const tally = (coverage: Coverage) => all.filter((r) => r.coverage === coverage).length
  const covered = tally('evidenced')
  const partial = tally('declared') + tally('operating_without_evidence')
  const uncovered = tally('uncovered')

  return (
    <Shell
      breadcrumb={[
        { href: '/admin', label: 'Organisations' },
        { href: `/admin/organizations/${id}`, label: organization.name },
      ]}
      organization={{ id, section: 'soa' }}
      title="Déclaration d’Applicabilité"
      subtitle="ISO/IEC 42001:2023, Annexe A — 38 contrôles de référence en 9 objectifs."
      actions={
        <div className="flex items-center gap-3">
          <Badge tone="info">{organization.business_ref}</Badge>
          {/*
            La mise en garde doit rester DISPONIBLE sans rester PRESENTE : on la
            lit une fois, on veut pouvoir la relire, et elle n'a pas a occuper
            le haut de l'ecran a chaque visite.
          */}
          <InfoTip
            label="Ce que cette Déclaration est, et n’est pas"
            title="L’Annexe A n’est pas une liste à cocher"
          >
            <p className="text-sm leading-relaxed text-ink-600">
              C’est un catalogue dans lequel on puise : le choix des contrôles retenus, comme celui
              des contrôles écartés, se justifie par l’appréciation des risques et l’évaluation
              d’impact. Une exclusion motivée est une réponse recevable ; une exigence laissée sans
              réponse ne l’est pas.
            </p>
            <p className="mt-3 text-[13px] leading-relaxed text-ink-500">
              Les intitulés et résumés présentés ici sont rédigés par AIGMS et expriment ce qu’une
              organisation doit pouvoir démontrer. Ils ne reproduisent pas le texte de la norme, qui
              s’obtient auprès de l’ISO, et ne valent ni avis de certification ni conclusion
              d’audit.
            </p>
          </InfoTip>
        </div>
      }
    >
      <StatStrip>
        <Stat label="Couvertes et prouvées" value={covered} total={all.length} tone="ok" />
        <Stat label="Partiellement couvertes" value={partial} total={all.length} tone="warn" />
        <Stat label="Non couvertes" value={uncovered} total={all.length} tone="stop" />
        <Stat
          label="Sans décision portée"
          value={readiness.undecided ?? 0}
          total={all.length}
          tone="stop"
        />
      </StatStrip>

      {/*
        La regle d'or, en tete : c'est le premier defaut qu'un auditeur releve,
        et le seul qui ne se rattrape pas par un argument.
      */}
      <div className="mb-5 rounded-lg border border-ink-200 bg-white px-5 py-4">
        <p className="text-sm font-semibold text-ink-900">
          Aucune case vide : chaque exigence est sélectionnée ou exclue, et justifiée
        </p>
        <p className="mt-1.5 text-sm leading-relaxed text-ink-600">
          {readiness.decided ?? 0} exigence(s) décidée(s) sur {all.length} —{' '}
          {readiness.selected ?? 0} sélectionnée(s), {readiness.excluded ?? 0} exclue(s).{' '}
          {profile ? (
            <>
              Le rôle <strong className="font-medium text-ink-900">
                « {ACTIVITY_PROFILE_LABELS[profile]} »
              </strong>{' '}
              impose une preuve technique sur {readiness.technical_expected ?? 0} d’entre elles.
            </>
          ) : (
            <span className="text-amber-700">
              Le rôle de l’organisation vis-à-vis de l’IA n’est pas renseigné : aucune criticité ne
              peut être attribuée, et le régime de preuve reste indéterminé.
            </span>
          )}
        </p>
      </div>

      {/*
        Trouver les trois exigences en ecart demandait de parcourir les
        trente-huit. Les compteurs portent sur l'ensemble de la Declaration, pas
        sur le filtre en cours : un filtre dont les compteurs dependent d'un
        autre filtre ne dit plus ce qu'il compte.
      */}
      <div className="mb-5 flex flex-wrap gap-3">
        <SegmentedFilter
          label="Filtrer par écart"
          param="ecart"
          basePath={`/admin/organizations/${id}/declaration-applicabilite`}
          selected={ecart}
          current={{ objectif }}
          options={gapFilters}
        />
        <SegmentedFilter
          label="Filtrer par objectif de contrôle"
          param="objectif"
          basePath={`/admin/organizations/${id}/declaration-applicabilite`}
          selected={objectif}
          current={{ ecart }}
          options={objectiveFilters}
        />
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

                        {row.typologies.length ? (
                          <p className="mt-2 text-xs text-ink-600">
                            Matrice des preuves —{' '}
                            {row.typologies
                              .map((t) =>
                                t.criticality
                                  ? `${t.name} (${CRITICALITY_LABELS[t.criticality].toLowerCase()})`
                                  : t.name,
                              )
                              .join(', ')}
                          </p>
                        ) : null}

                        <p className="mt-1.5 text-xs text-ink-500">
                          <span className="font-medium text-ink-700">
                            {REGIME_LABELS[row.evidence_regime]?.label}
                          </span>{' '}
                          — {REGIME_LABELS[row.evidence_regime]?.expectation}
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

                        {row.soa_status ? (
                          <blockquote className="mt-2.5 border-l-2 border-ink-200 pl-3 text-xs leading-relaxed text-ink-600">
                            <span className="font-medium text-ink-800">
                              {row.soa_status === 'selected' ? 'Sélectionnée' : 'Exclue'}
                            </span>
                            {row.decided_by_name ? ` par ${row.decided_by_name}` : ''} —{' '}
                            {row.soa_justification}
                          </blockquote>
                        ) : null}

                        {row.requirement_id ? (
                          <SoaDecisionForm
                            organizationId={id}
                            requirementId={row.requirement_id}
                            reference={row.requirement_reference}
                            currentStatus={row.soa_status}
                            currentJustification={row.soa_justification}
                            expectation={REGIME_LABELS[row.evidence_regime]?.expectation ?? ''}
                            open={exigence === row.requirement_reference}
                          />
                        ) : null}
                      </div>

                      <div className="flex shrink-0 flex-col items-end gap-1.5">
                        <Badge tone={COVERAGE[row.coverage].tone}>
                          {COVERAGE[row.coverage].label}
                        </Badge>
                        {row.expected_criticality ? (
                          <Badge tone={criticalityTone(row.expected_criticality)}>
                            {CRITICALITY_LABELS[row.expected_criticality]}
                          </Badge>
                        ) : null}
                        {row.gap ? (
                          <span className="text-xs font-medium text-stop-600">
                            {GAP_LABELS[row.gap] ?? row.gap}
                          </span>
                        ) : null}
                      </div>
                    </div>
                  </li>
                ))}
              </ul>
            </Card>
          ))}
        </div>
      ) : all.length ? (
        <Card title="Aucune exigence dans ce filtre">
          <Empty>
            Rien ne correspond à cette combinaison — ce qui est une bonne nouvelle si vous cherchiez
            un écart.{' '}
            <Link
              href={`/admin/organizations/${id}/declaration-applicabilite`}
              className="text-brand-600 hover:underline"
            >
              Revenir à la Déclaration complète
            </Link>
            .
          </Empty>
        </Card>
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


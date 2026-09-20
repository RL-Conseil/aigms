import Link from 'next/link'
import { notFound } from 'next/navigation'
import { createClient } from '@/lib/supabase/server'
import { Shell } from '@/components/shell'
import { Badge, Card, Empty, Stat, StatStrip } from '@/components/ui'
import { InfoTip } from '@/components/info-tip'
import { SegmentedFilter } from '@/components/governance/segmented-filter'
import {
  DecisionLinkForm,
  DecisionRulingForm,
} from '@/components/governance/decision-forms'
import { describePerson, organizationPeople } from '@/lib/governance/people'
import {
  CHANGE_STATUS_LABELS,
  DECISION_STATUS_LABELS,
  DECISION_TYPE_LABELS,
  formatDate,
  formatDateTime,
  VERDICT_LABELS,
  type ReassessmentVerdict,
} from '@/lib/domain/governance'

/**
 * Registre de decisions.
 *
 * « La piece que les autres outils traitent en dernier, et celle qu'un auditeur
 * ouvre en premier. » Le socle serveur existait depuis la migration 0010 ;
 * l'ecran manquait, et une decision transverse — une exception de politique
 * portant sur l'organisation entiere — n'etait visible nulle part.
 */

type Decision = {
  id: string
  business_ref: string
  decision_type: string
  subject: string
  decision_statement: string | null
  conditions: string | null
  rationale: string | null
  status: string
  effective_from: string | null
  review_due_at: string | null
  approved_at: string | null
  submitted_at: string | null
  use_case_id: string | null
  expected_approver_user_id: string | null
}

const STATUS_FILTERS = [
  { key: '', label: 'Toutes' },
  { key: 'a-instruire', label: 'À instruire' },
  { key: 'en-vigueur', label: 'En vigueur' },
  { key: 'revue-due', label: 'Revue échue' },
  { key: 'rejected', label: 'Rejetées' },
  { key: 'changements', label: 'Changements' },
] as const

export default async function DecisionsPage({
  params,
  searchParams,
}: {
  params: Promise<{ id: string }>
  searchParams: Promise<{ etat?: string }>
}) {
  const { id } = await params
  const { etat } = await searchParams
  const supabase = await createClient()
  const today = new Date().toISOString().slice(0, 10)

  const [
    { data: organization },
    { data: decisionRows },
    { data: useCases },
    { data: risks },
    { data: controls },
    { data: evidences },
    { data: impacts },
    { data: links },
    people,
  ] = await Promise.all([
    supabase.from('organization').select('id, name, business_ref').eq('id', id).maybeSingle(),
    supabase
      .from('governance_decision')
      .select(
        'id, business_ref, decision_type, subject, decision_statement, conditions, rationale, status, effective_from, review_due_at, approved_at, submitted_at, use_case_id, expected_approver_user_id',
      )
      .eq('organization_id', id)
      .order('submitted_at', { ascending: false, nullsFirst: false }),
    supabase
      .from('ai_use_case')
      .select('id, name, business_ref')
      .eq('organization_id', id)
      .order('business_ref'),
    supabase.from('risk').select('id, title, business_ref').eq('organization_id', id),
    supabase.from('control').select('id, name, code').eq('organization_id', id),
    supabase.from('evidence').select('id, title, business_ref').eq('organization_id', id),
    supabase
      .from('impact_assessment')
      .select('id, scope_description, business_ref')
      .eq('organization_id', id),
    supabase.from('decision_link').select('decision_id, target_type'),
    organizationPeople(id, true),
  ])

  if (!organization) notFound()

  const decisions = (decisionRows ?? []) as Decision[]
  const useCaseName = new Map((useCases ?? []).map((u) => [u.id, u.name]))
  const personName = new Map(people.map((person) => [person.userId, describePerson(person)]))

  const linkCount = new Map<string, number>()
  for (const link of links ?? []) {
    linkCount.set(link.decision_id, (linkCount.get(link.decision_id) ?? 0) + 1)
  }

  const pending = decisions.filter((d) => ['draft', 'submitted'].includes(d.status))
  const inForce = decisions.filter((d) =>
    ['approved', 'approved_with_conditions'].includes(d.status),
  )
  const reviewDue = inForce.filter((d) => d.review_due_at !== null && d.review_due_at <= today)
  const unfounded = decisions.filter((d) => !linkCount.has(d.id))
  // Une decision soumise que personne n'attend ne progresse pas.
  const unaddressed = pending.filter((d) => !d.expected_approver_user_id)

  // Les changements se lisent depuis le registre, a cote des decisions — sans
  // s'y confondre : un changement est un fait, une decision un acte (0063).
  const { data: mergedData } = await supabase.rpc('decisions_and_changes', { p_organization_id: id })
  const changes = ((mergedData ?? []) as {
    id: string
    kind: string
    business_ref: string
    title: string
    body: string | null
    status: string
    at: string
    use_case_id: string | null
    use_case: string | null
    verdict: string | null
    scope: string[] | null
    planned_at: string | null
    change_types: string[] | null
    decision: { id: string; business_ref: string; status: string } | null
  }[]).filter((e) => e.kind === 'change')

  const shown = decisions.filter((decision) => {
    if (etat === 'a-instruire') return ['draft', 'submitted'].includes(decision.status)
    if (etat === 'en-vigueur')
      return ['approved', 'approved_with_conditions'].includes(decision.status)
    if (etat === 'revue-due')
      return (
        ['approved', 'approved_with_conditions'].includes(decision.status) &&
        decision.review_due_at !== null &&
        decision.review_due_at <= today
      )
    if (etat === 'rejected') return decision.status === 'rejected'
    return true
  })

  const targets = {
    risk: (risks ?? []).map((r) => ({ id: r.id, label: `${r.business_ref} — ${r.title}` })),
    control: (controls ?? []).map((c) => ({ id: c.id, label: `${c.code} — ${c.name}` })),
    evidence: (evidences ?? []).map((e) => ({ id: e.id, label: `${e.business_ref} — ${e.title}` })),
    impact_assessment: (impacts ?? []).map((i) => ({
      id: i.id,
      label: `${i.business_ref} — ${i.scope_description.slice(0, 60)}`,
    })),
    use_case: (useCases ?? []).map((u) => ({ id: u.id, label: `${u.business_ref} — ${u.name}` })),
    incident: [],
    change_request: [],
  }

  return (
    <Shell
      breadcrumb={[
        { href: '/admin/organizations', label: 'Organisations' },
        { href: `/admin/organizations/${id}`, label: organization.name },
      ]}
      organization={{ id, section: 'decisions' }}
      title="Registre de décisions"
      subtitle="Qui a décidé quoi, pourquoi et sous quelles conditions."
      actions={
        <div className="flex items-center gap-3">
          <Link
            href={`/admin/organizations/${id}/decisions/nouvelle`}
            className="rounded-md bg-night-900 px-4 py-2.5 text-sm font-medium text-white hover:bg-night-800"
          >
            Soumettre une décision
          </Link>
          <InfoTip label="Comment lire ce registre" title="La pièce qu’un auditeur ouvre en premier">
            <div className="flex flex-col gap-3 text-sm leading-relaxed text-ink-600">
              <p>
                Une gouvernance crédible ne documente pas seulement les risques : elle documente qui
                a décidé quoi, pourquoi et sous quelles conditions. Autorisation d’usage, mise en
                production, acceptation de risque, exception, suspension, retrait — chaque type a
                son dossier.
              </p>
              <p>
                <strong className="font-medium text-ink-800">Deux actes, deux personnes.</strong>{' '}
                Soumettre énonce ce qui est décidé ; se prononcer engage nominativement. Sur une
                mise en production, une acceptation de risque ou une exception, la base refuse que
                ce soit la même personne — c’est ce qui donne sa valeur au registre.
              </p>
              <p>
                <strong className="font-medium text-ink-800">Rien ne dort.</strong> Ces trois types
                portent une date de revue, exigée une fois la décision approuvée. Le pilotage fait
                remonter celles qui arrivent à échéance.
              </p>
              <p>
                <strong className="font-medium text-ink-800">Reconstituable.</strong> Une décision
                se rattache aux risques, contrôles, preuves et évaluations sur lesquels elle
                s’appuie. Sans ces liens, le registre dit qui a décidé, pas sur quoi.
              </p>
            </div>
          </InfoTip>
        </div>
      }
    >
      <StatStrip>
        <Stat label="Décisions" value={decisions.length} />
        <Stat label="À instruire" value={pending.length} tone="warn" />
        <Stat label="Revues échues" value={reviewDue.length} tone="stop" />
        <Stat label="Sans élément probant" value={unfounded.length} tone="warn" />
        <Stat label="Adressées à personne" value={unaddressed.length} tone="warn" />
      </StatStrip>

      <div className="mb-5">
        <SegmentedFilter
          label="Filtrer par état"
          param="etat"
          basePath={`/admin/organizations/${id}/decisions`}
          selected={etat}
          options={STATUS_FILTERS.map((option) => ({
            key: option.key,
            label: option.label,
            count:
              option.key === ''
                ? decisions.length
                : option.key === 'a-instruire'
                  ? pending.length
                  : option.key === 'en-vigueur'
                    ? inForce.length
                    : option.key === 'revue-due'
                      ? reviewDue.length
                      : option.key === 'changements'
                        ? changes.length
                        : decisions.filter((d) => d.status === 'rejected').length,
          }))}
        />
      </div>

      {etat === 'changements' ? (
        <Card
          title="Changements"
          subtitle="Ce qui a changé sur les systèmes, le verdict de la réévaluation, et la décision que chacun appelle."
        >
          {changes.length ? (
            <ul className="flex flex-col divide-y divide-ink-100">
              {changes.map((c) => (
                <li key={c.id} className="py-4 first:pt-0 last:pb-0">
                  <div className="flex flex-wrap items-start justify-between gap-3">
                    <div className="min-w-0">
                      <p className="text-sm font-medium text-ink-900">
                        <span className="mr-2 font-mono text-xs text-ink-400">{c.business_ref}</span>
                        {c.title}
                      </p>
                      <p className="text-xs text-ink-400">
                        {c.use_case_id ? (
                          <Link href={`/admin/use-cases/${c.use_case_id}?onglet=decisions`} className="hover:underline">
                            {c.use_case}
                          </Link>
                        ) : null}
                        {c.change_types?.length ? ` · ${c.change_types.join(', ')}` : ''}
                        {` · ${formatDate(c.at)}`}
                        {c.planned_at ? ` · prévu le ${formatDate(c.planned_at)}` : ''}
                      </p>
                      {c.body ? <p className="mt-1 text-sm text-ink-600">{c.body}</p> : null}
                      <p className="mt-1 flex flex-wrap items-center gap-2 text-xs">
                        {c.verdict ? (
                          <Badge tone={c.verdict === 'NO_REASSESSMENT' ? 'neutral' : 'stop'}>
                            {VERDICT_LABELS[c.verdict as ReassessmentVerdict] ?? c.verdict}
                          </Badge>
                        ) : (
                          <Badge tone="warn">Non qualifié</Badge>
                        )}
                        {c.scope?.length ? <span className="text-ink-400">rouvre : {c.scope.join(', ')}</span> : null}
                        {c.decision ? (
                          <span className="text-ink-500">
                            Décision {c.decision.business_ref} : {DECISION_STATUS_LABELS[c.decision.status] ?? c.decision.status}
                          </span>
                        ) : c.verdict && c.verdict !== 'NO_REASSESSMENT' ? (
                          <span className="text-warn-600">Décision à ouvrir</span>
                        ) : null}
                      </p>
                    </div>
                    <Badge
                      tone={
                        ['APPROVED', 'IMPLEMENTED', 'VERIFIED'].includes(c.status)
                          ? 'ok'
                          : ['REJECTED', 'CANCELLED'].includes(c.status)
                            ? 'stop'
                            : 'neutral'
                      }
                    >
                      {CHANGE_STATUS_LABELS[c.status] ?? c.status}
                    </Badge>
                  </div>
                </li>
              ))}
            </ul>
          ) : (
            <Empty>Aucun changement déclaré.</Empty>
          )}
        </Card>
      ) : (
      <Card title="Décisions" subtitle={`${shown.length} décision(s)`}>
        {shown.length ? (
          <ul className="flex flex-col divide-y divide-ink-100">
            {shown.map((decision) => (
              <li key={decision.id} className="py-4 first:pt-0 last:pb-0">
                <div className="flex flex-wrap items-start justify-between gap-3">
                  <div className="min-w-0">
                    <p className="text-sm font-medium text-ink-900">
                      <span className="mr-2 font-mono text-xs text-ink-400">
                        {decision.business_ref}
                      </span>
                      {decision.subject}
                    </p>
                    <p className="mt-1 text-xs text-ink-500">
                      {DECISION_TYPE_LABELS[decision.decision_type] ?? decision.decision_type}
                      {decision.use_case_id
                        ? ` · ${useCaseName.get(decision.use_case_id) ?? 'cas d’usage'}`
                        : ' · décision transverse'}
                      {decision.effective_from
                        ? ` · effet le ${formatDate(decision.effective_from)}`
                        : ''}
                      {decision.review_due_at
                        ? ` · revue le ${formatDate(decision.review_due_at)}`
                        : ''}
                    </p>

                    {decision.decision_statement ? (
                      <p className="mt-2 text-sm leading-relaxed text-ink-700">
                        {decision.decision_statement}
                      </p>
                    ) : null}
                    {decision.conditions ? (
                      <p className="mt-1.5 text-sm leading-relaxed text-warn-600">
                        Conditions : {decision.conditions}
                      </p>
                    ) : null}
                    {decision.rationale ? (
                      <blockquote className="mt-1.5 border-l-2 border-ink-200 pl-3 text-xs leading-relaxed text-ink-600">
                        {decision.rationale}
                      </blockquote>
                    ) : null}

                    {['draft', 'submitted'].includes(decision.status) ? (
                      <p className="mt-2 text-xs text-ink-500">
                        {decision.expected_approver_user_id ? (
                          <>
                            Appelée à se prononcer :{' '}
                            <span className="font-medium text-ink-700">
                              {personName.get(decision.expected_approver_user_id) ??
                                'personne déclarée'}
                            </span>
                          </>
                        ) : (
                          <span className="text-warn-600">
                            Adressée à personne — désigner qui doit se prononcer.
                          </span>
                        )}
                      </p>
                    ) : null}

                    <p className="mt-2 text-xs text-ink-400">
                      {linkCount.get(decision.id)
                        ? `${linkCount.get(decision.id)} élément(s) probant(s)`
                        : 'Aucun élément probant rattaché — le registre dit qui a décidé, pas sur quoi.'}
                      {decision.approved_at
                        ? ` · approuvée le ${formatDateTime(decision.approved_at)}`
                        : decision.submitted_at
                          ? ` · soumise le ${formatDateTime(decision.submitted_at)}`
                          : ''}
                    </p>
                  </div>

                  <div className="flex shrink-0 flex-col items-end gap-2">
                    <Badge
                      tone={
                        ['approved', 'approved_with_conditions'].includes(decision.status)
                          ? 'ok'
                          : decision.status === 'rejected'
                            ? 'stop'
                            : 'warn'
                      }
                    >
                      {DECISION_STATUS_LABELS[decision.status] ?? decision.status}
                    </Badge>
                    <div className="flex flex-wrap justify-end gap-2">
                      <DecisionRulingForm
                        organizationId={id}
                        decisionId={decision.id}
                        useCaseId={decision.use_case_id}
                        subject={decision.subject}
                        decisionType={decision.decision_type}
                        rationale={decision.rationale}
                        conditions={decision.conditions}
                        awaiting={['draft', 'submitted'].includes(decision.status)}
                      />
                      <DecisionLinkForm
                        organizationId={id}
                        decisionId={decision.id}
                        targets={targets}
                      />
                    </div>
                  </div>
                </div>
              </li>
            ))}
          </ul>
        ) : decisions.length ? (
          <Empty>
            Aucune décision dans ce filtre.{' '}
            <Link
              href={`/admin/organizations/${id}/decisions`}
              className="text-brand-600 hover:underline"
            >
              Revenir au registre complet
            </Link>
            .
          </Empty>
        ) : (
          <Empty>
            Aucune décision enregistrée. C’est pourtant la pièce qu’un auditeur ouvre en premier :
            un dossier sans décision ne dit pas qui a autorisé quoi.
          </Empty>
        )}
      </Card>
      )}
    </Shell>
  )
}

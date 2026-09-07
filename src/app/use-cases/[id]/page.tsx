import { notFound } from 'next/navigation'
import { createClient } from '@/lib/supabase/server'
import { Shell } from '@/components/shell'
import { Badge, Card, Empty, Field } from '@/components/ui'
import { GateChecklist } from '@/components/gate-checklist'
import { Lifecycle } from '@/components/lifecycle'
import { TransitionPanel } from '@/components/transition-panel'
import { UI_TRANSITIONS } from '@/lib/domain/transitions'
import {
  AUTONOMY_LABELS,
  DECISION_STATUS_LABELS,
  DECISION_TYPE_LABELS,
  formatDate,
  formatDateTime,
  RISK_LEVEL_LABELS,
  USE_CASE_STATUS_LABELS,
  VERDICT_LABELS,
  type GateResult,
  type ReassessmentVerdict,
  type RiskLevel,
  type UseCaseStatus,
} from '@/lib/domain/governance'

function riskTone(level: RiskLevel | null) {
  if (level === 'critical' || level === 'high') return 'stop' as const
  if (level === 'moderate') return 'warn' as const
  return 'neutral' as const
}

export default async function UseCasePage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params
  const supabase = await createClient()

  const { data: useCase } = await supabase
    .from('ai_use_case')
    .select(
      `id, business_ref, name, purpose, business_process, expected_benefit, status,
       autonomy_level, criticality, decision_impact, users_description, affected_persons,
       data_description, involves_personal_data, involves_vulnerable_persons,
       next_review_at, status_changed_at, organization_id,
       organization:organization_id (id, name)`,
    )
    .eq('id', id)
    .maybeSingle()

  if (!useCase) notFound()

  const status = useCase.status as UseCaseStatus

  // Les requetes sont independantes : elles partent ensemble pour eviter une
  // cascade d'allers-retours.
  const [
    { data: classification },
    { data: risks },
    { data: impacts },
    { data: oversight },
    { data: decisions },
    { data: controls },
    { data: actions },
    { data: changes },
    { data: timeline },
    { data: gateData },
  ] = await Promise.all([
    supabase
      .from('regulatory_classification')
      .select(
        'framework_code, framework_version, organization_role, flags, rationale, legal_review_level, legal_review_completed, classified_at, next_review_at',
      )
      .eq('use_case_id', id)
      .eq('is_current', true)
      .maybeSingle(),
    supabase
      .from('risk')
      .select(
        'id, business_ref, title, scenario, category, inherent_level, residual_level, status, accepted_at, acceptance_review_at, next_review_at',
      )
      .eq('use_case_id', id)
      .order('business_ref'),
    supabase
      .from('impact_assessment')
      .select('id, business_ref, status, methodology, dpia_required, dpia_reference, conclusion, completed_at, next_review_at, reopened_reason')
      .eq('use_case_id', id),
    supabase
      .from('human_oversight_plan')
      .select(
        'id, business_ref, autonomy_level, status, intervention_triggers, override_procedure, stop_procedure, monitoring_cadence, expected_evidence, approved_at, not_applicable_rationale',
      )
      .eq('use_case_id', id)
      .maybeSingle(),
    supabase
      .from('governance_decision')
      .select(
        'id, business_ref, decision_type, subject, decision_statement, conditions, rationale, status, effective_from, review_due_at, approved_at',
      )
      .eq('use_case_id', id)
      .order('approved_at', { ascending: false, nullsFirst: false }),
    supabase
      .from('control_applicability')
      .select('id, status, justification, control:control_id (code, name, is_mandatory, status)')
      .eq('use_case_id', id),
    supabase
      .from('action')
      .select('id, business_ref, title, status, due_date, is_blocking')
      .eq('use_case_id', id)
      .order('due_date', { nullsFirst: false }),
    supabase
      .from('change_request')
      .select(
        'id, business_ref, title, description, change_types, status, planned_at, reassessment:reassessment (engine_verdict, final_verdict, status, scope)',
      )
      .eq('use_case_id', id),
    supabase
      .from('audit_log')
      .select('id, occurred_at, action, summary, actor_email')
      .eq('entity_id', id)
      .order('occurred_at', { ascending: false })
      .limit(30),
    supabase.rpc('evaluate_gate', { p_use_case_id: id, p_target: 'PRODUCTION' }),
  ])

  const gate = gateData as GateResult | null
  const organization = useCase.organization as unknown as { id: string; name: string } | null

  return (
    <Shell
      breadcrumb={[
        { href: '/portfolio', label: 'Portefeuille' },
        ...(organization
          ? [{ href: `/organizations/${organization.id}`, label: organization.name }]
          : []),
      ]}
      title={useCase.name}
      subtitle={`${useCase.business_ref} — ${useCase.purpose}`}
      actions={<Badge tone="info">{USE_CASE_STATUS_LABELS[status]}</Badge>}
    >
      <div className="mb-6 rounded-lg border border-ink-200 bg-white p-5">
        <Lifecycle status={status} />
        <p className="mt-3 text-xs text-ink-400">
          Dernier changement de statut : {formatDateTime(useCase.status_changed_at)}
          {useCase.next_review_at ? ` · prochaine revue le ${formatDate(useCase.next_review_at)}` : ''}
        </p>
      </div>

      <div className="grid gap-5 lg:grid-cols-3">
        <div className="space-y-5 lg:col-span-2">
          <Card title="Fiche du cas d'usage">
            <dl className="grid gap-4 sm:grid-cols-2">
              <Field label="Processus métier">{useCase.business_process ?? '—'}</Field>
              <Field label="Bénéfice attendu">{useCase.expected_benefit ?? '—'}</Field>
              <Field label="Niveau d'autonomie">
                {AUTONOMY_LABELS[useCase.autonomy_level] ?? useCase.autonomy_level}
              </Field>
              <Field label="Criticité">{useCase.criticality ?? 'Non déterminée'}</Field>
              <Field label="Utilisateurs">{useCase.users_description ?? '—'}</Field>
              <Field label="Personnes affectées">{useCase.affected_persons ?? '—'}</Field>
              <Field label="Données">{useCase.data_description ?? '—'}</Field>
              <Field label="Portée de la décision">{useCase.decision_impact ?? '—'}</Field>
            </dl>
            <div className="mt-4 flex gap-2">
              {useCase.involves_personal_data ? (
                <Badge tone="warn">Données personnelles</Badge>
              ) : null}
              {useCase.involves_vulnerable_persons ? (
                <Badge tone="stop">Personnes vulnérables</Badge>
              ) : null}
            </div>
          </Card>

          <Card
            title="Pré-classification réglementaire"
            subtitle="Aide au cadrage. Ne vaut pas avis juridique."
          >
            {classification ? (
              <div className="space-y-3">
                <div className="flex flex-wrap gap-2">
                  <Badge tone="info">
                    {classification.framework_code} {classification.framework_version}
                  </Badge>
                  <Badge>Rôle : {classification.organization_role}</Badge>
                  {(classification.flags as string[]).map((flag) => (
                    <Badge key={flag} tone={flag === 'high_risk_potential' ? 'stop' : 'warn'}>
                      {flag}
                    </Badge>
                  ))}
                </div>
                <p className="text-sm text-ink-600">{classification.rationale}</p>
                <p className="text-xs text-ink-400">
                  Revue juridique : {classification.legal_review_level}
                  {classification.legal_review_completed ? ' (close)' : ' (en attente)'} · classée le{' '}
                  {formatDate(classification.classified_at)}
                  {classification.next_review_at
                    ? ` · à revoir le ${formatDate(classification.next_review_at)}`
                    : ''}
                </p>
              </div>
            ) : (
              <Empty>Aucune classification enregistrée.</Empty>
            )}
          </Card>

          <Card title="Risques" subtitle={`${risks?.length ?? 0} risque(s)`}>
            {risks?.length ? (
              <ul className="divide-y divide-ink-100">
                {risks.map((risk) => (
                  <li key={risk.id} className="py-3">
                    <div className="flex items-start justify-between gap-4">
                      <div className="min-w-0">
                        <p className="text-sm font-medium text-ink-900">{risk.title}</p>
                        <p className="text-xs text-ink-600">{risk.scenario}</p>
                        <p className="mt-1 text-xs text-ink-400">
                          {risk.business_ref} · {risk.category} · statut {risk.status}
                          {risk.accepted_at
                            ? ` · accepté, revue le ${formatDate(risk.acceptance_review_at)}`
                            : ''}
                        </p>
                      </div>
                      <div className="flex shrink-0 flex-col items-end gap-1">
                        <Badge tone={riskTone(risk.inherent_level as RiskLevel)}>
                          Brut : {RISK_LEVEL_LABELS[risk.inherent_level as RiskLevel]}
                        </Badge>
                        {risk.residual_level ? (
                          <Badge tone={riskTone(risk.residual_level as RiskLevel)}>
                            Résiduel : {RISK_LEVEL_LABELS[risk.residual_level as RiskLevel]}
                          </Badge>
                        ) : null}
                      </div>
                    </div>
                  </li>
                ))}
              </ul>
            ) : (
              <Empty>Aucun risque identifié.</Empty>
            )}
          </Card>

          <Card
            title="Évaluation d'impact"
            subtitle="Effets sur les personnes, les groupes et la société (ISO/IEC 42005)."
          >
            {impacts?.length ? (
              <ul className="space-y-4">
                {impacts.map((aiia) => (
                  <li key={aiia.id}>
                    <div className="flex items-center gap-2">
                      <Badge tone={aiia.status === 'completed' ? 'ok' : 'warn'}>{aiia.status}</Badge>
                      <span className="text-xs text-ink-400">{aiia.business_ref}</span>
                      {aiia.dpia_required ? (
                        <Badge tone="warn">AIPD requise : {aiia.dpia_reference ?? 'référence à fournir'}</Badge>
                      ) : null}
                    </div>
                    {aiia.conclusion ? (
                      <p className="mt-2 text-sm text-ink-600">{aiia.conclusion}</p>
                    ) : null}
                    {aiia.reopened_reason ? (
                      <p className="mt-1 text-xs text-rose-700">Rouverte : {aiia.reopened_reason}</p>
                    ) : null}
                  </li>
                ))}
              </ul>
            ) : (
              <Empty>Aucune évaluation d&apos;impact.</Empty>
            )}
          </Card>

          <Card title="Supervision humaine">
            {oversight ? (
              <dl className="space-y-3">
                <div className="flex items-center gap-2">
                  <Badge tone={oversight.status === 'approved' ? 'ok' : 'warn'}>
                    {oversight.status}
                  </Badge>
                  <Badge>{AUTONOMY_LABELS[oversight.autonomy_level] ?? oversight.autonomy_level}</Badge>
                </div>
                <Field label="Déclencheurs d'intervention">
                  {oversight.intervention_triggers ?? '—'}
                </Field>
                <Field label="Procédure de reprise en main">
                  {oversight.override_procedure ?? '—'}
                </Field>
                <Field label="Autorité d'arrêt">{oversight.stop_procedure ?? '—'}</Field>
                <Field label="Cadence de suivi">{oversight.monitoring_cadence ?? '—'}</Field>
                <Field label="Preuves attendues">{oversight.expected_evidence ?? '—'}</Field>
              </dl>
            ) : (
              <Empty>Aucun plan de supervision.</Empty>
            )}
          </Card>

          <Card title="Décisions de gouvernance" subtitle={`${decisions?.length ?? 0} décision(s)`}>
            {decisions?.length ? (
              <ul className="divide-y divide-ink-100">
                {decisions.map((d) => (
                  <li key={d.id} className="py-3">
                    <div className="flex items-start justify-between gap-4">
                      <div className="min-w-0">
                        <p className="text-sm font-medium text-ink-900">{d.subject}</p>
                        <p className="text-xs text-ink-400">
                          {d.business_ref} · {DECISION_TYPE_LABELS[d.decision_type] ?? d.decision_type}
                        </p>
                        {d.decision_statement ? (
                          <p className="mt-1 text-sm text-ink-600">{d.decision_statement}</p>
                        ) : null}
                        {d.conditions ? (
                          <p className="mt-1 text-xs text-amber-800">Conditions : {d.conditions}</p>
                        ) : null}
                        <p className="mt-1 text-xs text-ink-400">
                          Effet le {formatDate(d.effective_from)}
                          {d.review_due_at ? ` · revue le ${formatDate(d.review_due_at)}` : ''}
                        </p>
                      </div>
                      <Badge
                        tone={
                          d.status === 'approved'
                            ? 'ok'
                            : d.status === 'approved_with_conditions'
                              ? 'warn'
                              : d.status === 'rejected'
                                ? 'stop'
                                : 'neutral'
                        }
                      >
                        {DECISION_STATUS_LABELS[d.status] ?? d.status}
                      </Badge>
                    </div>
                  </li>
                ))}
              </ul>
            ) : (
              <Empty>Aucune décision enregistrée.</Empty>
            )}
          </Card>

          <Card title="Changements et réévaluations">
            {changes?.length ? (
              <ul className="space-y-4">
                {changes.map((change) => {
                  const reassessments = (change.reassessment ?? []) as {
                    engine_verdict: ReassessmentVerdict
                    final_verdict: ReassessmentVerdict | null
                    status: string
                    scope: string[]
                  }[]
                  return (
                    <li key={change.id}>
                      <p className="text-sm font-medium text-ink-900">{change.title}</p>
                      <p className="text-xs text-ink-400">
                        {change.business_ref} · {(change.change_types as string[]).join(', ')} ·
                        statut {change.status}
                      </p>
                      <p className="mt-1 text-sm text-ink-600">{change.description}</p>
                      {reassessments.map((r, index) => (
                        <div key={index} className="mt-2 flex flex-wrap items-center gap-2">
                          <Badge
                            tone={r.engine_verdict === 'NO_REASSESSMENT' ? 'neutral' : 'stop'}
                          >
                            Moteur : {VERDICT_LABELS[r.engine_verdict]}
                          </Badge>
                          {r.final_verdict ? (
                            <Badge tone="info">
                              Retenu : {VERDICT_LABELS[r.final_verdict]} ({r.status})
                            </Badge>
                          ) : (
                            <Badge tone="warn">Revue humaine en attente</Badge>
                          )}
                          {r.scope?.length ? (
                            <span className="text-xs text-ink-400">
                              Périmètre rouvert : {r.scope.join(', ')}
                            </span>
                          ) : null}
                        </div>
                      ))}
                    </li>
                  )
                })}
              </ul>
            ) : (
              <Empty>Aucun changement enregistré.</Empty>
            )}
          </Card>
        </div>

        <div className="space-y-5">
          <Card
            title="Gate production"
            subtitle="Évalué en continu, sans déclencher de transition."
          >
            {gate ? <GateChecklist gate={gate} /> : <Empty>Gate non évaluable.</Empty>}
          </Card>

          <Card title="Faire évoluer le cas d'usage">
            <TransitionPanel useCaseId={id} targets={UI_TRANSITIONS[status]} />
          </Card>

          <Card title="Contrôles affectés">
            {controls?.length ? (
              <ul className="space-y-2">
                {controls.map((ca) => {
                  const control = ca.control as unknown as {
                    code: string
                    name: string
                    is_mandatory: boolean
                    status: string
                  }
                  return (
                    <li key={ca.id} className="text-sm">
                      <div className="flex items-start justify-between gap-2">
                        <span className="text-ink-900">
                          {control.code} — {control.name}
                        </span>
                        <Badge tone={ca.status === 'applicable' ? 'ok' : 'neutral'}>
                          {ca.status === 'applicable' ? 'Applicable' : 'Non applicable'}
                        </Badge>
                      </div>
                      {control.is_mandatory ? (
                        <span className="text-xs text-ink-400">Contrôle obligatoire</span>
                      ) : null}
                      {ca.justification ? (
                        <p className="text-xs text-ink-600">{ca.justification}</p>
                      ) : null}
                    </li>
                  )
                })}
              </ul>
            ) : (
              <Empty>Aucun contrôle affecté.</Empty>
            )}
          </Card>

          <Card title="Actions">
            {actions?.length ? (
              <ul className="space-y-2">
                {actions.map((a) => (
                  <li key={a.id} className="text-sm">
                    <div className="flex items-start justify-between gap-2">
                      <span className="text-ink-900">{a.title}</span>
                      {a.is_blocking ? <Badge tone="stop">Bloquante</Badge> : null}
                    </div>
                    <span className="text-xs text-ink-400">
                      {a.business_ref} · {a.status} · échéance {formatDate(a.due_date)}
                    </span>
                  </li>
                ))}
              </ul>
            ) : (
              <Empty>Aucune action ouverte.</Empty>
            )}
          </Card>

          <Card title="Journal d'audit" subtitle="Trace immuable des opérations sensibles.">
            {timeline?.length ? (
              <ol className="space-y-3">
                {timeline.map((entry) => (
                  <li key={entry.id} className="border-l-2 border-ink-200 pl-3">
                    <p className="text-sm text-ink-900">{entry.summary ?? entry.action}</p>
                    <p className="text-xs text-ink-400">
                      {formatDateTime(entry.occurred_at)} · {entry.actor_email ?? 'système'} ·{' '}
                      {entry.action}
                    </p>
                  </li>
                ))}
              </ol>
            ) : (
              <Empty>Aucune entrée de journal accessible depuis ce compte.</Empty>
            )}
          </Card>
        </div>
      </div>
    </Shell>
  )
}

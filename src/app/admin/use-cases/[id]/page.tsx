import Link from 'next/link'
import { notFound } from 'next/navigation'
import { createClient } from '@/lib/supabase/server'
import { Shell } from '@/components/shell'
import { UseCaseLabelForm } from '@/components/governance/use-case-label-form'
import { Badge, Card, Empty, Field, Stat, StatStrip } from '@/components/ui'
import { Disclosure } from '@/components/forms'
import { Modal } from '@/components/modal'
import { InfoTip } from '@/components/info-tip'
import { resolveTab, UseCaseTabs, type TabSignal, type UseCaseTab } from '@/components/governance/use-case-tabs'
import { GateChecklist } from '@/components/gate-checklist'
import { Lifecycle } from '@/components/lifecycle'
import { ApplicabilityForm, RiskTreatmentForm } from '@/components/governance/control-forms'
import { ControlProposals, type Suggestions } from '@/components/governance/control-proposals'
import { ActionProposals, type ActionSuggestions } from '@/components/governance/action-proposals'
import {
  ImpactForm,
  LinkAssetForm,
  LinkVendorForm,
  OversightForm,
} from '@/components/governance/registry-forms'
import {
  ActionNote,
  AuditNote,
  ChangeNote,
  ControlNote,
  DecisionNote,
  GateNote,
  ImpactNote,
  IncidentNote,
  OversightNote,
  RiskNote,
} from '@/components/governance/rubric-notes'
import { TransitionPanel } from '@/components/transition-panel'
import {
  ActionForm,
  ActionStatusForm,
  CapaCloseForm,
  CapaForm,
  ChangeRequestForm,
  IncidentForm,
  IncidentProgressForm,
} from '@/components/governance/operations-forms'
import { UI_TRANSITIONS } from '@/lib/domain/transitions'
import {
  AcceptRiskForm,
  ClassificationPanel,
  RiskPanel,
  TriagePanel,
} from '@/components/governance/use-case-panels'
import {
  ACTION_STATUS_LABELS,
  AUTONOMY_LABELS,
  DECISION_STATUS_LABELS,
  INCIDENT_STATUS_LABELS,
  DECISION_TYPE_LABELS,
  formatDate,
  formatDateTime,
  RISK_LEVEL_LABELS,
  RISK_STATUS_LABELS,
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

export default async function UseCasePage({
  params,
  searchParams,
}: {
  params: Promise<{ id: string }>
  searchParams: Promise<{ onglet?: string }>
}) {
  const { id } = await params
  const { onglet } = await searchParams
  const tab = resolveTab(onglet)
  const supabase = await createClient()

  const { data: useCase } = await supabase
    .from('ai_use_case')
    .select(
      `id, business_ref, name, purpose, business_process, expected_benefit, status,
       autonomy_level, criticality, decision_impact, users_description, affected_persons,
       owner_user_id, accountable_user_id,
       data_description, involves_personal_data, involves_vulnerable_persons,
       next_review_at, status_changed_at, organization_id, activity_id,
       organization:organization_id (id, name),
       activity:activity_id (id, name, process:process_id (name))`,
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
    { data: incidents },
    { data: suggestionsData },
    { data: actionSuggestionsData },
    { data: timeline },
    { data: gateData },
    { data: memberships },
    { data: orgControls },
    { data: orgVendors },
    { data: orgAssets },
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
      .select('id, status, justification, control:control_id (id, code, name, is_mandatory, status)')
      .eq('use_case_id', id),
    supabase
      .from('action')
      .select('id, business_ref, title, status, due_date, is_blocking, source')
      .eq('use_case_id', id)
      .order('due_date', { nullsFirst: false }),
    supabase
      .from('change_request')
      .select(
        'id, business_ref, title, description, change_types, status, planned_at, reassessment:reassessment (engine_verdict, final_verdict, status, scope)',
      )
      .eq('use_case_id', id),
    supabase
      .from('incident')
      .select(
        'id, business_ref, title, kind, severity, status, detected_at, containment_action, root_cause, is_recurrence, capa:capa (id, business_ref, correction, cause_analysis, corrective_action, preventive_action, owner_user_id, due_date, status)',
      )
      .eq('use_case_id', id)
      .order('detected_at', { ascending: false }),
    // Les propositions de l'assistant ne se calculent que pour la rubrique
    // qui les montre : ce sont les deux appels les plus lourds de la page.
    tab === 'controles'
      ? supabase.rpc('suggest_controls', { p_use_case_id: id })
      : Promise.resolve({ data: null }),
    tab === 'actions'
      ? supabase.rpc('suggest_actions', { p_use_case_id: id })
      : Promise.resolve({ data: null }),
    supabase
      .from('audit_log')
      .select('id, occurred_at, action, summary, actor_email')
      .eq('entity_id', id)
      .order('occurred_at', { ascending: false })
      .limit(30),
    supabase.rpc('evaluate_gate', { p_use_case_id: id, p_target: 'PRODUCTION' }),
    supabase
      .from('membership')
      .select('user:user_id (id, full_name, email, job_title)')
      .eq('status', 'active'),
    supabase
      .from('control')
      .select('id, code, name, status, organization_id')
      .order('code'),
    supabase.from('vendor').select('id, name, organization_id').order('name'),
    supabase.from('ai_asset').select('id, name, kind, organization_id').order('name'),
  ])

  const gate = gateData as GateResult | null
  const organization = useCase.organization as unknown as { id: string; name: string } | null
  const activity = useCase.activity as unknown as
    | { id: string; name: string; process: { name: string } | null }
    | null

  // Les quatre chiffres du bandeau. Ils se calculent ici, sur des donnees deja
  // chargees : un cinquieme appel serait du trafic pour un resultat deja en
  // memoire. Ils bougent a chaque acte pose sur la fiche : un risque identifie,
  // un controle retenu, une action close, une decision approuvee.
  const today = new Date().toISOString().slice(0, 10)
  const openHighRisks = (risks ?? []).filter(
    (r) =>
      ['high', 'critical'].includes((r.residual_level ?? r.inherent_level) as string) &&
      !['mitigated', 'closed', 'accepted'].includes(r.status),
  ).length
  // Un controle obligatoire dont l'applicabilite n'est pas tranchee bloque le
  // gate PRODUCTION : c'est un acte a poser, pas un volume.
  const mandatoryUndecided = (controls ?? []).filter((c) => {
    const control = c.control as unknown as { is_mandatory: boolean } | null
    return c.status === 'to_determine' && control?.is_mandatory === true
  }).length
  const applicableControls = (controls ?? []).filter((c) => c.status === 'applicable')
  const openActions = (actions ?? []).filter((a) => !['done', 'cancelled'].includes(a.status))
  const overdueActions = openActions.filter(
    (a) => a.due_date !== null && a.due_date <= today,
  ).length
  const pendingDecisions = (decisions ?? []).filter((d) =>
    ['draft', 'submitted'].includes(d.status),
  ).length

  // Un risque « brut » est un risque jamais recote apres traitement. Ni traite,
  // ni accepte, ni clos : il pese encore en entier.
  const unsettled = (risks ?? []).filter(
    (r) => !['mitigated', 'closed', 'accepted'].includes(r.status),
  )
  const unsettledRisks = unsettled.length
  const unassessedRisks = unsettled.filter((r) => r.residual_level === null).length
  const openIncidents = (incidents ?? []).filter((i) => i.status !== 'CLOSED').length
  const pendingReassessments = (changes ?? []).filter((c) =>
    ((c.reassessment ?? []) as { final_verdict: string | null }[]).some((r) => r.final_verdict === null),
  ).length

  // Les preuves de ce cas d'usage : celles rattachees aux controles qui s'y
  // appliquent. Elles ne se lisent que dans la rubrique Supervision.
  const applicableControlIds = applicableControls
    .map((c) => (c.control as unknown as { id: string } | null)?.id)
    .filter((cid): cid is string => Boolean(cid))
  const { data: evidenceLinks } =
    tab === 'supervision' && applicableControlIds.length
      ? await supabase
          .from('control_evidence')
          .select(
            'control_id, evidence:evidence_id (id, business_ref, title, validation_status, valid_until, typology:typology_id (name))',
          )
          .in('control_id', applicableControlIds)
      : { data: null }
  const useCaseEvidence = [
    ...new Map(
      (evidenceLinks ?? [])
        .map((l) => l.evidence as unknown as {
          id: string
          business_ref: string
          title: string
          validation_status: string
          valid_until: string | null
          typology: { name: string } | null
        } | null)
        .filter((e): e is NonNullable<typeof e> => Boolean(e))
        .map((e) => [e.id, e] as const),
    ).values(),
  ]

  const signals: Partial<Record<UseCaseTab, TabSignal>> = {
    fil: useCase.criticality ? { tone: 'done' } : { tone: 'todo' },
    qualification: classification ? { tone: 'done' } : { tone: 'todo' },
    actions: {
      count: openActions.length,
      tone: overdueActions ? 'late' : openActions.length ? 'todo' : 'neutral',
    },
    controles: {
      count: applicableControls.length,
      tone: mandatoryUndecided ? 'todo' : applicableControls.length ? 'done' : 'todo',
    },
    risques: {
      count: unsettledRisks,
      tone: openHighRisks ? 'late' : unsettledRisks ? 'todo' : 'neutral',
    },
    impact: { count: impacts?.length ?? 0, tone: impacts?.length ? 'done' : 'todo' },
    supervision: oversight
      ? { tone: oversight.status === 'approved' ? 'done' : 'todo' }
      : { tone: 'todo' },
    decisions: { count: pendingDecisions, tone: pendingDecisions ? 'todo' : 'neutral' },
    changements: { count: pendingReassessments, tone: pendingReassessments ? 'todo' : 'neutral' },
    incidents: { count: openIncidents, tone: openIncidents ? 'late' : 'neutral' },
  }

  const controlChoices = (orgControls ?? [])
    .filter((c) => c.organization_id === useCase.organization_id)
    .map((c) => ({ id: c.id, code: c.code, name: c.name, status: c.status }))
  // Un risque se traite par un controle qui S'APPLIQUE a ce cas d'usage : la
  // liste ne propose pas les cent vingt controles du referentiel.
  const treatmentChoices = controlChoices.filter((c) => applicableControlIds.includes(c.id))

  const vendorChoices = (orgVendors ?? [])
    .filter((v) => v.organization_id === useCase.organization_id)
    .map((v) => ({ id: v.id, name: v.name }))
  const assetChoices = (orgAssets ?? [])
    .filter((a) => a.organization_id === useCase.organization_id)
    .map((a) => ({ id: a.id, name: a.name, kind: a.kind }))

  const people = (memberships ?? [])
    .map((m) => m.user as unknown as { id: string; full_name: string | null; email: string; job_title: string | null } | null)
    .filter((u): u is NonNullable<typeof u> => Boolean(u))
    .map((u) => ({
      id: u.id,
      label: u.full_name ? `${u.full_name}${u.job_title ? ` — ${u.job_title}` : ''}` : u.email,
    }))

  const qualificationSummary = classification ? (
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
        {classification.legal_review_completed ? ' (close)' : ' (en attente)'} · qualifié le{' '}
        {formatDate(classification.classified_at)}
        {classification.next_review_at
          ? ` · à revoir le ${formatDate(classification.next_review_at)}`
          : ''}
      </p>
    </div>
  ) : (
    <Empty>
      Aucune qualification enregistrée. Elle se pose dans la rubrique « Qualification » ; le
      passage en revue l’exige.
    </Empty>
  )

  return (
    <Shell
      breadcrumb={[
        { href: '/admin/organizations', label: 'Organisations' },
        ...(organization
          ? [{ href: `/admin/organizations/${organization.id}`, label: organization.name }]
          : []),
        { label: useCase.name },
      ]}
      title={useCase.name}
      subtitle={
        activity
          ? `${useCase.business_ref} · ${activity.process?.name ?? '—'} › ${activity.name}`
          : `${useCase.business_ref} — non rattaché à une activité`
      }
      actions={
        <div className="flex items-center gap-3">
          <Badge tone="info">{USE_CASE_STATUS_LABELS[status]}</Badge>
          <UseCaseLabelForm useCase={useCase} people={people} trigger="Changer" />
          {/*
            Faire evoluer se demande depuis n'importe quelle rubrique : c'est
            l'acte central de la fiche, il ne vit pas dans un onglet.
          */}
          <Modal
            trigger="Faire évoluer"
            triggerClassName="rounded-md bg-night-900 px-3.5 py-1.5 text-xs font-medium text-white hover:bg-night-800"
            title="Faire évoluer le cas d’usage"
            description="Le serveur vérifie les préconditions ; un refus dit quoi corriger."
          >
            {() => (
              <TransitionPanel
                useCaseId={id}
                targets={UI_TRANSITIONS[status]}
                unsettledRisks={unsettledRisks}
                unassessedRisks={unassessedRisks}
              />
            )}
          </Modal>
        </div>
      }
    >
      {/*
        Le bandeau ne bouge pas d'une rubrique a l'autre : les quatre chiffres
        restent sous les yeux pendant qu'on agit dessous. Chacun change des
        qu'un acte est pose sur la fiche.
      */}
      <StatStrip>
        <Stat
          label={openHighRisks ? `Risques ouverts · ${openHighRisks} élevé(s)` : 'Risques ouverts'}
          value={unsettledRisks}
          total={risks?.length ?? 0}
          tone={openHighRisks ? 'stop' : 'warn'}
        />
        <Stat
          label={
            mandatoryUndecided
              ? `Contrôles applicables · ${mandatoryUndecided} obligatoire(s) à statuer`
              : 'Contrôles applicables'
          }
          value={applicableControls.length}
          total={controls?.length ?? 0}
          tone={mandatoryUndecided ? 'warn' : 'ok'}
        />
        <Stat
          label={overdueActions ? `Actions ouvertes · ${overdueActions} échue(s)` : 'Actions ouvertes'}
          value={openActions.length}
          total={actions?.length ?? 0}
          tone={overdueActions ? 'stop' : 'warn'}
        />
        <Stat
          label="Décisions à instruire"
          value={pendingDecisions}
          total={decisions?.length ?? 0}
          tone="warn"
        />
      </StatStrip>

      <UseCaseTabs useCaseId={id} active={tab} signals={signals} />

      {tab === 'fil' ? (
        <div className="grid gap-5 lg:grid-cols-3">
          <div className="space-y-5 lg:col-span-2">
            <div className="rounded-lg border border-ink-200 bg-white p-5">
              <Lifecycle status={status} />
              <p className="mt-3 border-t border-ink-100 pt-3 text-xs text-ink-400">
                Dernier changement de statut : {formatDateTime(useCase.status_changed_at)}
                {useCase.next_review_at
                  ? ` · prochaine revue le ${formatDate(useCase.next_review_at)}`
                  : ''}
              </p>

              <dl className="mt-4 grid gap-4 border-t border-ink-100 pt-4 sm:grid-cols-2">
                <Field label="Processus métier">{useCase.business_process ?? '—'}</Field>
                <Field label="Bénéfice attendu">{useCase.expected_benefit ?? '—'}</Field>
                <Field label="Niveau d’autonomie">
                  {AUTONOMY_LABELS[useCase.autonomy_level] ?? useCase.autonomy_level}
                </Field>
                <Field label="Criticité">
                  {useCase.criticality ?? 'Non déterminée'}
                </Field>
                <Field label="Utilisateurs">{useCase.users_description ?? '—'}</Field>
                <Field label="Personnes affectées">{useCase.affected_persons ?? '—'}</Field>
                <Field label="Données">{useCase.data_description ?? '—'}</Field>
                <Field label="Portée de la décision">{useCase.decision_impact ?? '—'}</Field>
              </dl>

              <div className="mt-4 flex flex-wrap items-center gap-2">
                {useCase.involves_personal_data ? (
                  <Badge tone="warn">Données personnelles</Badge>
                ) : null}
                {useCase.involves_vulnerable_persons ? (
                  <Badge tone="stop">Personnes vulnérables</Badge>
                ) : null}
                {/*
                  Ce que le cas d'usage emploie, et de qui il depend. Les deux
                  rattachements vivent ici parce qu'ils completent son identite —
                  et parce qu'un fournisseur rattache devient une precondition de
                  mise en production.
                */}
                <span className="ml-auto flex flex-wrap gap-2">
                  <LinkAssetForm useCaseId={id} assets={assetChoices} />
                  <LinkVendorForm useCaseId={id} vendors={vendorChoices} />
                </span>
              </div>
            </div>

            <TriagePanel
              useCaseId={id}
              criticality={useCase.criticality}
              nextReviewAt={useCase.next_review_at}
            />
          </div>

          <div className="space-y-5">
          <Disclosure
            title="Gate production"
            aside={<GateNote />}
            summary={
              gate
                ? gate.satisfied
                  ? 'Préconditions satisfaites'
                  : `${gate.checks.filter((c) => !c.satisfied).length} précondition(s) manquante(s)`
                : 'Évalué en continu, sans déclencher de transition'
            }
            tone={gate ? (gate.satisfied ? 'done' : 'todo') : 'neutral'}
            defaultOpen={Boolean(gate && !gate.satisfied)}
          >
            {gate ? <GateChecklist gate={gate} /> : <Empty>Gate non évaluable.</Empty>}
          </Disclosure>

            <Card
              title="Qualification réglementaire"
              subtitle="Telle qu’enregistrée. Elle se pose et se révise dans la rubrique « Qualification »."
              action={
                <InfoTip label="Ce que dit cette carte" title="Ce qui a été qualifié, et quand">
                  <div className="flex flex-col gap-3 text-sm leading-relaxed text-ink-600">
                    <p>
                      Le rappel de la qualification au regard du{' '}
                      <strong className="font-medium text-ink-800">règlement (UE) 2024/1689</strong>{' '}
                      (AI Act) : le rôle que l’organisation y tient et les qualifications retenues,
                      avec la version du règlement qui a servi et la date.
                    </p>
                    <p>
                      Elle se lit ici parce qu’elle conditionne la suite du parcours — le passage en
                      revue l’exige — mais elle ne se modifie que dans sa rubrique, où le
                      raisonnement est demandé.
                    </p>
                  </div>
                </InfoTip>
              }
            >
              {qualificationSummary}
              <Link
                href={`/admin/use-cases/${id}?onglet=qualification`}
                scroll={false}
                className="mt-3 inline-block text-xs font-medium text-brand-600 hover:underline"
              >
                {classification ? 'Réviser la qualification' : 'Qualifier maintenant'}
              </Link>
            </Card>
          </div>
        </div>
      ) : null}

      {tab === 'qualification' ? (
        <div className="grid gap-5 lg:grid-cols-3">
          <div className="lg:col-span-2">
            <ClassificationPanel
              useCaseId={id}
              current={
                classification
                  ? {
                      organization_role: classification.organization_role,
                      flags: classification.flags as string[],
                      rationale: classification.rationale,
                      legal_review_level: classification.legal_review_level,
                      legal_review_completed: classification.legal_review_completed,
                      framework_version: classification.framework_version,
                      next_review_at: classification.next_review_at,
                    }
                  : null
              }
            />
          </div>
          <Card title="Qualification enregistrée" subtitle="Ce qui vaut aujourd’hui">
            {qualificationSummary}
          </Card>
        </div>
      ) : null}

      {tab === 'actions' ? (
        <div className="max-w-4xl">
          <Card
            title="Actions"
            subtitle={
              actions?.length
                ? `${openActions.length} ouverte(s) sur ${actions.length}${overdueActions ? ` · ${overdueActions} échue(s)` : ''}`
                : 'Aucune action'
            }
            tone={overdueActions ? 'stop' : 'neutral'}
            action={<ActionNote />}
          >
            <div className="mb-4 flex flex-wrap items-center gap-3">
              <ActionProposals
                organizationId={useCase.organization_id}
                useCaseId={id}
                suggestions={(actionSuggestionsData ?? { available: false }) as ActionSuggestions}
                people={people}
              />
              <ActionForm organizationId={useCase.organization_id} useCaseId={id} people={people} />
            </div>
            {actions?.length ? (
              <ul className="space-y-3">
                {actions.map((a) => {
                  const late =
                    !['done', 'cancelled'].includes(a.status) &&
                    a.due_date !== null &&
                    a.due_date < new Date().toISOString().slice(0, 10)
                  return (
                    <li key={a.id} className="flex items-start justify-between gap-3 text-sm">
                      <div className="min-w-0">
                        <div className="flex flex-wrap items-center gap-2">
                          <span className="text-ink-900">{a.title}</span>
                          {a.is_blocking ? <Badge tone="stop">Bloquante</Badge> : null}
                          {late ? <Badge tone="stop">Échue</Badge> : null}
                        </div>
                        <span className="text-xs text-ink-400">
                          {a.business_ref} · {ACTION_STATUS_LABELS[a.status] ?? a.status}
                          {a.due_date ? ` · échéance ${formatDate(a.due_date)}` : ' · sans échéance'}
                        </span>
                      </div>
                      <span className="flex shrink-0 items-center gap-2">
                        {a.source === 'impact_finding' && !['done', 'cancelled'].includes(a.status) ? (
                          <Link
                            href={`/admin/organizations/${useCase.organization_id}/preuves/deposer?cas-d-usage=${id}&action=${a.id}`}
                            className="text-xs font-medium text-brand-600 hover:underline"
                          >
                            Déposer
                          </Link>
                        ) : null}
                        <ActionStatusForm
                          organizationId={useCase.organization_id}
                          useCaseId={id}
                          action={a}
                        />
                      </span>
                    </li>
                  )
                })}
              </ul>
            ) : (
              <Empty>Aucune action ouverte.</Empty>
            )}
          </Card>
        </div>
      ) : null}

      {tab === 'controles' ? (
        <div className="max-w-4xl">
          <Card
            title="Contrôles affectés"
            subtitle={`${controls?.length ?? 0} contrôle(s) statué(s) sur ${controlChoices.length} au référentiel · ${applicableControls.length} applicable(s)`}
            action={<ControlNote />}
          >
            {/*
              Deux gestes : laisser l'assistant proposer — regles, faits, role —
              et retenir ; ou statuer soi-meme sur un controle de la liste.
            */}
            <div className="mb-4 flex flex-wrap items-center gap-3">
              <ControlProposals
                organizationId={useCase.organization_id}
                useCaseId={id}
                suggestions={(suggestionsData ?? { available: false }) as Suggestions}
              />
              <ApplicabilityForm useCaseId={id} controls={controlChoices} />
            </div>

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
        </div>
      ) : null}

      {tab === 'risques' ? (
        <div className="max-w-4xl">
          <Card
            title="Risques"
            subtitle={`${risks?.length ?? 0} risque(s)`}
            tone={unsettledRisks ? 'warn' : 'neutral'}
            action={
              <span className="flex items-center gap-2">
                <RiskPanel useCaseId={id} riskCount={risks?.length ?? 0} people={people} />
                <RiskNote />
              </span>
            }
          >
            {risks?.length ? (
              <ul className="divide-y divide-ink-100">
                {risks.map((risk) => (
                  <li key={risk.id} className="py-3">
                    <div className="flex items-start justify-between gap-4">
                      <div className="min-w-0">
                        <p className="text-sm font-medium text-ink-900">{risk.title}</p>
                        <p className="text-xs text-ink-600">{risk.scenario}</p>
                        <p className="mt-1 text-xs text-ink-400">
                          {risk.business_ref} · {risk.category} ·{' '}
                          {RISK_STATUS_LABELS[risk.status] ?? risk.status}
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

                    {risk.status !== 'accepted' && risk.status !== 'closed' ? (
                      <div className="mt-3 flex flex-col gap-3">
                        {/*
                          Traiter et accepter sont deux reponses distinctes au
                          meme risque : on agit, ou on assume. Les presenter
                          cote a cote evite de croire que l'acceptation est la
                          seule issue offerte.
                        */}
                        <RiskTreatmentForm
                          riskId={risk.id}
                          useCaseId={id}
                          riskTitle={risk.title}
                          people={people}
                          controls={treatmentChoices}
                        />
                        <AcceptRiskForm riskId={risk.id} useCaseId={id} />
                      </div>
                    ) : null}
                  </li>
                ))}
              </ul>
            ) : (
              <Empty>Aucun risque identifié.</Empty>
            )}
          </Card>
        </div>
      ) : null}

      {tab === 'impact' ? (
        <div className="max-w-4xl space-y-3">
          <Card
            title="Évaluation d'impact"
            subtitle="Effets sur les personnes, les groupes et la société (ISO/IEC 42005)."
            action={
              <span className="flex items-center gap-2">
                <ImpactForm useCaseId={id} />
                <ImpactNote />
              </span>
            }
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
          <p className="text-xs leading-relaxed text-ink-500">
            Une évaluation <strong className="font-medium text-ink-700">achevée</strong> ouvre
            d’elle-même une action « Déposer la preuve de l’évaluation d’impact » — et l’AIPD
            lorsqu’elle est requise — confiée à la personne qui l’a conduite. Le dépôt de la pièce
            au registre des preuves clôt cette action.
          </p>
        </div>
      ) : null}

      {tab === 'supervision' ? (
        <div className="grid gap-5 lg:grid-cols-3">
          <div className="lg:col-span-2">
          <Card
            title="Supervision humaine"
            subtitle="Déclencheurs d’intervention, procédures d’arrêt et de reprise, cadence de revue."
            action={
              <span className="flex items-center gap-2">
                <OversightForm
                  useCaseId={id}
                  people={people}
                  current={
                    oversight
                      ? {
                          status: oversight.status,
                          intervention_triggers: oversight.intervention_triggers,
                          override_procedure: oversight.override_procedure,
                          stop_procedure: oversight.stop_procedure,
                          monitoring_cadence: oversight.monitoring_cadence,
                          expected_evidence: oversight.expected_evidence,
                          not_applicable_rationale: oversight.not_applicable_rationale,
                        }
                      : null
                  }
                />
                <OversightNote />
              </span>
            }
          >
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
          </div>
          <Card
            title="Preuves de ce cas d’usage"
            subtitle="Rattachées aux contrôles qui s’y appliquent."
            action={
              organization ? (
                <Link
                  href={`/admin/organizations/${organization.id}/preuves/deposer?cas-d-usage=${id}`}
                  className="rounded-md border border-ink-200 px-3.5 py-1.5 text-xs font-medium text-ink-700 hover:bg-ink-100"
                >
                  Déposer une preuve
                </Link>
              ) : null
            }
          >
            {oversight?.expected_evidence ? (
              <p className="mb-3 rounded-md bg-ink-100 px-3.5 py-2.5 text-[13px] leading-relaxed text-ink-600">
                Attendu par le plan : {oversight.expected_evidence}
              </p>
            ) : null}
            {useCaseEvidence.length ? (
              <ul className="divide-y divide-ink-100">
                {useCaseEvidence.map((e) => (
                  <li key={e.id} className="flex items-start justify-between gap-3 py-2 text-sm">
                    <div className="min-w-0">
                      {organization ? (
                        <Link
                          href={`/admin/organizations/${organization.id}/preuves?preuve=${e.id}`}
                          className="text-ink-900 hover:underline"
                        >
                          {e.title}
                        </Link>
                      ) : (
                        <span className="text-ink-900">{e.title}</span>
                      )}
                      <span className="block text-xs text-ink-400">
                        {e.business_ref}
                        {e.typology ? ` · ${e.typology.name}` : ''}
                        {e.valid_until ? ` · valide jusqu’au ${formatDate(e.valid_until)}` : ''}
                      </span>
                    </div>
                    <Badge
                      tone={
                        e.validation_status === 'validated'
                          ? 'ok'
                          : e.validation_status === 'pending'
                            ? 'warn'
                            : 'neutral'
                      }
                    >
                      {e.validation_status === 'validated'
                        ? 'Validée'
                        : e.validation_status === 'pending'
                          ? 'À valider'
                          : e.validation_status}
                    </Badge>
                  </li>
                ))}
              </ul>
            ) : (
              <Empty>
                Aucune preuve rattachée aux contrôles de ce cas d’usage. Déposer une preuve la
                rattache au contrôle qu’elle démontre.
              </Empty>
            )}
          </Card>
        </div>
      ) : null}

      {tab === 'decisions' ? (
        <div className="max-w-4xl">
          <Card
            title="Décisions de gouvernance"
            subtitle={`${decisions?.length ?? 0} décision(s)`}
            action={
              <span className="flex items-center gap-2">
                {organization ? (
                  <Link
                    href={`/admin/organizations/${organization.id}/decisions/nouvelle?cas-d-usage=${id}`}
                    className="rounded-md border border-ink-200 px-3.5 py-1.5 text-xs font-medium text-ink-700 hover:bg-ink-100"
                  >
                    Soumettre
                  </Link>
                ) : null}
                <DecisionNote />
              </span>
            }
          >
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
        </div>
      ) : null}

      {tab === 'changements' ? (
        <div className="max-w-4xl">
          <Card
            title="Changements et réévaluations"
            subtitle="Ce qui a rouvert l’évaluation, et pourquoi"
            action={<ChangeNote />}
          >
            <div className="mb-4">
              <ChangeRequestForm
                organizationId={useCase.organization_id}
                useCaseId={id}
                currentAutonomy={useCase.autonomy_level}
              />
            </div>
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
      ) : null}

      {tab === 'incidents' ? (
        <div className="max-w-4xl">
          <Card
            title="Incidents"
            subtitle={
              incidents?.length
                ? `${openIncidents} ouvert(s) sur ${incidents.length}`
                : 'Aucun incident'
            }
            tone={openIncidents ? 'stop' : 'neutral'}
            action={<IncidentNote />}
          >
            <div className="mb-4">
              <IncidentForm organizationId={useCase.organization_id} useCaseId={id} people={people} />
            </div>
            {incidents?.length ? (
              <ul className="space-y-4">
                {incidents.map((incident) => {
                  const capas = (incident.capa ?? []) as {
                    id: string
                    business_ref: string
                    correction: string
                    cause_analysis: string
                    corrective_action: string
                    preventive_action: string | null
                    owner_user_id: string | null
                    due_date: string | null
                    status: string
                  }[]
                  const significant =
                    ['S1', 'S2'].includes(incident.severity) ||
                    incident.kind === 'non_conformity' ||
                    incident.is_recurrence
                  const hasClosedCapa = capas.some((c) => c.status === 'closed')
                  return (
                    <li key={incident.id} className="rounded-md border border-ink-100 p-3 text-sm">
                      <div className="flex items-start justify-between gap-3">
                        <div className="min-w-0">
                          <div className="flex flex-wrap items-center gap-2">
                            <Badge tone={['S1', 'S2'].includes(incident.severity) ? 'stop' : 'warn'}>
                              {incident.severity}
                            </Badge>
                            <span className="font-medium text-ink-900">{incident.title}</span>
                          </div>
                          <span className="text-xs text-ink-400">
                            {incident.business_ref} · {INCIDENT_STATUS_LABELS[incident.status] ?? incident.status}
                            {' · détecté le '}
                            {formatDateTime(incident.detected_at)}
                            {significant ? ' · significatif : CAPA close exigée' : ''}
                          </span>
                        </div>
                        <IncidentProgressForm
                          organizationId={useCase.organization_id}
                          useCaseId={id}
                          incident={{
                            id: incident.id,
                            title: incident.title,
                            status: incident.status,
                            containment_action: incident.containment_action,
                            root_cause: incident.root_cause,
                            significant,
                            has_closed_capa: hasClosedCapa,
                          }}
                        />
                      </div>

                      {/* La CAPA vit sous son incident : c'est lui qu'elle corrige. */}
                      <div className="mt-3 border-t border-ink-100 pt-3">
                        {capas.length ? (
                          <ul className="space-y-2">
                            {capas.map((capa) => (
                              <li key={capa.id} className="flex items-start justify-between gap-3">
                                <div className="min-w-0">
                                  <span className="text-xs font-medium uppercase tracking-wide text-ink-500">
                                    CAPA {capa.business_ref}
                                  </span>
                                  <span className="block text-ink-800">{capa.corrective_action}</span>
                                  <span className="text-xs text-ink-400">
                                    {capa.status === 'closed'
                                      ? 'Close, efficacité vérifiée'
                                      : capa.status === 'ineffective'
                                        ? 'Inefficace — à reprendre'
                                        : `En cours${capa.due_date ? ` · échéance ${formatDate(capa.due_date)}` : ''}`}
                                  </span>
                                </div>
                                <div className="flex shrink-0 flex-wrap justify-end gap-2">
                                  {capa.status !== 'closed' ? (
                                    <>
                                      <CapaForm
                                        organizationId={useCase.organization_id}
                                        useCaseId={id}
                                        incidentId={incident.id}
                                        people={people}
                                        current={capa}
                                      />
                                      <CapaCloseForm
                                        organizationId={useCase.organization_id}
                                        useCaseId={id}
                                        capa={capa}
                                      />
                                    </>
                                  ) : null}
                                </div>
                              </li>
                            ))}
                          </ul>
                        ) : incident.status !== 'CLOSED' ? (
                          <div className="flex items-center justify-between gap-3">
                            <span className="text-xs text-ink-500">
                              {significant
                                ? 'Aucune CAPA : la clôture sera refusée tant qu’une CAPA n’est pas close.'
                                : 'Aucune CAPA. Facultative pour un incident mineur.'}
                            </span>
                            <CapaForm
                              organizationId={useCase.organization_id}
                              useCaseId={id}
                              incidentId={incident.id}
                              people={people}
                            />
                          </div>
                        ) : null}
                      </div>
                    </li>
                  )
                })}
              </ul>
            ) : (
              <Empty>Aucun incident déclaré sur ce cas d’usage.</Empty>
            )}
          </Card>
        </div>
      ) : null}

      {tab === 'journal' ? (
        <div className="max-w-4xl">
          <Card
            title="Journal d’audit"
            subtitle="Trace immuable des opérations sensibles"
            action={<AuditNote />}
          >
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
      ) : null}
    </Shell>
  )
}

import Link from 'next/link'
import { notFound } from 'next/navigation'
import { createClient } from '@/lib/supabase/server'
import { Shell } from '@/components/shell'
import { UseCaseLabelForm } from '@/components/governance/use-case-label-form'
import { Badge, Card, Empty, Field, Stat, StatStrip } from '@/components/ui'
import { TransitionModal } from '@/components/governance/transition-modal'
import { AssetMeasureForm } from '@/components/governance/asset-measure-form'
import { DecisionModal } from '@/components/governance/decision-modal'
import { IncidentTicket } from '@/components/governance/incident-ticket'
import { describePerson, organizationPeople } from '@/lib/governance/people'
import { unlinkAssetFromUseCase } from '@/lib/actions/registry'
import { resolveTab, UseCaseTabs, type TabSignal, type UseCaseTab } from '@/components/governance/use-case-tabs'
import {
  CLASSIFICATION_FLAG_LABELS,
  FRAMEWORK_LABELS,
  LEGAL_REVIEW_LABELS,
  ORGANIZATION_ROLE_LABELS,
} from '@/lib/domain/classification'
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
  type OversightCatalogControl,
} from '@/components/governance/registry-forms'
import {
  ActionNote,
  AuditNote,
  ChangeNote,
  ClassificationNote,
  ControlNote,
  DecisionNote,
  ImpactNote,
  IncidentNote,
  OversightNote,
  RiskNote,
} from '@/components/governance/rubric-notes'
import {
  ActionForm,
  ActionStatusForm,
  CapaCloseForm,
  CapaForm,
  ChangeRequestForm,
  IncidentForm,
  IncidentProgressForm,
} from '@/components/governance/operations-forms'
import { DECISION_TYPES_BY_STATUS, UI_TRANSITIONS } from '@/lib/domain/transitions'
import {
  AcceptRiskForm,
  ClassificationPanel,
  RiskPanel,
  TriagePanel,
} from '@/components/governance/use-case-panels'
import {
  ACTION_STATUS_LABELS,
  AUTONOMY_LABELS,
  ASSET_KIND_LABELS,
  ASSET_MEASURE_STATUS_LABELS,
  CHANGE_STATUS_LABELS,
  CONTROL_STATUS_LABELS,
  controlStatusTone,
  MEASURE_KIND_HINTS,
  MEASURE_KIND_LABELS,
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

/** « Camille Rousset », ou l'adresse, ou rien. */
function personLabel(value: unknown): string | null {
  const p = value as { full_name: string | null; email: string } | null
  return p ? (p.full_name?.trim() || p.email) : null
}

function riskTone(level: RiskLevel | null) {
  if (level === 'critical' || level === 'high') return 'stop' as const
  if (level === 'moderate') return 'warn' as const
  return 'neutral' as const
}

type TimelineEntry = {
  id: string
  kind: 'decision' | 'change'
  business_ref: string
  type: string | null
  title: string
  body: string | null
  conditions: string | null
  status: string
  at: string
  approved_at: string | null
  effective_from: string | null
  review_due_at: string | null
  expected_approver: string | null
  approver: string | null
  change_request_id: string | null
  decision: { id: string; business_ref: string; status: string } | null
  verdict: string | null
  scope: string[] | null
  planned_at: string | null
  change_types: string[] | null
}

type UseCaseAsset = {
  link_id: string
  relation: string
  asset_id: string
  business_ref: string
  name: string
  kind: string
  version: string | null
  hosting_location: string | null
  contains_personal_data: boolean
  vendor: string | null
  measures: {
    id: string
    control_id: string
    code: string
    name: string
    measure_kind: string
    control_status: string
    status: string
    note: string | null
    verified_at: string | null
  }[]
}

export default async function UseCasePage({
  params,
  searchParams,
}: {
  params: Promise<{ id: string }>
  searchParams: Promise<{ onglet?: string; controle?: string }>
}) {
  const { id } = await params
  const { onglet, controle } = await searchParams
  const tab = resolveTab(onglet)
  const supabase = await createClient()
  const {
    data: { user: viewer },
  } = await supabase.auth.getUser()

  // Une decision approuvee dont la date d'effet est arrivee franchit son
  // jalon au premier chargement de la fiche (0065) — avant de lire le statut.
  await supabase.rpc('apply_due_decisions', { p_use_case_id: id })

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
    { data: reviewGateData },
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
        'id, business_ref, title, scenario, category, inherent_level, residual_level, inherent_likelihood, inherent_impact, residual_likelihood, residual_impact, status, accepted_at, acceptance_review_at, next_review_at, owner_user_id',
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
        `id, business_ref, autonomy_level, status, intervention_triggers, override_procedure, stop_procedure, monitoring_cadence, expected_evidence, approved_at, not_applicable_rationale,
         accountable_user_id, stop_authority_user_id, required_competence,
         trigger_control_id, override_control_id, stop_control_id, competence_control_id,
         trigger_control:trigger_control_id (id, code, name, status), override_control:override_control_id (id, code, name, status),
         stop_control:stop_control_id (id, code, name, status), competence_control:competence_control_id (id, code, name, status)`,
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
      .select('id, status, justification, control:control_id (id, code, name, is_mandatory, status, measure_kind)')
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
        `id, business_ref, title, kind, severity, status, detected_at, containment_action, root_cause, is_recurrence,
         trigger_source, fundamental_rights_impacted, fundamental_rights_detail,
         qualified_at, stop_recommended_at, stop_validated_at, stop_executed_at, stop_note,
         closure_officer_at, closure_owner_at,
         asset:asset_id (name),
         officer:officer_user_id (full_name, email), owner:owner_user_id (full_name, email),
         qualifier:qualified_by (full_name, email),
         stop_recommender:stop_recommended_by (full_name, email), stop_validator:stop_validated_by (full_name, email), stop_executor:stop_executed_by (full_name, email),
         closure_officer:closure_officer_by (full_name, email), closure_owner:closure_owner_by (full_name, email),
         capa:capa (id, business_ref, correction, cause_analysis, corrective_action, preventive_action, owner_user_id, due_date, status)`,
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
    supabase.rpc('evaluate_gate', { p_use_case_id: id, p_target: 'REVIEW' }),
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
  const reviewGate = reviewGateData as GateResult | null
  // Chaque jalon dit lui-meme ce qui lui manque : l'infobulle du jalon porte
  // ses preconditions, evaluees en continu. Plus de carte « gate » a part.
  const gateTip = (g: GateResult | null) =>
    g
      ? {
          summary: g.satisfied
            ? 'préconditions satisfaites'
            : `${g.checks.filter((c) => !c.satisfied).length} précondition(s) manquante(s)`,
          satisfied: g.satisfied,
          content: <GateChecklist gate={g} />,
        }
      : { summary: 'non évaluable', satisfied: null, content: <Empty>Gate non évaluable.</Empty> }
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

  // Le plan s'adosse aux controles HUM : les controles-types publies, a
  // retenir d'un clic, et les controles organisationnels deja au registre.
  const { data: oversightCatalog } =
    tab === 'supervision'
      ? await supabase.rpc('oversight_catalog_controls', { p_organization_id: useCase.organization_id })
      : { data: null }
  const oversightControlChoices = (orgControls ?? [])
    .filter((c) => c.organization_id === useCase.organization_id && c.status !== 'retired')
    .map((c) => ({ id: c.id, code: c.code, name: c.name }))
  type PlanControl = { id: string; code: string; name: string; status: string } | null
  const planControls: { rubric: string; control: NonNullable<PlanControl> }[] = oversight
    ? (
        [
          { rubric: 'Déclencheurs d’intervention', control: oversight.trigger_control as unknown as PlanControl },
          { rubric: 'Reprise en main', control: oversight.override_control as unknown as PlanControl },
          { rubric: 'Arrêt et escalade', control: oversight.stop_control as unknown as PlanControl },
          { rubric: 'Compétence des superviseurs', control: oversight.competence_control as unknown as PlanControl },
        ] as { rubric: string; control: PlanControl }[]
      ).filter((e): e is { rubric: string; control: NonNullable<PlanControl> } => Boolean(e.control))
    : []

  // Les preuves de ce cas d'usage : celles rattachees aux controles qui s'y
  // appliquent. Elles ne se lisent que dans la rubrique Supervision.
  const applicableControlIds = applicableControls
    .map((c) => (c.control as unknown as { id: string } | null)?.id)
    .filter((cid): cid is string => Boolean(cid))
  // Les actifs du cas d'usage, avec leurs mesures : lus sur le fil conducteur
  // et dans les controles (une mesure technique se pose sur un actif).
  const { data: assetsData } =
    tab === 'fil' || tab === 'controles' || tab === 'incidents'
      ? await supabase.rpc('use_case_assets', { p_use_case_id: id })
      : { data: null }
  const useCaseAssets = (assetsData ?? []) as UseCaseAsset[]

  // Les preuves validees de l'organisation : ce sur quoi une decision se fonde.
  const { data: validatedEvidence } = await supabase
    .from('evidence')
    .select('id, business_ref, title')
    .eq('organization_id', useCase.organization_id)
    .eq('validation_status', 'validated')
    .order('business_ref')

  // Decisions et changements, dans l'ordre : une seule lecture (0063).
  const { data: timelineData } =
    tab === 'decisions'
      ? await supabase.rpc('decisions_and_changes', { p_organization_id: useCase.organization_id, p_use_case_id: id })
      : { data: null }
  const timelineEntries = (timelineData ?? []) as TimelineEntry[]

  const planControlIds = planControls.map((p) => p.control.id)
  const evidenceControlIds = [...new Set([...applicableControlIds, ...planControlIds])]
  const { data: evidenceLinks } =
    tab === 'supervision' && evidenceControlIds.length
      ? await supabase
          .from('control_evidence')
          .select(
            'control_id, evidence:evidence_id (id, business_ref, title, validation_status, valid_until, typology:typology_id (name))',
          )
          .in('control_id', evidenceControlIds)
      : { data: null }
  // Par controle du plan : ce qui le demontre, ou rien.
  const evidenceByControl = new Map<string, { id: string; business_ref: string; title: string; validation_status: string }[]>()
  for (const l of evidenceLinks ?? []) {
    const e = l.evidence as unknown as { id: string; business_ref: string; title: string; validation_status: string } | null
    if (!e) continue
    const list = evidenceByControl.get(l.control_id) ?? []
    list.push(e)
    evidenceByControl.set(l.control_id, list)
  }
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
    fil: useCase.criticality && classification ? { tone: 'done' } : { tone: 'todo' },
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
    decisions: {
      count: pendingDecisions + pendingReassessments,
      tone: pendingDecisions + pendingReassessments ? 'todo' : 'neutral',
    },
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

  // Les personnes qui peuvent se prononcer sur une decision.
  const reviewers = (await organizationPeople(useCase.organization_id, true)).map((p) => ({
    userId: p.userId,
    label: describePerson(p),
  }))

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
          {FRAMEWORK_LABELS[classification.framework_code] ?? classification.framework_code} · version{' '}
          {classification.framework_version}
        </Badge>
        <Badge>
          Rôle : {ORGANIZATION_ROLE_LABELS[classification.organization_role] ?? classification.organization_role}
        </Badge>
      </div>
      <div className="flex flex-wrap gap-2">
        {(classification.flags as string[]).length ? (
          (classification.flags as string[]).map((flag) => (
            <Badge key={flag} tone={flag === 'high_risk_potential' || flag === 'prohibited_practice_suspected' ? 'stop' : 'warn'}>
              {CLASSIFICATION_FLAG_LABELS[flag] ?? flag}
            </Badge>
          ))
        ) : (
          <span className="text-xs text-ink-400">Aucune qualification retenue.</span>
        )}
      </div>
      <p className="text-sm text-ink-600">{classification.rationale}</p>
      <p className="text-xs text-ink-400">
        Revue juridique : {LEGAL_REVIEW_LABELS[classification.legal_review_level] ?? classification.legal_review_level}
        {classification.legal_review_completed ? ' — close' : ' — en attente'} · qualifié le{' '}
        {formatDate(classification.classified_at)}
        {classification.next_review_at
          ? ` · à revoir le ${formatDate(classification.next_review_at)}`
          : ''}
      </p>
    </div>
  ) : (
    <Empty>
      Aucune qualification enregistrée. Le passage en revue l’exige : elle se pose ici, d’un clic.
    </Empty>
  )

  const classificationCurrent = classification
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
      titleAside={<UseCaseLabelForm useCase={useCase} people={people} trigger="Modifier la fiche" icon />}
      subtitle={
        activity
          ? `${useCase.business_ref} · ${activity.process?.name ?? '—'} › ${activity.name}`
          : `${useCase.business_ref} — non rattaché à une activité`
      }
      actions={
        <div className="flex items-center gap-3">
          <Badge tone="info">{USE_CASE_STATUS_LABELS[status]}</Badge>
          {/*
            Faire evoluer se demande depuis n'importe quelle rubrique : c'est
            l'acte central de la fiche, il ne vit pas dans un onglet.
          */}
          <TransitionModal
            useCaseId={id}
            organizationId={useCase.organization_id}
            status={status}
            targets={UI_TRANSITIONS[status]}
            unsettledRisks={unsettledRisks}
            unassessedRisks={unassessedRisks}
            currentAutonomy={useCase.autonomy_level}
            decisionTypes={DECISION_TYPES_BY_STATUS[status]}
            people={reviewers}
            evidence={validatedEvidence ?? []}
          />
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
              <Lifecycle status={status} gates={{ REVIEW: gateTip(reviewGate), PRODUCTION: gateTip(gate) }} />
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

              {/*
                Les actifs qu'emploie le cas d'usage — plusieurs, souvent : un
                modele, un systeme, un jeu de donnees — et, pour chacun, les
                mesures techniques posees dessus. C'est la que la gouvernance
                touche la technique.
              */}
              <div className="mt-4 border-t border-ink-100 pt-4">
                <p className="mb-2 text-xs font-semibold uppercase tracking-wide text-ink-500">
                  Actifs d’IA employés
                  <span className="ml-2 font-normal normal-case tracking-normal text-ink-400">
                    {useCaseAssets.length ? `${useCaseAssets.length} rattaché${useCaseAssets.length > 1 ? 's' : ''}` : 'aucun'}
                  </span>
                </p>
                {useCaseAssets.length ? (
                  <ul className="divide-y divide-ink-100">
                    {useCaseAssets.map((asset) => (
                      <li key={asset.link_id} className="py-2">
                        <div className="flex flex-wrap items-baseline justify-between gap-2">
                          <span className="text-sm text-ink-900">
                            {asset.name}
                            <span className="ml-2 text-xs text-ink-400">
                              {ASSET_KIND_LABELS[asset.kind] ?? asset.kind}
                              {asset.version ? ` · v${asset.version}` : ''}
                              {asset.vendor ? ` · ${asset.vendor}` : ''}
                              {asset.hosting_location ? ` · ${asset.hosting_location}` : ''}
                            </span>
                          </span>
                          <span className="flex items-center gap-2 text-xs text-ink-500">
                            {asset.measures.length
                              ? `${asset.measures.filter((m) => m.status === 'implemented' || m.status === 'verified').length}/${asset.measures.length} mesure${asset.measures.length > 1 ? 's' : ''} technique${asset.measures.length > 1 ? 's' : ''} en place`
                              : 'aucune mesure technique posée'}
                            {organization ? (
                              <Link
                                href={`/admin/organizations/${organization.id}/actifs/${asset.asset_id}`}
                                className="text-brand-600 hover:underline"
                              >
                                Fiche
                              </Link>
                            ) : null}
                            <form action={unlinkAssetFromUseCase}>
                              <input type="hidden" name="useCaseId" value={id} />
                              <input type="hidden" name="linkId" value={asset.link_id} />
                              <button type="submit" className="text-ink-400 hover:text-stop-600 hover:underline">
                                Détacher
                              </button>
                            </form>
                          </span>
                        </div>
                        {asset.measures.length ? (
                          <ul className="mt-1 flex flex-wrap gap-1.5">
                            {asset.measures.map((m) => (
                              <li
                                key={m.id}
                                className={`rounded-full px-2 py-0.5 text-[11px] ${
                                  m.status === 'verified' || m.status === 'implemented'
                                    ? 'bg-ok-600/10 text-ok-600'
                                    : 'bg-ink-100 text-ink-600'
                                }`}
                                title={`${m.name} · ${ASSET_MEASURE_STATUS_LABELS[m.status] ?? m.status}`}
                              >
                                {m.code} · {ASSET_MEASURE_STATUS_LABELS[m.status] ?? m.status}
                              </li>
                            ))}
                          </ul>
                        ) : null}
                      </li>
                    ))}
                  </ul>
                ) : (
                  <p className="text-xs text-ink-500">
                    Aucun actif rattaché. Les mesures techniques se posent sur un actif : rattacher le modèle,
                    le système ou le jeu de données employé.
                  </p>
                )}
              </div>
            </div>

            <TriagePanel
              useCaseId={id}
              criticality={useCase.criticality}
              nextReviewAt={useCase.next_review_at}
            />
          </div>

          <div className="space-y-5">
            <Card
              title="Qualification réglementaire"
              subtitle="Règlement (UE) 2024/1689 — AI Act. Se pose et se révise ici, d’un clic."
              tone={classification ? 'neutral' : 'warn'}
              action={
                <span className="flex items-center gap-2">
                  <ClassificationPanel useCaseId={id} current={classificationCurrent} />
                  <ClassificationNote />
                </span>
              }
            >
              {qualificationSummary}
            </Card>
          </div>
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
            subtitle={`${controls?.length ?? 0} contrôle(s) statué(s) sur ${controlChoices.length} au référentiel · ${applicableControls.length} applicable(s), dont ${applicableControls.filter((c) => (c.control as unknown as { status: string } | null)?.status === 'operating').length} opérant(s)`}
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
              <div className="flex flex-col gap-6">
                {/*
                  Par nature : une mesure technique se pose sur un actif — et
                  se lit avec les actifs qui la portent ; une organisationnelle
                  se pose sur l'organisation ou le cas d'usage ; une
                  contractuelle chez un fournisseur. Meme code couleur que le
                  panneau d'une activite : l'etat d'abord, l'applicabilite
                  ensuite ; les applicables non operants en tete.
                */}
                {(['technical', 'organizational', 'contractual'] as const).map((kind) => {
                  const rows = [...controls]
                    .map((ca) => ({
                      ca,
                      control: ca.control as unknown as {
                        id: string
                        code: string
                        name: string
                        is_mandatory: boolean
                        status: string
                        measure_kind: string
                      },
                    }))
                    .filter(({ control }) => (control.measure_kind ?? 'organizational') === kind)
                    .sort((a, b) => {
                      const rank = (x: typeof a) =>
                        x.ca.status !== 'applicable' ? 3 : x.control.status === 'operating' ? 2 : x.control.status === 'implemented' ? 1 : 0
                      return rank(a) - rank(b) || a.control.code.localeCompare(b.control.code)
                    })
                  if (!rows.length) return null
                  const applicableRows = rows.filter((r) => r.ca.status === 'applicable')
                  const unplaced =
                    kind === 'technical'
                      ? applicableRows.filter(
                          (r) => !useCaseAssets.some((a) => a.measures.some((m) => m.control_id === r.control.id)),
                        ).length
                      : 0
                  return (
                    <section key={kind}>
                      <header className="mb-2 flex flex-wrap items-baseline justify-between gap-2 border-b border-ink-200 pb-2">
                        <h3 className="text-sm font-semibold text-ink-900">
                          {MEASURE_KIND_LABELS[kind]}s
                          <span className="ml-2 text-xs font-normal text-ink-400">
                            {applicableRows.length} applicable{applicableRows.length > 1 ? 's' : ''}
                          </span>
                        </h3>
                        <p className={`text-xs ${unplaced ? 'text-warn-600' : 'text-ink-500'}`}>
                          {kind === 'technical'
                            ? unplaced
                              ? `${unplaced} mesure${unplaced > 1 ? 's' : ''} sans actif qui la porte`
                              : useCaseAssets.length
                                ? 'Chaque mesure se pose sur un actif du cas d’usage.'
                                : 'Aucun actif rattaché : ces mesures n’ont pas encore où se poser.'
                            : MEASURE_KIND_HINTS[kind]}
                        </p>
                      </header>
                      <ul className="divide-y divide-ink-100">
                        {rows.map(({ ca, control }) => {
                          const applicable = ca.status === 'applicable'
                          const highlighted = controle === control.id
                          const carriers = useCaseAssets.filter((a) => a.measures.some((m) => m.control_id === control.id))
                          return (
                            <li
                              key={ca.id}
                              id={`controle-${control.id}`}
                              className={`scroll-mt-24 py-2.5 text-sm ${highlighted ? '-mx-3 rounded-md bg-brand-500/10 px-3 ring-1 ring-brand-500/40' : ''}`}
                            >
                              <div className="flex flex-wrap items-start justify-between gap-2">
                                <span className={applicable ? 'text-ink-900' : 'text-ink-500'}>
                                  {control.code} — {control.name}
                                </span>
                                <span className="flex shrink-0 items-center gap-1.5">
                                  {applicable ? (
                                    <Badge tone={controlStatusTone(control.status)}>
                                      {CONTROL_STATUS_LABELS[control.status] ?? control.status}
                                    </Badge>
                                  ) : null}
                                  <Badge tone="neutral">
                                    {applicable ? 'Applicable' : 'Non applicable'}
                                  </Badge>
                                </span>
                              </div>
                              {control.is_mandatory ? (
                                <span className="text-xs text-ink-400">Contrôle obligatoire</span>
                              ) : null}
                              {ca.justification ? (
                                <p className="text-xs text-ink-600">{ca.justification}</p>
                              ) : null}
                              {kind === 'technical' && applicable ? (
                                <div className="mt-1.5 flex flex-wrap items-center gap-2">
                                  {carriers.map((a) => {
                                    const m = a.measures.find((x) => x.control_id === control.id)!
                                    return (
                                      <span
                                        key={a.asset_id}
                                        className={`inline-flex items-center gap-1 rounded-full px-2 py-0.5 text-[11px] ${
                                          m.status === 'verified' || m.status === 'implemented'
                                            ? 'bg-ok-600/10 text-ok-600'
                                            : 'bg-ink-100 text-ink-600'
                                        }`}
                                        title={m.note ?? undefined}
                                      >
                                        {a.name} · {ASSET_MEASURE_STATUS_LABELS[m.status] ?? m.status}
                                      </span>
                                    )
                                  })}
                                  <AssetMeasureForm
                                    useCaseId={id}
                                    control={{ id: control.id, code: control.code, name: control.name }}
                                    assets={useCaseAssets.map((a) => ({ asset_id: a.asset_id, name: a.name, kind: a.kind }))}
                                    placed={carriers.map((a) => a.asset_id)}
                                  />
                                </div>
                              ) : null}
                            </li>
                          )
                        })}
                      </ul>
                    </section>
                  )
                })}
              </div>
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
                <RiskPanel
                  useCaseId={id}
                  organizationId={useCase.organization_id}
                  riskCount={risks?.length ?? 0}
                  people={people}
                  controls={treatmentChoices}
                />
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
                          {risk.inherent_likelihood && risk.inherent_impact
                            ? ` (${risk.inherent_likelihood} × ${risk.inherent_impact} = ${risk.inherent_likelihood * risk.inherent_impact})`
                            : ''}
                        </Badge>
                        {risk.residual_level ? (
                          <Badge tone={riskTone(risk.residual_level as RiskLevel)}>
                            Résiduel : {RISK_LEVEL_LABELS[risk.residual_level as RiskLevel]}
                            {risk.residual_likelihood && risk.residual_impact
                              ? ` (${risk.residual_likelihood} × ${risk.residual_impact} = ${risk.residual_likelihood * risk.residual_impact})`
                              : ''}
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
                          riskRef={risk.business_ref}
                          useCaseId={id}
                          riskTitle={risk.title}
                          riskScenario={risk.scenario}
                          organizationId={useCase.organization_id}
                          people={people}
                          controls={treatmentChoices}
                        />
                        {/*
                          Accepter revient a la personne designee responsable
                          du risque — la base le refuse a quiconque d'autre.
                          Aux autres, on dit a qui cela revient.
                        */}
                        {!risk.owner_user_id || risk.owner_user_id === viewer?.id ? (
                          <AcceptRiskForm riskId={risk.id} useCaseId={id} />
                        ) : (
                          <p className="text-xs text-ink-500">
                            L’acceptation de ce risque revient à{' '}
                            <strong className="font-medium text-ink-700">
                              {people.find((p) => p.id === risk.owner_user_id)?.label ?? 'son responsable désigné'}
                            </strong>
                            , en son nom.
                          </p>
                        )}
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
                  organizationId={useCase.organization_id}
                  people={people}
                  controls={oversightControlChoices}
                  catalog={(oversightCatalog ?? []) as OversightCatalogControl[]}
                  current={
                    oversight
                      ? {
                          status: oversight.status,
                          accountable_user_id: oversight.accountable_user_id,
                          stop_authority_user_id: oversight.stop_authority_user_id,
                          required_competence: oversight.required_competence,
                          intervention_triggers: oversight.intervention_triggers,
                          override_procedure: oversight.override_procedure,
                          stop_procedure: oversight.stop_procedure,
                          monitoring_cadence: oversight.monitoring_cadence,
                          expected_evidence: oversight.expected_evidence,
                          not_applicable_rationale: oversight.not_applicable_rationale,
                          trigger_control_id: oversight.trigger_control_id,
                          override_control_id: oversight.override_control_id,
                          stop_control_id: oversight.stop_control_id,
                          competence_control_id: oversight.competence_control_id,
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
            title="Preuves de la supervision"
            subtitle="Par contrôle que le plan désigne : ce qui le démontre, ou ce qui manque."
            tone={planControls.some((p) => !(evidenceByControl.get(p.control.id) ?? []).some((e) => e.validation_status === 'validated')) ? 'warn' : 'neutral'}
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
            {/*
              Le plan s'adosse a des controles : c'est sur eux que les preuves
              se deposent, et c'est par eux que le gate juge. Chaque rubrique
              dit ce qui la demontre — ou renvoie au depot, pre-rempli.
            */}
            {planControls.length ? (
              <ul className="mb-4 divide-y divide-ink-100">
                {planControls.map(({ rubric, control }) => {
                  const proofs = evidenceByControl.get(control.id) ?? []
                  const held = control.status === 'operating' && proofs.some((e) => e.validation_status === 'validated')
                  return (
                    <li key={control.id} className="py-2 text-sm">
                      <div className="flex flex-wrap items-start justify-between gap-2">
                        <span>
                          <span className="block text-xs uppercase tracking-wide text-ink-400">{rubric}</span>
                          <span className="text-ink-900">{control.code} — {control.name}</span>
                        </span>
                        <span className="flex items-center gap-1.5">
                          <Badge tone={controlStatusTone(control.status)}>{CONTROL_STATUS_LABELS[control.status] ?? control.status}</Badge>
                          <Badge tone={held ? 'ok' : 'warn'}>{held ? 'Tenu' : proofs.length ? 'Preuve à valider' : 'Sans preuve'}</Badge>
                        </span>
                      </div>
                      <p className="mt-1 text-xs text-ink-500">
                        {proofs.length ? (
                          proofs.map((e) => (
                            <Link key={e.id} href={`/admin/organizations/${organization?.id}/preuves?preuve=${e.id}`} className={`mr-2 hover:underline ${e.validation_status === 'validated' ? 'text-ok-600' : 'text-ink-500'}`}>
                              {e.business_ref} {e.title}
                            </Link>
                          ))
                        ) : (
                          <>
                            Rien ne le démontre encore.{' '}
                            {organization ? (
                              <Link href={`/admin/organizations/${organization.id}/preuves/deposer?cas-d-usage=${id}&controle=${control.id}`} className="font-medium text-brand-600 hover:underline">
                                Déposer
                              </Link>
                            ) : null}
                          </>
                        )}
                      </p>
                    </li>
                  )
                })}
              </ul>
            ) : oversight ? (
              <p className="mb-4 text-xs text-warn-600">
                Le plan ne désigne aucun contrôle : ses procédures restent du texte. « Modifier le plan » propose les contrôles HUM du référentiel.
              </p>
            ) : null}
            <p className="mb-2 text-xs font-medium text-ink-600">Toutes les preuves du cas d’usage</p>
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
            title="Décisions et changements"
            subtitle="Un seul fil : ce qui a été décidé, ce qui a changé, et comment l’un a appelé l’autre."
            action={
              <span className="flex items-center gap-2">
                {DECISION_TYPES_BY_STATUS[status].length ? (
                  <DecisionModal
                    organizationId={useCase.organization_id}
                    useCaseId={id}
                    allowedTypes={DECISION_TYPES_BY_STATUS[status]}
                    people={reviewers}
                    evidence={validatedEvidence ?? []}
                  />
                ) : null}
                <ChangeRequestForm
                  organizationId={useCase.organization_id}
                  useCaseId={id}
                  currentAutonomy={useCase.autonomy_level}
                />
                <DecisionNote />
                <ChangeNote />
              </span>
            }
          >
            {/*
              Une decision est un acte ; un changement est un fait sur le
              systeme, que le moteur de reevaluation lit. Ils se repondent :
              un changement qui appelle une reevaluation ouvre une decision, une
              decision de changement cree le changement (0063). On les lit
              ensemble, dans l'ordre, chacun disant a quoi il est lie.
            */}
            {timelineEntries.length ? (
              <ul className="divide-y divide-ink-100">
                {timelineEntries.map((e) => (
                  <li key={`${e.kind}-${e.id}`} className="py-3">
                    <div className="flex items-start justify-between gap-4">
                      <div className="min-w-0">
                        <p className="flex flex-wrap items-center gap-2 text-sm font-medium text-ink-900">
                          <span
                            className={`rounded px-1.5 py-0.5 text-[10px] font-semibold uppercase tracking-wide ${
                              e.kind === 'decision' ? 'bg-night-900 text-white' : 'bg-brand-500/15 text-brand-700'
                            }`}
                          >
                            {e.kind === 'decision' ? 'Décision' : 'Changement'}
                          </span>
                          {e.title}
                        </p>
                        <p className="text-xs text-ink-400">
                          {e.business_ref}
                          {e.kind === 'decision' && e.type ? ` · ${DECISION_TYPE_LABELS[e.type] ?? e.type}` : ''}
                          {e.kind === 'change' && e.change_types?.length ? ` · ${e.change_types.join(', ')}` : ''}
                          {` · ${formatDate(e.at)}`}
                        </p>
                        {e.body ? <p className="mt-1 text-sm text-ink-600">{e.body}</p> : null}
                        {e.conditions ? (
                          <p className="mt-1 text-xs text-amber-800">Conditions : {e.conditions}</p>
                        ) : null}
                        {e.kind === 'decision' ? (
                          <p className="mt-1 text-xs text-ink-400">
                            {e.effective_from ? `Effet le ${formatDate(e.effective_from)}` : 'Sans date d’effet'}
                            {e.review_due_at ? ` · revue le ${formatDate(e.review_due_at)}` : ''}
                            {e.approver ? ` · approuvée par ${e.approver}` : e.expected_approver ? ` · attend ${e.expected_approver}` : ''}
                            {e.change_request_id ? ' · porte un changement' : ''}
                          </p>
                        ) : (
                          <div className="mt-1 flex flex-wrap items-center gap-2 text-xs">
                            {e.verdict ? (
                              <Badge tone={e.verdict === 'NO_REASSESSMENT' ? 'neutral' : 'stop'}>
                                {VERDICT_LABELS[e.verdict as ReassessmentVerdict] ?? e.verdict}
                              </Badge>
                            ) : (
                              <Badge tone="warn">Non qualifié</Badge>
                            )}
                            {e.scope?.length ? (
                              <span className="text-ink-400">Périmètre rouvert : {e.scope.join(', ')}</span>
                            ) : null}
                            {e.planned_at ? <span className="text-ink-400">prévu le {formatDate(e.planned_at)}</span> : null}
                            {e.decision ? (
                              <span className="text-ink-500">
                                Décision {e.decision.business_ref} :{' '}
                                {DECISION_STATUS_LABELS[e.decision.status] ?? e.decision.status}
                              </span>
                            ) : e.verdict && e.verdict !== 'NO_REASSESSMENT' ? (
                              <span className="text-warn-600">Décision à ouvrir</span>
                            ) : null}
                          </div>
                        )}
                      </div>
                      <Badge
                        tone={
                          ['approved', 'APPROVED', 'IMPLEMENTED', 'VERIFIED'].includes(e.status)
                            ? 'ok'
                            : e.status === 'approved_with_conditions'
                              ? 'warn'
                              : ['rejected', 'REJECTED', 'CANCELLED'].includes(e.status)
                                ? 'stop'
                                : 'neutral'
                        }
                      >
                        {e.kind === 'decision'
                          ? DECISION_STATUS_LABELS[e.status] ?? e.status
                          : CHANGE_STATUS_LABELS[e.status] ?? e.status}
                      </Badge>
                    </div>
                  </li>
                ))}
              </ul>
            ) : (
              <Empty>Aucune décision ni changement enregistrés.</Empty>
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
              <IncidentForm
                organizationId={useCase.organization_id}
                useCaseId={id}
                people={people}
                assets={useCaseAssets.map((a) => ({ id: a.asset_id, name: a.name, kind: a.kind }))}
              />
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

                      {/* Le ticket au format du kit : qualification, arret d'urgence, deux signatures. */}
                      <IncidentTicket
                        organizationId={useCase.organization_id}
                        people={people}
                        lateQualification={!incident.qualified_at && new Date(today).getTime() - new Date(incident.detected_at).getTime() > 24 * 36e5}
                        ticket={{
                          id: incident.id,
                          business_ref: incident.business_ref,
                          title: incident.title,
                          status: incident.status,
                          kind: incident.kind,
                          severity: incident.severity,
                          detected_at: incident.detected_at,
                          trigger_source: incident.trigger_source,
                          asset: incident.asset as unknown as { name: string } | null,
                          fundamental_rights_impacted: incident.fundamental_rights_impacted,
                          fundamental_rights_detail: incident.fundamental_rights_detail,
                          officer: personLabel(incident.officer),
                          owner: personLabel(incident.owner),
                          qualified_at: incident.qualified_at,
                          qualified_by: personLabel(incident.qualifier),
                          stop_recommended_at: incident.stop_recommended_at,
                          stop_recommended_by: personLabel(incident.stop_recommender),
                          stop_validated_at: incident.stop_validated_at,
                          stop_validated_by: personLabel(incident.stop_validator),
                          stop_executed_at: incident.stop_executed_at,
                          stop_executed_by: personLabel(incident.stop_executor),
                          stop_note: incident.stop_note,
                          closure_officer_at: incident.closure_officer_at,
                          closure_officer_by: personLabel(incident.closure_officer),
                          closure_owner_at: incident.closure_owner_at,
                          closure_owner_by: personLabel(incident.closure_owner),
                        }}
                      />

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

import Link from 'next/link'
import { notFound } from 'next/navigation'
import { createClient } from '@/lib/supabase/server'
import { Shell } from '@/components/shell'
import { Badge, Card, Empty } from '@/components/ui'
import { InfoTip } from '@/components/info-tip'
import {
  AcceptResidualForm,
  CompleteForm,
  ReturnStudyForm,
  DepositExportButton,
  FindingForm,
  RemoveFindingButton,
  RemoveStakeholderButton,
  ReopenForm,
  ScopeForm,
  StakeholderForm,
} from '@/components/governance/impact-forms'
import { getViewerContext } from '@/lib/auth/context'
import {
  IMPACT_DOMAIN_LABELS,
  IMPACT_FAMILIES,
  IMPACT_LIKELIHOOD_LABELS,
  IMPACT_SEVERITY_LABELS,
  IMPACT_STATUS_LABELS,
  severityTone,
  studyGaps,
  type ImpactStudy,
} from '@/lib/domain/impact'
import { CRITICALITY_LABELS, type Criticality } from '@/lib/domain/criticality'
import { CLASSIFICATION_FLAG_LABELS, ORGANIZATION_ROLE_LABELS } from '@/lib/domain/classification'
import { ACTION_STATUS_LABELS, AUTONOMY_LABELS, formatDate, formatDateTime } from '@/lib/domain/governance'
import { organizationPeople } from '@/lib/governance/people'

/**
 * Une etude d'impact, conduite section par section — comme le modele de
 * l'organisation : 1. cadrage et parties prenantes, 2. analyse croisee par
 * domaine, 3. plan de remediation, conclusion. Chaque section se saisit en
 * fenetre ; la page se relit d'un trait, s'imprime, s'exporte au format du
 * modele et se depose comme preuve.
 */
export default async function ImpactStudyPage({ params }: { params: Promise<{ id: string; studyId: string }> }) {
  const { id, studyId } = await params
  const supabase = await createClient()
  const [{ data: organization }, { data: studyData }, people, viewer] = await Promise.all([
    supabase.from('organization').select('id, name').eq('id', id).maybeSingle(),
    supabase.rpc('impact_study', { p_id: studyId }),
    organizationPeople(id),
    getViewerContext(),
  ])
  if (!organization || !studyData) notFound()
  const study = studyData as unknown as ImpactStudy
  if (study.organization_id !== id) notFound()

  const { data: risks } = await supabase
    .from('risk')
    .select('id, business_ref, title')
    .eq('use_case_id', study.use_case.id)
    .order('business_ref')

  const uc = study.use_case
  const peopleChoices = people.map((p) => ({ id: p.userId, label: p.jobTitle ? `${p.name} — ${p.jobTitle}` : p.name }))
  const gaps = studyGaps(study)
  // Trois temps : on conduit, on vise, on accepte. Chacun son acte, chacun
  // son signataire — et le second n'est pas le premier (0091).
  const awaitingSignature = Boolean(study.method_signed_at) && !study.residual_accepted_at
  const open = study.status !== 'completed' && study.status !== 'superseded' && !awaitingSignature
  const { data: ucOwner } = await supabase
    .from('ai_use_case')
    .select('owner_user_id')
    .eq('id', uc.id)
    .maybeSingle()
  const isOwner = Boolean(viewer && ucOwner?.owner_user_id === viewer.userId)
  const base = `/admin/organizations/${id}/etudes-impact`
  const flags = (uc.classification?.flags ?? []).map((f) => CLASSIFICATION_FLAG_LABELS[f] ?? f)
  const adverseSevere = study.findings.filter((f) => f.is_adverse && ['significant', 'severe'].includes(f.severity))
  const remediation = study.findings.filter((f) => f.is_adverse && f.mitigation?.trim())

  return (
    <Shell
      breadcrumb={[
        { href: '/admin/organizations', label: 'Organisations' },
        { href: `/admin/organizations/${id}`, label: organization.name },
        { href: base, label: 'Études d’impact IA' },
      ]}
      organization={{ id, section: 'apercu' }}
      title={`Étude d’impact — ${uc.name}`}
      subtitle={`${study.business_ref} · ${uc.business_ref} · ${study.methodology}${study.lifecycle_phase ? ` · ${study.lifecycle_phase}` : ''}`}
      actions={
        <div className="flex flex-wrap items-center gap-3">
          <Badge tone={study.status === 'completed' ? 'ok' : 'warn'}>{IMPACT_STATUS_LABELS[study.status] ?? study.status}</Badge>
          <Link href={`/admin/organizations/${id}/impression/etude-impact/${studyId}`} className="rounded-md border border-ink-200 px-3.5 py-2 text-sm text-ink-700 hover:bg-ink-100">
            Imprimer
          </Link>
          <a href={`${base}/${studyId}/export`} className="rounded-md border border-ink-200 px-3.5 py-2 text-sm text-ink-700 hover:bg-ink-100">
            Exporter (.docx)
          </a>
          {open ? (
            <CompleteForm study={study} gaps={gaps} />
          ) : awaitingSignature ? (
            isOwner ? (
              <>
                <AcceptResidualForm study={study} />
                <ReturnStudyForm studyId={studyId} />
              </>
            ) : (
              <span className="text-sm text-warn-600">
                En attente de l’acceptation des risques résiduels par{' '}
                {people.find((p) => p.userId === ucOwner?.owner_user_id)?.name ?? 'le Porteur de l’IA'}.
              </span>
            )
          ) : (
            <ReopenForm studyId={studyId} />
          )}
          <InfoTip label="Comment conduire l’étude" title="Quatre temps, comme le modèle">
            <div className="flex flex-col gap-3 text-sm leading-relaxed text-ink-600">
              <p><strong className="font-medium text-ink-800">1. Cadrage.</strong> Ce que fait le système, sur qui, avec quelles données ; les groupes affectés, directement ou non — et s’ils sont vulnérables.</p>
              <p><strong className="font-medium text-ink-800">2. Analyse croisée.</strong> Domaine par domaine, les bénéfices attendus et les préjudices potentiels, avec gravité et vraisemblance. Un préjudice significatif ou grave porte une mesure de réduction.</p>
              <p><strong className="font-medium text-ink-800">3. Remédiation.</strong> Chaque mesure est une action, confiée et datée, suivie avec les autres ; un préjudice grave la rend bloquante pour la production.</p>
              <p><strong className="font-medium text-ink-800">4. Conclusion.</strong> Ce que l’étude retient. Achevée, elle ouvre « déposer la preuve » : l’export au format du modèle se dépose d’un clic, à valider.</p>
            </div>
          </InfoTip>
        </div>
      }
    >
      {study.reopened_reason && study.status === 'reopened' ? (
        <p className="mb-5 rounded-md border border-warn-600/40 bg-amber-50 px-4 py-3 text-sm text-warn-600">
          Rouverte : {study.reopened_reason}
        </p>
      ) : null}

      <div className="grid gap-5 lg:grid-cols-3">
        <div className="space-y-5 lg:col-span-2">
          <Card title="1. Cadrage et contexte" subtitle="Le périmètre de l’étude et le statut du triage." action={open ? <ScopeForm study={study} /> : null}>
            <p className="text-sm leading-relaxed text-ink-700">{study.scope_description}</p>
            <dl className="mt-4 grid gap-3 border-t border-ink-100 pt-4 text-sm sm:grid-cols-2">
              <div>
                <dt className="text-xs uppercase tracking-wide text-ink-400">Statut du triage</dt>
                <dd className="text-ink-900">
                  {uc.criticality ? `Criticité ${CRITICALITY_LABELS[uc.criticality as Criticality].toLowerCase()}` : 'Criticité non déterminée'} ·{' '}
                  {uc.required ? 'étude exigée par les faits' : 'étude non exigée'}
                </dd>
              </div>
              <div>
                <dt className="text-xs uppercase tracking-wide text-ink-400">Autonomie</dt>
                <dd className="text-ink-900">{AUTONOMY_LABELS[uc.autonomy_level] ?? uc.autonomy_level}</dd>
              </div>
              <div>
                <dt className="text-xs uppercase tracking-wide text-ink-400">Qualification</dt>
                <dd className="text-ink-900">
                  {uc.classification ? `${ORGANIZATION_ROLE_LABELS[uc.classification.organization_role] ?? uc.classification.organization_role}${flags.length ? ` — ${flags.join(', ')}` : ''}` : 'Non posée'}
                </dd>
              </div>
              <div>
                <dt className="text-xs uppercase tracking-wide text-ink-400">Responsables</dt>
                <dd className="text-ink-900">Porteur : {uc.owner ?? '—'} · Redevable : {uc.accountable ?? '—'}</dd>
              </div>
              <div>
                <dt className="text-xs uppercase tracking-wide text-ink-400">Données</dt>
                <dd className="text-ink-900">
                  {uc.data_description ?? '—'}
                  {uc.involves_personal_data ? <Badge tone="warn">Données personnelles</Badge> : null}
                  {uc.involves_vulnerable_persons ? <Badge tone="stop">Personnes vulnérables</Badge> : null}
                </dd>
              </div>
              <div>
                <dt className="text-xs uppercase tracking-wide text-ink-400">AIPD</dt>
                <dd className="text-ink-900">{study.dpia_required ? `Requise${study.dpia_reference ? ` — ${study.dpia_reference}` : ' — référence à fournir'}` : 'Non requise'}</dd>
              </div>
              {uc.assets.length ? (
                <div className="sm:col-span-2">
                  <dt className="text-xs uppercase tracking-wide text-ink-400">Actifs employés</dt>
                  <dd className="text-ink-900">{uc.assets.map((a) => `${a.name}${a.version ? ` v${a.version}` : ''}`).join(', ')}</dd>
                </div>
              ) : null}
            </dl>
          </Card>

          <Card title="1.1 Parties prenantes" subtitle="Qui subit les effets du système — directement ou non." action={open ? <StakeholderForm studyId={studyId} /> : null}>
            {uc.users_description || uc.affected_persons ? (
              <p className="mb-3 text-xs text-ink-500">
                Sur la fiche : {uc.users_description ? `utilisateurs — ${uc.users_description}` : ''}{uc.users_description && uc.affected_persons ? ' · ' : ''}{uc.affected_persons ? `affectés — ${uc.affected_persons}` : ''}
              </p>
            ) : null}
            {study.stakeholders.length ? (
              <ul className="divide-y divide-ink-100">
                {study.stakeholders.map((s) => (
                  <li key={s.id} className="flex items-start justify-between gap-3 py-2 text-sm">
                    <div>
                      <span className="text-ink-900">{s.label}</span>
                      {s.is_vulnerable_group ? <Badge tone="stop">Vulnérable</Badge> : null}
                      <p className="text-xs text-ink-500">
                        {s.estimated_population ?? 'population non estimée'} · {s.consulted ? `consulté${s.consultation_method ? ` — ${s.consultation_method}` : ''}` : 'non consulté'}
                      </p>
                    </div>
                    {open ? <RemoveStakeholderButton studyId={studyId} stakeholder={s} /> : null}
                  </li>
                ))}
              </ul>
            ) : (
              <Empty>Aucune partie prenante identifiée.</Empty>
            )}
          </Card>

          <Card
            title="2. Analyse croisée des impacts"
            subtitle="Bénéfices attendus et préjudices potentiels, par domaine de la norme."
            tone={adverseSevere.some((f) => !f.mitigation?.trim()) ? 'warn' : 'neutral'}
            action={open ? <FindingForm studyId={studyId} stakeholders={study.stakeholders} people={peopleChoices} risks={risks ?? []} /> : null}
          >
            {study.findings.length ? (
              <div className="space-y-4">
                {IMPACT_FAMILIES.map((fam) => {
                  const inFamily = study.findings.filter((f) => fam.domains.includes(f.domain))
                  if (!inFamily.length) return null
                  return (
                    <section key={fam.key}>
                      <h3 className="mb-1 text-xs font-semibold uppercase tracking-wide text-ink-500">{fam.label}</h3>
                      <ul className="divide-y divide-ink-100">
                        {inFamily.map((f) => (
                          <li key={f.id} className="py-2 text-sm">
                            <div className="flex flex-wrap items-start justify-between gap-2">
                              <div className="min-w-0">
                                <div className="flex flex-wrap items-center gap-2">
                                  <Badge tone={f.is_adverse ? severityTone(f.severity) : 'ok'}>{f.is_adverse ? 'Préjudice' : 'Bénéfice'}</Badge>
                                  <span className="text-xs text-ink-400">{IMPACT_DOMAIN_LABELS[f.domain] ?? f.domain}</span>
                                  {f.stakeholder ? <span className="text-xs text-ink-400">· {f.stakeholder}</span> : null}
                                </div>
                                <p className="mt-1 text-ink-900">{f.description}</p>
                                {f.is_adverse ? (
                                  <p className="text-xs text-ink-500">
                                    Gravité {IMPACT_SEVERITY_LABELS[f.severity]?.toLowerCase()} · {IMPACT_LIKELIHOOD_LABELS[f.likelihood]?.toLowerCase()}
                                    {f.residual_severity ? ` · résiduel ${IMPACT_SEVERITY_LABELS[f.residual_severity]?.toLowerCase()}` : ''}
                                    {f.linked_risk ? (
                                      <> · <Link href={`/admin/use-cases/${uc.id}?onglet=risques`} className="text-brand-600 hover:underline">{f.linked_risk.business_ref}</Link></>
                                    ) : null}
                                  </p>
                                ) : null}
                                {f.is_adverse && ['significant', 'severe'].includes(f.severity) && !f.mitigation?.trim() ? (
                                  <p className="text-xs text-warn-600">Sans mesure de réduction — un préjudice grave en porte une.</p>
                                ) : null}
                              </div>
                              {open ? (
                                <span className="flex items-center gap-2">
                                  <FindingForm studyId={studyId} stakeholders={study.stakeholders} people={peopleChoices} risks={risks ?? []} current={f} trigger="Modifier" triggerClassName="text-xs text-brand-600 hover:underline" />
                                  <RemoveFindingButton studyId={studyId} finding={f} />
                                </span>
                              ) : null}
                            </div>
                          </li>
                        ))}
                      </ul>
                    </section>
                  )
                })}
              </div>
            ) : (
              <Empty>Aucun constat. Un bénéfice, un préjudice : l’étude se conclut sur des faits.</Empty>
            )}
          </Card>

          <Card title="3. Plan de gouvernance et remédiation" subtitle="Chaque mesure est une action : confiée, datée, suivie.">
            {remediation.length ? (
              <ul className="divide-y divide-ink-100">
                {remediation.map((f) => (
                  <li key={f.id} className="flex flex-wrap items-start justify-between gap-3 py-2 text-sm">
                    <div className="min-w-0">
                      <p className="text-ink-900">{f.mitigation}</p>
                      <p className="text-xs text-ink-500">
                        {IMPACT_DOMAIN_LABELS[f.domain] ?? f.domain} — {f.description.slice(0, 100)}{f.description.length > 100 ? '…' : ''}
                        {' · '}{f.owner ?? 'sans responsable'}
                        {f.mitigation_due_date ? ` · pour le ${formatDate(f.mitigation_due_date)}` : ''}
                      </p>
                    </div>
                    {f.action ? (
                      <Link
                        href={`/admin/organizations/${id}/suivi?vue=actions&action=${f.action.id}#action-${f.action.id}`}
                        className="inline-flex items-center gap-1.5 rounded-md border border-ink-200 px-2.5 py-1 text-xs text-brand-600 hover:bg-ink-50"
                      >
                        {f.action.business_ref} · {ACTION_STATUS_LABELS[f.action.status] ?? f.action.status}
                      </Link>
                    ) : (
                      <span className="text-xs text-ink-400">Aucune action — gravité limitée</span>
                    )}
                  </li>
                ))}
              </ul>
            ) : (
              <Empty>Aucune mesure de réduction renseignée.</Empty>
            )}
          </Card>
        </div>

        <div className="space-y-5">
          <Card title="Conclusion et signatures" tone={study.status === 'completed' ? 'neutral' : 'warn'}>
            {study.conclusion ? <p className="mb-3 text-sm leading-relaxed text-ink-700">{study.conclusion}</p> : null}
            {/*
              Deux actes de nature differente : la methode, et ce qui reste.
              Un auditeur lit d'abord cela.
            */}
            <dl className="mb-3 space-y-2 border-y border-ink-100 py-3 text-sm">
              <div>
                <dt className="text-xs uppercase tracking-wide text-ink-400">Visa de méthode</dt>
                <dd className={study.method_signed_at ? 'text-ink-900' : 'text-warn-600'}>
                  {study.method_signed_at
                    ? `${study.method_signed_by ?? '—'} · ${formatDate(study.method_signed_at)}`
                    : 'Non visée'}
                </dd>
              </div>
              <div>
                <dt className="text-xs uppercase tracking-wide text-ink-400">Acceptation des risques résiduels</dt>
                <dd className={study.residual_accepted_at ? 'text-ink-900' : 'text-warn-600'}>
                  {study.residual_accepted_at
                    ? `${study.residual_accepted_by ?? '—'} · ${formatDate(study.residual_accepted_at)}`
                    : 'Non acceptée — le jalon Production l’exige'}
                </dd>
                {study.residual_statement ? (
                  <dd className="mt-1 text-xs leading-relaxed text-ink-600">« {study.residual_statement} »</dd>
                ) : null}
              </div>
            </dl>
            {study.returned_at ? (
              <p className="mb-3 rounded-md border border-warn-600/40 bg-amber-50 px-3.5 py-2.5 text-xs leading-relaxed text-warn-600">
                Renvoyée à l’étude le {formatDate(study.returned_at)} : {study.returned_reason}
              </p>
            ) : null}
            {study.status === 'completed' ? (
              <div className="space-y-2 text-sm">
                <p className="text-xs text-ink-500">
                  Achevée le {formatDateTime(study.completed_at)}
                  {study.next_review_at ? ` · prochaine revue le ${formatDate(study.next_review_at)}` : ''}
                </p>
              </div>
            ) : (
              <div className="space-y-2 text-sm">
                <p className="text-ink-600">En cours{study.performed_by ? ` — conduite par ${study.performed_by}` : ''}.</p>
                {gaps.length ? (
                  <ul className="list-disc space-y-1 pl-5 text-xs text-warn-600">
                    {gaps.map((g) => (
                      <li key={g}>{g}</li>
                    ))}
                  </ul>
                ) : (
                  <p className="text-xs text-ok-600">Rien ne manque : l’étude peut s’achever.</p>
                )}
              </div>
            )}
          </Card>

          <Card title="Preuve" subtitle="L’export au format du modèle, déposé au registre.">
            {study.evidence.length ? (
              <ul className="mb-3 space-y-1 text-sm">
                {study.evidence.map((e) => (
                  <li key={e.id}>
                    <Link href={`/admin/organizations/${id}/preuves?preuve=${e.id}`} className="text-brand-600 hover:underline">
                      {e.business_ref} {e.title}
                    </Link>
                    <span className="ml-2 text-xs text-ink-400">{e.validation_status}</span>
                  </li>
                ))}
              </ul>
            ) : null}
            {study.pending_action ? (
              <p className="mb-3 text-xs text-warn-600">
                Action ouverte : {study.pending_action.business_ref} — {study.pending_action.title}
              </p>
            ) : null}
            {study.status === 'completed' ? (
              <DepositExportButton studyId={studyId} />
            ) : (
              <p className="text-xs text-ink-500">Se dépose une fois l’étude achevée.</p>
            )}
          </Card>

          <Card title="Cas d’usage">
            <Link href={`/admin/use-cases/${uc.id}`} className="text-sm text-brand-600 hover:underline">
              {uc.business_ref} — {uc.name}
            </Link>
            {uc.purpose ? <p className="mt-1 text-xs text-ink-500">{uc.purpose}</p> : null}
          </Card>
        </div>
      </div>
    </Shell>
  )
}

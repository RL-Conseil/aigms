'use client'

import { useActionState, useState, useTransition } from 'react'
import { Field, FIELD, FormFeedback, Submit } from '@/components/forms'
import { Modal } from '@/components/modal'
import {
  acceptResidualRisks,
  addStakeholder,
  completeImpactStudy,
  returnImpactStudy,
  depositImpactStudyExport,
  openImpactStudy,
  removeFinding,
  removeStakeholder,
  reopenImpactStudy,
  saveFinding,
  saveImpactScope,
  type FormState,
} from '@/lib/actions/impact'
import {
  IMPACT_DOMAIN_LABELS,
  IMPACT_FAMILIES,
  IMPACT_LIKELIHOOD_LABELS,
  IMPACT_SEVERITY_LABELS,
  LIFECYCLE_PHASES,
  type ImpactFinding,
  type ImpactStakeholder,
  type ImpactStudy,
} from '@/lib/domain/impact'

/**
 * La conduite d'une etude d'impact, acte par acte, en fenetre : chaque
 * section de la page a la sienne. On saisit la ou l'on lit.
 */

type Person = { id: string; label: string }
type RiskChoice = { id: string; business_ref: string; title: string }
const errorsOf = (state: FormState | null) => (state && !state.ok ? (state.fieldErrors ?? {}) : {})

// -----------------------------------------------------------------------------
// Ouvrir : depuis la page des etudes, un cas d'usage choisi
// -----------------------------------------------------------------------------
export function OpenStudyForm({
  useCases,
  defaultUseCaseId,
}: {
  useCases: { id: string; business_ref: string; name: string; required: boolean; hasOpenStudy: boolean }[]
  defaultUseCaseId?: string
}) {
  const [state, formAction, pending] = useActionState<FormState | null, FormData>(openImpactStudy, null)
  const errors = errorsOf(state)
  return (
    <form action={formAction} className="flex flex-col gap-4 sm:flex-row sm:items-end">
      <Field label="Cas d’usage" htmlFor="open-uc" error={errors.useCaseId} hint="Les cas où l’étude est exigée et manque viennent en premier.">
        <select id="open-uc" name="useCaseId" defaultValue={defaultUseCaseId ?? ''} className={FIELD}>
          <option value="">— Choisir</option>
          {useCases.map((u) => (
            <option key={u.id} value={u.id}>
              {u.business_ref} — {u.name}
              {u.required ? ' · exigée' : ''}
              {u.hasOpenStudy ? ' · étude en cours' : ''}
            </option>
          ))}
        </select>
      </Field>
      <div className="flex flex-col gap-2">
        <Submit pending={pending} idle="Conduire l’étude" />
        <FormFeedback state={state} />
      </div>
    </form>
  )
}

// -----------------------------------------------------------------------------
// Cadrage
// -----------------------------------------------------------------------------
export function ScopeForm({ study }: { study: ImpactStudy }) {
  const [state, formAction, pending] = useActionState<FormState | null, FormData>(saveImpactScope, null)
  const errors = errorsOf(state)
  return (
    <Modal trigger="Modifier le cadrage" title="1. Cadrage et contexte" description="Le périmètre de l’étude, sa méthode, sa phase, et si l’AIPD est requise.">
      {() => (
        <form action={formAction} className="flex flex-col gap-4">
          <input type="hidden" name="studyId" value={study.id} />
          <Field label="Périmètre" htmlFor="scope" error={errors.scopeDescription} hint="Ce que fait le système, sur qui, avec quelles données, dans quel but.">
            <textarea id="scope" name="scopeDescription" rows={5} required defaultValue={study.scope_description} className={FIELD} />
          </Field>
          <div className="grid gap-4 sm:grid-cols-2">
            <Field label="Méthodologie" htmlFor="method">
              <input id="method" name="methodology" type="text" defaultValue={study.methodology} className={FIELD} />
            </Field>
            <Field label="Phase du cycle de vie" htmlFor="phase" optional>
              <select id="phase" name="lifecyclePhase" defaultValue={study.lifecycle_phase ?? ''} className={FIELD}>
                <option value="">—</option>
                {LIFECYCLE_PHASES.map((p) => (
                  <option key={p} value={p}>{p}</option>
                ))}
              </select>
            </Field>
          </div>
          <label className="flex items-start gap-2 text-sm text-ink-700">
            <input type="checkbox" name="dpiaRequired" defaultChecked={study.dpia_required || Boolean(study.use_case.personal_data)} className="mt-0.5 size-4 accent-[oklch(0.45_0.11_245)]" />
            <span>
              Une AIPD (analyse d’impact relative à la protection des données, RGPD art. 35) est requise.
              <span className="block text-xs text-ink-500">
                L’étude d’impact IA ne s’y substitue pas : elle la référence.
                {study.use_case.personal_data && !study.dpia_required
                  ? ' Pré-cochée : des données personnelles sont en jeu (fiche ou actif rattaché).'
                  : ''}
              </span>
            </span>
          </label>
          <div className="grid gap-4 sm:grid-cols-2">
            <Field label="Référence de l’AIPD" htmlFor="dpia" optional>
              <input id="dpia" name="dpiaReference" type="text" defaultValue={study.dpia_reference ?? ''} className={FIELD} />
            </Field>
            <Field label="Prochaine revue" htmlFor="review" optional>
              <input id="review" name="nextReviewAt" type="date" defaultValue={study.next_review_at ?? ''} className={FIELD} />
            </Field>
          </div>
          <FormFeedback state={state} />
          <Submit pending={pending} idle="Enregistrer le cadrage" />
        </form>
      )}
    </Modal>
  )
}

// -----------------------------------------------------------------------------
// Parties prenantes
// -----------------------------------------------------------------------------
export function StakeholderForm({ studyId }: { studyId: string }) {
  const [state, formAction, pending] = useActionState<FormState | null, FormData>(addStakeholder, null)
  const errors = errorsOf(state)
  return (
    <Modal trigger="Ajouter une partie prenante" title="1.1 Partie prenante" description="Un groupe affecté par le système — directement ou non.">
      {() => (
        <form action={formAction} className="flex flex-col gap-4">
          <input type="hidden" name="studyId" value={studyId} />
          <Field label="Groupe" htmlFor="sh-label" error={errors.label} hint="Ex. : candidats à un poste ; conseillers du support ; clients finaux.">
            <input id="sh-label" name="label" type="text" required className={FIELD} />
          </Field>
          <Field label="Population estimée" htmlFor="sh-pop" optional>
            <input id="sh-pop" name="estimatedPopulation" type="text" placeholder="12 personnes ; ~3 000 candidats par an" className={FIELD} />
          </Field>
          <label className="flex items-start gap-2 text-sm text-ink-700">
            <input type="checkbox" name="isVulnerableGroup" className="mt-0.5 size-4 accent-[oklch(0.45_0.11_245)]" />
            <span>Groupe vulnérable (mineurs, patients, personnes en situation de précarité ou de handicap…) — le niveau d’examen s’en renforce.</span>
          </label>
          <label className="flex items-start gap-2 text-sm text-ink-700">
            <input type="checkbox" name="consulted" className="mt-0.5 size-4 accent-[oklch(0.45_0.11_245)]" />
            <span>Consulté dans le cadre de l’étude.</span>
          </label>
          <Field label="Méthode de consultation" htmlFor="sh-method" optional>
            <input id="sh-method" name="consultationMethod" type="text" placeholder="Entretiens, atelier, enquête, représentants du personnel…" className={FIELD} />
          </Field>
          <FormFeedback state={state} />
          <Submit pending={pending} idle="Ajouter" />
        </form>
      )}
    </Modal>
  )
}

export function RemoveStakeholderButton({ studyId, stakeholder }: { studyId: string; stakeholder: ImpactStakeholder }) {
  const [pending, start] = useTransition()
  return (
    <button
      type="button"
      disabled={pending}
      onClick={() => {
        if (confirm(`Retirer « ${stakeholder.label} » ?`)) start(() => void removeStakeholder(studyId, stakeholder.id))
      }}
      className="text-xs text-ink-400 hover:text-stop-600 hover:underline disabled:opacity-50"
    >
      Retirer
    </button>
  )
}

// -----------------------------------------------------------------------------
// Constats
// -----------------------------------------------------------------------------
export function FindingForm({
  studyId,
  stakeholders,
  people,
  risks,
  current,
  trigger,
  triggerClassName,
}: {
  studyId: string
  stakeholders: ImpactStakeholder[]
  people: Person[]
  risks: RiskChoice[]
  current?: ImpactFinding
  trigger?: string
  triggerClassName?: string
}) {
  const [state, formAction, pending] = useActionState<FormState | null, FormData>(saveFinding, null)
  const errors = errorsOf(state)
  const [adverse, setAdverse] = useState(current ? current.is_adverse : true)
  const [severity, setSeverity] = useState(current?.severity ?? 'limited')
  const grave = adverse && ['significant', 'severe'].includes(severity)
  return (
    <Modal
      trigger={trigger ?? (current ? 'Modifier' : 'Ajouter un constat')}
      triggerClassName={triggerClassName}
      title={current ? 'Constat' : '2. Constat : bénéfice ou préjudice'}
      description="Un effet du système sur un groupe, dans un domaine de la norme. Un préjudice grave porte sa mesure, confiée et datée."
    >
      {() => (
        <form action={formAction} className="flex flex-col gap-4">
          <input type="hidden" name="studyId" value={studyId} />
          {current ? <input type="hidden" name="findingId" value={current.id} /> : null}
          <div className="grid gap-4 sm:grid-cols-2">
            <Field label="Nature" htmlFor="f-nature">
              <select id="f-nature" name="isAdverse" value={adverse ? 'adverse' : 'benefit'} onChange={(e) => setAdverse(e.target.value === 'adverse')} className={FIELD}>
                <option value="adverse">Préjudice potentiel</option>
                <option value="benefit">Bénéfice attendu</option>
              </select>
            </Field>
            <Field label="Domaine" htmlFor="f-domain" error={errors.domain}>
              <select id="f-domain" name="domain" defaultValue={current?.domain ?? ''} required className={FIELD}>
                <option value="">— Choisir</option>
                {IMPACT_FAMILIES.map((fam) => (
                  <optgroup key={fam.key} label={fam.label}>
                    {fam.domains.map((d) => (
                      <option key={d} value={d}>{IMPACT_DOMAIN_LABELS[d]}</option>
                    ))}
                  </optgroup>
                ))}
              </select>
            </Field>
          </div>
          <Field label="Description" htmlFor="f-desc" error={errors.description} hint="L’effet, concret : qui, comment, dans quelles conditions.">
            <textarea id="f-desc" name="description" rows={3} required defaultValue={current?.description ?? ''} className={FIELD} />
          </Field>
          <div className="grid gap-4 sm:grid-cols-3">
            <Field label={adverse ? 'Gravité' : 'Ampleur'} htmlFor="f-sev">
              <select id="f-sev" name="severity" value={severity} onChange={(e) => setSeverity(e.target.value)} className={FIELD}>
                {Object.entries(IMPACT_SEVERITY_LABELS).map(([k, v]) => (
                  <option key={k} value={k}>{v}</option>
                ))}
              </select>
            </Field>
            <Field label="Vraisemblance" htmlFor="f-lik">
              <select id="f-lik" name="likelihood" defaultValue={current?.likelihood ?? 'possible'} className={FIELD}>
                {Object.entries(IMPACT_LIKELIHOOD_LABELS).map(([k, v]) => (
                  <option key={k} value={k}>{v}</option>
                ))}
              </select>
            </Field>
            <Field label="Partie prenante" htmlFor="f-sh" optional>
              <select id="f-sh" name="stakeholderId" defaultValue={current?.stakeholder_id ?? ''} className={FIELD}>
                <option value="">—</option>
                {stakeholders.map((s) => (
                  <option key={s.id} value={s.id}>{s.label}</option>
                ))}
              </select>
            </Field>
          </div>
          {adverse ? (
            <fieldset className="rounded-md border border-ink-200 p-3">
              <legend className="px-1 text-xs font-medium text-ink-600">
                Mesure de réduction{grave ? ' — exigée : elle ouvre une action' : ''}
              </legend>
              <div className="flex flex-col gap-3">
                <Field label="Mesure" htmlFor="f-mit" error={errors.mitigation} optional={!grave}>
                  <textarea id="f-mit" name="mitigation" rows={2} defaultValue={current?.mitigation ?? ''} className={FIELD} />
                </Field>
                <div className="grid gap-3 sm:grid-cols-3">
                  <Field label="Responsable" htmlFor="f-owner" error={errors.ownerUserId} optional={!grave}>
                    <select id="f-owner" name="ownerUserId" defaultValue={current?.owner_user_id ?? ''} className={FIELD}>
                      <option value="">— À désigner</option>
                      {people.map((p) => (
                        <option key={p.id} value={p.id}>{p.label}</option>
                      ))}
                    </select>
                  </Field>
                  <Field label="Échéance" htmlFor="f-due" optional>
                    <input id="f-due" name="mitigationDueDate" type="date" defaultValue={current?.mitigation_due_date ?? ''} className={FIELD} />
                  </Field>
                  <Field label="Gravité résiduelle" htmlFor="f-res" optional>
                    <select id="f-res" name="residualSeverity" defaultValue={current?.residual_severity ?? ''} className={FIELD}>
                      <option value="">—</option>
                      {Object.entries(IMPACT_SEVERITY_LABELS).map(([k, v]) => (
                        <option key={k} value={k}>{v}</option>
                      ))}
                    </select>
                  </Field>
                </div>
                <Field label="Risque du registre" htmlFor="f-risk" optional hint="Le risque de l’organisation que ce préjudice rejoint, s’il existe.">
                  <select id="f-risk" name="linkedRiskId" defaultValue={current?.linked_risk_id ?? ''} className={FIELD}>
                    <option value="">—</option>
                    {risks.map((r) => (
                      <option key={r.id} value={r.id}>{r.business_ref} — {r.title}</option>
                    ))}
                  </select>
                </Field>
              </div>
            </fieldset>
          ) : null}
          <FormFeedback state={state} />
          <Submit pending={pending} idle={current ? 'Enregistrer' : 'Ajouter le constat'} />
        </form>
      )}
    </Modal>
  )
}

export function RemoveFindingButton({ studyId, finding }: { studyId: string; finding: ImpactFinding }) {
  const [pending, start] = useTransition()
  return (
    <button
      type="button"
      disabled={pending}
      onClick={() => {
        if (confirm('Retirer ce constat ?')) start(() => void removeFinding(studyId, finding.id))
      }}
      className="text-xs text-ink-400 hover:text-stop-600 hover:underline disabled:opacity-50"
    >
      Retirer
    </button>
  )
}

// -----------------------------------------------------------------------------
// Achever, rouvrir, deposer
// -----------------------------------------------------------------------------
/**
 * Le VISA DE METHODE. Il n'acheve pas l'etude : il dit que sa conduite tient,
 * et appelle l'acceptation des risques residuels par le Porteur.
 */
export function CompleteForm({ study, gaps }: { study: ImpactStudy; gaps: string[] }) {
  const [state, formAction, pending] = useActionState<FormState | null, FormData>(completeImpactStudy, null)
  const errors = errorsOf(state)
  return (
    <Modal
      trigger="Viser l’étude"
      triggerClassName="rounded-md bg-night-900 px-4 py-2.5 text-sm font-medium text-white hover:bg-night-800"
      title="Viser l’étude d’impact"
      description="Vous attestez que l’étude est conduite correctement. Le Porteur de l’IA acceptera ensuite ce qui reste."
    >
      {() => (
        <form action={formAction} className="flex flex-col gap-4">
          <input type="hidden" name="studyId" value={study.id} />
          {gaps.length ? (
            <div className="rounded-md border border-warn-600/40 bg-amber-50 px-3.5 py-2.5 text-xs leading-relaxed text-warn-600">
              Avant d’achever : {gaps.join(' ; ')}. Vous pouvez achever malgré tout — la conclusion doit le dire.
            </div>
          ) : null}
          <p className="rounded-md bg-ink-100 px-3.5 py-2.5 text-xs leading-relaxed text-ink-600">
            Deux signatures, deux choses différentes : <strong className="font-medium text-ink-800">votre visa</strong> dit
            que la méthode tient — périmètre, parties prenantes, domaines examinés, mesures proportionnées ;
            <strong className="font-medium text-ink-800"> l’acceptation du Porteur</strong> dit que l’organisation assume
            ce qui demeure. Une même personne ne pose pas les deux.
          </p>
          <Field label="Conclusion" htmlFor="c-concl" error={errors.conclusion} hint="Ce que l’étude retient : effets acceptables ou non, sous quelles mesures, ce qui reste à surveiller.">
            <textarea id="c-concl" name="conclusion" rows={5} required defaultValue={study.conclusion ?? ''} className={FIELD} />
          </Field>
          <Field label="Prochaine revue" htmlFor="c-review" optional hint="Une étude se revoit : à la cadence de l’organisation, ou à tout changement significatif.">
            <input id="c-review" name="nextReviewAt" type="date" defaultValue={study.next_review_at ?? ''} className={FIELD} />
          </Field>
          <FormFeedback state={state} />
          <Submit pending={pending} idle="Viser l’étude" />
        </form>
      )}
    </Modal>
  )
}

/**
 * L'ACCEPTATION DES RISQUES RESIDUELS. Le Porteur de l'IA, en son propre nom :
 * apres les mesures, il demeure des prejudices possibles, et quelqu'un dit
 * qu'il les assume. Ou renvoie l'etude, en disant pourquoi.
 */
export function AcceptResidualForm({ study }: { study: ImpactStudy }) {
  const [state, formAction, pending] = useActionState<FormState | null, FormData>(acceptResidualRisks, null)
  const errors = errorsOf(state)
  const severe = study.findings.filter((f) => f.is_adverse && ['significant', 'severe'].includes(f.residual_severity ?? f.severity))
  return (
    <Modal
      trigger="Accepter les risques résiduels"
      triggerClassName="rounded-md bg-night-900 px-4 py-2.5 text-sm font-medium text-white hover:bg-night-800"
      title="Accepter les risques résiduels"
      description="Ce qui demeure après les mesures. Un acte nominatif : vous signez en votre nom, et il figure au document."
    >
      {() => (
        <form action={formAction} className="flex flex-col gap-4">
          <input type="hidden" name="studyId" value={study.id} />
          <p className="rounded-md bg-ink-100 px-3.5 py-2.5 text-xs leading-relaxed text-ink-600">
            {study.method_signed_by
              ? `${study.method_signed_by} a visé l’étude : sa méthode tient.`
              : 'L’étude est visée.'}{' '}
            Il vous revient de dire que l’organisation assume ce qui reste — c’est ce que le jalon Production exige.
          </p>
          {severe.length ? (
            <div className="rounded-md border border-warn-600/40 bg-amber-50 px-3.5 py-2.5 text-xs leading-relaxed text-warn-600">
              Ce qui demeure de significatif ou grave après mesures :
              <ul className="mt-1 list-disc pl-4">
                {severe.map((f) => (
                  <li key={f.id}>{f.description}</li>
                ))}
              </ul>
            </div>
          ) : null}
          <Field
            label="Ce que vous assumez"
            htmlFor={`accept-${study.id}`}
            error={errors.statement}
            hint="En une ou deux phrases : ce qui reste, sous quelles conditions, et ce que vous surveillerez."
          >
            <textarea id={`accept-${study.id}`} name="statement" rows={4} required className={FIELD} />
          </Field>
          <FormFeedback state={state} />
          <Submit pending={pending} idle="Accepter en mon nom" />
        </form>
      )}
    </Modal>
  )
}

export function ReturnStudyForm({ studyId }: { studyId: string }) {
  const [state, formAction, pending] = useActionState<FormState | null, FormData>(returnImpactStudy, null)
  const errors = errorsOf(state)
  return (
    <Modal
      trigger="Renvoyer à l’étude"
      triggerClassName="rounded-md border border-ink-200 px-4 py-2.5 text-sm text-ink-700 hover:bg-ink-100"
      title="Renvoyer à l’étude"
      description="Vous n’acceptez pas en l’état. Le visa tombe, l’AI Governance Officer reprend la main."
    >
      {() => (
        <form action={formAction} className="flex flex-col gap-4">
          <input type="hidden" name="studyId" value={studyId} />
          <Field
            label="Motif"
            htmlFor={`return-${studyId}`}
            error={errors.reason}
            hint="Ce qui manque ou ce qui ne va pas : un constat oublié, une mesure insuffisante, une partie prenante non consultée."
          >
            <textarea id={`return-${studyId}`} name="reason" rows={3} required className={FIELD} />
          </Field>
          <FormFeedback state={state} />
          <Submit pending={pending} idle="Renvoyer" />
        </form>
      )}
    </Modal>
  )
}

export function ReopenForm({ studyId }: { studyId: string }) {
  const [state, formAction, pending] = useActionState<FormState | null, FormData>(reopenImpactStudy, null)
  const errors = errorsOf(state)
  return (
    <Modal trigger="Rouvrir" title="Rouvrir l’étude" description="Un changement, un incident, une revue : dire ce qui appelle une nouvelle lecture.">
      {() => (
        <form action={formAction} className="flex flex-col gap-4">
          <input type="hidden" name="studyId" value={studyId} />
          <Field label="Motif" htmlFor="r-reason" error={errors.reason}>
            <textarea id="r-reason" name="reason" rows={3} required className={FIELD} />
          </Field>
          <FormFeedback state={state} />
          <Submit pending={pending} idle="Rouvrir" />
        </form>
      )}
    </Modal>
  )
}

export function DepositExportButton({ studyId }: { studyId: string }) {
  const [pending, start] = useTransition()
  const [state, setState] = useState<FormState | null>(null)
  return (
    <span className="flex flex-col items-end gap-1">
      <button
        type="button"
        disabled={pending}
        onClick={() => start(async () => setState(await depositImpactStudyExport(studyId)))}
        className="rounded-md bg-night-900 px-4 py-2.5 text-sm font-medium text-white hover:bg-night-800 disabled:opacity-50"
      >
        {pending ? 'Dépôt…' : 'Déposer l’export comme preuve'}
      </button>
      <FormFeedback state={state} />
    </span>
  )
}

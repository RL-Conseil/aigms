'use client'

import { useActionState, useMemo, useState } from 'react'
import { MEASURE_KIND_LABELS } from '@/lib/domain/governance'
import { instantiateCatalogControl, type FormState } from '@/lib/actions/controls'
import { Field, FIELD, FormFeedback, Submit } from '@/components/forms'

/**
 * Ajouter un controle depuis un referentiel.
 *
 * On choisit un referentiel publie, un domaine, puis un controle-type : sa
 * fiche s'affiche — objectif, questions d'evaluation, preuves attendues,
 * correspondances — avant de l'ajouter. Ce qui est deja instancie chez
 * l'organisation est grise : deux instances du meme modele se contrediraient.
 */

export type CatalogChoice = {
  catalog_control_id: string
  framework_code: string
  framework_name: string
  is_editor: boolean
  version: string
  domain_code: string
  domain_name: string
  code: string
  title: string
  objective: string | null
  control_type: string | null
  default_applicability: string | null
  review_frequency: string | null
  owner_role: string | null
  mapping_count: number
  instantiated_control_id: string | null
  measure_kind: string
  assessment_questions: string[]
  expected_evidence: string[]
  framework_mappings: { framework: string; version?: string; reference: string }[]
}

/** Les codes de référentiel normatif, lisibles. */
function frameworkLabel(code: string): string {
  return { ISO_IEC_42001: 'ISO/IEC 42001', AI_ACT: 'AI Act', NIST_AI_RMF: 'NIST AI RMF' }[code] ?? code.replace(/_/g, ' ')
}

const FREQUENCY_LABELS: Record<string, string> = {
  continuous: 'Continue',
  monthly: 'Mensuelle',
  quarterly: 'Trimestrielle',
  semiannual: 'Semestrielle',
  annual: 'Annuelle',
}

export function CatalogPickForm({
  organizationId,
  choices,
  people,
}: {
  organizationId: string
  choices: CatalogChoice[]
  people: { id: string; label: string }[]
}) {
  const [state, formAction, pending] = useActionState<FormState | null, FormData>(
    instantiateCatalogControl,
    null,
  )
  const errors = state && !state.ok ? (state.fieldErrors ?? {}) : {}

  const frameworks = useMemo(() => {
    const seen = new Map<string, { key: string; label: string }>()
    for (const c of choices) {
      const key = `${c.framework_code}@${c.version}`
      if (!seen.has(key)) {
        seen.set(key, {
          key,
          label: `${c.framework_name} v${c.version}${c.is_editor ? ' — référentiel de l’éditeur' : ' — référentiel du cabinet'}`,
        })
      }
    }
    return [...seen.values()]
  }, [choices])

  const [framework, setFramework] = useState(frameworks[0]?.key ?? '')
  const inFramework = choices.filter((c) => `${c.framework_code}@${c.version}` === framework)
  const domains = useMemo(() => {
    const seen = new Map<string, string>()
    for (const c of inFramework) if (!seen.has(c.domain_code)) seen.set(c.domain_code, c.domain_name)
    return [...seen.entries()]
  }, [inFramework])
  const [domain, setDomain] = useState('')
  // La nature — technique, organisationnelle, contractuelle — trie la liste
  // autant que le domaine : on cherche souvent « une mesure technique pour… ».
  const [kind, setKind] = useState('')
  const inDomain = inFramework.filter((c) => (!domain || c.domain_code === domain) && (!kind || c.measure_kind === kind))
  const byKind = (['technical', 'organizational', 'contractual'] as const)
    .map((k) => ({ kind: k, items: inDomain.filter((c) => c.measure_kind === k) }))
    .filter((g) => g.items.length)
  const [picked, setPicked] = useState('')
  const control = choices.find((c) => c.catalog_control_id === picked) ?? null

  if (!choices.length) {
    return (
      <p className="rounded-md border border-ink-200 bg-ink-50 px-3.5 py-3 text-sm text-ink-600">
        Aucun référentiel publié n’est visible. Le référentiel de l’éditeur est livré avec la
        plateforme ; un cabinet peut en importer d’autres depuis l’administration.
      </p>
    )
  }

  return (
    <form action={formAction} className="flex flex-col gap-4">
      <input type="hidden" name="organizationId" value={organizationId} />

      <div className="grid gap-4 sm:grid-cols-2">
        <Field label="Référentiel" htmlFor="pick-framework">
          <select
            id="pick-framework"
            value={framework}
            onChange={(e) => {
              setFramework(e.target.value)
              setDomain('')
              setPicked('')
            }}
            className={FIELD}
          >
            {frameworks.map((f) => (
              <option key={f.key} value={f.key}>
                {f.label}
              </option>
            ))}
          </select>
        </Field>
        <Field label="Domaine" htmlFor="pick-domain" optional>
          <select
            id="pick-domain"
            value={domain}
            onChange={(e) => {
              setDomain(e.target.value)
              setPicked('')
            }}
            className={FIELD}
          >
            <option value="">Tous les domaines</option>
            {domains.map(([code, name]) => (
              <option key={code} value={code}>
                {code} — {name}
              </option>
            ))}
          </select>
        </Field>
      </div>

      <Field label="Nature de la mesure" htmlFor="pick-kind" optional hint="Technique : sur un actif. Organisationnelle : organisation, processus, cas d’usage. Contractuelle : fournisseur.">
        <select
          id="pick-kind"
          value={kind}
          onChange={(e) => {
            setKind(e.target.value)
            setPicked('')
          }}
          className={FIELD}
        >
          <option value="">Toutes les natures</option>
          {Object.entries(MEASURE_KIND_LABELS).map(([value, label]) => (
            <option key={value} value={value}>
              {label}
            </option>
          ))}
        </select>
      </Field>

      <Field
        label="Contrôle-type"
        htmlFor="pick-control"
        error={errors.catalogControlId}
        hint="Ceux déjà présents chez l’organisation sont grisés."
      >
        <select
          id="pick-control"
          name="catalogControlId"
          value={picked}
          onChange={(e) => setPicked(e.target.value)}
          required
          className={FIELD}
          size={Math.min(12, Math.max(4, inDomain.length))}
        >
          {byKind.map((group) => (
            <optgroup key={group.kind} label={`${MEASURE_KIND_LABELS[group.kind]}s (${group.items.length})`}>
              {group.items.map((c) => (
                <option key={c.catalog_control_id} value={c.catalog_control_id} disabled={Boolean(c.instantiated_control_id)}>
                  {c.code} — {c.title}
                  {c.instantiated_control_id ? ' (déjà présent)' : c.objective ? '' : ' (titre seul)'}
                </option>
              ))}
            </optgroup>
          ))}
        </select>
      </Field>

      {control ? (
        <div className="rounded-md border border-ink-200 bg-ink-50 p-4 text-sm">
          <p className="font-medium text-ink-900">
            {control.code} — {control.title}
          </p>
          <p className="mt-0.5 text-xs text-ink-500">
            {MEASURE_KIND_LABELS[control.measure_kind] ?? control.measure_kind} · {control.domain_code} · {control.domain_name}
            {control.default_applicability ? ` · ${control.default_applicability === 'mandatory' ? 'obligatoire par défaut' : 'conditionnel'}` : ''}
            {control.review_frequency ? ` · revue ${(FREQUENCY_LABELS[control.review_frequency] ?? control.review_frequency).toLowerCase()}` : ''}
            {control.owner_role ? ` · ${control.owner_role}` : ''}
          </p>
          {control.objective ? (
            <p className="mt-2 leading-relaxed text-ink-700">{control.objective}</p>
          ) : (
            <p className="mt-2 text-xs text-ink-500">
              Ce contrôle-type n’a qu’un titre : son objectif et ses preuves attendues ne sont pas
              encore rédigés dans cette version du référentiel. Vous les compléterez sur le contrôle.
            </p>
          )}
          {control.expected_evidence.length ? (
            <div className="mt-3">
              <p className="text-xs font-medium text-ink-600">Preuves attendues</p>
              <ul className="mt-1 list-disc pl-5 text-xs text-ink-700">
                {control.expected_evidence.map((e) => (
                  <li key={e}>{e}</li>
                ))}
              </ul>
            </div>
          ) : null}
          {control.assessment_questions.length ? (
            <div className="mt-3">
              <p className="text-xs font-medium text-ink-600">Questions d’évaluation</p>
              <ul className="mt-1 list-disc pl-5 text-xs text-ink-700">
                {control.assessment_questions.map((q) => (
                  <li key={q}>{q}</li>
                ))}
              </ul>
            </div>
          ) : null}
          {control.framework_mappings.length ? (
            <p className="mt-3 text-xs text-ink-600">
              <span className="font-medium">Correspondances :</span>{' '}
              {control.framework_mappings.map((m) => `${frameworkLabel(m.framework)} ${m.reference}`).join(' · ')}
              <span className="block text-ink-500">
                Celles vers ISO/IEC 42001 seront rattachées au contrôle à l’ajout ; les autres sont
                rappelées, à porter vous-même.
              </span>
            </p>
          ) : null}
        </div>
      ) : null}

      <div className="grid gap-4 sm:grid-cols-2">
        <Field
          label="Code chez l’organisation"
          htmlFor="pick-code"
          optional
          hint="Par défaut, le code du contrôle-type."
          error={errors.code}
        >
          <input id="pick-code" name="code" type="text" maxLength={40} placeholder={control?.code ?? ''} className={FIELD} />
        </Field>
        <Field label="Responsable" htmlFor="pick-owner" optional>
          <select id="pick-owner" name="ownerUserId" defaultValue="" className={FIELD}>
            <option value="">— À désigner</option>
            {people.map((p) => (
              <option key={p.id} value={p.id}>
                {p.label}
              </option>
            ))}
          </select>
        </Field>
      </div>

      <FormFeedback state={state} />
      <Submit pending={pending} idle="Ajouter ce contrôle" />
    </form>
  )
}

'use client'

import Link from 'next/link'
import { useActionState } from 'react'
import { InfoTip } from '@/components/info-tip'
import { Field, FIELD, FormFeedback, Submit } from '@/components/forms'
import { attachEvidence, type FormState } from '@/lib/actions/evidence'
import { FRESHNESS_LABELS } from '@/lib/domain/governance'
import { PROOF_STATE, proofState, type ControlProof } from '@/lib/domain/proof'

/**
 * Ce qui demontre un controle, sur sa ligne.
 *
 * LA PREUVE EST RATTACHEE AU CONTROLE, pas au couple controle x cas d'usage :
 * une meme piece sert plusieurs cas d'usage. Cet ecran montre donc un etat
 * HERITE — il ne reclame pas un depot par cas d'usage, il dit ou en est le
 * controle et ouvre les deux gestes qui le font avancer.
 *
 * Une pastille, pas une ligne : cent vingt controles ne peuvent pas porter
 * chacun trois lignes de preuve. Le detail s'ouvre au clic.
 */

export function ControlEvidenceTip({
  organizationId,
  controlId,
  controlCode,
  proofs,
  available,
  deposit,
}: {
  organizationId: string
  controlId: string
  controlCode: string
  proofs: ControlProof[]
  /** Les preuves de l'organisation qu'on peut rattacher ici. */
  available: { id: string; business_ref: string; title: string }[]
  /** Le bouton de depot, monte par la page : il porte ses typologies. */
  deposit?: React.ReactNode
}) {
  const state = proofState(proofs)
  const marque = PROOF_STATE[state]
  const [linkState, linkAction, pending] = useActionState<FormState | null, FormData>(
    attachEvidence,
    null,
  )
  const libres = available.filter((e) => !proofs.some((p) => p.id === e.id))

  return (
    <InfoTip
      label={`${marque.label} — ${controlCode}`}
      title={`${controlCode} — ce qui le démontre`}
      tone={state === 'held' ? 'ok' : state === 'none' || state === 'expired' ? 'todo' : 'neutral'}
    >
      <div className="flex flex-col gap-3 text-sm leading-relaxed text-ink-600">
        <p className={`font-medium ${marque.className}`}>{marque.label}</p>

        {proofs.length ? (
          <ul className="flex flex-col gap-1">
            {proofs.map((p) => (
              <li key={p.id}>
                <Link
                  href={`/admin/organizations/${organizationId}/preuves?preuve=${p.id}`}
                  className="hover:underline"
                >
                  <span className="font-mono text-xs text-ink-400">{p.business_ref}</span> {p.title}
                </Link>
                <span className="ml-1.5 text-xs text-ink-400">
                  {p.validation_status === 'validated' ? 'validée' : 'à valider'}
                  {p.freshness !== 'unknown' ? ` · ${FRESHNESS_LABELS[p.freshness]}` : ''}
                </span>
              </li>
            ))}
          </ul>
        ) : (
          <p className="text-ink-500">Rien ne le démontre encore.</p>
        )}

        {/*
          Deux gestes, et un seul des deux est neuf : rattacher une piece qui
          existe deja. Deposer passe par la modale de depot, qui sait ou ranger
          le fichier et quelle typologie lui donner.
        */}
        {libres.length ? (
          <form action={linkAction} className="flex flex-col gap-2 border-t border-ink-100 pt-3">
            <input type="hidden" name="organizationId" value={organizationId} />
            <input type="hidden" name="controlId" value={controlId} />
            <Field label="Rattacher une preuve existante" htmlFor={`attach-${controlId}`}>
              <select id={`attach-${controlId}`} name="evidenceId" defaultValue="" required className={FIELD}>
                <option value="" disabled>
                  — Choisir une preuve
                </option>
                {libres.map((e) => (
                  <option key={e.id} value={e.id}>
                    {e.business_ref} — {e.title}
                  </option>
                ))}
              </select>
            </Field>
            <FormFeedback state={linkState} />
            <Submit pending={pending} idle="Rattacher" />
          </form>
        ) : null}

        {deposit ? <div className="border-t border-ink-100 pt-3">{deposit}</div> : null}
      </div>
    </InfoTip>
  )
}

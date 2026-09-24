'use client'

import Link from 'next/link'
import { useActionState } from 'react'
import { Modal } from '@/components/modal'
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
 * UNE ICONE, PAS UNE INFOBULLE. La ligne en portait trois, et trois ronds « i »
 * cote a cote ne se distinguent plus : on ne sait plus lequel ouvre quoi. Celle-
 * ci prend la forme de ce qu'elle contient — une piece — et sa couleur dit
 * l'etat sans qu'on ait a l'ouvrir.
 */

/** Une feuille cornee : la piece qu'on depose, reconnaissable a 16 px. */
function PieceIcon() {
  return (
    <svg width="15" height="15" viewBox="0 0 16 16" fill="none" aria-hidden>
      <path
        d="M9.3 1.8H4.2a1.4 1.4 0 0 0-1.4 1.4v9.6a1.4 1.4 0 0 0 1.4 1.4h7.6a1.4 1.4 0 0 0 1.4-1.4V5.7L9.3 1.8Z"
        stroke="currentColor"
        strokeWidth="1.3"
        strokeLinejoin="round"
      />
      <path d="M9.2 1.9v3.9h4" stroke="currentColor" strokeWidth="1.3" strokeLinejoin="round" />
    </svg>
  )
}

export function ControlEvidenceModal({
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
    <Modal
      trigger={
        <span className="inline-flex items-center gap-1">
          <PieceIcon />
          {proofs.length ? (
            <span className="text-[11px] font-semibold tabular-nums">{proofs.length}</span>
          ) : null}
        </span>
      }
      triggerLabel={`${marque.label} — ${controlCode}`}
      triggerClassName={`inline-flex items-center justify-center rounded-md border px-1.5 py-1 transition-colors ${
        state === 'held'
          ? 'border-ok-600/40 text-ok-600 hover:bg-ok-600/10'
          : state === 'none' || state === 'expired'
            ? 'border-stop-600/40 text-stop-600 hover:bg-stop-600/10'
            : 'border-warn-600/40 text-warn-600 hover:bg-warn-600/10'
      }`}
      title={`${controlCode} — ce qui le démontre`}
      description={marque.label}
    >
      {() => (
        <div className="flex flex-col gap-4 text-sm leading-relaxed text-ink-600">
          {proofs.length ? (
            <ul className="flex flex-col gap-1.5">
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
            <form action={linkAction} className="flex flex-col gap-2 border-t border-ink-100 pt-4">
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

          {deposit ? <div className="border-t border-ink-100 pt-4">{deposit}</div> : null}
        </div>
      )}
    </Modal>
  )
}

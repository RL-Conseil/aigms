import Link from 'next/link'
import { ROLE_LABELS } from '@/lib/domain/roles'
import type { Readiness } from '@/lib/governance/readiness'

/**
 * L'organisation n'est pas operationnelle : on le dit en haut de chaque page
 * de l'organisation, avec les roles qui manquent, et ou l'on va pour les
 * attribuer. Un formulaire qui refuse sans avoir prevenu est une embuscade.
 */
export function ReadinessBanner({
  readiness,
  administrating,
}: {
  readiness: Readiness
  administrating: boolean
}) {
  if (readiness.ready) return null
  return (
    <div
      role="status"
      className="mb-5 rounded-lg border border-warn-600/40 bg-warn-600/10 px-4 py-3 text-sm text-ink-800"
    >
      <p className="font-medium">
        Organisation non opérationnelle : {readiness.missing.length} rôle
        {readiness.missing.length > 1 ? 's' : ''} sur six n’{readiness.missing.length > 1 ? 'ont' : 'a'} pas de titulaire.
      </p>
      <p className="mt-1 text-[13px] leading-relaxed text-ink-700">
        Manque{readiness.missing.length > 1 ? 'nt' : ''} :{' '}
        <strong className="font-medium">{readiness.missing.map((r) => ROLE_LABELS[r]).join(', ')}</strong>.
        Tant que les six rôles ne sont pas tenus, on lit l’organisation, on n’y écrit aucun objet de
        gouvernance.{' '}
        {administrating ? (
          <Link href="/admin/comptes" className="font-medium text-brand-600 hover:underline">
            Déclarer les comptes et attribuer les rôles
          </Link>
        ) : (
          'L’administration de la plateforme attribue les rôles.'
        )}
      </p>
    </div>
  )
}

export function ReadinessCard({ readiness }: { readiness: Readiness }) {
  return (
    <div>
      <ul className="flex flex-col gap-1.5">
        {readiness.required.map((role) => {
          const held = readiness.held.includes(role)
          return (
            <li key={role} className="flex items-center justify-between gap-3 text-sm">
              <span className={held ? 'text-ink-900' : 'text-ink-500'}>{ROLE_LABELS[role]}</span>
              <span
                className={`rounded-full px-2 py-0.5 text-[11px] font-semibold ${
                  held ? 'bg-ok-600/10 text-ok-600' : 'bg-warn-600/10 text-warn-600'
                }`}
              >
                {held ? 'tenu' : 'manquant'}
              </span>
            </li>
          )
        })}
      </ul>
      <p className="mt-3 text-xs leading-relaxed text-ink-500">
        {readiness.ready
          ? `Opérationnelle : les six rôles sont tenus, par ${readiness.people} personne${readiness.people > 1 ? 's' : ''}.`
          : 'Non opérationnelle : aucun objet de gouvernance ne s’y écrit tant que chaque rôle n’a pas de titulaire.'}
      </p>
    </div>
  )
}

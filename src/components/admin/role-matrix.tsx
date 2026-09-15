import { APP_ROLES, ROLE_LABELS, type AppRole } from '@/lib/domain/roles'

/**
 * Matrice roles × capacites.
 *
 * Elle repond a la question qu'un administrateur se pose au moment
 * d'attribuer un role : « avec celui-ci, que pourra-t-elle faire, et que ne
 * pourra-t-elle pas ? » Une phrase par role n'y suffisait pas.
 *
 * LES CELLULES SONT DES ETATS, PAS DES INTERRUPTEURS. Elles se lisent comme
 * actif / inactif, mais ne se basculent pas : la matrice est calculee en base
 * (`app.role_capabilities`) a partir des ensembles de roles que les policies
 * utilisent. Elle ne peut donc pas diverger de ce que la base fait — et la
 * rendre reglable reviendrait a laisser un administrateur donner au porteur
 * du systeme le droit de se prononcer sur sa propre mise en production.
 * Changer une regle est une migration, relue et versionnee.
 */

export type Capability = {
  key: string
  group: string
  label: string
  note: string | null
  roles: AppRole[]
}

/** L'ordre des colonnes suit celui de la liste des roles, administration en tete. */
const COLUMNS: AppRole[] = [...APP_ROLES]

/** Abreviations de colonne : huit intitules complets ne tiennent pas en largeur. */
const SHORT: Record<AppRole, string> = {
  platform_admin: 'Admin',
  governance_officer: 'AIGO',
  client_admin: 'Adm. client',
  system_owner: 'Porteur',
  risk_owner: 'Risque',
  reviewer: 'Relecteur',
  auditor: 'Auditeur',
  executive_viewer: 'Direction',
}

function Cell({
  active,
  role,
  label,
  highlighted,
}: {
  active: boolean
  role: AppRole
  label: string
  highlighted: boolean
}) {
  return (
    <td className={`px-1.5 py-2 text-center ${highlighted ? 'bg-brand-500/10' : ''}`}>
      <span
        role="img"
        aria-label={`${ROLE_LABELS[role]} : ${active ? 'actif' : 'inactif'} — ${label}`}
        title={`${ROLE_LABELS[role]} — ${active ? 'actif' : 'inactif'}`}
        className={`inline-flex h-5 w-9 items-center rounded-full px-0.5 transition-colors ${
          active ? 'justify-end bg-ok-600' : 'justify-start bg-ink-200'
        }`}
      >
        <span className="h-4 w-4 rounded-full bg-white shadow-sm" />
      </span>
    </td>
  )
}

export function RoleMatrix({
  capabilities,
  highlight,
}: {
  capabilities: Capability[]
  /** Colonne mise en avant — le role en cours d'attribution, par exemple. */
  highlight?: AppRole
}) {
  const groups: { name: string; rows: Capability[] }[] = []
  for (const capability of capabilities) {
    const last = groups.at(-1)
    if (last && last.name === capability.group) last.rows.push(capability)
    else groups.push({ name: capability.group, rows: [capability] })
  }

  return (
    <div className="overflow-x-auto">
      <table className="w-full min-w-[720px] border-collapse text-[13px]">
        <thead>
          <tr className="border-b border-ink-200">
            <th className="py-2 pr-3 text-left text-xs font-medium text-ink-500">Capacité</th>
            {COLUMNS.map((role) => (
              <th
                key={role}
                scope="col"
                title={ROLE_LABELS[role]}
                className={`px-1.5 py-2 text-center text-xs font-medium ${
                  highlight === role ? 'rounded-t-md bg-brand-500/10 text-brand-700' : 'text-ink-500'
                }`}
              >
                {SHORT[role]}
              </th>
            ))}
          </tr>
        </thead>
        <tbody>
          {groups.map((group) => (
            <GroupRows key={group.name} group={group} highlight={highlight} />
          ))}
        </tbody>
      </table>
      <p className="mt-3 text-xs leading-relaxed text-ink-500">
        Les états se lisent, ils ne se basculent pas : la matrice est calculée depuis les règles
        que la base applique réellement. Changer une règle est une migration, relue et versionnée
        — jamais un réglage d’écran.
      </p>
    </div>
  )
}

function GroupRows({
  group,
  highlight,
}: {
  group: { name: string; rows: Capability[] }
  highlight?: AppRole
}) {
  return (
    <>
      <tr>
        <th
          colSpan={COLUMNS.length + 1}
          scope="rowgroup"
          className="bg-ink-50 px-2 pt-3 pb-1.5 text-left text-[11px] font-semibold uppercase tracking-wide text-ink-600"
        >
          {group.name}
        </th>
      </tr>
      {group.rows.map((row) => (
        <tr key={row.key} className="border-b border-ink-100">
          <th scope="row" className="py-2 pr-3 text-left font-normal text-ink-800">
            {row.label}
            {row.note ? (
              <span className="mt-0.5 block text-[11px] leading-snug text-ink-500">{row.note}</span>
            ) : null}
          </th>
          {COLUMNS.map((role) => (
            <Cell
              key={role}
              role={role}
              label={row.label}
              active={row.roles.includes(role)}
              highlighted={highlight === role}
            />
          ))}
        </tr>
      ))}
    </>
  )
}

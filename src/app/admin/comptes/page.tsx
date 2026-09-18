import { createClient } from '@/lib/supabase/server'
import { Shell } from '@/components/shell'
import { Badge, Card, Empty } from '@/components/ui'
import { AccountForm, RoleForm } from '@/components/admin/forms'
import { RoleMatrix } from '@/components/admin/role-matrix'
import { RaciTable } from '@/components/admin/raci-table'
import { roleCapabilities } from '@/lib/admin/role-capabilities'
import { organizationReadiness } from '@/lib/governance/readiness'
import { ReadinessCard } from '@/components/governance/readiness-banner'
import { InfoTip } from '@/components/info-tip'
import { Disclosure } from '@/components/forms'
import { getViewerContext, isAdministrating } from '@/lib/auth/context'
import { ROLE_LABELS, type AppRole } from '@/lib/domain/roles'
import { formatDate } from '@/lib/domain/governance'

/**
 * Comptes et roles de la plateforme.
 *
 * L'administration ouvre les acces ; elle ne gouverne pas. Cette page est donc
 * son poste de travail principal : declarer qui entre, avec quel role, sur
 * quelle organisation.
 */
export default async function AccountsPage() {
  const viewer = await getViewerContext()

  if (!isAdministrating(viewer)) {
    return (
      <Shell title="Comptes et rôles">
        <Card title="Accès réservé">
          <Empty>
            La gestion des comptes relève de l’administration de la plateforme. Votre rôle —{' '}
            {viewer?.role ? ROLE_LABELS[viewer.role] : 'non attribué'} — ne l’inclut pas.
          </Empty>
        </Card>
      </Shell>
    )
  }

  const supabase = await createClient()

  const [{ data: memberships }, { data: organizations }, { data: assignments }, capabilities] =
    await Promise.all([
    supabase
      .from('membership')
      .select('id, tenant_id, role, status, created_at, user:user_id (id, email, full_name, job_title)')
      .order('created_at'),
    // Une organisation archivee ne recoit plus de comptes : elle ne se lit pas ici.
    supabase.from('organization').select('id, name, tenant_id').neq('status', 'archived').order('name'),
    supabase
      .from('role_assignment')
      .select('user_id, role, organization_id, valid_until, organization:organization_id (name)'),
    roleCapabilities(),
  ])

  type Account = {
    membershipId: string
    tenantId: string
    userId: string
    email: string
    fullName: string | null
    jobTitle: string | null
    role: AppRole
    since: string
  }
  const accounts: Account[] = (memberships ?? []).flatMap((m) => {
    const user = m.user as unknown as { id: string; email: string; full_name: string | null; job_title: string | null } | null
    return user
      ? [{ membershipId: m.id, tenantId: m.tenant_id, userId: user.id, email: user.email, fullName: user.full_name, jobTitle: user.job_title, role: m.role as AppRole, since: m.created_at }]
      : []
  })

  // Les comptes se lisent PAR ORGANISATION : c'est la que les six roles
  // doivent etre tenus. Un compte affecte a une organisation figure sous elle
  // avec le role affecte ; un compte sans affectation porte le role de son
  // appartenance sur TOUTES les organisations de son tenant — il figure donc
  // sous chacune, marque « par appartenance ». C'est la meme lecture que la
  // base (organization_roles) : ce qu'on voit ici est ce qu'elle applique.
  const active = (assignments ?? []).filter((a) => !a.valid_until || a.valid_until > new Date().toISOString())
  const assignedUserIds = new Set(active.map((a) => a.user_id))
  const byOrganization = new Map<string, { account: Account; role: AppRole; scoped: boolean }[]>()
  for (const o of organizations ?? []) {
    const rows: { account: Account; role: AppRole; scoped: boolean }[] = []
    for (const a of active.filter((a) => a.organization_id === o.id)) {
      const account = accounts.find((acc) => acc.userId === a.user_id)
      if (account) rows.push({ account, role: a.role as AppRole, scoped: true })
    }
    for (const account of accounts) {
      if (account.tenantId === o.tenant_id && account.role !== 'platform_admin' && !assignedUserIds.has(account.userId)) {
        rows.push({ account, role: account.role, scoped: false })
      }
    }
    byOrganization.set(o.id, rows)
  }
  const placed = new Set([...byOrganization.values()].flat().map((r) => r.account.userId))
  const admins = accounts.filter((a) => a.role === 'platform_admin')
  const unassigned = accounts.filter((a) => a.role !== 'platform_admin' && !placed.has(a.userId))
  const roleOrder: AppRole[] = ['governance_officer', 'client_admin', 'system_owner', 'reviewer', 'risk_owner', 'executive_viewer', 'auditor', 'platform_admin']
  const byRole = (x: { role: AppRole }, y: { role: AppRole }) => roleOrder.indexOf(x.role) - roleOrder.indexOf(y.role)

  const readiness = await Promise.all(
    (organizations ?? []).map(async (o) => ({ ...o, readiness: await organizationReadiness(o.id) })),
  )

  return (
    <Shell
      title="Comptes et rôles"
      subtitle="Qui accède à la plateforme, avec quel rôle et sur quelle organisation."
      actions={<Badge tone="info">{memberships?.length ?? 0} compte(s)</Badge>}
    >
      <div className="grid gap-5 lg:grid-cols-5">
        <div className="lg:col-span-3">
          <Card
            title="Comptes déclarés"
            subtitle="Par organisation. Chaque organisation doit voir ses six rôles tenus pour être opérationnelle."
          >
            {accounts.length ? (
              <div className="flex flex-col gap-3">
                {readiness.map((o, index) => {
                  const rows = (byOrganization.get(o.id) ?? []).sort(byRole)
                  const ready = o.readiness?.ready ?? true
                  return (
                    <Disclosure
                      key={o.id}
                      title={o.name}
                      summary={
                        o.readiness
                          ? ready
                            ? `${rows.length} compte${rows.length > 1 ? 's' : ''} · opérationnelle, six rôles tenus`
                            : `${rows.length} compte${rows.length > 1 ? 's' : ''} · non opérationnelle — manque : ${o.readiness.missing.map((r) => ROLE_LABELS[r]).join(', ')}`
                          : `${rows.length} compte(s)`
                      }
                      tone={ready ? 'done' : 'todo'}
                      defaultOpen={!ready || index === 0}
                    >
                      <AccountRows rows={rows} empty="Aucun compte sur cette organisation : déclarer les comptes de ses six rôles." />
                    </Disclosure>
                  )
                })}

                {unassigned.length ? (
                  <Disclosure
                    title="Sans organisation"
                    summary={`${unassigned.length} compte${unassigned.length > 1 ? 's' : ''} dont le tenant n’a aucune organisation active`}
                    tone="neutral"
                  >
                    <AccountRows rows={unassigned.sort(byRole).map((account) => ({ account, role: account.role, scoped: false }))} />
                  </Disclosure>
                ) : null}

                {admins.length ? (
                  <Disclosure
                    title="Administration de la plateforme"
                    summary={`${admins.length} compte${admins.length > 1 ? 's' : ''} · ouvre les accès, ne gouverne pas`}
                    tone="neutral"
                  >
                    <AccountRows rows={admins.map((account) => ({ account, role: account.role, scoped: false }))} />
                  </Disclosure>
                ) : null}
              </div>
            ) : (
              <Empty>Aucun compte déclaré.</Empty>
            )}
          </Card>
        </div>

        <div className="lg:col-span-2">
          <Card
            title="Déclarer un compte"
            subtitle="Le compte est créé, rattaché à la plateforme et doté de son rôle."
          >
            <AccountForm organizations={organizations ?? []} />
          </Card>

          {/*
            Une organisation n'est operationnelle qu'avec ses six roles tenus :
            c'est ici, en declarant les comptes, qu'on la rend operationnelle.
          */}
          {readiness.map((o) =>
            o.readiness ? (
              <div key={o.id} className="mt-5">
                <Card
                  title={o.name}
                  subtitle={o.readiness.ready ? 'Opérationnelle : six rôles tenus' : `${o.readiness.missing.length} rôle(s) sans titulaire — aucune écriture de gouvernance possible`}
                  tone={o.readiness.ready ? 'neutral' : 'warn'}
                >
                  <ReadinessCard readiness={o.readiness} />
                </Card>
              </div>
            ) : null,
          )}
        </div>
      </div>

      {/*
        La matrice repond a la question qu'on se pose au moment d'attribuer :
        « avec ce role, que pourra-t-elle faire ? » Les cellules se lisent
        actif / inactif ; elles ne se basculent pas — voir role-matrix.tsx.
      */}
      <div className="mt-5">
        <Card
          title="Ce que chaque rôle peut faire"
          subtitle="Une ligne par capacité, une colonne par rôle. Calculée depuis les règles que la base applique."
          action={
            <InfoTip label="Pourquoi la matrice ne se règle pas" title="Des états, pas des interrupteurs">
              <div className="flex flex-col gap-3 text-sm leading-relaxed text-ink-600">
                <p>
                  Les cellules ressemblent à des interrupteurs parce qu’elles se lisent ainsi :
                  actif, inactif. Elles ne se basculent pas. La matrice est{' '}
                  <strong className="font-medium text-ink-800">calculée en base</strong>, depuis
                  les ensembles de rôles que les policies de sécurité utilisent réellement — elle
                  ne peut donc pas diverger de ce que la plateforme fait.
                </p>
                <p>
                  La rendre réglable reviendrait à laisser un administrateur donner au porteur du
                  système le droit de se prononcer sur sa propre mise en production. Changer une
                  règle est une migration, relue et versionnée — jamais un réglage d’écran.
                </p>
                <p>
                  <strong className="font-medium text-ink-800">Deux règles ne se lisent pas ici</strong>{' '}
                  parce qu’elles portent sur les personnes, pas sur les rôles : la séparation des
                  rôles sur les décisions engageantes, et la validation nominative des preuves.
                </p>
              </div>
            </InfoTip>
          }
        >
          <RoleMatrix capabilities={capabilities} />
        </Card>

        <Card
          title="Qui fait quoi : le RACI des six rôles"
          subtitle="Ce que l’organisation attend de chaque rôle à chaque étape. La matrice au-dessus dit ce que la base laisse faire ; ici, ce dont chacun répond."
          action={
            <InfoTip label="Lire le RACI" title="Une responsabilité, pas un droit">
              <div className="flex flex-col gap-3 text-sm leading-relaxed text-ink-600">
                <p>
                  Six dénominations : le{' '}
                  <strong className="font-medium text-ink-800">Porteur de l’IA</strong> — le métier
                  ou chef de projet qui déploie l’outil ; l’{' '}
                  <strong className="font-medium text-ink-800">AI Governance Officer</strong> — le
                  pilote global de la conformité ; l’{' '}
                  <strong className="font-medium text-ink-800">Expert métier (DPO / RSSI)</strong> —
                  les relecteurs spécialisés ; le{' '}
                  <strong className="font-medium text-ink-800">Comité des risques</strong> — le
                  valideur indépendant des risques ; le{' '}
                  <strong className="font-medium text-ink-800">Comité de direction</strong> —
                  l’instance suprême d’arbitrage ; l’{' '}
                  <strong className="font-medium text-ink-800">Auditeur</strong> — le contrôleur
                  indépendant, a posteriori.
                </p>
                <p>
                  Un « A » n’ouvre pas un droit d’écriture : le comité de direction reste en
                  lecture, et son arbitrage se porte par la décision qui le nomme comme personne
                  appelée à se prononcer. Ce que la base applique se lit dans la matrice des
                  capacités.
                </p>
              </div>
            </InfoTip>
          }
        >
          <RaciTable />
        </Card>
      </div>
    </Shell>
  )
}

/** Initiales, pour reconnaitre une personne d'un coup d'oeil. */
function initials(name: string | null, email: string) {
  return (name ?? email)
    .split(/[\s@.]+/)
    .filter(Boolean)
    .slice(0, 2)
    .map((part) => part[0]?.toUpperCase() ?? '')
    .join('')
}

const ROLE_TONE: Partial<Record<AppRole, string>> = {
  governance_officer: 'bg-brand-500/15 text-brand-700',
  client_admin: 'bg-brand-500/15 text-brand-700',
  system_owner: 'bg-teal-500/15 text-teal-800',
  reviewer: 'bg-violet-500/15 text-violet-800',
  risk_owner: 'bg-amber-500/15 text-amber-800',
  executive_viewer: 'bg-night-900 text-white',
  auditor: 'bg-ink-100 text-ink-700',
  platform_admin: 'bg-warn-600/15 text-warn-600',
}

function AccountRows({
  rows,
  empty = 'Aucun compte.',
}: {
  rows: {
    account: {
      membershipId: string
      userId: string
      email: string
      fullName: string | null
      jobTitle: string | null
      role: AppRole
      since: string
    }
    role: AppRole
    /** Vrai quand le role vient d'une affectation a l'organisation ; sinon de l'appartenance. */
    scoped: boolean
  }[]
  empty?: string
}) {
  if (!rows.length) return <p className="text-sm text-ink-400">{empty}</p>
  return (
    <ul className="divide-y divide-ink-100">
      {rows.map(({ account, role, scoped }) => (
        <li key={`${account.membershipId}-${role}`} className="flex flex-wrap items-center gap-3 py-2.5">
          <span
            aria-hidden
            className="inline-flex size-9 shrink-0 items-center justify-center rounded-full bg-ink-100 text-xs font-semibold text-ink-700"
          >
            {initials(account.fullName, account.email)}
          </span>
          <div className="min-w-0 flex-1">
            <p className="truncate text-sm font-medium text-ink-900">{account.fullName ?? account.email}</p>
            <p className="truncate text-xs text-ink-400">
              {account.email}
              {account.jobTitle ? ` · ${account.jobTitle}` : ''}
              {` · depuis le ${formatDate(account.since)}`}
              {role !== 'platform_admin' ? (scoped ? ' · affecté' : ' · par appartenance') : ''}
            </p>
          </div>
          <span className={`inline-flex items-center rounded-full px-2.5 py-1 text-[11px] font-semibold ${ROLE_TONE[role] ?? 'bg-ink-100 text-ink-700'}`}>
            {ROLE_LABELS[role]}
          </span>
          {role === 'platform_admin' ? (
            <span className="text-xs text-ink-400">Non modifiable depuis l’application</span>
          ) : (
            <RoleForm userId={account.userId} currentRole={account.role} />
          )}
        </li>
      ))}
    </ul>
  )
}

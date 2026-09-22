import { redirect } from 'next/navigation'
import { createClient } from '@/lib/supabase/server'
import { Shell } from '@/components/shell'
import { Badge, Card, Empty, Field } from '@/components/ui'
import { NotificationForm, type NotificationPreference } from '@/components/admin/notification-form'
import { isMailerConfigured, systemEmailSender } from '@/lib/email/mailer'
import { BrandingForm, ProfileForm } from '@/components/admin/settings-forms'
import { tenantBranding } from '@/lib/branding'
import { getViewerContext, isAdministrating } from '@/lib/auth/context'
import { ROLE_DESCRIPTIONS, ROLE_LABELS, type AppRole } from '@/lib/domain/roles'
import { CurrentOrganizationForm } from '@/components/governance/current-organization'
import { managedOrganizations } from '@/lib/governance/organizations'
import {
  ACTIVITY_PROFILE_LABELS,
  CRITICALITY_LABELS,
  criticalityTone,
  type ActivityProfile,
  type EvidenceCriticality,
} from '@/lib/domain/activity-profile'

export default async function SettingsPage() {
  const viewer = await getViewerContext()
  if (!viewer) redirect('/login')

  const administrating = isAdministrating(viewer)
  const mailer = {
    configured: isMailerConfigured(),
    sender: systemEmailSender(),
    cron: Boolean(process.env.CRON_SECRET?.trim()),
  }
  const supabase = await createClient()

  const branding = await tenantBranding()
  const organizations = await managedOrganizations()
  const current = organizations.find((o) => o.id === viewer.currentOrganizationId) ?? null

  const [{ data: assignments }, { data: typologyRows }, { data: preference }, { data: digestPreview }] = await Promise.all([
    supabase
      .from('role_assignment')
      .select('role, valid_until, organization:organization_id (id, name)')
      .eq('user_id', viewer.userId),
    current
      ? supabase.rpc('typology_coverage', { p_organization_id: current.id })
      : Promise.resolve({ data: null }),
    supabase.rpc('my_notification_preference'),
    supabase.rpc('my_notification_digest'),
  ])

  const notificationPreference = (preference ?? {
    email_enabled: true,
    immediate_enabled: true,
    digest: 'daily',
  }) as NotificationPreference
  const digest = (digestPreview ?? { organizations: [] }) as {
    organizations: { name: string; actions_open: number; actions_overdue: number; incidents: unknown[]; alerts: unknown[] }[]
  }

  const demanding = ((typologyRows ?? []) as {
    code: string
    name: string
    criticality: EvidenceCriticality | null
  }[]).filter((t) => t.criticality === 'critical' || t.criticality === 'high')

  return (
    <Shell
      title="Paramètres"
      subtitle="Votre compte et l’organisation à laquelle il est rattaché."
    >
      <div className="grid gap-5 lg:grid-cols-2">
        <div className="flex flex-col gap-5">
          <Card title="Votre compte">
            <ProfileForm
              fullName={viewer.fullName}
              jobTitle={viewer.jobTitle}
              email={viewer.email}
            />
          </Card>

          {/*
            Comment etre prevenu : « Mes alertes » suppose qu'on ouvre la
            plateforme ; le courriel va chercher la personne la ou elle est.
          */}
          <Card
            title="Notifications"
            subtitle={`Ce qui vous est adressé nommément, envoyé à ${viewer.email}.`}
          >
            <NotificationForm userId={viewer.userId} preference={notificationPreference} />
            {digest.organizations.length ? (
              <div className="mt-4 border-t border-ink-100 pt-3">
                <p className="text-xs font-medium text-ink-600">Ce que votre prochaine synthèse dirait</p>
                <ul className="mt-1.5 space-y-1 text-xs text-ink-500">
                  {digest.organizations.map((o) => (
                    <li key={o.name}>
                      {o.name} — {o.actions_open} action(s)
                      {o.actions_overdue ? `, dont ${o.actions_overdue} échue(s)` : ''}
                      {o.incidents.length ? ` · ${o.incidents.length} incident(s)` : ''}
                      {o.alerts.length ? ` · ${o.alerts.length} alerte(s) non lue(s)` : ''}
                    </li>
                  ))}
                </ul>
              </div>
            ) : (
              <p className="mt-4 border-t border-ink-100 pt-3 text-xs text-ink-500">
                Rien à faire avancer en ce moment : aucune synthèse ne partirait.
              </p>
            )}
          </Card>
        </div>

        <div className="flex flex-col gap-5">
          <Card title="Votre rôle">
            {viewer.role ? (
              <dl className="space-y-3">
                <Field label="Rôle sur l’ensemble des organisations">
                  <span className="inline-flex items-center gap-2">
                    <Badge tone={administrating ? 'warn' : 'info'}>
                      {ROLE_LABELS[viewer.role]}
                    </Badge>
                  </span>
                  <p className="mt-2 text-sm leading-relaxed text-ink-600">
                    {ROLE_DESCRIPTIONS[viewer.role]}
                  </p>
                </Field>

                <Field label="Affectations par organisation">
                  {assignments?.length ? (
                    <ul className="mt-1 space-y-1.5">
                      {assignments.map((assignment, index) => {
                        const org = assignment.organization as unknown as {
                          id: string
                          name: string
                        } | null
                        return (
                          <li key={`${org?.id}-${index}`} className="text-sm">
                            {org?.name ?? '—'} —{' '}
                            {ROLE_LABELS[assignment.role as AppRole] ?? assignment.role}
                            {assignment.valid_until
                              ? ` (jusqu’au ${new Date(assignment.valid_until).toLocaleDateString('fr-FR')})`
                              : ''}
                          </li>
                        )
                      })}
                    </ul>
                  ) : (
                    <span className="text-sm text-ink-500">
                      Aucune affectation ciblée : votre rôle porte sur toutes les organisations.
                    </span>
                  )}
                </Field>

                <p className="border-t border-ink-100 pt-3 text-xs leading-relaxed text-ink-500">
                  Les rôles sont attribués par l’administration de la plateforme. Ils ne se
                  modifient pas depuis cette page.
                </p>
              </dl>
            ) : (
              <Empty>Aucun rôle attribué. Contactez l’administration de la plateforme.</Empty>
            )}
          </Card>

          <div id="organisation" className="flex flex-col gap-5">
            <Card
              title="Mon organisation"
              subtitle={
                current
                  ? `${current.business_ref} — ${current.legal_name ?? current.name}`
                  : 'Aucune organisation courante'
              }
            >
              {current ? (
                <div className="flex flex-col gap-4">
                  <dl className="grid gap-3 sm:grid-cols-2">
                    <Field label="Organisation">{current.name}</Field>
                    <Field label="Votre rôle ici">
                      {current.role ? ROLE_LABELS[current.role] : '—'}
                    </Field>
                    <Field label="Nom enregistré">{viewer.fullName ?? '—'}</Field>
                    <Field label="Fonction">{viewer.jobTitle ?? '—'}</Field>
                    <Field label="Adresse électronique">{viewer.email}</Field>
                    <Field label="Rôle de l’organisation vis-à-vis de l’IA">
                      {current.ai_activity_profile ? (
                        ACTIVITY_PROFILE_LABELS[current.ai_activity_profile as ActivityProfile]
                      ) : (
                        <span className="text-ink-500">Non renseigné</span>
                      )}
                    </Field>
                  </dl>

                  {/*
                    Le role vis-a-vis de l'IA n'est pas une preference : il
                    commande les preuves attendues et le regime exige par la
                    Declaration. Il releve de l'administration, et cette page le
                    presente sans permettre de le changer.
                  */}
                  <p className="rounded-md bg-ink-50 px-3.5 py-3 text-xs leading-relaxed text-ink-600">
                    Le rôle de l’organisation vis-à-vis de l’IA est attribué par l’administration de
                    la plateforme. Il détermine les typologies de preuves attendues et leur
                    criticité : il ne se modifie pas depuis cette page.
                  </p>

                  {demanding.length ? (
                    <div>
                      <p className="mb-2 text-xs font-medium text-ink-600">
                        Ce que ce rôle rend exigeant
                      </p>
                      <ul className="flex flex-col gap-1.5">
                        {demanding.map((typology) => (
                          <li
                            key={typology.code}
                            className="flex items-baseline justify-between gap-2 text-sm"
                          >
                            <span className="text-ink-800">
                              <span className="mr-2 font-mono text-xs text-ink-400">
                                {typology.code}
                              </span>
                              {typology.name}
                            </span>
                            <Badge tone={criticalityTone(typology.criticality)}>
                              {typology.criticality
                                ? CRITICALITY_LABELS[typology.criticality]
                                : '—'}
                            </Badge>
                          </li>
                        ))}
                      </ul>
                    </div>
                  ) : null}

                  <div className="border-t border-ink-100 pt-4">
                    <CurrentOrganizationForm
                      organizations={organizations.map((o) => ({ id: o.id, name: o.name }))}
                      current={viewer.currentOrganizationId}
                    />
                  </div>
                </div>
              ) : organizations.length ? (
                <div className="flex flex-col gap-4">
                  <Empty>
                    Plusieurs organisations vous sont attribuées : choisissez celle sur laquelle
                    vous travaillez.
                  </Empty>
                  <CurrentOrganizationForm
                    organizations={organizations.map((o) => ({ id: o.id, name: o.name }))}
                    current={viewer.currentOrganizationId}
                  />
                </div>
              ) : (
                <Empty>
                  Aucun rôle ne vous a été attribué sur une organisation. L’administration de la
                  plateforme s’en charge.
                </Empty>
              )}
            </Card>

            {/*
              La marque se regle ici et nulle part ailleurs : c'est le cabinet
              qui revend, pas son client. La mire de connexion n'en depend pas —
              avant authentification, on ne sait pas quel tenant se presente.
            */}
            {administrating && viewer.tenantId ? (
              <Card
                title="Marque de la plateforme"
                subtitle="Ce que vos clients voient en haut de chaque écran."
              >
                <BrandingForm
                  tenantId={viewer.tenantId}
                  label={branding.label}
                  tagline={branding.tagline}
                  logoUrl={branding.logoUrl}
                />
              </Card>
            ) : null}

            {/*
              Le courrier sortant : l'etat de ce qui est pose dans
              l'environnement. Aucune cle ne se lit ni ne s'ecrit depuis un
              ecran — on dit seulement si l'envoi est possible.
            */}
            {administrating ? (
              <Card
                title="Courrier sortant"
                subtitle="Ce qui permet à la plateforme d’écrire aux personnes."
                tone={mailer.configured ? 'neutral' : 'warn'}
              >
                <dl className="space-y-2 text-sm">
                  <div className="flex items-center justify-between gap-3">
                    <dt className="text-ink-600">État</dt>
                    <dd>
                      <Badge tone={mailer.configured ? 'ok' : 'warn'}>
                        {mailer.configured ? 'Configuré' : 'Non configuré'}
                      </Badge>
                    </dd>
                  </div>
                  <div className="flex items-center justify-between gap-3">
                    <dt className="text-ink-600">Expéditeur</dt>
                    <dd className="text-ink-900">{mailer.sender ?? '—'}</dd>
                  </div>
                  <div className="flex items-center justify-between gap-3">
                    <dt className="text-ink-600">Envoi planifié</dt>
                    <dd className="text-ink-900">{mailer.cron ? 'Chaque jour à 7 h' : 'Non planifié'}</dd>
                  </div>
                </dl>
                <p className="mt-3 border-t border-ink-100 pt-3 text-xs leading-relaxed text-ink-500">
                  {mailer.configured ? (
                    <>
                      Les alertes qui ne peuvent pas attendre partent au passage suivant ; la synthèse
                      part à la cadence de chacun. Une alerte qui n’a pas pu partir reste lisible dans
                      « Mes alertes » et repartira.
                    </>
                  ) : (
                    <>
                      Posez <code>RESEND_API_KEY</code>, <code>SYSTEM_EMAIL_FROM</code> et{' '}
                      <code>CRON_SECRET</code> dans les variables d’environnement du déploiement —
                      jamais dans le code. Sans elles, rien ne part : les alertes restent lisibles
                      dans « Mes alertes ».
                    </>
                  )}
                </p>
              </Card>
            ) : null}
          </div>
        </div>
      </div>
    </Shell>
  )
}

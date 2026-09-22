import Link from 'next/link'
import { notFound } from 'next/navigation'
import { createClient } from '@/lib/supabase/server'
import { Shell } from '@/components/shell'
import { Badge, Card, Empty, Stat, StatStrip } from '@/components/ui'
import { InfoTip } from '@/components/info-tip'
import { SegmentedFilter } from '@/components/governance/segmented-filter'
import { RemoveToolingButton, ToolingForm, type ToolFamily } from '@/components/governance/tooling-forms'

/**
 * La carte d'outillage : avec quoi l'organisation tient ses controles.
 *
 * Le referentiel porte une TYPOLOGIE — soixante familles d'outillage, avec
 * ce qu'elles controlent et les preuves qu'elles produisent. Elle dit ou
 * chercher ; elle ne dit pas ce qu'on emploie. Cette page inscrit le produit
 * reel, une ligne par famille. Ce n'est pas un inventaire du SI : AIGMS ne
 * construit pas de CMDB, et un produit declare ici vaut surtout par deux
 * choses — un controle qui dit avec quoi il se tient, et un connecteur
 * candidat pour en lire les preuves.
 */
export default async function ToolingPage({
  params,
  searchParams,
}: {
  params: Promise<{ id: string }>
  searchParams: Promise<{ vue?: string }>
}) {
  const { id } = await params
  const { vue } = await searchParams
  const supabase = await createClient()

  const [{ data: organization }, { data: mapData }, { data: vendors }, { data: connectors }] =
    await Promise.all([
      supabase.from('organization').select('id, name').eq('id', id).maybeSingle(),
      supabase.rpc('organization_tooling_map', { p_organization_id: id }),
      supabase.from('vendor').select('id, name').eq('organization_id', id).order('name'),
      supabase.from('governance_connector').select('id, display_name').order('display_name'),
    ])
  if (!organization) notFound()

  const families = ((mapData ?? { families: [] }) as { families: ToolFamily[] }).families
  const declared = families.filter((f) => f.declared)
  const expected = families.filter((f) => f.controls > 0)
  const missing = expected.filter((f) => !f.declared)
  const connected = declared.filter((f) => f.declared?.connector)

  const view = vue === 'toutes' ? 'toutes' : vue === 'declarees' ? 'declarees' : 'attendues'
  const shown =
    view === 'toutes' ? families : view === 'declarees' ? declared : expected.length ? expected : families
  const base = `/admin/organizations/${id}/outillage`

  return (
    <Shell
      breadcrumb={[
        { href: '/admin/organizations', label: 'Organisations' },
        { href: `/admin/organizations/${id}`, label: organization.name },
      ]}
      organization={{ id, section: 'controles' }}
      title="Outillage des contrôles"
      subtitle="Avec quoi l’organisation tient ses contrôles — un produit par famille, pas un inventaire du SI."
      actions={
        <InfoTip label="À quoi sert cette carte" title="« Se tient avec », en vrai">
          <div className="flex flex-col gap-3 text-sm leading-relaxed text-ink-600">
            <p>
              Le référentiel rattache chaque contrôle à des <strong className="font-medium text-ink-800">familles
              d’outillage</strong> — passerelle d’appels IA, CSPM, observabilité, gestion des
              incidents… C’est une typologie : elle dit <em>où chercher</em>, pas ce que vous
              employez.
            </p>
            <p>
              En inscrivant le produit réel, un contrôle cesse de dire « se tient avec
              l’observabilité » pour dire <strong className="font-medium text-ink-800">« se tient avec
              Datadog, chez nous »</strong> — et l’on sait où prendre sa preuve.
            </p>
            <p>
              <strong className="font-medium text-ink-800">Ce n’est pas une CMDB.</strong> Une ligne
              par famille, le produit employé : pas d’instances, pas de dépendances, pas de cycle de
              vie. L’inventaire du SI vit dans votre ITSM ; AIGMS s’y connecte plutôt que de le
              refaire.
            </p>
            <p>
              Chaque produit déclaré est un <strong className="font-medium text-ink-800">connecteur
              candidat</strong> : c’est le chemin vers la collecte automatique des preuves.
            </p>
          </div>
        </InfoTip>
      }
    >
      <StatStrip>
        <Stat label="Familles attendues par vos contrôles" value={expected.length} total={families.length} />
        <Stat label="Produits déclarés" value={declared.length} tone={declared.length ? 'ok' : 'warn'} />
        <Stat label="Attendues sans produit" value={missing.length} tone={missing.length ? 'warn' : 'ok'} />
        <Stat label="Reliés à un connecteur" value={connected.length} total={declared.length} tone={connected.length ? 'ok' : 'neutral'} />
      </StatStrip>

      <div className="mt-5 mb-5 flex flex-wrap items-center gap-3">
        <SegmentedFilter
          label="Lecture de la carte"
          param="vue"
          basePath={base}
          current={{ vue: view }}
          selected={view === 'attendues' ? '' : view}
          options={[
            { key: '', label: 'Attendues par mes contrôles', count: expected.length, hint: 'Les familles que le référentiel rattache aux contrôles de cette organisation.' },
            { key: 'declarees', label: 'Déclarées', count: declared.length },
            { key: 'toutes', label: 'Toutes les familles', count: families.length, hint: 'La typologie complète du référentiel.' },
          ]}
        />
        <Link href={`/admin/organizations/${id}/controles`} className="text-sm text-brand-600 hover:underline">
          Registre des contrôles
        </Link>
      </div>

      <Card
        title="Familles d’outillage"
        subtitle={`${shown.length} famille(s) — le produit se déclare une fois, les contrôles le retiennent ensuite.`}
      >
        {shown.length ? (
          <ul className="divide-y divide-ink-100">
            {shown.map((family) => {
              const d = family.declared
              return (
                <li key={family.code} className="py-3 first:pt-0 last:pb-0">
                  <div className="flex flex-wrap items-start justify-between gap-3">
                    <div className="min-w-0">
                      <div className="flex flex-wrap items-center gap-2">
                        <span className="text-sm font-medium text-ink-900">{family.name}</span>
                        {family.acronym ? <Badge>{family.acronym}</Badge> : null}
                        {family.controls ? (
                          <Badge tone={d ? 'ok' : 'warn'}>
                            {family.controls} contrôle(s) attendent cette famille
                          </Badge>
                        ) : null}
                        {d?.connector ? <Badge tone="info">Connecteur</Badge> : null}
                      </div>
                      <p className="text-xs text-ink-500">
                        {family.domain ?? family.code}
                        {family.phase ? ` · ${family.phase}` : ''}
                        {d ? (
                          <>
                            {' · '}
                            <strong className="font-medium text-ink-800">{d.product}</strong>
                            {d.vendor ? ` · ${d.vendor.name}` : ''}
                            {d.connector ? ` · ${d.connector.name}` : ''}
                            {d.used_by ? ` · retenu par ${d.used_by} contrôle(s)` : ' · retenu par aucun contrôle'}
                          </>
                        ) : (
                          <>
                            {family.examples.length ? ` · ex. ${family.examples.slice(0, 3).join(', ')}` : ''}
                            {' · aucun produit déclaré'}
                          </>
                        )}
                      </p>
                      {d?.note ? <p className="mt-1 text-xs text-ink-500">{d.note}</p> : null}
                      {d?.vendor && !['approved', 'approved_with_conditions'].includes(d.vendor.review_status) ? (
                        <p className="mt-1 text-xs text-warn-600">
                          Son fournisseur n’a pas de revue approuvée : précondition de production des cas d’usage qui en dépendent.
                        </p>
                      ) : null}
                    </div>
                    <span className="flex shrink-0 items-center gap-3">
                      <ToolingForm
                        organizationId={id}
                        family={family}
                        vendors={vendors ?? []}
                        connectors={(connectors ?? []).map((c) => ({ id: c.id, name: c.display_name }))}
                      />
                      {d ? (
                        <RemoveToolingButton organizationId={id} toolingId={d.id} product={d.product} usedBy={d.used_by} />
                      ) : null}
                    </span>
                  </div>
                </li>
              )
            })}
          </ul>
        ) : (
          <Empty>
            Aucune famille dans cette lecture. Les contrôles retenus depuis le référentiel portent
            leurs familles ; un contrôle écrit librement n’en porte aucune.
          </Empty>
        )}
      </Card>
    </Shell>
  )
}

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

  const [{ data: organization }, { data: mapData }, { data: vendors }, { data: assets }] =
    await Promise.all([
      supabase.from('organization').select('id, name').eq('id', id).maybeSingle(),
      supabase.rpc('organization_tooling_map', { p_organization_id: id }),
      supabase.from('vendor').select('id, name').eq('organization_id', id).order('name'),
      supabase
        .from('ai_asset')
        .select('id, name, business_ref')
        .eq('organization_id', id)
        .order('name'),
    ])
  if (!organization) notFound()

  const map = (mapData ?? { families: [], signals: null }) as {
    families: ToolFamily[]
    signals: { technical_without_tooling: number; evidence_automatable: number } | null
  }
  const families = map.families
  const signals = map.signals ?? { technical_without_tooling: 0, evidence_automatable: 0 }
  const declared = families.filter((f) => f.declared)
  const expected = families.filter((f) => f.controls > 0)
  const missing = expected.filter((f) => !f.declared)

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
              <strong className="font-medium text-ink-800">Deux natures, deux textes.</strong> Un
              outil se déclare à l’un de deux titres, parfois aux deux :
            </p>
            <ul className="flex list-disc flex-col gap-2 pl-5">
              <li>
                <strong className="font-medium text-ink-800">Instrument d’un contrôle</strong> — il
                sert à tenir ou à prouver une mesure. C’est la lecture d’ISO/IEC 27002, où la nature
                technique appartient à la mesure elle-même, et de l’article 32 du RGPD, qui parle de
                « mesures techniques et organisationnelles ». L’outil n’est pas un objet gouverné :
                c’est un moyen.
              </li>
              <li>
                <strong className="font-medium text-ink-800">Ressource d’un système d’IA</strong> —
                il a servi à développer, entraîner, valider ou exploiter un système. ISO/IEC 42001
                le nomme explicitement en <strong className="font-medium text-ink-800">A.4.4,
                « Tooling resources »</strong>, et l’annexe IV de l’AI Act demande la même chose
                pour la documentation technique.
              </li>
              <li>
                <strong className="font-medium text-ink-800">Les deux</strong> — une passerelle
                d’appels IA avec modération, un juge LLM d’évaluation, un assistant de code. Il tient
                un contrôle <em>et</em> constitue un actif d’IA à gouverner. Rattachez-le alors à son
                actif : sans ce lien, le même produit se saisit deux fois sans que rien ne le dise.
              </li>
            </ul>
            <p>
              <strong className="font-medium text-ink-800">Ce n’est pas une CMDB.</strong> Une ligne
              par famille, le produit employé : pas d’instances, pas de dépendances, pas de cycle de
              vie. L’inventaire du SI vit dans votre ITSM ; AIGMS s’y connecte plutôt que de le
              refaire. Le rattachement à un actif ne change pas cette règle — il désigne une fiche
              existante, il n’en crée pas.
            </p>
            <p>
              <strong className="font-medium text-ink-800">Ce que la carte signale.</strong> Un
              contrôle de nature technique dont aucun outillage n’est retenu énonce un moyen sans le
              nommer : il ne se prouve pas. À l’inverse, un contrôle qui retient un outil dont le
              connecteur est actif, et qui n’a pourtant aucune preuve validée et fraîche, collecte à
              la main ce qui pourrait venir tout seul.
            </p>
            <p>
              <strong className="font-medium text-ink-800">Qui déclare quoi.</strong> L’outillage se
              déclare ici par l’AI Governance Officer, avec l’Expert (DSI, RSSI) qui le connaît —
              c’est le RACI. En revanche, <strong className="font-medium text-ink-800">configurer un
              connecteur</strong> chez un fournisseur, pour en tirer les preuves, est une tâche
              d’administration de la plateforme : chaque produit déclaré ici en est un candidat, et
              ce branchement reste à venir.
            </p>
          </div>
        </InfoTip>
      }
    >
      <StatStrip>
        <Stat label="Familles attendues par vos contrôles" value={expected.length} total={families.length} />
        <Stat label="Produits déclarés" value={declared.length} tone={declared.length ? 'ok' : 'warn'} />
        <Stat label="Attendues sans produit" value={missing.length} tone={missing.length ? 'warn' : 'ok'} />
        <Stat label="Retenus par au moins un contrôle" value={declared.filter((f) => (f.declared?.used_by ?? 0) > 0).length} total={declared.length} tone="neutral" />
      </StatStrip>

      {/*
        Les deux signaux. Le premier est une lacune de gouvernance ; le second
        est un gisement — une collecte qui pourrait etre automatique et qui ne
        l'est pas. Ni l'un ni l'autre ne bloque : ils disent ou regarder.
      */}
      {signals.technical_without_tooling || signals.evidence_automatable ? (
        <div className="mt-5 flex flex-col gap-2">
          {signals.technical_without_tooling ? (
            <p className="rounded-md border border-warn-600/25 bg-warn-600/5 px-4 py-3 text-sm leading-relaxed text-ink-700">
              <strong className="font-medium text-ink-900">
                {signals.technical_without_tooling} contrôle(s) de nature technique ne nomment aucun
                outillage.
              </strong>{' '}
              Un contrôle technique qui ne dit pas avec quoi il se tient énonce un moyen sans le
              nommer : il ne se prouve pas.{' '}
              <Link href={`/admin/organizations/${id}/controles`} className="text-brand-600 hover:underline">
                Voir les contrôles
              </Link>
            </p>
          ) : null}
          {signals.evidence_automatable ? (
            <p className="rounded-md border border-brand-600/25 bg-brand-600/5 px-4 py-3 text-sm leading-relaxed text-ink-700">
              <strong className="font-medium text-ink-900">
                {signals.evidence_automatable} contrôle(s) pourraient tirer leur preuve d’un
                connecteur déjà branché.
              </strong>{' '}
              Ils retiennent un outil dont le connecteur est actif, et n’ont aucune preuve validée et
              fraîche. La collecte se fait donc encore à la main.
            </p>
          ) : null}
        </div>
      ) : null}

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
                      </div>
                      <p className="text-xs text-ink-500">
                        {family.domain ?? family.code}
                        {family.phase ? ` · ${family.phase}` : ''}
                        {d ? (
                          <>
                            {' · '}
                            <strong className="font-medium text-ink-800">{d.product}</strong>
                            {d.role === 'system_resource'
                              ? ' · ressource du système'
                              : d.role === 'both'
                                ? ' · instrument et ressource'
                                : ''}
                            {d.vendor ? ` · ${d.vendor.name}` : ''}
                            {d.used_by ? ` · retenu par ${d.used_by} contrôle(s)` : ' · retenu par aucun contrôle'}
                          </>
                        ) : (
                          <>
                            {family.examples.length ? ` · ex. ${family.examples.slice(0, 3).join(', ')}` : ''}
                            {' · aucun produit déclaré'}
                          </>
                        )}
                      </p>
                      {d?.asset ? (
                        <p className="mt-1 text-xs text-ink-600">
                          Cet outil est aussi un actif d’IA déclaré :{' '}
                          <Link
                            href={`/admin/organizations/${id}/actifs/${d.asset.id}`}
                            className="text-brand-600 hover:underline"
                          >
                            {d.asset.business_ref} — {d.asset.name}
                          </Link>
                          . Il s’instruit comme tel.
                        </p>
                      ) : null}
                      {d?.note ? <p className="mt-1 text-xs text-ink-500">{d.note}</p> : null}
                      {d?.vendor && !['approved', 'approved_with_conditions'].includes(d.vendor.review_status) ? (
                        <p className="mt-1 text-xs text-warn-600">
                          Son fournisseur n’a pas de revue approuvée : précondition de production des cas d’usage qui en dépendent.
                        </p>
                      ) : null}
                    </div>
                    <span className="flex shrink-0 items-center gap-3">
                      <ToolingForm organizationId={id} family={family} vendors={vendors ?? []} assets={assets ?? []} />
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

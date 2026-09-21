import Link from 'next/link'
import { notFound } from 'next/navigation'
import { createClient } from '@/lib/supabase/server'
import { Shell } from '@/components/shell'
import { Badge, Card, Empty, Stat, StatStrip } from '@/components/ui'
import { InfoTip } from '@/components/info-tip'
import { OpenStudyForm } from '@/components/governance/impact-forms'
import { IMPACT_STATUS_LABELS, type ImpactStudyRow } from '@/lib/domain/impact'
import { CRITICALITY_LABELS, type Criticality } from '@/lib/domain/criticality'
import { USE_CASE_STATUS_LABELS, formatDate, type UseCaseStatus } from '@/lib/domain/governance'

/**
 * Les etudes d'impact IA d'une organisation.
 *
 * Par cas d'usage : l'etude est-elle exigee par les faits (0011 : donnees
 * personnelles, personnes vulnerables, autonomie L3+, criticite elevee,
 * drapeau haut risque), conduite, achevee, a revoir ? Les cas ou elle est
 * exigee et manque viennent en premier : c'est la ou le gate Production
 * bloquera.
 */
export default async function ImpactStudiesPage({
  params,
  searchParams,
}: {
  params: Promise<{ id: string }>
  searchParams: Promise<{ cas?: string }>
}) {
  const { id } = await params
  const { cas } = await searchParams
  const supabase = await createClient()
  const [{ data: organization }, { data: studiesData }] = await Promise.all([
    supabase.from('organization').select('id, name').eq('id', id).maybeSingle(),
    supabase.rpc('impact_studies', { p_organization_id: id }),
  ])
  if (!organization) notFound()

  const rows = (studiesData ?? []) as unknown as ImpactStudyRow[]
  const missing = rows.filter((r) => r.required && (!r.study || r.study.status !== 'completed'))
  const completed = rows.filter((r) => r.study?.status === 'completed')
  const today = new Date().toISOString().slice(0, 10)
  const toReview = rows.filter((r) => r.study?.next_review_at && r.study.next_review_at < today)
  const base = `/admin/organizations/${id}/etudes-impact`

  return (
    <Shell
      breadcrumb={[
        { href: '/admin/organizations', label: 'Organisations' },
        { href: `/admin/organizations/${id}`, label: organization.name },
      ]}
      organization={{ id, section: 'apercu' }}
      title="Études d’impact IA"
      subtitle="Effets de chaque système sur les personnes, les groupes et la société — ISO/IEC 42005."
      actions={
        <InfoTip label="Qu’est-ce qu’une étude d’impact IA" title="Ni AIPD, ni registre des risques">
          <div className="flex flex-col gap-3 text-sm leading-relaxed text-ink-600">
            <p>
              L’étude d’impact IA (AI Impact Assessment, <strong className="font-medium text-ink-800">ISO/IEC 42005</strong>)
              regarde les effets d’un système sur les <strong className="font-medium text-ink-800">personnes, les groupes et la société</strong> :
              droits fondamentaux, égalité, vie privée, emploi, accès aux services, environnement. Elle croise bénéfices
              attendus et préjudices potentiels, domaine par domaine, et arrête des mesures de réduction — confiées et datées.
            </p>
            <p>
              Elle n’est <strong className="font-medium text-ink-800">ni le registre des risques</strong> — qui regarde
              l’organisation — <strong className="font-medium text-ink-800">ni l’AIPD</strong> — qui regarde les données
              personnelles (RGPD art. 35) et que l’étude peut appeler.
            </p>
            <p>
              Elle est <strong className="font-medium text-ink-800">exigée</strong> dès que les faits le disent : données
              personnelles, personnes vulnérables, autonomie L3 ou L4, criticité élevée ou critique, potentiel haut risque
              ou vie privée à la qualification. Le jalon Production la demande alors achevée. Achevée, elle ouvre l’action
              « déposer la preuve » : l’export au format du modèle de l’organisation se dépose d’un clic.
            </p>
          </div>
        </InfoTip>
      }
    >
      <StatStrip>
        <Stat label="Exigées et non achevées" value={missing.length} total={rows.filter((r) => r.required).length} tone={missing.length ? 'stop' : 'ok'} />
        <Stat label="Achevées" value={completed.length} total={rows.length} tone="ok" />
        <Stat label="À revoir" value={toReview.length} tone={toReview.length ? 'warn' : 'neutral'} />
      </StatStrip>

      <div className="mt-5 grid gap-5 lg:grid-cols-3">
        <div className="lg:col-span-2">
          <Card title="Par cas d’usage" subtitle="Les cas où l’étude est exigée et manque viennent en premier.">
            {rows.length ? (
              <ul className="divide-y divide-ink-100">
                {rows.map((r) => {
                  const s = r.study
                  const late = s?.next_review_at && s.next_review_at < today
                  const tone = r.required && (!s || s.status !== 'completed') ? 'stop' : s?.status === 'completed' ? (late ? 'warn' : 'ok') : s ? 'warn' : 'neutral'
                  return (
                    <li key={r.use_case_id} className="flex flex-wrap items-start justify-between gap-3 py-3 first:pt-0 last:pb-0">
                      <div className="min-w-0">
                        <div className="flex flex-wrap items-center gap-2">
                          <Link href={`/admin/use-cases/${r.use_case_id}`} className="text-sm font-medium text-ink-900 hover:underline">
                            {r.name}
                          </Link>
                          <Badge tone={r.required ? 'stop' : 'neutral'}>{r.required ? 'Exigée' : 'Non exigée'}</Badge>
                          {s ? <Badge tone={tone}>{IMPACT_STATUS_LABELS[s.status] ?? s.status}</Badge> : <Badge tone={r.required ? 'stop' : 'neutral'}>Aucune étude</Badge>}
                          {s?.dpia_required ? <Badge tone="warn">AIPD</Badge> : null}
                        </div>
                        <p className="text-xs text-ink-500">
                          {r.business_ref} · {USE_CASE_STATUS_LABELS[r.status as UseCaseStatus] ?? r.status}
                          {r.criticality ? ` · criticité ${CRITICALITY_LABELS[r.criticality as Criticality].toLowerCase()}` : ''}
                          {s ? ` · ${s.business_ref} · ${s.findings} constat(s)${s.severe ? `, ${s.severe} grave(s)` : ''}` : ''}
                          {s?.completed_at ? ` · achevée le ${formatDate(s.completed_at)}` : ''}
                          {s?.next_review_at ? ` · revue ${late ? 'échue ' : ''}le ${formatDate(s.next_review_at)}` : ''}
                        </p>
                      </div>
                      {s ? (
                        <Link href={`${base}/${s.id}`} className="rounded-md border border-ink-200 px-3 py-1.5 text-xs text-ink-700 hover:bg-ink-100">
                          {s.status === 'completed' ? 'Lire' : 'Poursuivre'}
                        </Link>
                      ) : (
                        <Link href={`${base}?cas=${r.use_case_id}`} className="rounded-md border border-ink-200 px-3 py-1.5 text-xs text-ink-700 hover:bg-ink-100">
                          Conduire
                        </Link>
                      )}
                    </li>
                  )
                })}
              </ul>
            ) : (
              <Empty>Aucun cas d’usage déclaré.</Empty>
            )}
          </Card>
        </div>
        <Card title="Conduire une étude" subtitle="Choisir le cas d’usage ; l’étude s’ouvre sur sa page.">
          <OpenStudyForm
            defaultUseCaseId={cas}
            useCases={rows.map((r) => ({
              id: r.use_case_id,
              business_ref: r.business_ref,
              name: r.name,
              required: r.required,
              hasOpenStudy: Boolean(r.study && r.study.status !== 'completed'),
            }))}
          />
          <p className="mt-4 text-xs leading-relaxed text-ink-500">
            Le modèle de l’organisation (ISO/IEC 42005) structure l’étude : cadrage et parties prenantes, analyse croisée
            bénéfices / préjudices par domaine, plan de remédiation. L’export reprend ce modèle.
          </p>
        </Card>
      </div>
    </Shell>
  )
}

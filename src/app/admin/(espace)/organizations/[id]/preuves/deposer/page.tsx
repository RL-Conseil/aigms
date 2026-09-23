import Link from 'next/link'
import { notFound } from 'next/navigation'
import { createClient } from '@/lib/supabase/server'
import { Shell } from '@/components/shell'
import { Card, Empty } from '@/components/ui'
import {
  EvidenceUploadForm,
  type ControlChoice,
  type TypologyChoice,
} from '@/components/governance/evidence-forms'

/**
 * Depot d'une preuve, sur sa propre page.
 *
 * Le formulaire vivait dans le registre, ou il occupait en permanence une
 * colonne entiere : on consulte un registre cent fois pour y deposer une fois.
 * Le sortir rend la consultation lisible et donne au depot la place qu'il
 * demande — typologie, description technique attendue, livrables qui font
 * preuve.
 */

type Control = {
  id: string
  code: string
  name: string
  status: string
  is_mandatory: boolean
  evidence_count: number
  is_evidenced: boolean
}

export default async function DepositEvidencePage({
  params,
  searchParams,
}: {
  params: Promise<{ id: string }>
  searchParams: Promise<{
    controle?: string
    typologie?: string
    remplace?: string
    'cas-d-usage'?: string
    action?: string
  }>
}) {
  const { id } = await params
  const { controle, typologie, remplace, action } = await searchParams
  const useCaseId = (await searchParams)['cas-d-usage']
  const supabase = await createClient()

  const [
    { data: organization },
    { data: controlData },
    { data: typologyData },
    { data: replaced },
    { data: useCaseData },
    { data: applicability },
    { data: actionData },
  ] =
    await Promise.all([
      supabase.from('organization').select('id, name, business_ref').eq('id', id).maybeSingle(),
      supabase.rpc('controls_awaiting_evidence', { p_organization_id: id }),
      supabase.rpc('evidence_typologies', { p_organization_id: id }),
      // Renouvellement : la piece remplacee pre-remplit le formulaire.
      remplace
        ? supabase
            .from('evidence')
            .select('id, business_ref, title, evidence_type, source, typology_id, links:control_evidence (control:control_id (code))')
            .eq('id', remplace)
            .eq('organization_id', id)
            .maybeSingle()
        : Promise.resolve({ data: null }),
      // Depuis la fiche d'un cas d'usage : la liste des controles se restreint
      // a ceux qui s'y appliquent, et la page dit pour qui elle depose.
      useCaseId
        ? supabase.from('ai_use_case').select('id, name, business_ref').eq('id', useCaseId).maybeSingle()
        : Promise.resolve({ data: null }),
      useCaseId
        ? supabase
            .from('control_applicability')
            .select('control_id')
            .eq('use_case_id', useCaseId)
            .eq('status', 'applicable')
        : Promise.resolve({ data: null }),
      // Une action a solder par ce depot : « Déposer la preuve de l'évaluation… ».
      action
        ? supabase
            .from('action')
            .select('id, business_ref, title, status')
            .eq('id', action)
            .eq('organization_id', id)
            .maybeSingle()
        : Promise.resolve({ data: null }),
    ])

  if (!organization) notFound()

  const applicableIds = new Set((applicability ?? []).map((a) => a.control_id))
  const openAction =
    actionData && !['done', 'cancelled'].includes(actionData.status) ? actionData : null

  const controls = (controlData ?? []) as Control[]
  const typologies = (typologyData ?? []) as TypologyChoice[]
  const replaces = replaced
    ? {
        id: replaced.id,
        business_ref: replaced.business_ref,
        title: replaced.title,
        evidence_type: replaced.evidence_type as string,
        source: replaced.source,
        typology_id: replaced.typology_id,
        control_codes: ((replaced.links ?? []) as unknown as { control: { code: string } | null }[])
          .map((l) => l.control?.code)
          .filter((c): c is string => Boolean(c)),
      }
    : null
  // `?typologie=<code>` depuis les manques de la matrice : on retrouve l'id.
  const defaultTypologyId = typologie ? typologies.find((t) => t.code === typologie)?.id : undefined
  const scoped = useCaseData ? controls.filter((c) => applicableIds.has(c.id)) : controls
  const choices: ControlChoice[] = (scoped.length ? scoped : controls).map((c) => ({
    id: c.id,
    code: c.code,
    name: c.name,
    is_evidenced: c.is_evidenced,
    status: c.status,
  }))

  return (
    <Shell
      breadcrumb={[
        { href: '/admin/organizations', label: 'Organisations' },
        { href: `/admin/organizations/${id}`, label: organization.name },
        { href: `/admin/organizations/${id}/preuves`, label: 'Preuves' },
      ]}
      organization={{ id, section: 'preuves' }}
      title="Déposer une preuve"
      subtitle="Un dépôt n’est pas une validation : la pièce arrivera « à valider »."
      actions={
        <Link
          href={`/admin/organizations/${id}/preuves`}
          className="rounded-md border border-ink-200 px-3.5 py-2 text-sm text-ink-700 hover:bg-ink-100"
        >
          Retour au registre
        </Link>
      }
    >
      <div className="max-w-3xl">
        {useCaseData || openAction ? (
          <p className="mb-4 rounded-md border border-ink-200 bg-white px-4 py-3 text-sm text-ink-600">
            {useCaseData ? (
              <>
                Preuve pour le cas d’usage{' '}
                <Link href={`/admin/use-cases/${useCaseData.id}?onglet=supervision`} className="font-medium text-brand-600 hover:underline">
                  {useCaseData.name}
                </Link>{' '}
                ({useCaseData.business_ref}) : la liste ne propose que les contrôles qui s’y appliquent.
              </>
            ) : null}
            {openAction ? (
              <span className="block">
                Le dépôt clôturera l’action <strong className="font-medium text-ink-900">{openAction.business_ref}</strong> — « {openAction.title} ».
              </span>
            ) : null}
          </p>
        ) : null}
        <Card title="La pièce et ce qu’elle démontre">
          {typologies.length || choices.length ? (
            <EvidenceUploadForm
              organizationId={id}
              controls={choices}
              typologies={typologies}
              defaultControlId={controle}
              defaultTypologyId={defaultTypologyId}
              replaces={replaces}
              closesActionId={openAction?.id}
            />
          ) : (
            <Empty>
              Cette organisation n’est pas accessible depuis votre compte, ou ne porte encore aucun
              contrôle auquel rattacher une preuve.
            </Empty>
          )}
        </Card>
      </div>
    </Shell>
  )
}

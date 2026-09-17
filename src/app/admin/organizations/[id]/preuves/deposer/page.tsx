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
  searchParams: Promise<{ controle?: string; typologie?: string; remplace?: string }>
}) {
  const { id } = await params
  const { controle, typologie, remplace } = await searchParams
  const supabase = await createClient()

  const [{ data: organization }, { data: controlData }, { data: typologyData }, { data: replaced }] =
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
    ])

  if (!organization) notFound()

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
  const choices: ControlChoice[] = controls.map((c) => ({
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
        <Card title="La pièce et ce qu’elle démontre">
          {typologies.length || choices.length ? (
            <EvidenceUploadForm
              organizationId={id}
              controls={choices}
              typologies={typologies}
              defaultControlId={controle}
              defaultTypologyId={defaultTypologyId}
              replaces={replaces}
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

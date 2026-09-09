import Link from 'next/link'
import { Badge, Card, Empty } from '@/components/ui'
import {
  CONTROL_STATUS_LABELS,
  RISK_LEVEL_LABELS,
  TREATMENT_STATUS_LABELS,
  type RiskLevel,
} from '@/lib/domain/governance'

/**
 * Le chemin d'un risque, du processus jusqu'a la preuve.
 *
 * Le graphe montre des liens ; ce panneau rend un verdict. Il ne se contente
 * pas de dire « incomplet » : il nomme le maillon exact ou la chaine rompt,
 * parce qu'un chemin qui s'arrete au traitement et un chemin qui s'arrete a la
 * preuve n'appellent pas la meme action.
 *
 * Le verdict est calcule en base (`app.risk_path`) : c'est une regle de
 * gouvernance, pas une mise en forme.
 */

export type PathControl = {
  id: string
  code: string
  name: string
  status: string
  evidenced: boolean
  treatment_status: string
  strategy: string
}

export type RiskPath = {
  available: boolean
  risk?: { id: string; ref: string; title: string; level: RiskLevel; status: string }
  anchor?: {
    process: string | null
    activity: string | null
    use_case: string
    use_case_ref: string
    use_case_id: string
  }
  controls?: PathControl[]
  counts?: { treatments: number; controls: number; operating: number; evidenced: number }
  chain_complete?: boolean
  break?: string | null
  message?: string
  highlight_nodes?: string[]
  highlight_edges?: string[]
}

export type RiskChoice = {
  id: string
  business_ref: string
  title: string
  level: RiskLevel
  status: string
}

// Chaque rupture appelle une action differente : c'est tout l'interet de la
// nommer plutot que de rendre un simple « incomplet ».
const BREAK_ACTIONS: Record<string, string> = {
  no_treatment: 'Ouvrir un plan de traitement, ou accepter le risque de façon nominative et datée.',
  no_control: 'Désigner le contrôle qui met en œuvre le traitement prévu.',
  control_not_operating: 'Faire passer le contrôle désigné en état opérant.',
  no_evidence: 'Rattacher au contrôle une preuve validée et non échue.',
}

export function RiskPathPanel({
  path,
  organizationId,
}: {
  path: RiskPath
  organizationId: string
}) {
  if (!path.available || !path.risk) {
    return (
      <Card title="Chemin du risque">
        <Empty>Ce risque n’est pas accessible.</Empty>
      </Card>
    )
  }

  const risk = path.risk
  const anchor = path.anchor
  const complete = path.chain_complete === true
  const accepted = risk.status === 'accepted'
  const counts = path.counts

  return (
    <div className="flex flex-col gap-5">
      <Card
        title={risk.title}
        subtitle={`${risk.ref} · risque ${RISK_LEVEL_LABELS[risk.level].toLowerCase()}`}
        action={
          <Link
            href={`/admin/organizations/${organizationId}/processus?vue=graphe`}
            scroll={false}
            className="text-xs text-ink-500 hover:text-ink-900"
          >
            Effacer
          </Link>
        }
      >
        <div
          className={`rounded-md border px-3.5 py-3 text-sm ${
            accepted
              ? 'border-ink-200 bg-ink-50 text-ink-700'
              : complete
                ? 'border-ok-600/30 bg-ok-600/5 text-ok-600'
                : 'border-stop-600/30 bg-stop-600/5 text-stop-600'
          }`}
        >
          <p className="font-medium">
            {accepted
              ? 'Risque accepté'
              : complete
                ? 'Chaîne de maîtrise complète'
                : 'Chaîne de maîtrise rompue'}
          </p>
          <p className="mt-1 text-ink-700">{path.message}</p>
          {path.break && BREAK_ACTIONS[path.break] ? (
            <p className="mt-2 text-xs text-ink-600">
              <span className="font-medium">À faire — </span>
              {BREAK_ACTIONS[path.break]}
            </p>
          ) : null}
        </div>

        {counts ? (
          <dl className="mt-4 grid grid-cols-2 gap-x-4 gap-y-2 text-sm sm:grid-cols-4">
            <Count label="Traitements" value={counts.treatments} />
            <Count label="Contrôles désignés" value={counts.controls} />
            <Count label="Opérants" value={counts.operating} />
            <Count label="Prouvés" value={counts.evidenced} />
          </dl>
        ) : null}
      </Card>

      {anchor ? (
        <Card title="Où ce risque se joue">
          <ol className="flex flex-col gap-0">
            <Step label="Processus" value={anchor.process ?? '— non rattaché'} />
            <Step label="Activité" value={anchor.activity ?? '— non rattachée'} />
            <Step
              label="Cas d’usage"
              value={anchor.use_case}
              href={`/admin/use-cases/${anchor.use_case_id}`}
              hint={anchor.use_case_ref}
            />
            <Step label="Risque" value={risk.title} hint={risk.ref} last />
          </ol>
        </Card>
      ) : null}

      <Card title="Ce qui le tient">
        {path.controls?.length ? (
          <ul className="flex flex-col gap-3">
            {path.controls.map((control) => (
              <li key={control.id} className="flex flex-col gap-1">
                <div className="flex flex-wrap items-baseline justify-between gap-2">
                  <span className="text-sm text-ink-900">
                    <span className="mr-2 font-mono text-xs text-ink-400">{control.code}</span>
                    {control.name}
                  </span>
                  <Badge
                    tone={
                      control.status === 'operating' && control.evidenced
                        ? 'ok'
                        : control.status === 'operating'
                          ? 'warn'
                          : 'stop'
                    }
                  >
                    {CONTROL_STATUS_LABELS[control.status] ?? control.status}
                  </Badge>
                </div>
                <p className="text-xs text-ink-500">
                  Traitement {(TREATMENT_STATUS_LABELS[control.treatment_status] ?? control.treatment_status).toLowerCase()}
                  {' · '}
                  {control.evidenced ? 'preuve validée et non échue' : 'aucune preuve valide'}
                </p>
              </li>
            ))}
          </ul>
        ) : (
          <Empty>
            Aucun contrôle n’est désigné pour traiter ce risque. Un plan de traitement décrit une
            intention ; c’est le contrôle qui l’exécute.
          </Empty>
        )}
      </Card>
    </div>
  )
}

// -----------------------------------------------------------------------------
// Choix du risque a suivre
// -----------------------------------------------------------------------------
export function RiskPicker({
  risks,
  organizationId,
  selectedId,
}: {
  risks: RiskChoice[]
  organizationId: string
  selectedId?: string
}) {
  if (!risks.length) {
    return (
      <Card title="Suivre un risque">
        <Empty>Aucun risque déclaré sur cette organisation.</Empty>
      </Card>
    )
  }

  return (
    <Card
      title="Suivre un risque"
      subtitle="Le graphe met en évidence le chemin, du processus jusqu’à la preuve."
    >
      <ul className="flex flex-col gap-1.5">
        {risks.map((risk) => {
          const selected = risk.id === selectedId
          return (
            <li key={risk.id}>
              <Link
                href={`/admin/organizations/${organizationId}/processus?vue=graphe&risque=${risk.id}`}
                scroll={false}
                aria-current={selected ? 'true' : undefined}
                className={`flex items-start justify-between gap-2 rounded-md px-2.5 py-2 text-sm hover:bg-ink-50 ${
                  selected ? 'bg-brand-500/5 ring-1 ring-inset ring-brand-500/30' : ''
                }`}
              >
                <span className="text-ink-800">
                  <span className="mr-2 font-mono text-xs text-ink-400">{risk.business_ref}</span>
                  {risk.title}
                </span>
                <Badge
                  tone={
                    risk.status === 'accepted'
                      ? 'neutral'
                      : risk.level === 'critical' || risk.level === 'high'
                        ? 'stop'
                        : risk.level === 'moderate'
                          ? 'warn'
                          : 'neutral'
                  }
                >
                  {RISK_LEVEL_LABELS[risk.level]}
                </Badge>
              </Link>
            </li>
          )
        })}
      </ul>
    </Card>
  )
}

function Count({ label, value }: { label: string; value: number }) {
  return (
    <div>
      <dt className="text-xs text-ink-500">{label}</dt>
      <dd className="text-lg font-medium text-ink-900">{value}</dd>
    </div>
  )
}

function Step({
  label,
  value,
  hint,
  href,
  last = false,
}: {
  label: string
  value: string
  hint?: string
  href?: string
  last?: boolean
}) {
  return (
    <li className="relative flex gap-3 pb-3.5 last:pb-0">
      <span className="relative flex flex-col items-center">
        <span className="mt-1.5 size-2 shrink-0 rounded-full bg-brand-500" />
        {last ? null : <span className="mt-1 w-px flex-1 bg-ink-200" />}
      </span>
      <span className="min-w-0">
        <span className="block text-xs text-ink-400">{label}</span>
        {href ? (
          <Link href={href} className="text-sm text-brand-600 hover:underline">
            {value}
          </Link>
        ) : (
          <span className="text-sm text-ink-900">{value}</span>
        )}
        {hint ? <span className="ml-2 font-mono text-xs text-ink-400">{hint}</span> : null}
      </span>
    </li>
  )
}

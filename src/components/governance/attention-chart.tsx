import { ATTENTION_ORDER, attentionLabel, isLate, type Attention } from '@/lib/governance/attention'

/**
 * Ce qui appelle une action, par nature.
 *
 * Un tableau de bord synthetique repond a « ou porter l'effort », pas a « quels
 * sont les elements ». Six listes de meme poids ne le disaient pas : il fallait
 * les parcourir pour comparer. Une barre le dit d'un coup d'oeil.
 *
 * Pas de bibliotheque : sept barres horizontales en HTML se lisent au clavier,
 * s'impriment, et ne coutent rien. La longueur est proportionnelle au plus
 * grand compteur — l'echelle est donc relative, et l'indiquer evite de lire une
 * proportion qui n'existe pas.
 */
export function AttentionChart({ rows }: { rows: Attention[] }) {
  const totals = ATTENTION_ORDER.map((kind) => ({
    kind,
    count: rows.reduce((sum, row) => sum + row[kind], 0),
  })).filter((entry) => entry.count > 0)

  if (!totals.length) {
    return (
      <p className="rounded-lg border border-ok-600/25 bg-ok-600/5 px-4 py-3 text-sm text-ok-600">
        Rien n’appelle d’action sur votre périmètre.
      </p>
    )
  }

  const max = Math.max(...totals.map((entry) => entry.count))

  return (
    <div className="flex flex-col gap-3">
      {totals.map(({ kind, count }) => (
        <div key={kind}>
          <div className="mb-1 flex items-baseline justify-between gap-4">
            <span className="text-sm text-ink-700">{attentionLabel(kind, count)}</span>
            <span
              className={`text-sm font-semibold tabular-nums ${
                isLate(kind) ? 'text-stop-600' : 'text-warn-600'
              }`}
            >
              {count}
            </span>
          </div>
          <div className="h-2 rounded-full bg-ink-100">
            <div
              className={`h-2 rounded-full ${isLate(kind) ? 'bg-stop-600' : 'bg-warn-600'}`}
              style={{ width: `${Math.round((count / max) * 100)}%` }}
            />
          </div>
        </div>
      ))}

      <p className="mt-1 text-xs leading-relaxed text-ink-500">
        Les longueurs se comparent entre elles, pas à un objectif : la plus longue est simplement la
        plus nombreuse. Le rouge marque ce qui aurait déjà dû être fait, l’ambre ce qui attend une
        main.
      </p>
    </div>
  )
}

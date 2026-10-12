import { NumberField } from '@/app/NumberField'
import { linkButton } from '@/app/buttonStyles'
import type { CompletedSet } from '@/repositories/SessionRepository'

export interface DropDraft {
  weight: number
  reps: number
  rir: number | undefined
}

interface DropSetBlockProps {
  exerciseName: string
  madre: CompletedSet
  pendingCount: number
  previousBlock: CompletedSet | null // el mismo bloque la vez pasada, para el "Antes" de cada bajada
  canAdd: boolean // solo el último bloque de la sesión puede crecer
  unitLabel: string
  displayWeight: (kg: number) => number
  toKg: (displayed: number) => number
  getDraft: (dropIndex: number) => DropDraft
  onChangeDraft: (dropIndex: number, changes: Partial<DropDraft>) => void
  onCompleteDrop: (dropIndex: number) => void
  onRemoveDrop: (dropIndex: number) => void
  onAddDrop: () => void
}

const inputClass = 'h-10 min-w-0 rounded bg-slate-700 px-2 text-center text-base'
const removeButtonClass = 'h-9 w-8 shrink-0 text-slate-500'

// Las bajadas de un Drop Set, anidadas bajo la serie madre: primero las ya hechas (verde), luego la activa y las pendientes
export function DropSetBlock({
  exerciseName,
  madre,
  pendingCount,
  previousBlock,
  canAdd,
  unitLabel,
  displayWeight,
  toKg,
  getDraft,
  onChangeDraft,
  onCompleteDrop,
  onRemoveDrop,
  onAddDrop,
}: DropSetBlockProps) {
  const drops = madre.drops ?? []

  return (
    <div className="ml-4 mt-1 border-l-2 border-violet-500/40 pl-2">
      {drops.map((drop, index) => (
        <div key={`done-${index}`} className="mt-1 flex items-center gap-2 rounded-lg bg-emerald-950 px-1 py-2 text-sm">
          <span className="w-6 shrink-0 text-center text-violet-400" aria-hidden="true">↳</span>
          <span className="flex-1 text-center">{displayWeight(drop.weight)}</span>
          <span className="flex-1 text-center">{drop.reps}</span>
          <span className="w-14 text-center text-slate-400">{drop.rir ?? '—'}</span>
          <span className="w-8 text-center text-emerald-400">✓</span>
          <button
            type="button"
            onClick={() => onRemoveDrop(index)}
            aria-label={`${exerciseName}: quitar bajada ${index + 1}`}
            className={removeButtonClass}
          >
            ✕
          </button>
        </div>
      ))}

      {Array.from({ length: pendingCount }, (_, offset) => {
        const dropIndex = drops.length + offset
        const draft = getDraft(dropIndex)
        const previousDrop = previousBlock?.drops?.[dropIndex]
        const label = `${exerciseName}, bajada ${dropIndex + 1}`

        // Solo la primera pendiente se puede completar; las demás muestran lo que se propone y esperan su turno
        if (offset > 0) {
          return (
            <div key={`pending-${dropIndex}`} className="mt-1 flex items-center gap-2 rounded-lg px-1 py-2 text-sm text-slate-600">
              <span className="w-6 shrink-0 text-center" aria-hidden="true">↳</span>
              <span className="flex-1 text-center">{displayWeight(draft.weight)}</span>
              <span className="flex-1 text-center">{draft.reps}</span>
              <span className="w-14 text-center">—</span>
              <span className="w-8 text-center">○</span>
              <button
                type="button"
                onClick={() => onRemoveDrop(dropIndex)}
                aria-label={`${exerciseName}: quitar bajada ${dropIndex + 1}`}
                className={removeButtonClass}
              >
                ✕
              </button>
            </div>
          )
        }

        return (
          <div key={`pending-${dropIndex}`} className="mt-1 rounded-lg bg-slate-800 px-1 py-2">
            <div className="flex items-center gap-2">
              <span className="w-6 shrink-0 text-center text-violet-400" aria-hidden="true">↳</span>
              <NumberField
                value={displayWeight(draft.weight)}
                onChange={(value) => onChangeDraft(dropIndex, { weight: toKg(value) })}
                ariaLabel={`${label}: peso en ${unitLabel}`}
                className={`${inputClass} flex-1`}
              />
              <NumberField
                value={draft.reps}
                onChange={(reps) => onChangeDraft(dropIndex, { reps })}
                allowDecimals={false}
                ariaLabel={`${label}: repeticiones`}
                className={`${inputClass} flex-1`}
              />
              <input
                type="number"
                inputMode="numeric"
                value={draft.rir ?? ''}
                onChange={(e) => onChangeDraft(dropIndex, { rir: e.target.value === '' ? undefined : Number(e.target.value) })}
                onFocus={(e) => e.target.select()}
                aria-label={`${label}: RIR (repeticiones en reserva)`}
                placeholder="—"
                className={`${inputClass} w-14`}
              />
              <button
                type="button"
                onClick={() => onCompleteDrop(dropIndex)}
                aria-label={`Completar bajada ${dropIndex + 1}`}
                className="h-11 w-11 shrink-0 rounded-full bg-primary text-sm font-semibold text-slate-950"
              >
                ✓
              </button>
              <button
                type="button"
                onClick={() => onRemoveDrop(dropIndex)}
                aria-label={`${exerciseName}: quitar bajada ${dropIndex + 1}`}
                className={removeButtonClass}
              >
                ✕
              </button>
            </div>
            {previousDrop && (
              <div className="mt-1 flex items-center gap-2">
                <span className="w-6 shrink-0" aria-hidden="true" />
                <p className="flex-1 text-center text-sm font-bold text-primary">Antes {displayWeight(previousDrop.weight)}</p>
                <p className="flex-1 text-center text-sm font-bold text-primary">Antes {previousDrop.reps}</p>
                <span className="w-14 shrink-0" aria-hidden="true" />
                <span className="w-11 shrink-0" aria-hidden="true" />
                <span className="w-8 shrink-0" aria-hidden="true" />
              </div>
            )}
          </div>
        )
      })}

      {canAdd && (
        <button type="button" onClick={onAddDrop} className={`${linkButton} mt-1`}>
          + Otra bajada
        </button>
      )}
    </div>
  )
}

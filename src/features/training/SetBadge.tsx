import { SET_TYPE_ABBREVIATIONS, type SetTypes } from '@/domain/setTypes'

const TYPE_STYLES: Record<SetTypes, string> = {
  Normal: 'bg-slate-600/40 text-slate-300',
  Calentamiento: 'bg-amber-500/20 text-amber-400',
  'Al Fallo': 'bg-red-500/20 text-red-400',
  'Drop Set': 'bg-violet-500/20 text-violet-400',
}

// La abreviatura del tipo de serie (N, C, F, DS) con su color
export function SetTypeChip({ type }: { type: SetTypes }) {
  return (
    <span className={`rounded px-1.5 text-[11px] font-bold leading-5 ${TYPE_STYLES[type]}`} aria-label={type}>
      {SET_TYPE_ABBREVIATIONS[type]}
    </span>
  )
}

interface SetBadgeProps {
  number: number
  type: SetTypes
  onClick?: () => void // si se indica, el tipo se puede cambiar tocándolo (solo en la serie activa)
}

// Número de serie + tipo. En las series completadas o bloqueadas es solo lectura.
export function SetBadge({ number, type, onClick }: SetBadgeProps) {
  const content = (
    <>
      <span className="w-4 text-sm font-semibold">{number}</span>
      <SetTypeChip type={type} />
    </>
  )

  if (!onClick) return <span className="flex w-16 shrink-0 items-center gap-1">{content}</span>

  return (
    <button
      type="button"
      onClick={onClick}
      aria-label={`Serie ${number}, tipo ${type}. Toca para cambiar el tipo`}
      className="flex h-11 w-16 shrink-0 items-center gap-1 rounded bg-slate-700/60 px-1"
    >
      {content}
    </button>
  )
}

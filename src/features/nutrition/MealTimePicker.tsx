import { useEffect, useRef, useState } from 'react'
import { MEAL_TYPE_LABELS, type MealType } from '@/domain/mealTypes'
import { formatMinutesToTime, parseTimeToMinutes } from '@/domain/mealSchedule'
import { primaryButton, iconButton } from '@/app/buttonStyles'

const ITEM_HEIGHT = 32 // px: alto de cada número de la rueda
const VISIBLE_ROWS = 3 // impar, para que uno quede centrado (resaltado)

// Sube o baja un número en 1, dando la vuelta en los extremos (23 -> 0, 0 -> 23, etc.)
function step(current: number, delta: number, max: number): number {
  return (current + delta + (max + 1)) % (max + 1)
}

interface TimeWheelProps {
  value: number
  max: number // 23 para horas, 59 para minutos
  onChange: (value: number) => void
  ariaLabel: string
}

// Rueda de números: se desplaza con el dedo o el mouse (se "engancha" al más cercano al centro, sin librería) para
// moverse rápido, y con los botones ▲/▼ para elegir exacto — la rueda del mouse sola no es lo bastante precisa.
function TimeWheel({ value, max, onChange, ariaLabel }: TimeWheelProps) {
  const containerRef = useRef<HTMLDivElement>(null)
  const settleTimeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null)
  const initialValueRef = useRef(value) // se lee una sola vez, al montar (ver el efecto de abajo)

  // Centra la rueda en el valor inicial una sola vez: si se resincronizara en cada cambio, pelearía con el
  // propio gesto de scroll del usuario (el valor cambia justo porque el usuario está moviendo la rueda)
  useEffect(() => {
    if (containerRef.current) containerRef.current.scrollTop = initialValueRef.current * ITEM_HEIGHT
  }, [])

  useEffect(() => () => {
    if (settleTimeoutRef.current) clearTimeout(settleTimeoutRef.current)
  }, [])

  function handleScroll() {
    const el = containerRef.current
    if (!el) return
    if (settleTimeoutRef.current) clearTimeout(settleTimeoutRef.current)
    // Espera a que el usuario deje de mover el dedo antes de "leer" en qué número quedó
    settleTimeoutRef.current = setTimeout(() => {
      const index = Math.min(Math.max(Math.round(el.scrollTop / ITEM_HEIGHT), 0), max)
      if (index !== value) onChange(index)
    }, 120)
  }

  // Mueve la rueda exactamente un número, y actualiza el scroll ya mismo (no espera al próximo scroll)
  function handleStep(delta: number) {
    if (settleTimeoutRef.current) clearTimeout(settleTimeoutRef.current)
    const next = step(value, delta, max)
    if (containerRef.current) containerRef.current.scrollTop = next * ITEM_HEIGHT
    onChange(next)
  }

  return (
    <div className="flex flex-col items-center gap-1">
      <button type="button" onClick={() => handleStep(-1)} aria-label={`${ariaLabel}: uno menos`} className={iconButton}>
        ▲
      </button>
      <div
        ref={containerRef}
        onScroll={handleScroll}
        role="listbox"
        aria-label={ariaLabel}
        className="no-scrollbar snap-y snap-mandatory overflow-y-scroll overscroll-contain rounded-lg bg-slate-800"
        style={{ height: ITEM_HEIGHT * VISIBLE_ROWS, width: 52 }}
      >
        <div style={{ height: ITEM_HEIGHT }} aria-hidden="true" />
        {Array.from({ length: max + 1 }, (_, item) => (
          <div
            key={item}
            role="option"
            aria-selected={item === value}
            className={`flex snap-center items-center justify-center text-base tabular-nums ${
              item === value ? 'font-bold text-slate-100' : 'text-slate-500'
            }`}
            style={{ height: ITEM_HEIGHT }}
          >
            {String(item).padStart(2, '0')}
          </div>
        ))}
        <div style={{ height: ITEM_HEIGHT }} aria-hidden="true" />
      </div>
      <button type="button" onClick={() => handleStep(1)} aria-label={`${ariaLabel}: uno más`} className={iconButton}>
        ▼
      </button>
    </div>
  )
}

interface MealTimePickerProps {
  mealType: MealType // la comida que se está editando: solo se muestra esta, no el resto del día
  resolvedTime: string // hora actual (elegida o tentativa)
  onAccept: (time: string) => void
}

// Selector de la hora de UNA comida, con su propia rueda de hora y minuto
export function MealTimePicker({ mealType, resolvedTime, onAccept }: MealTimePickerProps) {
  const [draft, setDraft] = useState(() => {
    const total = parseTimeToMinutes(resolvedTime) ?? 0
    return { hours: Math.floor(total / 60), minutes: total % 60 }
  })

  function handleAccept() {
    onAccept(formatMinutesToTime(draft.hours * 60 + draft.minutes))
  }

  return (
    <div className="flex flex-col gap-4">
      <div className="flex items-center justify-center gap-2">
        <TimeWheel
          value={draft.hours}
          max={23}
          onChange={(hours) => setDraft((current) => ({ ...current, hours }))}
          ariaLabel={`${MEAL_TYPE_LABELS[mealType]}: hora`}
        />
        <span className="text-lg text-slate-500">:</span>
        <TimeWheel
          value={draft.minutes}
          max={59}
          onChange={(minutes) => setDraft((current) => ({ ...current, minutes }))}
          ariaLabel={`${MEAL_TYPE_LABELS[mealType]}: minutos`}
        />
      </div>

      <button type="button" onClick={handleAccept} className={primaryButton}>
        Aceptar
      </button>
    </div>
  )
}

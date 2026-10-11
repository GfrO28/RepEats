import { useState } from 'react'
import type { MealType } from '@/domain/mealTypes'
import { MEAL_TYPE_LABELS } from '@/domain/mealTypes'
import { calculateMealTotals } from '@/domain/diary'
import type { DayTarget } from '@/domain/nutritionGoals'
import type { DiaryItem } from '@/repositories/DiaryRepository'
import { addButton } from '@/app/buttonStyles'
import { kcalText, proteinText, fatText, carbsText } from '@/app/macroStyles'
import { SwipeToDeleteRow } from '@/app/SwipeToDeleteRow'

interface MealSectionProps {
  type: MealType
  items: DiaryItem[]
  target: DayTarget | null // el reparto del objetivo del día para esta comida; null sin fase activa
  time: string | null // hora sugerida ("HH:mm"); null sin despertar/dormir configurados
  onAddItem: () => void
  onEditItem: (index: number) => void
  onRemoveItem: (index: number) => void
  onRemoveMeal: () => void
  onCopyFromDay: () => void
  onSaveAsMeal: () => void
}

const secondaryButton = 'rounded-full bg-slate-800 px-3 py-1 text-xs text-slate-300'
const round1 = (value: number) => Math.round(value * 10) / 10

// Qué fila está deslizada dentro de esta comida: la comida entera, un alimento por su posición, o ninguna
type OpenRow = 'meal' | number | null

export function MealSection({
  type,
  items,
  target,
  time,
  onAddItem,
  onEditItem,
  onRemoveItem,
  onRemoveMeal,
  onCopyFromDay,
  onSaveAsMeal,
}: MealSectionProps) {
  const label = MEAL_TYPE_LABELS[type]
  const totals = calculateMealTotals({ type, items })
  const [openRow, setOpenRow] = useState<OpenRow>(null)

  function handleRemoveMeal() {
    // Una comida vacía se quita sin preguntar (se puede volver a agregar); con alimentos, se confirma
    if (items.length === 0 || window.confirm(`Quitar "${label}" de este día eliminará sus ${items.length} alimento(s). ¿Continuar?`)) {
      onRemoveMeal()
    }
  }

  return (
    <SwipeToDeleteRow
      isOpen={openRow === 'meal'}
      onOpenChange={(open) => setOpenRow(open ? 'meal' : null)}
      onDelete={handleRemoveMeal}
      deleteLabel={`Quitar ${label} de este día`}
      showBorder={false}
      className="mt-4 rounded-xl"
    >
      <div className="rounded-xl bg-slate-900 p-4">
        <div>
          <p className="font-semibold">
            {label}
            {time && <span className="ml-2 font-normal text-slate-500">{time}</span>}
          </p>
          <p className="text-xs text-slate-500">
            <span className={kcalText}>
              {target ? `${Math.round(totals.kcal)} / ${Math.round(target.kcal)}` : Math.round(totals.kcal)} kcal
            </span>
            {target && (
              <>
                {' · '}
                <span className={proteinText}>
                  P {Math.round(totals.proteinG)}/{Math.round(target.macros.proteinG)}
                </span>
                {' · '}
                <span className={fatText}>
                  G {Math.round(totals.fatG)}/{Math.round(target.macros.fatG)}
                </span>
                {' · '}
                <span className={carbsText}>
                  C {Math.round(totals.carbsG)}/{Math.round(target.macros.carbsG)}
                </span>
              </>
            )}
          </p>
        </div>

        {items.map((item, index) => (
          <SwipeToDeleteRow
            key={index}
            isOpen={openRow === index}
            onOpenChange={(open) => setOpenRow(open ? index : null)}
            onDelete={() => onRemoveItem(index)}
            deleteLabel={`Quitar ${item.name}`}
            className="mt-2"
          >
            <button
              type="button"
              onClick={() => onEditItem(index)}
              className="flex w-full items-center justify-between py-2 text-left"
            >
              <div>
                <p className="text-sm">{item.name}</p>
                <p className="text-xs text-slate-500">
                  {item.grams !== null ? `${round1(item.grams)} g` : 'Registro rápido'}
                  {' · '}
                  <span className={kcalText}>{Math.round(item.nutrition.kcal)} kcal</span>
                  {' · '}
                  <span className={proteinText}>P {round1(item.nutrition.proteinG)}</span>
                  {' · '}
                  <span className={fatText}>G {round1(item.nutrition.fatG)}</span>
                  {' · '}
                  <span className={carbsText}>C {round1(item.nutrition.carbsG)}</span>
                </p>
              </div>
            </button>
          </SwipeToDeleteRow>
        ))}

        <button
          type="button"
          onClick={onAddItem}
          className={`${addButton} mt-3`}
        >
          + Agregar alimento
        </button>

        <div className="mt-2 flex flex-wrap gap-2">
          <button type="button" onClick={onCopyFromDay} className={secondaryButton}>
            Copiar de otro día
          </button>
          {items.length > 0 && (
            <button type="button" onClick={onSaveAsMeal} className={secondaryButton}>
              Guardar como comida
            </button>
          )}
        </div>
      </div>
    </SwipeToDeleteRow>
  )
}

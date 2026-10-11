import { useEffect, useId, useState } from 'react'
import { firebaseDiaryRepository } from '@/data/firestore/diaryRepository'
import type { DiaryDay } from '@/repositories/DiaryRepository'
import { MEAL_TYPE_LABELS, type MealType } from '@/domain/mealTypes'
import { getMealItems } from '@/domain/diary'
import { sumNutrition } from '@/domain/foodNutrition'
import { addDaysToLocalDate } from '@/domain/localDate'
import { chip, primaryButton } from '@/app/buttonStyles'

export type CopyScope = 'meal' | 'day'

interface CopyFromDayFormProps {
  targetDate: string // el día al que se copia
  mealType: MealType // la comida desde la que se abrió
  onCopy: (source: DiaryDay, scope: CopyScope) => void
}


const isDateString = (value: string) => /^\d{4}-\d{2}-\d{2}$/.test(value)

export function CopyFromDayForm({ targetDate, mealType, onCopy }: CopyFromDayFormProps) {
  const fieldId = useId()
  const [sourceDate, setSourceDate] = useState(() => addDaysToLocalDate(targetDate, -1)) // por defecto, ayer
  const [scope, setScope] = useState<CopyScope>('meal')
  // Se guarda junto con su fecha para no mostrar por un instante los datos del día anterior
  const [source, setSource] = useState<{ date: string; day: DiaryDay | null } | null>(null)

  const isSourceValid = isDateString(sourceDate) && sourceDate !== targetDate

  useEffect(() => {
    if (!isSourceValid) return
    return firebaseDiaryRepository.subscribeDay(sourceDate, (day) => setSource({ date: sourceDate, day }))
  }, [sourceDate, isSourceValid])

  const isLoaded = isSourceValid && source !== null && source.date === sourceDate
  const sourceDay = isLoaded ? source.day : null

  const items =
    scope === 'meal' ? getMealItems(sourceDay, mealType) : (sourceDay?.meals ?? []).flatMap((meal) => meal.items)
  const totals = sumNutrition(items.map((item) => item.nutrition))

  return (
    <div className="flex flex-col gap-4">
      <div className="flex flex-col">
        <label htmlFor={`${fieldId}-1`} className="text-xs text-slate-500">Copiar desde el día</label>
        <input id={`${fieldId}-1`}
          type="date"
          value={sourceDate}
          onChange={(e) => setSourceDate(e.target.value)}
          className="w-full rounded bg-slate-800 px-3 py-2 text-sm"
        />
        {isDateString(sourceDate) && sourceDate === targetDate && (
          <p className="mt-1 text-xs text-amber-400">Elige un día distinto al actual.</p>
        )}
      </div>

      <div className="flex gap-2">
        <button type="button" onClick={() => setScope('meal')} className={chip(scope === 'meal')}>
          Solo {MEAL_TYPE_LABELS[mealType]}
        </button>
        <button type="button" onClick={() => setScope('day')} className={chip(scope === 'day')}>
          Todo el día
        </button>
      </div>

      {isSourceValid && !isLoaded && <p className="text-sm text-slate-500">Cargando…</p>}

      {isLoaded && items.length === 0 && (
        <p className="text-sm text-slate-500">
          {scope === 'meal' ? `Ese día no registraste ${MEAL_TYPE_LABELS[mealType]}.` : 'Ese día no tiene registros.'}
        </p>
      )}

      {items.length > 0 && (
        <div className="rounded-xl bg-slate-800 p-3">
          {items.map((item, index) => (
            <div key={index} className="flex items-center justify-between py-1 text-sm">
              <span>{item.name}</span>
              <span className="text-xs text-slate-500">
                {item.grams !== null ? `${Math.round(item.grams * 10) / 10} g · ` : ''}
                {Math.round(item.nutrition.kcal)} kcal
              </span>
            </div>
          ))}
          <p className="mt-2 border-t border-slate-700 pt-2 text-xs text-slate-400">
            {items.length} alimento(s) · {Math.round(totals.kcal)} kcal
          </p>
        </div>
      )}

      <button
        type="button"
        onClick={() => sourceDay && onCopy(sourceDay, scope)}
        disabled={items.length === 0}
        className={primaryButton}
      >
        {items.length > 0 ? `Copiar ${items.length} alimento(s)` : 'Copiar'}
      </button>
    </div>
  )
}

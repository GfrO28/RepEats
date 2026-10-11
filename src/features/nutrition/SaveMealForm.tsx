import { useId, useState, type FormEvent, type KeyboardEvent } from 'react'
import type { DiaryItem } from '@/repositories/DiaryRepository'
import type { SavedMeal } from '@/repositories/SavedMealRepository'
import { sumNutrition } from '@/domain/foodNutrition'
import { resizeDiaryItem } from '@/domain/diary'
import { isPositiveNumber } from '@/domain/inputValidation'
import { primaryButton, iconButton } from '@/app/buttonStyles'
import { SwipeToDeleteRow } from '@/app/SwipeToDeleteRow'

interface SaveMealFormProps {
  items: DiaryItem[] // ítems iniciales: los de la comida actual del diario, o los que ya tenía la comida a editar
  mealToEdit?: SavedMeal | null // si viene, precarga el nombre y el botón dice "Guardar cambios"
  onSave: (name: string, items: DiaryItem[]) => void
}

export function SaveMealForm({ items: initialItems, mealToEdit = null, onSave }: SaveMealFormProps) {
  const fieldId = useId()
  const [name, setName] = useState(mealToEdit?.name ?? '')
  const [items, setItems] = useState(initialItems)
  const [openSwipeIndex, setOpenSwipeIndex] = useState<number | null>(null)
  const [editingIndex, setEditingIndex] = useState<number | null>(null)
  const [editAmount, setEditAmount] = useState('')
  const totals = sumNutrition(items.map((item) => item.nutrition))
  const isValid = name.trim() !== '' && items.length > 0
  const isEditAmountValid = isPositiveNumber(editAmount)

  function handleSubmit(event: FormEvent) {
    event.preventDefault()
    if (isValid) onSave(name, items)
  }

  function startEditingAmount(index: number, grams: number) {
    setEditingIndex(index)
    setEditAmount(String(grams))
  }

  function confirmEditingAmount() {
    if (editingIndex === null || !isEditAmountValid) return
    setItems((current) => current.map((item, i) => (i === editingIndex ? resizeDiaryItem(item, Number(editAmount)) : item)))
    setEditingIndex(null)
  }

  function handleAmountKeyDown(event: KeyboardEvent<HTMLInputElement>) {
    if (event.key !== 'Enter') return
    event.preventDefault()
    confirmEditingAmount()
  }

  return (
    <form onSubmit={handleSubmit} className="flex flex-col gap-4">
      <div className="flex flex-col">
        <label htmlFor={`${fieldId}-1`} className="text-xs text-slate-500">Nombre de la comida</label>
        <input id={`${fieldId}-1`}
          value={name}
          onChange={(e) => setName(e.target.value)}
          placeholder="Ej.: Mi desayuno de siempre"
          className="w-full rounded bg-slate-800 px-3 py-2 text-sm"
        />
      </div>

      <div className="rounded-xl bg-slate-800 p-3">
        {items.map((item, index) => (
          <SwipeToDeleteRow
            key={index}
            isOpen={openSwipeIndex === index}
            onOpenChange={(open) => setOpenSwipeIndex(open ? index : null)}
            onDelete={() => {
              setItems((current) => current.filter((_, i) => i !== index))
              if (editingIndex === index) setEditingIndex(null)
            }}
            deleteLabel={`Quitar ${item.name}`}
            showBorder={false}
          >
            {editingIndex === index ? (
              <div className="flex items-center gap-2 py-1">
                <span className="flex-1 text-sm">{item.name}</span>
                <input
                  type="number"
                  step="0.5"
                  value={editAmount}
                  onChange={(e) => setEditAmount(e.target.value)}
                  onKeyDown={handleAmountKeyDown}
                  aria-label={`Cantidad (g) de ${item.name}`}
                  className="w-16 rounded bg-slate-700 px-2 py-1 text-center text-sm"
                  autoFocus
                />
                <button
                  type="button"
                  onClick={confirmEditingAmount}
                  disabled={!isEditAmountValid}
                  aria-label={`Confirmar cantidad de ${item.name}`}
                  className={`${iconButton} disabled:opacity-40`}
                >
                  ✓
                </button>
                <button
                  type="button"
                  onClick={() => setEditingIndex(null)}
                  aria-label={`Cancelar edición de ${item.name}`}
                  className={iconButton}
                >
                  ✕
                </button>
              </div>
            ) : item.grams !== null ? (
              <button
                type="button"
                onClick={() => startEditingAmount(index, item.grams as number)}
                className="flex w-full items-center justify-between py-1 text-left text-sm"
              >
                <span>{item.name}</span>
                <span className="text-xs text-slate-500">
                  {Math.round(item.grams * 10) / 10} g · {Math.round(item.nutrition.kcal)} kcal
                </span>
              </button>
            ) : (
              <div className="flex items-center justify-between py-1 text-sm">
                <span>{item.name}</span>
                <span className="text-xs text-slate-500">{Math.round(item.nutrition.kcal)} kcal</span>
              </div>
            )}
          </SwipeToDeleteRow>
        ))}
        {items.length === 0 && <p className="py-1 text-sm text-slate-500">Sin alimentos: agrega al menos uno.</p>}
        <p className="mt-2 border-t border-slate-700 pt-2 text-xs text-slate-400">
          {items.length} alimento(s) · {Math.round(totals.kcal)} kcal
        </p>
      </div>
      <p className="text-xs text-slate-500">
        Toca un alimento para cambiar su cantidad, o deslízalo a la izquierda para quitarlo de esta comida guardada
        (nada de esto afecta lo ya registrado en el diario). Al usarla en otro día se agrega alimento por alimento, y
        ahí también puedes ajustarlos o quitar los que no quieras.
      </p>

      <button
        type="submit"
        disabled={!isValid}
        className={primaryButton}
      >
        {mealToEdit ? 'Guardar cambios' : 'Guardar comida'}
      </button>
    </form>
  )
}

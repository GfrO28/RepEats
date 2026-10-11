import { useState } from 'react'
import type { SavedMeal } from '@/repositories/SavedMealRepository'
import { calculateSavedMealTotals, sortSavedMeals } from '@/domain/savedMeals'
import { SwipeToDeleteRow } from '@/app/SwipeToDeleteRow'
import { iconButton } from '@/app/buttonStyles'

interface SavedMealsListProps {
  savedMeals: SavedMeal[]
  onUse: (meal: SavedMeal) => void
  onEdit: (meal: SavedMeal) => void
  onDelete: (meal: SavedMeal) => void
}

export function SavedMealsList({ savedMeals, onUse, onEdit, onDelete }: SavedMealsListProps) {
  const [openSwipeId, setOpenSwipeId] = useState<string | null>(null) // solo una fila deslizada a la vez

  if (savedMeals.length === 0) {
    return (
      <p className="text-sm text-slate-500">
        Aún no tienes comidas guardadas. Registra una comida y pulsa &quot;Guardar como comida&quot; para reutilizarla.
      </p>
    )
  }

  return (
    <div>
      {sortSavedMeals(savedMeals).map((meal) => (
        <SwipeToDeleteRow
          key={meal.id}
          isOpen={openSwipeId === meal.id}
          onOpenChange={(open) => setOpenSwipeId(open ? meal.id : null)}
          onDelete={() => {
            onDelete(meal)
            setOpenSwipeId(null)
          }}
          deleteLabel={`Eliminar ${meal.name}`}
        >
          <div className="flex items-center gap-1">
            <button type="button" onClick={() => onUse(meal)} className="min-w-0 flex-1 py-3 text-left">
              <p className="text-sm font-medium">{meal.name}</p>
              <p className="text-xs text-slate-500">
                {meal.items.length} alimento(s) · {Math.round(calculateSavedMealTotals(meal).kcal)} kcal
              </p>
              <p className="truncate text-xs text-slate-600">{meal.items.map((item) => item.name).join(', ')}</p>
            </button>
            <button
              type="button"
              onClick={() => onEdit(meal)}
              aria-label={`Editar ${meal.name}`}
              className={iconButton}
            >
              ✏️
            </button>
          </div>
        </SwipeToDeleteRow>
      ))}
    </div>
  )
}

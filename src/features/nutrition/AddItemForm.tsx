import { useId, useState } from 'react'
import type { Food } from '@/repositories/FoodRepository'
import type { DiaryItem } from '@/repositories/DiaryRepository'
import type { SavedMeal } from '@/repositories/SavedMealRepository'
import { MEAL_TYPE_LABELS, type MealType } from '@/domain/mealTypes'
import { calculatePortionNutrition } from '@/domain/foodNutrition'
import { createItemFromFood } from '@/domain/diary'
import { isPositiveNumber } from '@/domain/inputValidation'
import { searchFoods, getFavoriteFoods, getFrequentFoods, getRecipeFoods, MAX_LIST_RESULTS } from '@/domain/foodPicker'
import { firebaseFoodRepository } from '@/data/firestore/foodRepository'
import { FavoriteStar } from './FavoriteStar'
import { RecipeBadge } from './RecipeBadge'
import { SavedMealsList } from './SavedMealsList'
import { ScanFoodFlow } from './ScanFoodFlow'
import { chip, linkButton, primaryButton } from '@/app/buttonStyles'
import { proteinText, fatText, carbsText } from '@/app/macroStyles'

type Mode = 'food' | 'scan'
type Measure = 'grams' | 'units'
// Categorías para no tener que escribir siempre: qué mostrar cuando el buscador está vacío. "saved" (comidas
// guardadas) solo aparece si el que llama pasa `savedMeals` (no tiene sentido al editar un ítem ya registrado).
type Category = 'favorites' | 'frequent' | 'saved' | 'recipes' | 'all'

const CATEGORY_LABELS: Record<Category, string> = {
  favorites: 'Favoritos',
  frequent: 'Frecuentes',
  saved: 'Guardados',
  recipes: 'Recetas',
  all: 'Todos',
}

interface AddItemFormProps {
  foods: Food[]
  mealType: MealType // para qué comida es (Desayuno, Almuerzo...): decide qué cuenta como "Frecuentes" ahí
  mealTime?: string | null // hora resuelta (elegida o tentativa) de esa comida hoy; junto con onEditMealTime, muestra el chip para cambiarla
  onEditMealTime?: () => void
  savedMeals?: SavedMeal[] // habilita la categoría "Guardados"; sin esto, no se ofrece
  itemToEdit?: DiaryItem | null // si viene, precarga su alimento y cantidad, y el botón dice "Guardar cambios"
  onAdd: (item: DiaryItem) => void
  onUseSavedMeal?: (meal: SavedMeal) => void // requerido junto con savedMeals para usar una comida guardada
  onEditSavedMeal?: (meal: SavedMeal) => void
  onDeleteSavedMeal?: (meal: SavedMeal) => void
}

const inputClass = 'w-full rounded bg-slate-800 px-3 py-2 text-sm'

// Fila del selector: al tocar el nombre se elige el alimento; la estrella lo marca como favorito
function FoodPickRow({ food, onSelect }: { food: Food; onSelect: (food: Food) => void }) {
  return (
    <div className="flex items-center border-b border-slate-800">
      <button type="button" onClick={() => onSelect(food)} className="flex flex-1 items-center justify-between py-2 text-left">
        <span className="text-sm">
          {food.name}
          <RecipeBadge food={food} />
          {food.brand && <span className="ml-1 text-xs text-slate-400">· {food.brand}</span>}
        </span>
        <span className="text-xs text-slate-500">{Math.round(food.per100g.kcal)} kcal / 100 g</span>
      </button>
      <FavoriteStar food={food} />
    </div>
  )
}

export function AddItemForm({
  foods,
  mealType,
  mealTime = null,
  onEditMealTime,
  savedMeals,
  itemToEdit = null,
  onAdd,
  onUseSavedMeal,
  onEditSavedMeal,
  onDeleteSavedMeal,
}: AddItemFormProps) {
  const fieldId = useId()
  // Al editar un ítem cuyo alimento ya no existe (se borró de la biblioteca), no hay con qué precargar: se abre
  // en blanco, como si fuera nuevo, para elegir de nuevo (o crearlo en la pestaña Alimentos).
  const editingFood = itemToEdit?.foodId ? (foods.find((food) => food.id === itemToEdit.foodId) ?? null) : null
  const [mode, setMode] = useState<Mode>('food')

  const [search, setSearch] = useState('')
  const [selectedFood, setSelectedFood] = useState<Food | null>(editingFood)
  const [measure, setMeasure] = useState<Measure>('grams')
  const [amount, setAmount] = useState(editingFood && itemToEdit?.grams != null ? String(itemToEdit.grams) : '')

  const favoriteFoods = getFavoriteFoods(foods)
  const frequentFoods = getFrequentFoods(foods, mealType)
  const recipeFoods = getRecipeFoods(foods)
  const allFoodsSorted = [...foods].sort((a, b) => a.name.localeCompare(b.name))
  const canUseSaved = savedMeals !== undefined && onUseSavedMeal !== undefined

  const categories: Category[] = canUseSaved
    ? ['favorites', 'frequent', 'saved', 'recipes', 'all']
    : ['favorites', 'frequent', 'recipes', 'all']
  const [category, setCategory] = useState<Category>('favorites')

  const categoryFoods: Record<Exclude<Category, 'saved'>, Food[]> = {
    favorites: favoriteFoods,
    frequent: frequentFoods,
    recipes: recipeFoods,
    all: allFoodsSorted,
  }

  // Sin texto: la categoría elegida. Con texto: resultados de toda la biblioteca (favoritos y más usados primero), limitados
  const isSearching = search.trim() !== ''
  const matchingFoods = isSearching ? searchFoods(foods, search) : []
  const visibleFoods = matchingFoods.slice(0, MAX_LIST_RESULTS)
  const browsedFoods = category === 'saved' ? [] : categoryFoods[category]
  const visibleBrowsedFoods = browsedFoods.slice(0, MAX_LIST_RESULTS)

  function selectFood(food: Food) {
    setSelectedFood(food)
    // Con unidad se propone 1 unidad; sin unidad, 100 g
    setMeasure(food.unit ? 'units' : 'grams')
    setAmount(food.unit ? '1' : '100')
  }

  // La cantidad siempre se convierte a gramos: es lo que se guarda y con lo que se calcula
  const gramsPerStep = measure === 'units' && selectedFood?.unit ? selectedFood.unit.grams : 1
  const grams = Number(amount) * gramsPerStep
  const isAmountValid = isPositiveNumber(amount)
  const preview = selectedFood && isAmountValid ? calculatePortionNutrition(selectedFood.per100g, grams) : null

  function handleAddFood() {
    if (!selectedFood || !isAmountValid) return
    onAdd(createItemFromFood(selectedFood, grams))
    firebaseFoodRepository.markUsed(selectedFood.id, mealType) // alimenta "Frecuentes" (de esta comida) y el orden de la búsqueda
  }

  const submitLabel = itemToEdit ? 'Guardar cambios' : 'Agregar'

  return (
    <div className="flex flex-col gap-4">
      {mealTime && onEditMealTime && (
        <button type="button" onClick={onEditMealTime} className={`${chip(false)} self-start`}>
          {MEAL_TYPE_LABELS[mealType]} {mealTime} ▾
        </button>
      )}

      <div className="flex gap-2">
        <button type="button" onClick={() => setMode('food')} className={chip(mode === 'food')}>
          Alimento
        </button>
        <button type="button" onClick={() => setMode('scan')} className={chip(mode === 'scan')}>
          Escanear
        </button>
      </div>

      {mode === 'scan' && (
        <ScanFoodFlow
          foods={foods}
          onResolved={(food) => {
            selectFood(food)
            setMode('food')
          }}
        />
      )}

      {mode === 'food' && !selectedFood && (
        <div>
          <input
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="Buscar alimento"
            aria-label="Buscar alimento"
            className={inputClass}
          />
          {foods.length === 0 && (
            <p className="mt-3 text-sm text-slate-500">Aún no tienes alimentos. Créalos en la pestaña Alimentos.</p>
          )}

          {isSearching && (
            <>
              {matchingFoods.length === 0 && <p className="mt-3 text-sm text-slate-500">Sin resultados</p>}
              {visibleFoods.map((food) => (
                <FoodPickRow key={food.id} food={food} onSelect={selectFood} />
              ))}
              {matchingFoods.length > visibleFoods.length && (
                <p className="mt-2 text-xs text-slate-500">
                  Mostrando {visibleFoods.length} de {matchingFoods.length}. Escribe más para afinar.
                </p>
              )}
            </>
          )}

          {!isSearching && foods.length > 0 && (
            <div className="mt-3 flex gap-2">
              {/* Barra vertical de categorías (a la izquierda): a diferencia de los filtros en fila que usa el
                  resto de la app, aquí no compite por el mismo ancho que la lista de resultados, y con 5
                  categorías de nombre largo no se rompe en varias líneas como pasaría en una fila horizontal. */}
              <div role="tablist" aria-label="Categoría" className="flex w-20 shrink-0 flex-col gap-1">
                {categories.map((option) => (
                  <button
                    key={option}
                    type="button"
                    role="tab"
                    onClick={() => setCategory(option)}
                    aria-selected={category === option}
                    className={`rounded-lg px-2 py-2 text-center text-xs leading-tight ${
                      category === option ? 'bg-primary font-semibold text-slate-950' : 'bg-slate-800 text-slate-300'
                    }`}
                  >
                    {CATEGORY_LABELS[option]}
                  </button>
                ))}
              </div>

              <div className="min-w-0 flex-1">
                {category === 'saved' ? (
                  <SavedMealsList
                    savedMeals={savedMeals ?? []}
                    onUse={(meal) => onUseSavedMeal?.(meal)}
                    onEdit={(meal) => onEditSavedMeal?.(meal)}
                    onDelete={(meal) => onDeleteSavedMeal?.(meal)}
                  />
                ) : (
                  <>
                    {browsedFoods.length === 0 && (
                      <p className="text-sm text-slate-500">
                        {category === 'favorites' && 'Marca con ☆ los alimentos que más uses y aparecerán aquí.'}
                        {category === 'frequent' && 'Todavía no registraste ninguno lo bastante seguido.'}
                        {category === 'recipes' && 'Aún no tienes recetas guardadas.'}
                        {category === 'all' && 'Aún no tienes alimentos.'}
                      </p>
                    )}
                    {visibleBrowsedFoods.map((food) => (
                      <FoodPickRow key={food.id} food={food} onSelect={selectFood} />
                    ))}
                    {browsedFoods.length > visibleBrowsedFoods.length && (
                      <p className="mt-2 text-xs text-slate-500">
                        Mostrando {visibleBrowsedFoods.length} de {browsedFoods.length}. Escribe para buscar en todos.
                      </p>
                    )}
                  </>
                )}
              </div>
            </div>
          )}
        </div>
      )}

      {mode === 'food' && selectedFood && (
        <div className="flex flex-col gap-3">
          <div className="flex items-center justify-between">
            <p className="font-medium">{selectedFood.name}</p>
            <button type="button" onClick={() => setSelectedFood(null)} className={linkButton}>
              Cambiar
            </button>
          </div>

          {selectedFood.unit && (
            <div className="flex gap-2">
              <button
                type="button"
                onClick={() => {
                  setMeasure('units')
                  setAmount('1')
                }}
                className={chip(measure === 'units')}
              >
                {selectedFood.unit.label} ({selectedFood.unit.grams} g)
              </button>
              <button
                type="button"
                onClick={() => {
                  setMeasure('grams')
                  setAmount('100')
                }}
                className={chip(measure === 'grams')}
              >
                Gramos
              </button>
            </div>
          )}

          <div className="flex flex-col">
            <label htmlFor={`${fieldId}-1`} className="text-xs text-slate-500">
              {measure === 'units' && selectedFood.unit ? `Cantidad de ${selectedFood.unit.label}` : 'Cantidad (g)'}
            </label>
            <input id={`${fieldId}-1`}
              type="number"
              step="0.5"
              value={amount}
              onChange={(e) => setAmount(e.target.value)}
              className={inputClass}
            />
          </div>

          {preview && (
            <div className="rounded-xl bg-slate-800 p-3">
              <p className="text-xl font-bold">{Math.round(preview.kcal)} kcal</p>
              <p className="text-xs text-slate-400">
                <span className={proteinText}>Proteína {Math.round(preview.proteinG * 10) / 10} g</span>
                {' · '}
                <span className={fatText}>Grasa {Math.round(preview.fatG * 10) / 10} g</span>
                {' · '}
                <span className={carbsText}>Carbohidratos {Math.round(preview.carbsG * 10) / 10} g</span>
              </p>
              {measure === 'units' && <p className="mt-1 text-xs text-slate-500">Equivale a {Math.round(grams * 10) / 10} g</p>}
            </div>
          )}

          <button
            type="button"
            onClick={handleAddFood}
            disabled={!isAmountValid}
            className={primaryButton}
          >
            {submitLabel}
          </button>
        </div>
      )}
    </div>
  )
}

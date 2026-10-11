import { useEffect, useState } from 'react'
import { firebaseFoodRepository } from '@/data/firestore/foodRepository'
import type { Food } from '@/repositories/FoodRepository'
import { Modal } from '@/app/Modal'
import { FoodForm } from './FoodForm'
import { FoodImportForm } from './FoodImportForm'
import { FavoriteStar } from './FavoriteStar'
import { RecipeBadge } from './RecipeBadge'
import { RecipeForm } from './RecipeForm'
import { ScanFoodFlow } from './ScanFoodFlow'
import { searchFoods, MAX_LIST_RESULTS } from '@/domain/foodPicker'
import { fabButton, primaryButton, secondaryButton } from '@/app/buttonStyles'
import { kcalText, proteinText, fatText, carbsText } from '@/app/macroStyles'
import { SwipeToDeleteRow } from '@/app/SwipeToDeleteRow'

export function FoodLibraryPage() {
  const [foods, setFoods] = useState<Food[]>([])
  const [editingFood, setEditingFood] = useState<Food | null>(null)
  const [isCreating, setIsCreating] = useState(false)
  const [isCreatingRecipe, setIsCreatingRecipe] = useState(false)
  const [search, setSearch] = useState('')
  const [isImportOpen, setIsImportOpen] = useState(false)
  const [isScanOpen, setIsScanOpen] = useState(false)
  const [openSwipeId, setOpenSwipeId] = useState<string | null>(null) // solo una fila deslizada a la vez

  useEffect(() => {
    const unsubscribe = firebaseFoodRepository.subscribeFoods(setFoods)
    return unsubscribe
  }, [])

  // Editar una receta abre el formulario de recetas; cualquier otro alimento, el de alimentos
  const editingRecipe = editingFood?.recipe ? editingFood : null
  const isFoodFormOpen = isCreating || (editingFood !== null && editingRecipe === null)
  const isRecipeFormOpen = isCreatingRecipe || editingRecipe !== null

  function closeForm() {
    setIsCreating(false)
    setIsCreatingRecipe(false)
    setEditingFood(null)
  }

  // Favoritos primero, luego los más usados; con miles de alimentos solo se pintan los primeros
  const matchingFoods = searchFoods(foods, search)
  const visibleFoods = matchingFoods.slice(0, MAX_LIST_RESULTS)

  function handleDelete(food: Food) {
    if (window.confirm(`¿Eliminar el alimento "${food.name}"?`)) {
      firebaseFoodRepository.deleteFood(food.id)
    }
  }

  return (
    <section className="px-4 py-6">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <h1 className="text-xl font-semibold">
          Alimentos
          {foods.length > 0 && <span className="ml-2 text-sm font-normal text-slate-500">({foods.length})</span>}
        </h1>
        <div className="flex gap-2">
          <button
            type="button"
            onClick={() => setIsCreatingRecipe(true)}
            className={primaryButton}
          >
            Nueva receta
          </button>
          <button
            type="button"
            onClick={() => setIsImportOpen(true)}
            className={secondaryButton}
          >
            Importar JSON
          </button>
        </div>
      </div>

      <div className="mt-3 flex gap-2">
        <input
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          placeholder="Buscar alimento"
          aria-label="Buscar alimento"
          className="w-full rounded bg-slate-800 px-3 py-2 text-sm"
        />
        <button
          type="button"
          onClick={() => setIsScanOpen(true)}
          className={`${secondaryButton} shrink-0`}
        >
          📷 Escanear
        </button>
      </div>

      {foods.length === 0 && <p className="mt-4">Aún no tienes alimentos</p>}
      {foods.length > 0 && matchingFoods.length === 0 && <p className="mt-4 text-sm text-slate-500">Sin resultados</p>}

      {visibleFoods.map((food) => (
        <SwipeToDeleteRow
          key={food.id}
          isOpen={openSwipeId === food.id}
          onOpenChange={(open) => setOpenSwipeId(open ? food.id : null)}
          onDelete={() => {
            handleDelete(food)
            setOpenSwipeId(null)
          }}
          deleteLabel={`Eliminar ${food.name}`}
        >
          <div className="flex items-center gap-1 py-2">
            <button
              type="button"
              onClick={() => setEditingFood(food)}
              aria-label={`Editar ${food.name}`}
              className="min-w-0 flex-1 text-left"
            >
              <p className="font-medium">
                {food.name}
                <RecipeBadge food={food} />
              </p>
              {food.brand && <p className="text-xs text-slate-400">{food.brand}</p>}
              <p className="text-xs text-slate-500">
                <span className={kcalText}>{Math.round(food.per100g.kcal)} kcal</span>
                {' · '}
                <span className={proteinText}>P {food.per100g.proteinG}</span>
                {' · '}
                <span className={fatText}>G {food.per100g.fatG}</span>
                {' · '}
                <span className={carbsText}>C {food.per100g.carbsG}</span> (por 100 g)
              </p>
              {food.unit && (
                <p className="text-xs text-slate-500">
                  1 {food.unit.label} = {food.unit.grams} g
                </p>
              )}
            </button>
            <FavoriteStar food={food} />
          </div>
        </SwipeToDeleteRow>
      ))}

      {matchingFoods.length > visibleFoods.length && (
        <p className="mt-3 text-xs text-slate-500">
          Mostrando {visibleFoods.length} de {matchingFoods.length}. Escribe en el buscador para encontrar el resto.
        </p>
      )}

      <button
        type="button"
        onClick={() => setIsCreating(true)}
        aria-label="Nuevo alimento"
        className={fabButton}
      >
        +
      </button>

      <Modal isOpen={isScanOpen} onClose={() => setIsScanOpen(false)} title="Escanear producto">
        {/* Se desmonta al cerrar, así la cámara se apaga */}
        {isScanOpen && (
          <ScanFoodFlow
            foods={foods}
            onResolved={(food, alreadySaved) => {
              setIsScanOpen(false)
              // Uno que ya tenías se abre para revisarlo; uno nuevo ya quedó guardado
              if (alreadySaved) setEditingFood(food)
            }}
          />
        )}
      </Modal>

      <Modal isOpen={isImportOpen} onClose={() => setIsImportOpen(false)} title="Importar alimentos">
        <FoodImportForm existingFoods={foods} onDone={() => setIsImportOpen(false)} />
      </Modal>

      <Modal isOpen={isFoodFormOpen} onClose={closeForm} title={editingFood ? 'Editar alimento' : 'Nuevo alimento'}>
        <FoodForm key={editingFood?.id ?? 'new'} foods={foods} foodToEdit={editingFood} onDone={closeForm} />
      </Modal>

      <Modal isOpen={isRecipeFormOpen} onClose={closeForm} title={editingRecipe ? 'Editar receta' : 'Nueva receta'}>
        <RecipeForm key={editingRecipe?.id ?? 'new'} foods={foods} recipeToEdit={editingRecipe} onDone={closeForm} />
      </Modal>
    </section>
  )
}

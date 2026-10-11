import { useId, useState, type FormEvent } from 'react'
import { firebaseFoodRepository } from '@/data/firestore/foodRepository'
import type { Food } from '@/repositories/FoodRepository'
import { normalizeFoodName } from '@/domain/foodImport'
import { isPositiveNumber } from '@/domain/inputValidation'
import {
  calculateRecipe,
  createRecipeFood,
  isRecipeWeightPlausible,
  linesFromRecipe,
  searchIngredients,
  type RecipeLine,
} from '@/domain/recipe'
import { dangerIconButton, primaryButton } from '@/app/buttonStyles'
import { proteinText, fatText, carbsText } from '@/app/macroStyles'

const MAX_INGREDIENT_RESULTS = 6

// Un ingrediente mientras se edita: los gramos son texto, igual que el resto de formularios
type EditableLine = Omit<RecipeLine, 'grams'> & { grams: string }

interface RecipeFormProps {
  foods: Food[] // para buscar ingredientes y avisar de nombres repetidos
  recipeToEdit: Food | null
  onDone: () => void
}

const inputClass = 'w-full rounded bg-slate-800 px-3 py-2 text-sm'
const round1 = (value: number) => Math.round(value * 10) / 10

export function RecipeForm({ foods, recipeToEdit, onDone }: RecipeFormProps) {
  const fieldId = useId()
  const [name, setName] = useState(recipeToEdit?.name ?? '')
  const [lines, setLines] = useState<EditableLine[]>(
    recipeToEdit?.recipe ? linesFromRecipe(recipeToEdit.recipe).map((line) => ({ ...line, grams: String(line.grams) })) : [],
  )
  const [search, setSearch] = useState('')
  const [cookedInput, setCookedInput] = useState(recipeToEdit?.recipe ? String(recipeToEdit.recipe.cookedGrams) : '')
  const [servingsInput, setServingsInput] = useState(
    recipeToEdit?.recipe?.servings ? String(recipeToEdit.recipe.servings) : '',
  )

  // Sin platos de restaurante (ya son un plato terminado) ni la propia receta
  const ingredientMatches =
    search.trim() === '' ? [] : searchIngredients(foods, search, recipeToEdit?.id ?? null).slice(0, MAX_INGREDIENT_RESULTS)

  function addIngredient(food: Food) {
    setLines([...lines, { foodId: food.id, name: food.name, per100g: food.per100g, grams: '100' }])
    setSearch('')
  }

  function updateGrams(index: number, grams: string) {
    setLines(lines.map((line, i) => (i === index ? { ...line, grams } : line)))
  }

  function removeIngredient(index: number) {
    setLines(lines.filter((_, i) => i !== index))
  }

  // Todo lo que se muestra se deriva en cada render
  const recipeLines: RecipeLine[] = lines.map((line) => ({ ...line, grams: Number(line.grams) || 0 }))
  const rawGrams = recipeLines.reduce((sum, line) => sum + line.grams, 0)
  const cookedGrams = cookedInput.trim() === '' ? rawGrams : Number(cookedInput) // sin dato: el peso no cambia al cocinar
  const servings = servingsInput.trim() === '' ? null : Number(servingsInput)
  const summary = calculateRecipe(recipeLines, cookedGrams, servings)

  const areGramsValid = lines.length > 0 && lines.every((line) => isPositiveNumber(line.grams))
  const isCookedValid = cookedInput.trim() === '' || isPositiveNumber(cookedInput)
  const areServingsValid = servingsInput.trim() === '' || isPositiveNumber(servingsInput)
  const isWeightPlausible = isRecipeWeightPlausible(summary.total, cookedGrams)

  const isNameTaken =
    name.trim() !== '' &&
    foods.some((food) => food.id !== recipeToEdit?.id && normalizeFoodName(food.name) === normalizeFoodName(name))

  const isValid =
    name.trim() !== '' && areGramsValid && isCookedValid && cookedGrams > 0 && areServingsValid && isWeightPlausible

  function handleSubmit(event: FormEvent) {
    event.preventDefault()
    if (!isValid) return

    const food = createRecipeFood({
      id: recipeToEdit?.id ?? firebaseFoodRepository.generateFoodId(),
      name,
      lines: recipeLines,
      cookedGrams,
      servings,
      previous: recipeToEdit,
    })

    if (recipeToEdit) {
      firebaseFoodRepository.updateFood(food)
    } else {
      firebaseFoodRepository.addFood(food)
    }
    onDone()
  }

  return (
    <form onSubmit={handleSubmit} className="flex flex-col gap-4">
      <div className="flex flex-col">
        <label htmlFor={`${fieldId}-1`} className="text-xs text-slate-500">Nombre de la receta</label>
        <input id={`${fieldId}-1`}
          value={name}
          onChange={(e) => setName(e.target.value)}
          placeholder="Ej.: Lentejas guisadas"
          className={inputClass}
        />
        {isNameTaken && (
          <p className="mt-1 text-xs text-amber-400">Ya tienes un alimento con este nombre. Puedes guardarla igual.</p>
        )}
      </div>

      <div>
        <p className="text-xs uppercase text-slate-500">Ingredientes</p>
        {lines.length === 0 && <p className="mt-1 text-xs text-slate-500">Busca y agrega los ingredientes con su peso.</p>}
        {lines.map((line, index) => (
          <div key={index} className="flex items-center gap-2 border-b border-slate-800 py-2">
            <div className="min-w-0 flex-1">
              <p className="truncate text-sm">{line.name}</p>
              <p className="text-xs text-slate-500">{Math.round(line.per100g.kcal)} kcal / 100 g</p>
            </div>
            <input
              type="number"
              inputMode="decimal"
              value={line.grams}
              onChange={(e) => updateGrams(index, e.target.value)}
              aria-label={`Gramos de ${line.name}`}
              className="w-20 rounded bg-slate-800 px-2 py-2 text-right text-sm"
            />
            <span className="text-xs text-slate-500">g</span>
            <button type="button" onClick={() => removeIngredient(index)} aria-label={`Quitar ${line.name}`} className={dangerIconButton}>
              ✕
            </button>
          </div>
        ))}

        <input
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          placeholder="Buscar ingrediente"
          aria-label="Buscar ingrediente"
          className={`${inputClass} mt-3`}
        />
        {ingredientMatches.map((food) => (
          <button
            key={food.id}
            type="button"
            onClick={() => addIngredient(food)}
            className="flex w-full items-center justify-between border-b border-slate-800 py-2 text-left"
          >
            <span className="text-sm">{food.name}</span>
            <span className="text-xs text-slate-500">{Math.round(food.per100g.kcal)} kcal / 100 g</span>
          </button>
        ))}
        {search.trim() !== '' && ingredientMatches.length === 0 && <p className="mt-2 text-xs text-slate-500">Sin resultados</p>}
      </div>

      <div className="grid grid-cols-2 gap-3">
        <div className="flex flex-col">
          <label htmlFor={`${fieldId}-2`} className="text-xs text-slate-500">Peso final cocido (g)</label>
          <input id={`${fieldId}-2`}
            type="number"
            inputMode="decimal"
            value={cookedInput}
            onChange={(e) => setCookedInput(e.target.value)}
            placeholder={rawGrams > 0 ? String(rawGrams) : ''}
            className={inputClass}
          />
        </div>
        <div className="flex flex-col">
          <label htmlFor={`${fieldId}-3`} className="text-xs text-slate-500">Rinde (porciones)</label>
          <input id={`${fieldId}-3`}
            type="number"
            inputMode="decimal"
            value={servingsInput}
            onChange={(e) => setServingsInput(e.target.value)}
            placeholder="Opcional"
            className={inputClass}
          />
        </div>
      </div>
      <p className="text-xs text-slate-500">
        En crudo suman {round1(rawGrams)} g. Pesa la receta ya cocida y anótalo: al cocinar el peso cambia (el arroz absorbe
        agua, la carne la pierde) y de eso dependen los valores por 100 g. Si lo dejas vacío se usa el peso en crudo.
      </p>
      {!isWeightPlausible && (
        <p className="text-xs text-amber-400">
          Ese peso final es menor que lo que pesan la proteína, la grasa y los carbohidratos de los ingredientes. Revísalo.
        </p>
      )}

      {lines.length > 0 && isCookedValid && cookedGrams > 0 && (
        <div className="rounded-xl bg-slate-800 p-3">
          <p className="text-xl font-bold">{Math.round(summary.per100g.kcal)} kcal por 100 g</p>
          <p className="text-xs text-slate-400">
            <span className={proteinText}>Proteína {round1(summary.per100g.proteinG)} g</span>
            {' · '}
            <span className={fatText}>Grasa {round1(summary.per100g.fatG)} g</span>
            {' · '}
            <span className={carbsText}>Carbohidratos {round1(summary.per100g.carbsG)} g</span>
          </p>
          <p className="mt-2 text-xs text-slate-500">Toda la receta: {Math.round(summary.total.kcal)} kcal</p>
          {summary.perServing && summary.servingGrams !== null && (
            <p className="text-xs text-slate-500">
              Cada porción ({round1(summary.servingGrams)} g): {Math.round(summary.perServing.kcal)} kcal
            </p>
          )}
        </div>
      )}

      <button
        type="submit"
        disabled={!isValid}
        className={primaryButton}
      >
        {recipeToEdit ? 'Guardar cambios' : 'Guardar receta'}
      </button>
    </form>
  )
}

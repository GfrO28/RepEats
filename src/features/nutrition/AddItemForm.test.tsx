import { describe, expect, it, vi } from 'vitest'
import { render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import type { Food } from '@/repositories/FoodRepository'
import type { DiaryItem } from '@/repositories/DiaryRepository'
import type { SavedMeal } from '@/repositories/SavedMealRepository'
import { AddItemForm } from './AddItemForm'

vi.mock('@/data/firestore/foodRepository', () => ({
  firebaseFoodRepository: { markUsed: vi.fn() },
}))

const rice: Food = {
  id: 'food-1',
  name: 'Arroz',
  brand: null,
  barcode: null,
  source: 'manual',
  per100g: { kcal: 130, proteinG: 2.7, fatG: 0.3, carbsG: 28 },
  unit: null,
  isFavorite: false,
  useCount: 0,
  useCountByMeal: {},
  lastUsedAt: null,
  recipe: null,
  isPreparedDish: false,
}

describe('AddItemForm: agregar (sin editar)', () => {
  it('el botón dice "Agregar"', async () => {
    render(<AddItemForm mealType="breakfast" foods={[rice]} onAdd={vi.fn()} />)
    await userEvent.type(screen.getByLabelText('Buscar alimento'), 'Arroz')
    await userEvent.click(screen.getByRole('button', { name: /^Arroz/ }))
    expect(screen.getByRole('button', { name: 'Agregar' })).toBeInTheDocument()
  })

  it('no ofrece "Registro rápido": solo Alimento y Escanear', () => {
    render(<AddItemForm mealType="breakfast" foods={[rice]} onAdd={vi.fn()} />)
    expect(screen.queryByRole('button', { name: 'Registro rápido' })).not.toBeInTheDocument()
  })
})

describe('AddItemForm: chip de hora de la comida', () => {
  it('sin mealTime ni onEditMealTime, no muestra el chip', () => {
    render(<AddItemForm mealType="breakfast" foods={[rice]} onAdd={vi.fn()} />)
    expect(screen.queryByText(/Desayuno/)).not.toBeInTheDocument()
  })

  it('con mealTime y onEditMealTime, muestra la comida y la hora, y al tocarlo abre el selector', async () => {
    const onEditMealTime = vi.fn()
    render(<AddItemForm mealType="breakfast" mealTime="08:00" onEditMealTime={onEditMealTime} foods={[rice]} onAdd={vi.fn()} />)
    await userEvent.click(screen.getByRole('button', { name: /Desayuno 08:00/ }))
    expect(onEditMealTime).toHaveBeenCalled()
  })
})

describe('AddItemForm: editar un ítem existente', () => {
  it('si el alimento sigue existiendo, precarga su cantidad en gramos', () => {
    const item: DiaryItem = { foodId: 'food-1', name: 'Arroz', grams: 250, nutrition: { kcal: 325, proteinG: 6.75, fatG: 0.75, carbsG: 70 } }
    render(<AddItemForm mealType="breakfast" foods={[rice]} itemToEdit={item} onAdd={vi.fn()} />)

    expect(screen.getByText('Arroz')).toBeInTheDocument() // ya viene con el alimento elegido, no en el buscador
    expect(screen.getByLabelText('Cantidad (g)')).toHaveValue(250)
    expect(screen.getByRole('button', { name: 'Guardar cambios' })).toBeInTheDocument()
  })

  it('guardar cambios en modo alimento llama a onAdd con el nuevo ítem', async () => {
    const item: DiaryItem = { foodId: 'food-1', name: 'Arroz', grams: 250, nutrition: { kcal: 325, proteinG: 6.75, fatG: 0.75, carbsG: 70 } }
    const onAdd = vi.fn()
    render(<AddItemForm mealType="breakfast" foods={[rice]} itemToEdit={item} onAdd={onAdd} />)

    const amountInput = screen.getByLabelText('Cantidad (g)')
    await userEvent.clear(amountInput)
    await userEvent.type(amountInput, '100')
    await userEvent.click(screen.getByRole('button', { name: 'Guardar cambios' }))

    expect(onAdd).toHaveBeenCalledWith(expect.objectContaining({ foodId: 'food-1', grams: 100 }))
  })

  it('si su alimento ya no existe (se borró de la biblioteca), se abre en blanco para elegir de nuevo', () => {
    const item: DiaryItem = {
      foodId: 'food-borrado',
      name: 'Ya no existe',
      grams: 80,
      nutrition: { kcal: 200, proteinG: 10, fatG: 5, carbsG: 20 },
    }
    render(<AddItemForm mealType="breakfast" foods={[]} itemToEdit={item} onAdd={vi.fn()} />)

    expect(screen.getByLabelText('Buscar alimento')).toBeInTheDocument()
    expect(screen.queryByText('Ya no existe')).not.toBeInTheDocument()
  })
})

describe('AddItemForm: categorías (favoritos, frecuentes, guardados, recetas, todos)', () => {
  const favoriteFood: Food = { ...rice, id: 'food-fav', name: 'Palta', isFavorite: true }
  const frequentFood: Food = { ...rice, id: 'food-freq', name: 'Pollo a la plancha', useCountByMeal: { breakfast: 5 } }
  const recipeFood: Food = { ...rice, id: 'food-recipe', name: 'Ceviche', recipe: { ingredients: [], cookedGrams: 500, servings: 4 } }
  const allFoods = [rice, favoriteFood, frequentFood, recipeFood]

  it('sin buscar, ofrece categorías para elegir', () => {
    render(<AddItemForm mealType="breakfast" foods={allFoods} onAdd={vi.fn()} />)
    expect(screen.getByRole('tab', { name: 'Favoritos' })).toBeInTheDocument()
    expect(screen.getByRole('tab', { name: 'Frecuentes' })).toBeInTheDocument()
    expect(screen.getByRole('tab', { name: 'Recetas' })).toBeInTheDocument()
    expect(screen.getByRole('tab', { name: 'Todos' })).toBeInTheDocument()
  })

  it('"Favoritos" solo muestra los marcados con ☆', () => {
    render(<AddItemForm mealType="breakfast" foods={allFoods} onAdd={vi.fn()} />)
    expect(screen.getByText('Palta')).toBeInTheDocument() // ya es la categoría por defecto
    expect(screen.queryByText('Pollo a la plancha')).not.toBeInTheDocument()
  })

  it('"Frecuentes" muestra los más usados en esa comida, no los favoritos', async () => {
    render(<AddItemForm mealType="breakfast" foods={allFoods} onAdd={vi.fn()} />)
    await userEvent.click(screen.getByRole('tab', { name: 'Frecuentes' }))
    expect(screen.getByText('Pollo a la plancha')).toBeInTheDocument()
    expect(screen.queryByText('Palta')).not.toBeInTheDocument()
  })

  it('"Frecuentes" es por comida: lo usado seguido en desayuno no aparece al agregar al almuerzo', async () => {
    const milk: Food = { ...rice, id: 'food-milk', name: 'Leche Gloria', useCountByMeal: { breakfast: 12 } }

    const { rerender } = render(<AddItemForm mealType="breakfast" foods={[milk]} onAdd={vi.fn()} />)
    await userEvent.click(screen.getByRole('tab', { name: 'Frecuentes' }))
    expect(screen.getByText('Leche Gloria')).toBeInTheDocument()

    rerender(<AddItemForm mealType="lunch" foods={[milk]} onAdd={vi.fn()} />)
    await userEvent.click(screen.getByRole('tab', { name: 'Frecuentes' }))
    expect(screen.queryByText('Leche Gloria')).not.toBeInTheDocument()
  })

  it('"Recetas" solo muestra alimentos con receta', async () => {
    render(<AddItemForm mealType="breakfast" foods={allFoods} onAdd={vi.fn()} />)
    await userEvent.click(screen.getByRole('tab', { name: 'Recetas' }))
    expect(screen.getByText('Ceviche')).toBeInTheDocument()
    expect(screen.queryByText('Palta')).not.toBeInTheDocument()
  })

  it('buscar ignora la categoría elegida: resultados de toda la biblioteca', async () => {
    render(<AddItemForm mealType="breakfast" foods={allFoods} onAdd={vi.fn()} />)
    await userEvent.type(screen.getByLabelText('Buscar alimento'), 'Pollo')
    expect(screen.getByText('Pollo a la plancha')).toBeInTheDocument()
  })

  it('sin "savedMeals", no ofrece la categoría "Guardados"', () => {
    render(<AddItemForm mealType="breakfast" foods={allFoods} onAdd={vi.fn()} />)
    expect(screen.queryByRole('tab', { name: 'Guardados' })).not.toBeInTheDocument()
  })

  it('con "savedMeals", elegir una comida guardada la usa directamente (sin elegir cantidad)', async () => {
    const savedMeal: SavedMeal = {
      id: 'meal-1',
      name: 'Mi desayuno de siempre',
      items: [{ foodId: 'food-1', name: 'Arroz', grams: 100, nutrition: { kcal: 130, proteinG: 2.7, fatG: 0.3, carbsG: 28 } }],
    }
    const onUseSavedMeal = vi.fn()
    render(<AddItemForm mealType="breakfast" foods={allFoods} savedMeals={[savedMeal]} onUseSavedMeal={onUseSavedMeal} onAdd={vi.fn()} />)

    await userEvent.click(screen.getByRole('tab', { name: 'Guardados' }))
    await userEvent.click(screen.getByText('Mi desayuno de siempre'))

    expect(onUseSavedMeal).toHaveBeenCalledWith(savedMeal)
    expect(screen.queryByLabelText('Cantidad (g)')).not.toBeInTheDocument()
  })
})

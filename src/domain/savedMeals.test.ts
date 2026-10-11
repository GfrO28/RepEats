import { describe, it, expect } from 'vitest'
import type { DiaryItem } from '@/repositories/DiaryRepository'
import type { SavedMeal } from '@/repositories/SavedMealRepository'
import { createSavedMeal, calculateSavedMealTotals, sortSavedMeals, updateSavedMeal } from './savedMeals'

const item = (name: string, kcal: number, proteinG: number): DiaryItem => ({
  foodId: name,
  name,
  grams: 100,
  nutrition: { kcal, proteinG, fatG: 1, carbsG: 10 },
})

describe('createSavedMeal', () => {
  it('limpia el nombre y copia la lista de ítems', () => {
    const items = [item('Avena', 150, 5)]
    const meal = createSavedMeal('m1', '  Mi desayuno  ', items)
    expect(meal).toEqual({ id: 'm1', name: 'Mi desayuno', items })
    expect(meal.items).not.toBe(items) // cambiar la lista original no altera la comida guardada
  })
})

describe('calculateSavedMealTotals', () => {
  it('suma las calorías y macros de todos los ítems', () => {
    const meal = createSavedMeal('m1', 'Desayuno', [item('Avena', 150, 5), item('Huevo', 70, 6)])
    expect(calculateSavedMealTotals(meal)).toEqual({ kcal: 220, proteinG: 11, fatG: 2, carbsG: 20 })
  })
})

describe('sortSavedMeals', () => {
  const meals: SavedMeal[] = [
    { id: '1', name: 'Snack de tarde', items: [] },
    { id: '2', name: 'Almuerzo fitness', items: [] },
    { id: '3', name: 'Ávena nocturna', items: [] },
  ]

  it('ordena alfabéticamente sin importar tildes', () => {
    expect(sortSavedMeals(meals).map((m) => m.name)).toEqual(['Almuerzo fitness', 'Ávena nocturna', 'Snack de tarde'])
  })

  it('no modifica la lista original', () => {
    sortSavedMeals(meals)
    expect(meals[0]?.name).toBe('Snack de tarde')
  })
})

describe('updateSavedMeal', () => {
  it('cambia nombre e ítems, conservando el id', () => {
    const meal = createSavedMeal('m1', 'Desayuno', [item('Avena', 150, 5)])
    const updated = updateSavedMeal(meal, '  Desayuno fuerte  ', [item('Avena', 150, 5), item('Huevo', 70, 6)])
    expect(updated).toEqual({ id: 'm1', name: 'Desayuno fuerte', items: [item('Avena', 150, 5), item('Huevo', 70, 6)] })
  })

  it('no modifica la comida original', () => {
    const meal = createSavedMeal('m1', 'Desayuno', [item('Avena', 150, 5)])
    updateSavedMeal(meal, 'Otro nombre', [])
    expect(meal.name).toBe('Desayuno')
    expect(meal.items).toHaveLength(1)
  })
})

import { describe, it, expect } from 'vitest'
import type { DiaryDay, DiaryItem } from '@/repositories/DiaryRepository'
import { createEmptyDay, getMealItems, addItemsToDay, copyDayInto } from './diary'

const item = (name: string, kcal: number): DiaryItem => ({
  foodId: name,
  name,
  grams: 100,
  nutrition: { kcal, proteinG: 0, fatG: 0, carbsG: 0 },
})

const oats = item('Avena', 150)
const banana = item('Plátano', 90)
const egg = item('Huevo', 70)

describe('getMealItems', () => {
  it('devuelve los ítems de esa comida', () => {
    const day: DiaryDay = { ...createEmptyDay('2026-01-10'), meals: [{ type: 'breakfast', items: [oats] }] }
    expect(getMealItems(day, 'breakfast')).toEqual([oats])
  })

  it('devuelve una lista vacía si el día no existe o no tiene esa comida', () => {
    expect(getMealItems(null, 'lunch')).toEqual([])
    expect(getMealItems(createEmptyDay('2026-01-10'), 'lunch')).toEqual([])
  })
})

describe('addItemsToDay', () => {
  it('crea la comida si no existía y agrega todos los ítems en orden', () => {
    const result = addItemsToDay(createEmptyDay('2026-01-10'), 'breakfast', [oats, banana])
    expect(result.meals).toEqual([{ type: 'breakfast', items: [oats, banana] }])
  })

  it('conserva lo que ya había en la comida', () => {
    const day: DiaryDay = { ...createEmptyDay('2026-01-10'), meals: [{ type: 'breakfast', items: [egg] }] }
    expect(getMealItems(addItemsToDay(day, 'breakfast', [oats]), 'breakfast')).toEqual([egg, oats])
  })

  it('vuelve a mostrar una comida que el día había quitado', () => {
    const day: DiaryDay = { ...createEmptyDay('2026-01-10'), hiddenMeals: ['snack', 'dinner'], mealTimes: {} }
    expect(addItemsToDay(day, 'snack', [banana]).hiddenMeals).toEqual(['dinner'])
  })

  it('sin ítems no cambia nada (ni siquiera crea una comida vacía)', () => {
    const day = createEmptyDay('2026-01-10')
    expect(addItemsToDay(day, 'lunch', [])).toBe(day)
  })

  it('no modifica el día original', () => {
    const day = createEmptyDay('2026-01-10')
    addItemsToDay(day, 'breakfast', [oats])
    expect(day.meals).toEqual([])
  })
})

describe('copyDayInto', () => {
  const source: DiaryDay = {
    date: '2026-01-09',
    hiddenMeals: [], mealTimes: {},
    meals: [
      { type: 'breakfast', items: [oats, banana] },
      { type: 'lunch', items: [] }, // una comida vacía no se copia
      { type: 'dinner', items: [egg] },
    ],
  }

  it('copia cada comida con sus ítems al día destino', () => {
    const result = copyDayInto(createEmptyDay('2026-01-10'), source)
    expect(getMealItems(result, 'breakfast')).toEqual([oats, banana])
    expect(getMealItems(result, 'dinner')).toEqual([egg])
    expect(result.meals.some((m) => m.type === 'lunch')).toBe(false)
    expect(result.date).toBe('2026-01-10')
  })

  it('suma a lo que el día destino ya tenía, sin borrarlo', () => {
    const target: DiaryDay = { ...createEmptyDay('2026-01-10'), meals: [{ type: 'breakfast', items: [egg] }] }
    expect(getMealItems(copyDayInto(target, source), 'breakfast')).toEqual([egg, oats, banana])
  })

  it('copiar un día vacío deja el destino igual', () => {
    const target = createEmptyDay('2026-01-10')
    expect(copyDayInto(target, createEmptyDay('2026-01-09'))).toEqual(target)
  })
})

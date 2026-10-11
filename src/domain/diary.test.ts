import { describe, it, expect } from 'vitest'
import {
  createEmptyDay,
  getVisibleMealTypes,
  getAddableMealTypes,
  removeMealFromDay,
  addMealToDay,
  addItemToDay,
  removeItemFromDay,
  replaceItemInDay,
  resizeDiaryItem,
  createItemFromFood,
  calculateMealTotals,
  calculateDayTotals,
  getDailyIntakes,
} from './diary'
import type { DiaryDay, DiaryItem } from '@/repositories/DiaryRepository'
import type { Food } from '@/repositories/FoodRepository'

function makeItem(kcal: number, proteinG: number, fatG: number, carbsG: number, name = 'Ítem'): DiaryItem {
  return { foodId: null, name, grams: null, nutrition: { kcal, proteinG, fatG, carbsG } }
}

const ZERO = { kcal: 0, proteinG: 0, fatG: 0, carbsG: 0 }

describe('getVisibleMealTypes', () => {
  it('sin opcionales activadas muestra solo las comidas base', () => {
    expect(getVisibleMealTypes(null, [])).toEqual(['breakfast', 'lunch', 'dinner'])
  })

  it('las opcionales activadas se muestran aunque el día no tenga nada, en orden cronológico', () => {
    expect(getVisibleMealTypes(createEmptyDay('2026-09-25'), ['snack', 'midMorning'])).toEqual([
      'breakfast',
      'midMorning',
      'lunch',
      'dinner',
      'snack',
    ])
  })

  it('una comida quitada ese día no se muestra, sea base u opcional', () => {
    const day: DiaryDay = { date: '2026-09-25', meals: [], hiddenMeals: ['breakfast', 'midMorning'], mealTimes: {} }
    expect(getVisibleMealTypes(day, ['midMorning', 'snack'])).toEqual(['lunch', 'dinner', 'snack'])
  })

  it('una opcional no activada en el perfil se muestra si el día la tiene agregada', () => {
    const day: DiaryDay = { date: '2026-09-25', meals: [{ type: 'snack', items: [] }], hiddenMeals: [], mealTimes: {} }
    expect(getVisibleMealTypes(day, [])).toEqual(['breakfast', 'lunch', 'dinner', 'snack'])
  })

  it('una opcional no activada y sin registro ese día no se muestra', () => {
    expect(getVisibleMealTypes(createEmptyDay('2026-09-25'), [])).not.toContain('snack')
  })

  it('no duplica una comida que está activada y además tiene registro', () => {
    const day: DiaryDay = { date: '2026-09-25', meals: [{ type: 'snack', items: [makeItem(50, 1, 1, 8)] }], hiddenMeals: [], mealTimes: {} }
    expect(getVisibleMealTypes(day, ['snack'])).toEqual(['breakfast', 'lunch', 'dinner', 'snack'])
  })
})

describe('getAddableMealTypes', () => {
  it('devuelve las comidas que hoy no se ven', () => {
    const day: DiaryDay = { date: '2026-09-25', meals: [], hiddenMeals: ['breakfast'], mealTimes: {} }
    expect(getAddableMealTypes(day, ['midMorning'])).toEqual(['breakfast', 'midAfternoon', 'snack'])
  })

  it('con las 6 visibles no queda nada por agregar', () => {
    expect(getAddableMealTypes(createEmptyDay('2026-09-25'), ['midMorning', 'midAfternoon', 'snack'])).toEqual([])
  })
})

describe('removeMealFromDay', () => {
  it('quita la comida con sus ítems y la marca como quitada', () => {
    const day: DiaryDay = {
      date: '2026-09-25',
      meals: [
        { type: 'lunch', items: [makeItem(500, 30, 15, 60)] },
        { type: 'dinner', items: [makeItem(400, 25, 10, 40)] },
      ],
      hiddenMeals: [], mealTimes: {},
    }
    const result = removeMealFromDay(day, 'lunch')
    expect(result.meals.map((meal) => meal.type)).toEqual(['dinner'])
    expect(result.hiddenMeals).toEqual(['lunch'])
  })

  it('quitar una comida que no tenía registro también la oculta', () => {
    const result = removeMealFromDay(createEmptyDay('2026-09-25'), 'breakfast')
    expect(result.hiddenMeals).toEqual(['breakfast'])
  })

  it('quitarla dos veces no la duplica en hiddenMeals', () => {
    const once = removeMealFromDay(createEmptyDay('2026-09-25'), 'breakfast')
    expect(removeMealFromDay(once, 'breakfast').hiddenMeals).toEqual(['breakfast'])
  })

  it('no modifica el día original', () => {
    const day = createEmptyDay('2026-09-25')
    removeMealFromDay(day, 'breakfast')
    expect(day.hiddenMeals).toEqual([])
  })
})

describe('addMealToDay', () => {
  it('vuelve a mostrar una comida quitada y le crea su registro vacío', () => {
    const day: DiaryDay = { date: '2026-09-25', meals: [], hiddenMeals: ['breakfast', 'snack'], mealTimes: {} }
    const result = addMealToDay(day, 'breakfast')
    expect(result.hiddenMeals).toEqual(['snack'])
    expect(result.meals).toEqual([{ type: 'breakfast', items: [] }])
  })

  it('no borra los ítems si la comida ya tenía registro', () => {
    const day: DiaryDay = { date: '2026-09-25', meals: [{ type: 'lunch', items: [makeItem(500, 30, 15, 60)] }], hiddenMeals: [], mealTimes: {} }
    const result = addMealToDay(day, 'lunch')
    expect(result.meals).toHaveLength(1)
    expect(result.meals[0]?.items).toHaveLength(1)
  })
})

describe('addItemToDay', () => {
  it('crea la comida si el día aún no la tenía', () => {
    const result = addItemToDay(createEmptyDay('2026-09-25'), 'lunch', makeItem(100, 5, 2, 10, 'Arroz'))
    expect(result.meals).toHaveLength(1)
    expect(result.meals[0]?.type).toBe('lunch')
    expect(result.meals[0]?.items.map((item) => item.name)).toEqual(['Arroz'])
  })

  it('agrega al final de una comida existente sin tocar las demás', () => {
    const day: DiaryDay = {
      date: '2026-09-25',
      meals: [
        { type: 'lunch', items: [makeItem(100, 5, 2, 10, 'Arroz')] },
        { type: 'dinner', items: [makeItem(200, 10, 5, 20, 'Sopa')] },
      ],
      hiddenMeals: [], mealTimes: {},
    }
    const result = addItemToDay(day, 'lunch', makeItem(50, 1, 1, 8, 'Pollo'))
    expect(result.meals[0]?.items.map((item) => item.name)).toEqual(['Arroz', 'Pollo'])
    expect(result.meals[1]?.items.map((item) => item.name)).toEqual(['Sopa'])
  })
})

describe('removeItemFromDay', () => {
  const day: DiaryDay = {
    date: '2026-09-25',
    meals: [{ type: 'lunch', items: [makeItem(100, 5, 2, 10, 'A'), makeItem(50, 1, 1, 8, 'B'), makeItem(20, 0, 0, 5, 'C')] }],
    hiddenMeals: [], mealTimes: {},
  }

  it('quita el ítem de esa posición', () => {
    const result = removeItemFromDay(day, 'lunch', 1)
    expect(result.meals[0]?.items.map((item) => item.name)).toEqual(['A', 'C'])
  })

  it('una posición inexistente no cambia nada', () => {
    const result = removeItemFromDay(day, 'lunch', 9)
    expect(result.meals[0]?.items).toHaveLength(3)
  })

  it('la comida queda en el día aunque se quede sin ítems', () => {
    const single: DiaryDay = { date: '2026-09-25', meals: [{ type: 'lunch', items: [makeItem(100, 5, 2, 10)] }], hiddenMeals: [], mealTimes: {} }
    const result = removeItemFromDay(single, 'lunch', 0)
    expect(result.meals).toEqual([{ type: 'lunch', items: [] }])
  })
})

describe('resizeDiaryItem', () => {
  it('escala kcal y macros en la misma proporción que los gramos', () => {
    const item: DiaryItem = { foodId: 'f1', name: 'Arroz', grams: 100, nutrition: { kcal: 130, proteinG: 2.7, fatG: 0.3, carbsG: 28 } }
    const result = resizeDiaryItem(item, 200)
    expect(result.grams).toBe(200)
    expect(result.nutrition).toEqual({ kcal: 260, proteinG: 5.4, fatG: 0.6, carbsG: 56 })
  })

  it('conserva el resto de campos (nombre, foodId)', () => {
    const item: DiaryItem = { foodId: 'f1', name: 'Arroz', grams: 100, nutrition: { kcal: 130, proteinG: 2.7, fatG: 0.3, carbsG: 28 } }
    const result = resizeDiaryItem(item, 50)
    expect(result.foodId).toBe('f1')
    expect(result.name).toBe('Arroz')
  })

  it('un registro sin gramos (registro rápido histórico) no se puede escalar: se devuelve igual', () => {
    const item: DiaryItem = { foodId: null, name: 'Menú del día', grams: null, nutrition: { kcal: 600, proteinG: 25, fatG: 20, carbsG: 70 } }
    expect(resizeDiaryItem(item, 100)).toEqual(item)
  })

  it('no modifica el ítem original', () => {
    const item: DiaryItem = { foodId: 'f1', name: 'Arroz', grams: 100, nutrition: { kcal: 130, proteinG: 2.7, fatG: 0.3, carbsG: 28 } }
    resizeDiaryItem(item, 200)
    expect(item.grams).toBe(100)
  })
})

describe('replaceItemInDay', () => {
  const day: DiaryDay = {
    date: '2026-09-25',
    meals: [{ type: 'lunch', items: [makeItem(100, 5, 2, 10, 'A'), makeItem(50, 1, 1, 8, 'B')] }],
    hiddenMeals: [], mealTimes: {},
  }

  it('reemplaza el ítem de esa posición, sin mover a los demás', () => {
    const replacement = makeItem(300, 20, 10, 30, 'B editado')
    const result = replaceItemInDay(day, 'lunch', 1, replacement)
    expect(result.meals[0]?.items.map((item) => item.name)).toEqual(['A', 'B editado'])
    expect(result.meals[0]?.items[1]).toEqual(replacement)
  })

  it('no toca otras comidas del día', () => {
    const withDinner: DiaryDay = { ...day, meals: [...day.meals, { type: 'dinner', items: [makeItem(400, 0, 0, 0, 'Sopa')] }] }
    const result = replaceItemInDay(withDinner, 'lunch', 0, makeItem(1, 0, 0, 0, 'X'))
    expect(result.meals[1]?.items.map((item) => item.name)).toEqual(['Sopa'])
  })

  it('no modifica el día original', () => {
    replaceItemInDay(day, 'lunch', 0, makeItem(1, 0, 0, 0, 'X'))
    expect(day.meals[0]?.items[0]?.name).toBe('A')
  })
})

describe('createItemFromFood', () => {
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

  it('calcula los valores de la porción y guarda una copia del nombre', () => {
    const item = createItemFromFood(rice, 200)
    expect(item.foodId).toBe('food-1')
    expect(item.name).toBe('Arroz')
    expect(item.grams).toBe(200)
    expect(item.nutrition.kcal).toBeCloseTo(260, 5)
    expect(item.nutrition.carbsG).toBeCloseTo(56, 5)
  })
})

describe('calculateMealTotals', () => {
  it('suma los ítems de una comida', () => {
    const result = calculateMealTotals({ type: 'lunch', items: [makeItem(100, 10, 5, 20), makeItem(50, 2, 1, 8)] })
    expect(result).toEqual({ kcal: 150, proteinG: 12, fatG: 6, carbsG: 28 })
  })

  it('una comida sin ítems da todo en 0', () => {
    expect(calculateMealTotals({ type: 'lunch', items: [] })).toEqual(ZERO)
  })
})

describe('calculateDayTotals', () => {
  it('suma los ítems de todas las comidas del día', () => {
    const day: DiaryDay = {
      date: '2026-09-25',
      meals: [
        { type: 'breakfast', items: [makeItem(300, 20, 10, 30)] },
        { type: 'lunch', items: [makeItem(500, 30, 15, 60), makeItem(100, 5, 2, 10)] },
      ],
      hiddenMeals: [], mealTimes: {},
    }
    expect(calculateDayTotals(day)).toEqual({ kcal: 900, proteinG: 55, fatG: 27, carbsG: 100 })
  })

  it('un día sin registro (null) da todo en 0', () => {
    expect(calculateDayTotals(null)).toEqual(ZERO)
  })

  it('un día con comidas vacías da todo en 0', () => {
    const day: DiaryDay = { date: '2026-09-25', meals: [{ type: 'breakfast', items: [] }], hiddenMeals: [], mealTimes: {} }
    expect(calculateDayTotals(day)).toEqual(ZERO)
  })
})

describe('getDailyIntakes', () => {
  const item = (kcal: number): DiaryItem => ({
    foodId: null,
    name: 'x',
    grams: null,
    nutrition: { kcal, proteinG: 0, fatG: 0, carbsG: 0 },
  })

  it('suma las kcal de todas las comidas de cada día, conservando la fecha', () => {
    const days: DiaryDay[] = [
      {
        date: '2026-03-01',
        meals: [
          { type: 'breakfast', items: [item(400), item(100)] },
          { type: 'lunch', items: [item(800)] },
        ],
        hiddenMeals: [], mealTimes: {},
      },
      { date: '2026-03-02', meals: [{ type: 'dinner', items: [item(600)] }], hiddenMeals: [], mealTimes: {} },
    ]
    expect(getDailyIntakes(days)).toEqual([
      { date: '2026-03-01', kcal: 1300 },
      { date: '2026-03-02', kcal: 600 },
    ])
  })

  it('un día sin registros da 0 kcal y sin días da una lista vacía', () => {
    expect(getDailyIntakes([{ date: '2026-03-01', meals: [], hiddenMeals: [], mealTimes: {} }])).toEqual([
      { date: '2026-03-01', kcal: 0 },
    ])
    expect(getDailyIntakes([])).toEqual([])
  })
})

import { describe, it, expect } from 'vitest'
import type { Food } from '@/repositories/FoodRepository'
import {
  calculateRecipe,
  isRecipeWeightPlausible,
  linesFromRecipe,
  createRecipeFood,
  searchIngredients,
  type RecipeLine,
} from './recipe'

const rice: RecipeLine = {
  foodId: 'rice',
  name: 'Arroz',
  per100g: { kcal: 130, proteinG: 2.7, fatG: 0.3, carbsG: 28 },
  grams: 200,
}
const chicken: RecipeLine = {
  foodId: 'chicken',
  name: 'Pollo',
  per100g: { kcal: 165, proteinG: 31, fatG: 3.6, carbsG: 0 },
  grams: 100,
}

describe('calculateRecipe', () => {
  it('suma los ingredientes y reparte por 100 g sobre el peso final', () => {
    // 200 g de arroz = 260 kcal; 100 g de pollo = 165 kcal; total 425 kcal
    const summary = calculateRecipe([rice, chicken], 500, null)
    expect(summary.rawGrams).toBe(300)
    expect(summary.total.kcal).toBeCloseTo(425, 5)
    expect(summary.per100g.kcal).toBeCloseTo(85, 5) // 425 / 500 * 100
    expect(summary.servingGrams).toBeNull()
    expect(summary.perServing).toBeNull()
  })

  it('si el peso final es igual a la suma en crudo, es el promedio directo', () => {
    const summary = calculateRecipe([rice, chicken], 300, null)
    expect(summary.per100g.kcal).toBeCloseTo((425 / 300) * 100, 5)
  })

  it('cuando se pierde agua al cocinar, los valores por 100 g suben (las kcal no cambian)', () => {
    const wet = calculateRecipe([chicken], 100, null)
    const dry = calculateRecipe([chicken], 70, null)
    expect(dry.total.kcal).toBe(wet.total.kcal)
    expect(dry.per100g.kcal).toBeCloseTo((165 / 70) * 100, 5)
  })

  it('calcula la porción cuando se indica en cuántas porciones rinde', () => {
    const summary = calculateRecipe([rice, chicken], 500, 4)
    expect(summary.servingGrams).toBe(125)
    expect(summary.perServing?.kcal).toBeCloseTo(425 / 4, 5)
  })

  it('un peso final de 0 no produce NaN ni infinito', () => {
    const summary = calculateRecipe([rice], 0, 2)
    expect(summary.per100g).toEqual({ kcal: 0, proteinG: 0, fatG: 0, carbsG: 0 })
    expect(summary.servingGrams).toBeNull()
  })

  it('sin ingredientes todo es 0', () => {
    expect(calculateRecipe([], 100, null).total).toEqual({ kcal: 0, proteinG: 0, fatG: 0, carbsG: 0 })
  })
})

describe('isRecipeWeightPlausible', () => {
  it('acepta un peso final coherente', () => {
    expect(isRecipeWeightPlausible(calculateRecipe([rice, chicken], 500, null).total, 500)).toBe(true)
  })

  it('acepta el límite exacto (100 g de aceite en 100 g de receta)', () => {
    const oil: RecipeLine = { foodId: null, name: 'Aceite', per100g: { kcal: 900, proteinG: 0, fatG: 100, carbsG: 0 }, grams: 100 }
    expect(isRecipeWeightPlausible(calculateRecipe([oil], 100, null).total, 100)).toBe(true)
  })

  it('rechaza un peso final más bajo que los macros que contiene', () => {
    // 100 g de pollo aportan ~34,6 g de proteína y grasa: no caben en 30 g de receta
    expect(isRecipeWeightPlausible(calculateRecipe([chicken], 30, null).total, 30)).toBe(false)
  })
})

describe('searchIngredients', () => {
  const makeFood = (id: string, name: string, overrides: Partial<Food> = {}): Food => ({
    id,
    name,
    brand: null,
    barcode: null,
    source: 'manual',
    per100g: { kcal: 100, proteinG: 1, fatG: 1, carbsG: 10 },
    unit: null,
    isFavorite: false,
    useCount: 0,
    useCountByMeal: {},
    lastUsedAt: null,
    recipe: null,
    isPreparedDish: false,
    ...overrides,
  })

  const foods = [
    makeFood('1', 'Lentejas grandes'),
    makeFood('2', 'Lenteja con bisteck y arroz (restaurante)', { isPreparedDish: true }),
    makeFood('3', 'Lentejas guisadas', { recipe: { ingredients: [], cookedGrams: 100, servings: null } }),
  ]

  it('no ofrece los platos de restaurante como ingrediente', () => {
    expect(searchIngredients(foods, 'lenteja', null).map((f) => f.id)).toEqual(['1', '3'])
  })

  it('sí ofrece otras recetas (una receta puede llevar otra ya preparada)', () => {
    expect(searchIngredients(foods, 'guisadas', null).map((f) => f.id)).toEqual(['3'])
  })

  it('no ofrece la receta que se está editando', () => {
    expect(searchIngredients(foods, 'lenteja', '3').map((f) => f.id)).toEqual(['1'])
  })
})

describe('createRecipeFood', () => {
  const build = (previous: Food | null = null, servings: number | null = 4) =>
    createRecipeFood({ id: 'r1', name: '  Arroz con pollo  ', lines: [rice, chicken], cookedGrams: 500, servings, previous })

  it('genera un alimento con los valores por 100 g redondeados y los ingredientes guardados', () => {
    const food = build()
    expect(food.name).toBe('Arroz con pollo')
    expect(food.per100g).toEqual({ kcal: 85, proteinG: 7.28, fatG: 0.84, carbsG: 11.2 })
    expect(food.recipe?.cookedGrams).toBe(500)
    expect(food.recipe?.ingredients).toHaveLength(2)
    expect(food.recipe?.ingredients[0]).toMatchObject({ foodId: 'rice', name: 'Arroz', grams: 200 })
    expect(food.recipe?.ingredients[0]?.nutrition.kcal).toBeCloseTo(260, 5)
  })

  it('con porciones crea la unidad "porción"; sin porciones no hay unidad', () => {
    expect(build().unit).toEqual({ label: 'porción', grams: 125 })
    expect(build(null, null).unit).toBeNull()
  })

  it('al editar conserva favorito y uso', () => {
    const previous = { isFavorite: true, useCount: 7, lastUsedAt: new Date(2026, 0, 5) } as Food
    const food = build(previous)
    expect(food.isFavorite).toBe(true)
    expect(food.useCount).toBe(7)
    expect(food.lastUsedAt).toEqual(new Date(2026, 0, 5))
  })

  it('una receta nueva empieza sin favorito ni uso', () => {
    const food = build()
    expect(food).toMatchObject({ isFavorite: false, useCount: 0, lastUsedAt: null })
  })
})

describe('linesFromRecipe', () => {
  it('recupera los valores por 100 g de cada ingrediente, para poder editar los gramos', () => {
    const food = createRecipeFood({ id: 'r1', name: 'X', lines: [rice, chicken], cookedGrams: 500, servings: null, previous: null })
    const lines = linesFromRecipe(food.recipe!)
    expect(lines[0]?.per100g.kcal).toBeCloseTo(130, 5)
    expect(lines[1]?.per100g.proteinG).toBeCloseTo(31, 5)
    expect(lines.map((l) => l.grams)).toEqual([200, 100])
  })

  it('un ingrediente guardado con 0 g no divide entre cero', () => {
    const lines = linesFromRecipe({
      ingredients: [{ foodId: null, name: 'Nada', grams: 0, nutrition: { kcal: 0, proteinG: 0, fatG: 0, carbsG: 0 } }],
      cookedGrams: 100,
      servings: null,
    })
    expect(lines[0]?.per100g).toEqual({ kcal: 0, proteinG: 0, fatG: 0, carbsG: 0 })
  })
})

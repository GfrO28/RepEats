import { describe, it, expect } from 'vitest'
import type { Food } from '@/repositories/FoodRepository'
import { searchFoods, getQuickPicks, getFavoriteFoods, getFrequentFoods, getRecipeFoods } from './foodPicker'

function makeFood(name: string, overrides: Partial<Food> = {}): Food {
  return {
    id: name,
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
  }
}

const day = (n: number) => new Date(2026, 0, n)

describe('searchFoods', () => {
  it('ignora mayúsculas y tildes', () => {
    const foods = [makeFood('Plátano de seda'), makeFood('Arroz')]
    expect(searchFoods(foods, 'PLATANO').map((f) => f.name)).toEqual(['Plátano de seda'])
  })

  it('encuentra por marca, en cualquier orden de palabras', () => {
    const foods = [makeFood('Leche entera', { brand: 'Gloria' }), makeFood('Leche evaporada', { brand: 'Laive' })]
    expect(searchFoods(foods, 'gloria').map((f) => f.name)).toEqual(['Leche entera'])
    expect(searchFoods(foods, 'leche laive').map((f) => f.name)).toEqual(['Leche evaporada'])
  })

  it('encuentra por código de barras completo', () => {
    const foods = [makeFood('Leche entera', { barcode: '7750182007269' }), makeFood('Arroz')]
    expect(searchFoods(foods, '7750182007269').map((f) => f.name)).toEqual(['Leche entera'])
  })

  it('"lenteja" encuentra "Lentejas grandes" (singular contra plural)', () => {
    const foods = [makeFood('Lentejas grandes'), makeFood('Arroz')]
    expect(searchFoods(foods, 'Lenteja').map((f) => f.name)).toEqual(['Lentejas grandes'])
  })

  it('con varias palabras, cada una debe coincidir aunque estén en otro orden o en singular', () => {
    const foods = [makeFood('Lentejas grandes'), makeFood('Lentejas chicas'), makeFood('Arroz con pollo')]
    expect(searchFoods(foods, 'lenteja grande').map((f) => f.name)).toEqual(['Lentejas grandes'])
    expect(searchFoods(foods, 'pollo arroz').map((f) => f.name)).toEqual(['Arroz con pollo'])
  })

  it('no lista lo que no coincide con todas las palabras', () => {
    expect(searchFoods([makeFood('Arroz con leche')], 'arroz pollo')).toEqual([])
  })

  it('ordena por parecido: empieza con lo escrito, luego palabra completa, luego en medio', () => {
    const foods = [
      makeFood('Carroza de pollo'), // "arroz" dentro de una palabra
      makeFood('Sopa de arroz'), // "arroz" al inicio de una palabra
      makeFood('Arroz chaufa'), // el nombre empieza con "arroz"
    ]
    expect(searchFoods(foods, 'arroz').map((f) => f.name)).toEqual(['Arroz chaufa', 'Sopa de arroz', 'Carroza de pollo'])
  })

  it('con texto vacío devuelve todos', () => {
    expect(searchFoods([makeFood('A'), makeFood('B')], '  ')).toHaveLength(2)
  })

  it('sin coincidencias devuelve una lista vacía', () => {
    expect(searchFoods([makeFood('Arroz')], 'zzz')).toEqual([])
  })

  it('dentro de un mismo parecido: favoritos primero, luego los más usados y luego el orden alfabético', () => {
    const foods = [
      makeFood('Arroz integral'),
      makeFood('Arroz blanco', { useCount: 3 }),
      makeFood('Arroz chaufa', { useCount: 9 }),
      makeFood('Arroz con leche', { isFavorite: true }),
    ]
    expect(searchFoods(foods, 'arroz').map((f) => f.name)).toEqual([
      'Arroz con leche',
      'Arroz chaufa',
      'Arroz blanco',
      'Arroz integral',
    ])
  })

  it('no modifica la lista original', () => {
    const foods = [makeFood('B'), makeFood('A')]
    searchFoods(foods, '')
    expect(foods.map((f) => f.name)).toEqual(['B', 'A'])
  })
})

describe('getQuickPicks', () => {
  it('sin favoritos ni usos no ofrece nada', () => {
    expect(getQuickPicks([makeFood('Arroz')])).toEqual({ favorites: [], recents: [] })
  })

  it('los favoritos salen en orden alfabético', () => {
    const foods = [makeFood('Pan', { isFavorite: true }), makeFood('Avena', { isFavorite: true }), makeFood('Sal')]
    expect(getQuickPicks(foods).favorites.map((f) => f.name)).toEqual(['Avena', 'Pan'])
  })

  it('los recientes salen del más nuevo al más antiguo', () => {
    const foods = [
      makeFood('Viejo', { lastUsedAt: day(1) }),
      makeFood('Nuevo', { lastUsedAt: day(9) }),
      makeFood('Medio', { lastUsedAt: day(5) }),
      makeFood('Nunca'),
    ]
    expect(getQuickPicks(foods).recents.map((f) => f.name)).toEqual(['Nuevo', 'Medio', 'Viejo'])
  })

  it('un favorito no se repite en recientes', () => {
    const foods = [makeFood('Huevo', { isFavorite: true, lastUsedAt: day(3) })]
    const picks = getQuickPicks(foods)
    expect(picks.favorites).toHaveLength(1)
    expect(picks.recents).toEqual([])
  })

  it('respeta el límite de recientes', () => {
    const foods = [1, 2, 3, 4].map((n) => makeFood(`F${n}`, { lastUsedAt: day(n) }))
    expect(getQuickPicks(foods, 2).recents.map((f) => f.name)).toEqual(['F4', 'F3'])
  })
})

describe('getFavoriteFoods', () => {
  it('solo los favoritos, en orden alfabético', () => {
    const foods = [makeFood('Pan', { isFavorite: true }), makeFood('Avena', { isFavorite: true }), makeFood('Sal')]
    expect(getFavoriteFoods(foods).map((f) => f.name)).toEqual(['Avena', 'Pan'])
  })
})

describe('getFrequentFoods', () => {
  it('los más usados primero en ESA comida, no los más recientes', () => {
    const foods = [
      makeFood('Poco usado', { useCountByMeal: { breakfast: 1 }, lastUsedAt: day(9) }),
      makeFood('Muy usado', { useCountByMeal: { breakfast: 20 }, lastUsedAt: day(1) }),
      makeFood('Sin usar'),
    ]
    expect(getFrequentFoods(foods, 'breakfast').map((f) => f.name)).toEqual(['Muy usado', 'Poco usado'])
  })

  it('a igual uso, orden alfabético', () => {
    const foods = [makeFood('Zapallo', { useCountByMeal: { lunch: 2 } }), makeFood('Arroz', { useCountByMeal: { lunch: 2 } })]
    expect(getFrequentFoods(foods, 'lunch').map((f) => f.name)).toEqual(['Arroz', 'Zapallo'])
  })

  it('lo usado seguido en otra comida no cuenta como "frecuente" acá', () => {
    const foods = [makeFood('Leche Gloria', { useCountByMeal: { breakfast: 15 } })]
    expect(getFrequentFoods(foods, 'dinner')).toEqual([])
    expect(getFrequentFoods(foods, 'breakfast').map((f) => f.name)).toEqual(['Leche Gloria'])
  })

  it('respeta el límite', () => {
    const foods = [1, 2, 3].map((n) => makeFood(`F${n}`, { useCountByMeal: { lunch: n } }))
    expect(getFrequentFoods(foods, 'lunch', 2)).toHaveLength(2)
  })
})

describe('getRecipeFoods', () => {
  const recipe = { ingredients: [], cookedGrams: 500, servings: 4 }

  it('solo las recetas, en orden alfabético', () => {
    const foods = [makeFood('Ceviche', { recipe }), makeFood('Arroz', {}), makeFood('Ají de gallina', { recipe })]
    expect(getRecipeFoods(foods).map((f) => f.name)).toEqual(['Ají de gallina', 'Ceviche'])
  })
})

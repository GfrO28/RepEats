import { describe, it, expect } from 'vitest'
import type { Food } from '@/repositories/FoodRepository'
import { convertLabelToPer100g, isValidBarcode, findFoodByBarcode } from './foodLabel'

describe('convertLabelToPer100g', () => {
  it('con una base de 100 g deja los valores igual', () => {
    const values = { kcal: 250, proteinG: 8, fatG: 10, carbsG: 32 }
    expect(convertLabelToPer100g(values, 100)).toEqual(values)
  })

  it('convierte una porción de 30 g a 100 g', () => {
    const result = convertLabelToPer100g({ kcal: 120, proteinG: 3, fatG: 6, carbsG: 15 }, 30)
    expect(result).toEqual({ kcal: 400, proteinG: 10, fatG: 20, carbsG: 50 })
  })

  it('una porción mayor a 100 g reduce los valores', () => {
    const result = convertLabelToPer100g({ kcal: 300, proteinG: 20, fatG: 10, carbsG: 30 }, 250)
    expect(result).toEqual({ kcal: 120, proteinG: 8, fatG: 4, carbsG: 12 })
  })

  it('redondea a 2 decimales', () => {
    const result = convertLabelToPer100g({ kcal: 100, proteinG: 1, fatG: 1, carbsG: 1 }, 30)
    expect(result.kcal).toBe(333.33)
  })

  it('una base de 0 g o negativa es un error de programación', () => {
    const values = { kcal: 1, proteinG: 1, fatG: 1, carbsG: 1 }
    expect(() => convertLabelToPer100g(values, 0)).toThrow(RangeError)
    expect(() => convertLabelToPer100g(values, -5)).toThrow(RangeError)
  })
})

describe('isValidBarcode', () => {
  it('acepta EAN-13, EAN-8 y UPC-12 con su dígito de control', () => {
    expect(isValidBarcode('7750182007269')).toBe(true)
    expect(isValidBarcode('4006381333931')).toBe(true)
    expect(isValidBarcode('96385074')).toBe(true)
    expect(isValidBarcode('036000291452')).toBe(true)
  })

  it('rechaza un dígito de control equivocado (error al teclear)', () => {
    expect(isValidBarcode('7750182007268')).toBe(false)
  })

  it('rechaza letras, espacios y longitudes que no existen', () => {
    expect(isValidBarcode('775018200726A')).toBe(false)
    expect(isValidBarcode('7750182 007269')).toBe(false)
    expect(isValidBarcode('123456789')).toBe(false)
    expect(isValidBarcode('')).toBe(false)
  })
})

describe('findFoodByBarcode', () => {
  const makeFood = (id: string, barcode: string | null): Food => ({
    id,
    name: id,
    brand: null,
    barcode,
    source: 'label',
    per100g: { kcal: 1, proteinG: 0, fatG: 0, carbsG: 0 },
    unit: null,
    isFavorite: false,
    useCount: 0,
    useCountByMeal: {},
    lastUsedAt: null,
    recipe: null,
    isPreparedDish: false,
  })
  const foods = [makeFood('a', '7750182007269'), makeFood('b', null)]

  it('encuentra el alimento con ese código', () => {
    expect(findFoodByBarcode(foods, '7750182007269')?.id).toBe('a')
  })

  it('no encuentra un código desconocido ni vacío', () => {
    expect(findFoodByBarcode(foods, '4006381333931')).toBeNull()
    expect(findFoodByBarcode(foods, '')).toBeNull()
  })

  it('ignora el alimento que se está editando', () => {
    expect(findFoodByBarcode(foods, '7750182007269', 'a')).toBeNull()
  })
})

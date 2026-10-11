import { describe, it, expect } from 'vitest'
import {
  calculatePortionNutrition,
  sumNutrition,
  calculateProgressRatio,
  isKcalConsistent,
  estimateKcalFromMacros,
} from './foodNutrition'

describe('calculatePortionNutrition', () => {
  it('escala los valores por 100 g a la cantidad en gramos', () => {
    const result = calculatePortionNutrition({ kcal: 130, proteinG: 2.7, fatG: 0.3, carbsG: 28 }, 200)
    expect(result.kcal).toBeCloseTo(260, 5)
    expect(result.proteinG).toBeCloseTo(5.4, 5)
    expect(result.fatG).toBeCloseTo(0.6, 5)
    expect(result.carbsG).toBeCloseTo(56, 5)
  })

  it('0 g da todo en 0', () => {
    const result = calculatePortionNutrition({ kcal: 130, proteinG: 2.7, fatG: 0.3, carbsG: 28 }, 0)
    expect(result).toEqual({ kcal: 0, proteinG: 0, fatG: 0, carbsG: 0 })
  })
})

describe('sumNutrition', () => {
  it('suma cada valor por separado', () => {
    const result = sumNutrition([
      { kcal: 100, proteinG: 10, fatG: 5, carbsG: 20 },
      { kcal: 50, proteinG: 2, fatG: 1, carbsG: 8 },
    ])
    expect(result).toEqual({ kcal: 150, proteinG: 12, fatG: 6, carbsG: 28 })
  })

  it('una lista vacía da todo en 0', () => {
    expect(sumNutrition([])).toEqual({ kcal: 0, proteinG: 0, fatG: 0, carbsG: 0 })
  })
})

describe('calculateProgressRatio', () => {
  it('devuelve la proporción consumida', () => {
    expect(calculateProgressRatio(1200, 2400)).toBe(0.5)
  })

  it('no pasa de 1 cuando se supera el objetivo', () => {
    expect(calculateProgressRatio(3000, 2400)).toBe(1)
  })

  it('con objetivo 0 devuelve 0 en vez de dividir entre cero', () => {
    expect(calculateProgressRatio(100, 0)).toBe(0)
  })
})

describe('isKcalConsistent', () => {
  it('acepta kcal que coinciden con los macros', () => {
    // 4·10 + 4·20 + 9·5 = 165
    expect(isKcalConsistent({ kcal: 165, proteinG: 10, fatG: 5, carbsG: 20 })).toBe(true)
  })

  it('tolera diferencias pequeñas (redondeos de etiqueta)', () => {
    expect(isKcalConsistent({ kcal: 180, proteinG: 10, fatG: 5, carbsG: 20 })).toBe(true)
  })

  it('rechaza kcal que no cuadran con los macros', () => {
    expect(isKcalConsistent({ kcal: 400, proteinG: 10, fatG: 5, carbsG: 20 })).toBe(false)
  })

  it('un alimento sin macros y con kcal (p. ej. alcohol) no cuadra si supera la tolerancia', () => {
    expect(isKcalConsistent({ kcal: 0, proteinG: 0, fatG: 0, carbsG: 0 })).toBe(true)
    expect(isKcalConsistent({ kcal: 70, proteinG: 0, fatG: 0, carbsG: 0 })).toBe(false)
  })
})

describe('estimateKcalFromMacros', () => {
  it('usa 4 kcal/g de proteína y carbohidratos y 9 kcal/g de grasa', () => {
    expect(estimateKcalFromMacros({ kcal: 0, proteinG: 10, fatG: 5, carbsG: 20 })).toBe(165)
  })
})

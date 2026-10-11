import { describe, it, expect } from 'vitest'
import { calculateBmr, calculateTdee } from './energyExpenditure'

describe('calculateBmr', () => {
  it('calcular TMB de un hombre', () => {
    const result = calculateBmr({ sex: 'male', weightKg: 80, heightCm: 180, ageYears: 30 })
    expect(result).toBe(1780)
  })

  it('calcular TMB de una mujer', () => {
    // TODO: input { sex: 'female', weightKg: 60, heightCm: 165, ageYears: 25 } → 1345.25
    const result = calculateBmr({ sex: 'female', weightKg: 60, heightCm: 165, ageYears: 25 })
    expect(result).toBe(1345.25)
  })
})

describe('calculateTdee', () => {
  it('calcular TDEE con actividad moderada', () => {
    const result = calculateTdee(1780, 'moderate')
    expect(result).toBe(2759)
  })
})

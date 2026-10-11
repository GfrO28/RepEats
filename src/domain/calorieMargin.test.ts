import { describe, expect, it } from 'vitest'
import { calculateCalorieMargin } from './calorieMargin'

describe('calculateCalorieMargin', () => {
  it('dentro del objetivo: remaining positivo y zona "onTrack"', () => {
    const margin = calculateCalorieMargin(1500, 2000, 2000)
    expect(margin.remaining).toBe(500)
    expect(margin.ratio).toBe(0.75)
    expect(margin.zone).toBe('onTrack')
  })

  it('justo en el objetivo: sigue siendo "onTrack"', () => {
    const margin = calculateCalorieMargin(2000, 2000, 2000)
    expect(margin.remaining).toBe(0)
    expect(margin.zone).toBe('onTrack')
  })

  describe('en déficit (objetivo por debajo del TDEE)', () => {
    const target = 1800
    const tdee = 2000

    it('pasado el objetivo pero todavía por debajo del TDEE: zona "close" (sigues en déficit, solo que menor)', () => {
      const margin = calculateCalorieMargin(1900, target, tdee)
      expect(margin.remaining).toBe(-100)
      expect(margin.zone).toBe('close')
    })

    it('justo en el TDEE: todavía "close", no "over"', () => {
      expect(calculateCalorieMargin(2000, target, tdee).zone).toBe('close')
    })

    it('por encima del TDEE: recién ahí es un superávit real, zona "over"', () => {
      expect(calculateCalorieMargin(2100, target, tdee).zone).toBe('over')
    })
  })

  describe('en volumen (objetivo por encima del TDEE)', () => {
    const target = 2400
    const tdee = 2000

    it('el TDEE queda dentro de la zona "onTrack" (el superávit es intencional)', () => {
      expect(calculateCalorieMargin(2100, target, tdee).zone).toBe('onTrack')
    })

    it('pasado el objetivo: zona "over" directamente (el TDEE ya no aporta margen extra)', () => {
      expect(calculateCalorieMargin(2500, target, tdee).zone).toBe('over')
    })
  })

  it('objetivo cero o inválido no revienta: ratio 0', () => {
    expect(calculateCalorieMargin(500, 0, 2000).ratio).toBe(0)
  })
})

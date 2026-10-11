import { describe, it, expect } from 'vitest'
import { estimateOneRepMax } from './oneRepMax'

describe('estimateOneRepMax', () => {
  it('calcular one rep max 100 * (1 + 1/30)', () => {
    expect(estimateOneRepMax(100, 1)).toBeCloseTo(103.33, 2)
  })
  it('calcular one rep max 100 * (1 + 10/30)', () => {
    expect(estimateOneRepMax(100, 10)).toBeCloseTo(133.33, 2)
  })
  it('calcular one rep max 0 * (1 + 10/30)', () => {
    expect(estimateOneRepMax(0, 10)).toBe(0)
  })
})
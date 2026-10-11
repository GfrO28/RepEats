import { describe, it, expect } from 'vitest'
import { isNonNegativeNumber, isPositiveNumber } from './inputValidation'

describe('isNonNegativeNumber', () => {
  it('acepta el cero y los positivos, con decimales', () => {
    expect(isNonNegativeNumber('0')).toBe(true)
    expect(isNonNegativeNumber('12.5')).toBe(true)
  })

  it('rechaza vacío, solo espacios, negativos y texto', () => {
    expect(isNonNegativeNumber('')).toBe(false)
    expect(isNonNegativeNumber('   ')).toBe(false)
    expect(isNonNegativeNumber('-1')).toBe(false)
    expect(isNonNegativeNumber('abc')).toBe(false)
  })
})

describe('isPositiveNumber', () => {
  it('acepta solo mayores que cero', () => {
    expect(isPositiveNumber('0.1')).toBe(true)
    expect(isPositiveNumber('0')).toBe(false)
  })

  it('rechaza vacío y texto', () => {
    expect(isPositiveNumber('')).toBe(false)
    expect(isPositiveNumber('abc')).toBe(false)
  })
})

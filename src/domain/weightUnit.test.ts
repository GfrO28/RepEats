import { describe, expect, it } from 'vitest'
import { kgToLb, lbToKg } from './weightUnit'

describe('kgToLb', () => {
  it('convierte kg a lb', () => {
    expect(kgToLb(60)).toBeCloseTo(132.3, 1)
    expect(kgToLb(100)).toBeCloseTo(220.5, 1)
  })

  it('redondea a 1 decimal', () => {
    expect(Number.isInteger(kgToLb(61.2345) * 10)).toBe(true)
  })
})

describe('lbToKg', () => {
  it('convierte lb a kg', () => {
    expect(lbToKg(135)).toBeCloseTo(61.23, 1)
    expect(lbToKg(45)).toBeCloseTo(20.41, 1)
  })

  it('redondea a 2 decimales', () => {
    expect(Number.isInteger(lbToKg(137) * 100)).toBe(true)
  })

  it('ida y vuelta se mantiene razonablemente estable', () => {
    expect(kgToLb(lbToKg(135))).toBeCloseTo(135, 0)
    expect(lbToKg(kgToLb(60))).toBeCloseTo(60, 0)
  })
})

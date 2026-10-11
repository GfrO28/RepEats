import { describe, it, expect } from 'vitest'
import { calculateRestProgress } from './restProgress'

describe('calculateRestProgress', () => {
  it('empieza en 0 cuando queda todo el tiempo', () => {
    expect(calculateRestProgress(60, 60)).toBe(0)
  })
  it('a la mitad da 0.5', () => {
    expect(calculateRestProgress(30, 60)).toBe(0.5)
  })
  it('termina en 1 cuando no queda tiempo', () => {
    expect(calculateRestProgress(0, 60)).toBe(1)
  })
  it('sin descanso activo (total 0) da 0, sin dividir entre cero', () => {
    expect(calculateRestProgress(0, 0)).toBe(0)
  })
  it('nunca sale del rango 0..1', () => {
    expect(calculateRestProgress(90, 60)).toBe(0)
    expect(calculateRestProgress(-5, 60)).toBe(1)
  })
})

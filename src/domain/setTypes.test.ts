import { describe, it, expect } from 'vitest'
import { SET_TYPES, SET_TYPE_ABBREVIATIONS } from './setTypes'

describe('SET_TYPE_ABBREVIATIONS', () => {
  it('cada tipo de serie tiene su abreviatura', () => {
    expect(SET_TYPE_ABBREVIATIONS).toEqual({ Normal: 'N', Calentamiento: 'C', 'Al Fallo': 'F', 'Drop Set': 'DS' })
  })

  it('no hay dos tipos con la misma abreviatura (se confundirían en la pantalla)', () => {
    const abbreviations = SET_TYPES.map((type) => SET_TYPE_ABBREVIATIONS[type])
    expect(new Set(abbreviations).size).toBe(SET_TYPES.length)
  })
})

import { describe, expect, it } from 'vitest'
import { getNextFocusIndex } from './focusTrap'

describe('getNextFocusIndex', () => {
  it('a mitad de la lista deja que el navegador avance solo', () => {
    expect(getNextFocusIndex(1, 4, false)).toBeNull()
    expect(getNextFocusIndex(1, 4, true)).toBeNull()
  })

  it('Tab en el último elemento vuelve al primero', () => {
    expect(getNextFocusIndex(3, 4, false)).toBe(0)
  })

  it('Shift+Tab en el primero pasa al último', () => {
    expect(getNextFocusIndex(0, 4, true)).toBe(3)
  })

  it('Tab en el primero o Shift+Tab en el último avanzan normal', () => {
    expect(getNextFocusIndex(0, 4, false)).toBeNull()
    expect(getNextFocusIndex(3, 4, true)).toBeNull()
  })

  it('con el foco en el propio diálogo (o fuera), Tab va al primero y Shift+Tab al último', () => {
    expect(getNextFocusIndex(-1, 4, false)).toBe(0)
    expect(getNextFocusIndex(-1, 4, true)).toBe(3)
  })

  it('con un solo elemento, Tab se queda en él', () => {
    expect(getNextFocusIndex(0, 1, false)).toBe(0)
    expect(getNextFocusIndex(0, 1, true)).toBe(0)
  })

  it('sin elementos enfocables no hay a dónde mover el foco', () => {
    expect(getNextFocusIndex(-1, 0, false)).toBeNull()
  })
})

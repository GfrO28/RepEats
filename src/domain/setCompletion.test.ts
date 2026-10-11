import { describe, expect, it } from 'vitest'
import { DOUBLE_TAP_WINDOW_MS, shouldIgnoreCompletion } from './setCompletion'

describe('shouldIgnoreCompletion', () => {
  it('la primera vez que se completa una fila se acepta', () => {
    expect(shouldIgnoreCompletion(0, 0, null, 10_000)).toBe(false)
    expect(shouldIgnoreCompletion(2, 2, null, 10_000)).toBe(false)
  })

  it('una fila que ya está registrada (hay más series hechas que su posición) se ignora', () => {
    expect(shouldIgnoreCompletion(1, 0, null, 10_000)).toBe(true)
    expect(shouldIgnoreCompletion(3, 1, null, 10_000)).toBe(true)
  })

  it('un segundo toque enseguida sobre la misma fila se ignora, aunque la pantalla no se haya actualizado', () => {
    expect(shouldIgnoreCompletion(0, 0, 10_000, 10_200)).toBe(true)
    expect(shouldIgnoreCompletion(0, 0, 10_000, 10_000 + DOUBLE_TAP_WINDOW_MS - 1)).toBe(true)
  })

  it('pasado el margen se acepta de nuevo (por ejemplo, si la serie se borró y se rehace)', () => {
    expect(shouldIgnoreCompletion(0, 0, 10_000, 10_000 + DOUBLE_TAP_WINDOW_MS)).toBe(false)
  })

  it('completar la fila siguiente enseguida no se confunde con un doble toque', () => {
    // la fila 1 es otra fila: su último registro es null
    expect(shouldIgnoreCompletion(1, 1, null, 10_100)).toBe(false)
  })
})

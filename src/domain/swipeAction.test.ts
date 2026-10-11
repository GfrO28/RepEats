import { describe, expect, it } from 'vitest'
import { clampSwipeOffset, isHorizontalDrag, resolveSwipeSnap, SWIPE_ACTION_WIDTH } from './swipeAction'

describe('clampSwipeOffset', () => {
  it('deja pasar un valor dentro de rango', () => {
    expect(clampSwipeOffset(-30)).toBe(-30)
  })

  it('no deja ir más allá del ancho del botón', () => {
    expect(clampSwipeOffset(-200)).toBe(-SWIPE_ACTION_WIDTH)
    expect(clampSwipeOffset(-SWIPE_ACTION_WIDTH)).toBe(-SWIPE_ACTION_WIDTH)
  })

  it('no deja pasar de 0 (no se arrastra hacia la derecha más allá de cerrado)', () => {
    expect(clampSwipeOffset(40)).toBe(0)
    expect(clampSwipeOffset(0)).toBe(0)
  })

  it('acepta un ancho de botón distinto', () => {
    expect(clampSwipeOffset(-150, 100)).toBe(-100)
  })
})

describe('resolveSwipeSnap', () => {
  it('por debajo del 40 % del ancho, se cierra', () => {
    expect(resolveSwipeSnap(-10)).toBe('closed')
    expect(resolveSwipeSnap(-31)).toBe('closed') // 40 % de 80 es 32
  })

  it('al llegar o pasar el 40 %, queda abierto', () => {
    expect(resolveSwipeSnap(-32)).toBe('open')
    expect(resolveSwipeSnap(-SWIPE_ACTION_WIDTH)).toBe('open')
  })

  it('el signo no importa: se compara la distancia', () => {
    expect(resolveSwipeSnap(32)).toBe('open')
  })

  it('acepta otro ancho o umbral', () => {
    expect(resolveSwipeSnap(-20, 100, 0.5)).toBe('closed')
    expect(resolveSwipeSnap(-50, 100, 0.5)).toBe('open')
  })
})

describe('isHorizontalDrag', () => {
  it('un movimiento claramente lateral cuenta como arrastre', () => {
    expect(isHorizontalDrag(-40, 2)).toBe(true)
  })

  it('un movimiento vertical, o mixto pero más vertical, no cuenta', () => {
    expect(isHorizontalDrag(-5, 30)).toBe(false)
    expect(isHorizontalDrag(-10, 15)).toBe(false)
  })

  it('un movimiento diminuto (temblor del dedo, o un toque) no cuenta', () => {
    expect(isHorizontalDrag(3, 1)).toBe(false)
    expect(isHorizontalDrag(0, 0)).toBe(false)
  })

  it('justo en el límite de tolerancia no cuenta; un poco más sí', () => {
    expect(isHorizontalDrag(6, 0)).toBe(false)
    expect(isHorizontalDrag(7, 0)).toBe(true)
  })
})

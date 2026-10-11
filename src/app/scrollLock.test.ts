import { afterEach, beforeEach, describe, expect, it, vi, type MockInstance } from 'vitest'
import { lockBodyScroll } from './scrollLock'

let scrollTo: MockInstance<(x: number, y: number) => void>

beforeEach(() => {
  scrollTo = vi.spyOn(window, 'scrollTo').mockImplementation(() => {}) as unknown as MockInstance<(x: number, y: number) => void>
  Object.defineProperty(window, 'scrollY', { value: 340, configurable: true })
})
afterEach(() => {
  vi.restoreAllMocks()
  document.body.removeAttribute('style')
})

describe('lockBodyScroll', () => {
  it('fija el body en su posición actual', () => {
    const unlock = lockBodyScroll()
    expect(document.body.style.position).toBe('fixed')
    expect(document.body.style.top).toBe('-340px')
    expect(document.body.style.width).toBe('100%')
    unlock()
  })

  it('al liberar, quita los estilos y vuelve a la misma altura de la página', () => {
    const unlock = lockBodyScroll()
    unlock()
    expect(document.body.style.position).toBe('')
    expect(document.body.style.top).toBe('')
    expect(scrollTo).toHaveBeenCalledWith(0, 340)
  })

  it('con dos ventanas, el fondo sigue bloqueado hasta cerrar la última', () => {
    const unlockOuter = lockBodyScroll()
    const unlockInner = lockBodyScroll()

    unlockInner()
    expect(document.body.style.position).toBe('fixed')
    expect(scrollTo).not.toHaveBeenCalled()

    unlockOuter()
    expect(document.body.style.position).toBe('')
    expect(scrollTo).toHaveBeenCalledTimes(1)
  })

  it('liberar dos veces la misma ventana no libera la otra', () => {
    const unlockA = lockBodyScroll()
    const unlockB = lockBodyScroll()
    unlockA()
    unlockA() // segunda vez: no debe restar
    expect(document.body.style.position).toBe('fixed')
    unlockB()
    expect(document.body.style.position).toBe('')
  })

  it('se puede volver a bloquear después de liberar, tomando la altura de ese momento', () => {
    lockBodyScroll()()
    Object.defineProperty(window, 'scrollY', { value: 900, configurable: true })
    const unlock = lockBodyScroll()
    expect(document.body.style.top).toBe('-900px')
    unlock()
    expect(scrollTo).toHaveBeenLastCalledWith(0, 900)
  })
})

import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { act, renderHook } from '@testing-library/react'
import { useRemainingSeconds } from './useRemainingSeconds'

const START = new Date('2026-03-10T12:00:00.000Z').getTime()

beforeEach(() => {
  vi.useFakeTimers()
  vi.setSystemTime(START)
})
afterEach(() => vi.useRealTimers())

describe('useRemainingSeconds', () => {
  it('sin descanso en curso devuelve 0', () => {
    const { result } = renderHook(({ endsAt }) => useRemainingSeconds(endsAt), { initialProps: { endsAt: null as Date | null } })
    expect(result.current).toBe(0)
  })

  it('un descanso de 180 s empieza mostrando exactamente 180, aunque la app llevara rato sin descanso', () => {
    const { result, rerender } = renderHook(({ endsAt }) => useRemainingSeconds(endsAt), {
      initialProps: { endsAt: null as Date | null },
    })
    // Pasan 10 s sin descanso (el hook no actualiza su reloj interno en ese tiempo)
    act(() => {
      vi.setSystemTime(START + 10_000)
    })
    // Al marcar la serie empieza el descanso de 3 minutos
    rerender({ endsAt: new Date(START + 10_000 + 180_000) })
    expect(result.current).toBe(180) // antes del arreglo mostraba 190
  })

  it('el segundo siguiente muestra 179 y sigue bajando sin saltos', () => {
    const { result, rerender } = renderHook(({ endsAt }) => useRemainingSeconds(endsAt), {
      initialProps: { endsAt: null as Date | null },
    })
    act(() => {
      vi.setSystemTime(START + 7_000)
    })
    rerender({ endsAt: new Date(START + 7_000 + 180_000) })
    expect(result.current).toBe(180)

    const seen: number[] = []
    for (let i = 0; i < 3; i++) {
      act(() => {
        vi.advanceTimersByTime(1000)
      })
      seen.push(result.current)
    }
    expect(seen).toEqual([179, 178, 177])
  })

  it('al llegar al final se queda en 0 y no baja de ahí', () => {
    const { result } = renderHook(() => useRemainingSeconds(new Date(START + 2_000)))
    act(() => {
      vi.advanceTimersByTime(5_000)
    })
    expect(result.current).toBe(0)
  })

  it('al sumar 15 s con +15s, muestra de inmediato el tiempo correcto', () => {
    const endsAt = new Date(START + 60_000)
    const { result, rerender } = renderHook(({ endsAt }) => useRemainingSeconds(endsAt), { initialProps: { endsAt } })
    act(() => {
      vi.advanceTimersByTime(20_000)
    })
    expect(result.current).toBe(40)

    rerender({ endsAt: new Date(endsAt.getTime() + 15_000) })
    expect(result.current).toBe(55)
  })

  it('tras una suspensión larga (app en segundo plano) al volver muestra el tiempo real', () => {
    const { result } = renderHook(() => useRemainingSeconds(new Date(START + 180_000)))
    // Pasan 100 s de golpe, sin ticks intermedios; el siguiente tic corrige el valor
    act(() => {
      vi.setSystemTime(START + 100_000)
      vi.advanceTimersByTime(1000)
    })
    expect(result.current).toBe(79)
  })
})

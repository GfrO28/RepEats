import { describe, expect, it } from 'vitest'
import type { CompletedSet, DropSet } from '@/repositories/SessionRepository'
import {
  countPendingDrops,
  formatDropChain,
  getSetVolume,
  suggestDrop,
  suggestDropWeight,
} from './dropSet'

const at = new Date('2026-10-01T10:00:00')
const drop = (weight: number, reps: number): DropSet => ({ weight, reps, completedAt: at })
const madre = (weight: number, reps: number, drops?: DropSet[]): CompletedSet => ({
  type: 'Drop Set',
  weight,
  reps,
  completedAt: at,
  ...(drops && { drops }),
})

describe('suggestDropWeight', () => {
  it('baja un 20 % y redondea al múltiplo de 2.5 kg más cercano', () => {
    expect(suggestDropWeight(60)).toBe(47.5) // 48 → 47.5
    expect(suggestDropWeight(100)).toBe(80)
    expect(suggestDropWeight(40)).toBe(32.5) // 32 → 32.5
  })

  it('en cascada: cada bajada parte de la anterior ya redondeada', () => {
    const first = suggestDropWeight(60)
    const second = suggestDropWeight(first)
    expect([first, second]).toEqual([47.5, 37.5]) // 47.5 × 0.8 = 38 → 37.5
  })

  it('sin peso (peso corporal) no hay nada que bajar', () => {
    expect(suggestDropWeight(0)).toBe(0)
  })

  it('con pesos muy chicos nunca sugiere 0 ni más que el peso anterior', () => {
    expect(suggestDropWeight(2.5)).toBe(2.5)
    expect(suggestDropWeight(1)).toBe(1)
    expect(suggestDropWeight(5)).toBe(5) // 4 → 5 (múltiplo más cercano), no sube
  })

  it('el resultado siempre es múltiplo de 2.5 (salvo el piso por pesos chicos)', () => {
    for (const weight of [22.5, 37.5, 52.5, 67.5, 82.5, 112.5]) {
      expect(suggestDropWeight(weight) % 2.5).toBe(0)
    }
  })
})

describe('suggestDrop', () => {
  it('la primera bajada parte de la madre y repite sus repeticiones', () => {
    expect(suggestDrop(madre(60, 8, []), 0)).toEqual({ weight: 47.5, reps: 8 })
  })

  it('la segunda pendiente sigue la cascada aunque la primera no se haya hecho', () => {
    expect(suggestDrop(madre(60, 8, []), 1)).toEqual({ weight: 37.5, reps: 8 })
  })

  it('las bajadas ya completadas devuelven lo registrado', () => {
    expect(suggestDrop(madre(60, 8, [drop(50, 6)]), 0)).toEqual({ weight: 50, reps: 6 })
  })

  it('una pendiente continúa desde la última completada, con sus repeticiones', () => {
    // la última hecha fue 50 × 6 (no los 47.5 sugeridos): la cascada sigue desde ahí
    expect(suggestDrop(madre(60, 8, [drop(50, 6)]), 1)).toEqual({ weight: 40, reps: 6 })
  })

  it('una madre sin el campo "drops" se trata como sin bajadas', () => {
    expect(suggestDrop(madre(60, 8), 0)).toEqual({ weight: 47.5, reps: 8 })
  })
})

describe('countPendingDrops', () => {
  it('por defecto se esperan 2 bajadas', () => {
    expect(countPendingDrops(madre(60, 8, []), null)).toBe(2)
    expect(countPendingDrops(madre(60, 8, [drop(48, 6)]), null)).toBe(1)
    expect(countPendingDrops(madre(60, 8, [drop(48, 6), drop(38, 5)]), null)).toBe(0)
  })

  it('respeta lo que el usuario agregó o quitó', () => {
    expect(countPendingDrops(madre(60, 8, [drop(48, 6)]), 3)).toBe(2)
    expect(countPendingDrops(madre(60, 8, []), 0)).toBe(0)
  })

  it('nunca es negativo si ya hay más bajadas hechas que las planeadas', () => {
    expect(countPendingDrops(madre(60, 8, [drop(48, 6), drop(38, 5), drop(30, 4)]), 2)).toBe(0)
  })
})

describe('getSetVolume', () => {
  it('una serie sin bajadas es peso × reps', () => {
    expect(getSetVolume(madre(60, 8))).toBe(480)
    expect(getSetVolume(madre(60, 8, []))).toBe(480)
  })

  it('suma la madre y todas las bajadas', () => {
    expect(getSetVolume(madre(60, 8, [drop(47.5, 6), drop(37.5, 5)]))).toBe(480 + 285 + 187.5)
  })
})

describe('formatDropChain', () => {
  it('muestra el bloque completo en una línea', () => {
    expect(formatDropChain(madre(60, 8, [drop(47.5, 6), drop(37.5, 5)]))).toBe('60×8 → 47.5×6 → 37.5×5')
  })

  it('sin bajadas muestra solo la madre', () => {
    expect(formatDropChain(madre(60, 8, []))).toBe('60×8')
  })

  it('puede convertir el peso para mostrarlo (p. ej. a libras)', () => {
    expect(formatDropChain(madre(50, 8, [drop(40, 6)]), (kg) => kg * 2)).toBe('100×8 → 80×6')
  })
})

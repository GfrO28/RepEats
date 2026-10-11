import { describe, expect, it } from 'vitest'
import type { CompletedSet, Session } from '@/repositories/SessionRepository'
import type { SetTypes } from './setTypes'
import {
  countEffectiveSets,
  countPerformedExercises,
  formatMonthLabel,
  formatSessionDate,
  formatSetGroup,
  getSessionDurationSeconds,
  groupSessionsByMonth,
  summarizeSets,
} from './sessionHistory'

const when = new Date(2026, 2, 4, 18, 0)
const set = (weight: number, reps: number, type: SetTypes = 'Normal'): CompletedSet => ({
  type,
  weight,
  reps,
  completedAt: when,
})

function makeSession(id: string, endedAt: Date, overrides: Partial<Session> = {}): Session {
  return {
    id,
    routineId: null,
    startedAt: new Date(endedAt.getTime() - 60 * 60_000),
    endedAt,
    status: 'completed',
    exercises: [],
    manualExerciseKcal: null,
    ...overrides,
  }
}

describe('formatSessionDate', () => {
  it('da el día de la semana, el día y el mes', () => {
    expect(formatSessionDate(new Date(2026, 2, 4))).toBe('mié 4 mar')
    expect(formatSessionDate(new Date(2026, 11, 25))).toBe('vie 25 dic')
    expect(formatSessionDate(new Date(2026, 0, 1))).toBe('jue 1 ene')
  })
})

describe('formatMonthLabel', () => {
  it('escribe el mes en español con mayúscula inicial y el año', () => {
    expect(formatMonthLabel('2026-03')).toBe('Marzo 2026')
    expect(formatMonthLabel('2025-12')).toBe('Diciembre 2025')
    expect(formatMonthLabel('2026-01')).toBe('Enero 2026')
  })
})

describe('groupSessionsByMonth', () => {
  it('agrupa por mes, con lo más reciente primero (meses y sesiones)', () => {
    const groups = groupSessionsByMonth([
      makeSession('feb', new Date(2026, 1, 10)),
      makeSession('mar2', new Date(2026, 2, 20)),
      makeSession('mar1', new Date(2026, 2, 5)),
      makeSession('ene', new Date(2026, 0, 30)),
    ])
    expect(groups.map((group) => group.monthKey)).toEqual(['2026-03', '2026-02', '2026-01'])
    expect(groups[0]?.label).toBe('Marzo 2026')
    expect(groups[0]?.sessions.map((session) => session.id)).toEqual(['mar2', 'mar1'])
  })

  it('separa el mismo mes de años distintos', () => {
    const groups = groupSessionsByMonth([makeSession('a', new Date(2025, 2, 5)), makeSession('b', new Date(2026, 2, 5))])
    expect(groups.map((group) => group.monthKey)).toEqual(['2026-03', '2025-03'])
  })

  it('una sesión que termina justo pasada la medianoche del mes siguiente va en ese mes', () => {
    const groups = groupSessionsByMonth([makeSession('noche', new Date(2026, 3, 1, 0, 20), { startedAt: new Date(2026, 2, 31, 23, 10) })])
    expect(groups[0]?.monthKey).toBe('2026-04')
  })

  it('ignora las sesiones que no están completadas', () => {
    const groups = groupSessionsByMonth([makeSession('curso', new Date(2026, 2, 5), { status: 'in_progress', endedAt: null })])
    expect(groups).toEqual([])
  })

  it('sin sesiones no hay grupos, y no modifica la lista original', () => {
    expect(groupSessionsByMonth([])).toEqual([])
    const input = [makeSession('a', new Date(2026, 1, 1)), makeSession('b', new Date(2026, 2, 1))]
    const copy = [...input]
    groupSessionsByMonth(input)
    expect(input).toEqual(copy)
  })
})

describe('getSessionDurationSeconds / conteos', () => {
  it('la duración es de que empezó a que terminó', () => {
    expect(getSessionDurationSeconds(makeSession('a', when))).toBe(3600)
  })

  it('nunca es negativa', () => {
    expect(getSessionDurationSeconds(makeSession('a', when, { startedAt: new Date(when.getTime() + 5000) }))).toBe(0)
  })

  const session = makeSession('a', when, {
    exercises: [
      { exerciseId: 'e1', notes: '', sets: [set(20, 10, 'Calentamiento'), set(60, 8), set(60, 8)] },
      { exerciseId: 'e2', notes: '', sets: [] }, // ejercicio de la rutina que se saltó
      { exerciseId: 'e3', notes: '', sets: [set(0, 12, 'Al Fallo')] },
    ],
  })

  it('las series efectivas no incluyen el calentamiento', () => {
    expect(countEffectiveSets(session)).toBe(3)
  })

  it('los ejercicios realizados no incluyen los que quedaron sin series', () => {
    expect(countPerformedExercises(session)).toBe(2)
  })
})

describe('summarizeSets / formatSetGroup', () => {
  it('junta series seguidas idénticas', () => {
    const groups = summarizeSets([set(60, 8), set(60, 8), set(60, 8), set(60, 6)])
    expect(groups).toEqual([
      { type: 'Normal', count: 3, reps: 8, weight: 60 },
      { type: 'Normal', count: 1, reps: 6, weight: 60 },
    ])
  })

  it('no junta series idénticas que no son seguidas ni de distinto tipo', () => {
    const groups = summarizeSets([set(60, 8), set(70, 8), set(60, 8), set(60, 8, 'Al Fallo')])
    expect(groups).toHaveLength(4)
  })

  it('sin series devuelve una lista vacía', () => {
    expect(summarizeSets([])).toEqual([])
  })

  it('formatea peso, repeticiones y cantidad', () => {
    expect(formatSetGroup({ type: 'Normal', count: 4, reps: 8, weight: 60 })).toBe('4 × 8 @ 60 kg')
    expect(formatSetGroup({ type: 'Normal', count: 1, reps: 10, weight: 22.5 })).toBe('1 × 10 @ 22.5 kg')
  })

  it('sin peso es peso corporal', () => {
    expect(formatSetGroup({ type: 'Normal', count: 3, reps: 12, weight: 0 })).toBe('3 × 12 (peso corporal)')
  })

  it('los tipos distintos de normal llevan su nombre delante', () => {
    expect(formatSetGroup({ type: 'Calentamiento', count: 1, reps: 12, weight: 20 })).toBe('Calentamiento: 1 × 12 @ 20 kg')
    expect(formatSetGroup({ type: 'Al Fallo', count: 1, reps: 9, weight: 60 })).toBe('Al fallo: 1 × 9 @ 60 kg')
    expect(formatSetGroup({ type: 'Drop Set', count: 2, reps: 6, weight: 40 })).toBe('Drop set: 2 × 6 @ 40 kg')
  })
})

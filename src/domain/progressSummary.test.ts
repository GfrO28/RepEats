import { describe, expect, it } from 'vitest'
import type { Session } from '@/repositories/SessionRepository'
import type { SetTypes } from './setTypes'
import {
  collectRecords,
  compareWeeks,
  countRecordsInWeek,
  findRecentRecords,
  getSessionDate,
  getWeeklyHistory,
  summarizeWeek,
} from './progressSummary'

// Semana de referencia: lunes 2 al domingo 8 de marzo de 2026 (fechas locales)
const day = (dayOfMonth: number, hour = 18) => new Date(2026, 2, dayOfMonth, hour, 0)
const REFERENCE = day(4, 12) // miércoles

function makeSession(
  id: string,
  endedAt: Date,
  sets: { weight: number; reps: number; type?: SetTypes }[],
  options: { minutes?: number; exerciseId?: string; status?: Session['status'] } = {},
): Session {
  const minutes = options.minutes ?? 60
  return {
    id,
    routineId: null,
    startedAt: new Date(endedAt.getTime() - minutes * 60_000),
    endedAt,
    status: options.status ?? 'completed',
    exercises: [
      {
        exerciseId: options.exerciseId ?? 'press',
        notes: '',
        sets: sets.map((set) => ({ type: set.type ?? 'Normal', weight: set.weight, reps: set.reps, completedAt: endedAt })),
      },
    ],
    manualExerciseKcal: null,
  }
}

describe('getSessionDate', () => {
  it('usa cuándo terminó la sesión, o cuándo empezó si no hay fin', () => {
    const session = makeSession('a', day(4), [{ weight: 60, reps: 8 }])
    expect(getSessionDate(session)).toEqual(day(4))
    expect(getSessionDate({ ...session, endedAt: null })).toEqual(session.startedAt)
  })
})

describe('summarizeWeek', () => {
  it('la semana de referencia empieza en lunes (verificación del calendario de prueba)', () => {
    expect(new Date(2026, 2, 2).getDay()).toBe(1)
  })

  it('suma sesiones, volumen (sin calentamiento) y tiempo de la semana', () => {
    const sessions = [
      makeSession('a', day(2), [{ weight: 100, reps: 5 }, { weight: 20, reps: 10, type: 'Calentamiento' }], { minutes: 50 }),
      makeSession('b', day(4), [{ weight: 60, reps: 10 }], { minutes: 70 }),
    ]
    const week = summarizeWeek(sessions, REFERENCE)
    expect(week.sessionCount).toBe(2)
    expect(week.volumeKg).toBe(100 * 5 + 60 * 10) // el calentamiento (20 × 10) no cuenta
    expect(week.durationSeconds).toBe((50 + 70) * 60)
    expect(week.weekStart).toEqual(new Date(2026, 2, 2, 0, 0, 0, 0))
  })

  it('marca los días entrenados de lunes a domingo', () => {
    const sessions = [
      makeSession('a', day(2), [{ weight: 50, reps: 5 }]), // lunes
      makeSession('b', day(4), [{ weight: 50, reps: 5 }]), // miércoles
      makeSession('c', day(8), [{ weight: 50, reps: 5 }]), // domingo
    ]
    expect(summarizeWeek(sessions, REFERENCE).trainedDays).toEqual([true, false, true, false, false, false, true])
  })

  it('dos sesiones el mismo día cuentan como dos sesiones pero un solo día entrenado', () => {
    const sessions = [
      makeSession('a', day(3, 9), [{ weight: 50, reps: 5 }]),
      makeSession('b', day(3, 19), [{ weight: 50, reps: 5 }]),
    ]
    const week = summarizeWeek(sessions, REFERENCE)
    expect(week.sessionCount).toBe(2)
    expect(week.trainedDays.filter(Boolean)).toHaveLength(1)
  })

  it('ignora sesiones de otras semanas y las que no están completadas', () => {
    const sessions = [
      makeSession('otra', day(1), [{ weight: 50, reps: 5 }]), // domingo anterior
      makeSession('siguiente', day(9), [{ weight: 50, reps: 5 }]), // lunes siguiente
      makeSession('curso', day(4), [{ weight: 50, reps: 5 }], { status: 'in_progress' }),
    ]
    expect(summarizeWeek(sessions, REFERENCE).sessionCount).toBe(0)
  })

  it('domingo 23:59 sigue siendo de la misma semana; lunes 00:00 ya es de la siguiente', () => {
    const lateSunday = new Date(2026, 2, 8, 23, 59, 59)
    const earlyMonday = new Date(2026, 2, 9, 0, 0, 0)
    const sessions = [
      makeSession('a', lateSunday, [{ weight: 50, reps: 5 }]),
      makeSession('b', earlyMonday, [{ weight: 50, reps: 5 }]),
    ]
    expect(summarizeWeek(sessions, REFERENCE).sessionCount).toBe(1)
    expect(summarizeWeek(sessions, new Date(2026, 2, 10)).sessionCount).toBe(1)
  })

  it('una semana sin sesiones da ceros', () => {
    const week = summarizeWeek([], REFERENCE)
    expect(week).toMatchObject({ sessionCount: 0, volumeKg: 0, durationSeconds: 0 })
    expect(week.trainedDays).toEqual([false, false, false, false, false, false, false])
  })
})

describe('getWeeklyHistory', () => {
  it('devuelve las últimas N semanas, de la más antigua a la actual, incluyendo las vacías', () => {
    const sessions = [
      makeSession('a', day(4), [{ weight: 50, reps: 5 }]), // semana actual
      makeSession('b', new Date(2026, 1, 18), [{ weight: 50, reps: 5 }]), // 2 semanas antes (miércoles 18 feb)
    ]
    const history = getWeeklyHistory(sessions, REFERENCE, 4)
    expect(history).toHaveLength(4)
    expect(history.map((week) => week.sessionCount)).toEqual([0, 1, 0, 1])
    expect(history[3]?.weekStart).toEqual(new Date(2026, 2, 2))
    expect(history[0]?.weekStart).toEqual(new Date(2026, 1, 9))
  })

  it('por defecto muestra 8 semanas', () => {
    expect(getWeeklyHistory([], REFERENCE)).toHaveLength(8)
  })

  it('las semanas siempre empiezan en lunes, también cruzando el fin de año', () => {
    const history = getWeeklyHistory([], new Date(2026, 0, 7), 3)
    expect(history.map((week) => week.weekStart.getDay())).toEqual([1, 1, 1])
    expect(history[0]?.weekStart).toEqual(new Date(2025, 11, 22))
  })
})

describe('compareWeeks', () => {
  it('resta la semana anterior de la actual', () => {
    const current = summarizeWeek([makeSession('a', day(4), [{ weight: 100, reps: 10 }], { minutes: 60 })], REFERENCE)
    const previous = summarizeWeek([], REFERENCE)
    expect(compareWeeks(current, previous)).toEqual({ sessionCount: 1, volumeKg: 1000, durationSeconds: 3600 })
    expect(compareWeeks(previous, current)).toEqual({ sessionCount: -1, volumeKg: -1000, durationSeconds: -3600 })
  })
})

describe('collectRecords / findRecentRecords / countRecordsInWeek', () => {
  // 1RM estimado (Epley): 100 × (1 + 5/30) = 116.67 ; 100 × (1 + 8/30) = 126.67 ; 110 × (1 + 5/30) = 128.33
  const first = makeSession('s1', day(2), [{ weight: 100, reps: 5 }])
  const better = makeSession('s2', day(4), [{ weight: 110, reps: 5 }])
  const worse = makeSession('s3', day(6), [{ weight: 90, reps: 5 }])

  it('la primera vez que haces un ejercicio no cuenta como récord', () => {
    expect(collectRecords([first])).toEqual([])
  })

  it('superar tu mejor 1RM anterior es un récord, con el valor previo y el nuevo', () => {
    const events = collectRecords([first, better])
    expect(events).toHaveLength(1)
    expect(events[0]).toMatchObject({ exerciseId: 'press', date: day(4) })
    expect(events[0]?.previousBest).toBeCloseTo(116.67, 1)
    expect(events[0]?.newBest).toBeCloseTo(128.33, 1)
  })

  it('una sesión más floja no es récord, y el siguiente récord se compara con el mejor de siempre', () => {
    const later = makeSession('s4', day(8), [{ weight: 115, reps: 5 }])
    const events = collectRecords([first, better, worse, later])
    expect(events.map((event) => event.date)).toEqual([day(4), day(8)])
    expect(events[1]?.previousBest).toBeCloseTo(128.33, 1) // no el de la sesión floja
  })

  it('no depende del orden en que lleguen las sesiones', () => {
    expect(collectRecords([better, first])).toEqual(collectRecords([first, better]))
  })

  it('cada ejercicio lleva su propio récord', () => {
    const squat1 = makeSession('q1', day(2), [{ weight: 140, reps: 5 }], { exerciseId: 'sentadilla' })
    const events = collectRecords([first, squat1, better])
    expect(events.map((event) => event.exerciseId)).toEqual(['press'])
  })

  it('ignora las sesiones no completadas', () => {
    const inProgress = makeSession('x', day(4), [{ weight: 200, reps: 5 }], { status: 'in_progress' })
    expect(collectRecords([first, inProgress])).toEqual([])
  })

  it('un ejercicio sin series no rompe nada', () => {
    const empty = makeSession('e', day(4), [])
    expect(collectRecords([first, empty])).toEqual([])
  })

  it('findRecentRecords devuelve los más recientes primero y respeta el límite', () => {
    const later = makeSession('s4', day(8), [{ weight: 120, reps: 5 }])
    const events = collectRecords([first, better, later])
    expect(findRecentRecords(events, 5).map((event) => event.date)).toEqual([day(8), day(4)])
    expect(findRecentRecords(events, 1).map((event) => event.date)).toEqual([day(8)])
  })

  it('countRecordsInWeek cuenta solo los de esa semana', () => {
    const nextWeek = makeSession('s5', day(11), [{ weight: 130, reps: 5 }])
    const events = collectRecords([first, better, nextWeek])
    expect(countRecordsInWeek(events, REFERENCE)).toBe(1)
    expect(countRecordsInWeek(events, day(11))).toBe(1)
    expect(countRecordsInWeek(events, new Date(2026, 3, 20))).toBe(0)
  })
})

import { describe, it, expect } from 'vitest'
import {
  findPreviousSetForType,
  getExerciseHistory,
  getLastPerformedDates,
  summarizeExercise,
  type ExerciseSessionStat,
} from './exerciseHistory'
import type { CompletedSet, Session } from '@/repositories/SessionRepository'

const completedSessionOld: Session = {
  id: 'session-old',
  routineId: null,
  startedAt: new Date('2026-01-01'),
  endedAt: new Date('2026-01-01'),
  status: 'completed',
  manualExerciseKcal: null,
  exercises: [
    {
      exerciseId: 'e1',
      notes: '',
      sets: [
        { type: 'Normal', weight: 50, reps: 8, rir: undefined, completedAt: new Date('2026-01-01') },
        { type: 'Normal', weight: 50, reps: 8, rir: undefined, completedAt: new Date('2026-01-01') },
      ],
    },
  ],
}

const completedSessionNew: Session = {
  id: 'session-new',
  routineId: null,
  startedAt: new Date('2026-02-01'),
  endedAt: new Date('2026-02-01'),
  status: 'completed',
  manualExerciseKcal: null,
  exercises: [
    {
      exerciseId: 'e1',
      notes: '',
      sets: [{ type: 'Normal', weight: 60, reps: 8, rir: undefined, completedAt: new Date('2026-02-01') }],
    },
    {
      exerciseId: 'e2',
      notes: '',
      sets: [{ type: 'Normal', weight: 100, reps: 5, rir: undefined, completedAt: new Date('2026-02-01') }],
    },
  ],
}

const inProgressSession: Session = {
  id: 'session-active',
  routineId: null,
  startedAt: new Date('2026-03-01'),
  endedAt: null,
  status: 'in_progress',
  manualExerciseKcal: null,
  exercises: [
    {
      exerciseId: 'e1',
      notes: '',
      sets: [{ type: 'Normal', weight: 999, reps: 1, rir: undefined, completedAt: new Date('2026-03-01') }],
    },
  ],
}

describe('getExerciseHistory', () => {
  it('devuelve una entrada por cada sesión completada con ese ejercicio, ordenadas por fecha ascendente', () => {
    const history = getExerciseHistory([completedSessionNew, completedSessionOld, inProgressSession], 'e1')

    expect(history.length).toBe(2)
    expect(history[0]?.sessionId).toBe('session-old')
    expect(history[1]?.sessionId).toBe('session-new')
  })

  it('calcula peso máximo, volumen y 1RM estimado de esa sesión', () => {
    const history = getExerciseHistory([completedSessionOld], 'e1')

    expect(history[0]?.maxWeight).toBe(50)
    expect(history[0]?.volume).toBe(800)
    expect(history[0]?.bestOneRepMax).toBeCloseTo(63.33, 2)
  })

  it('ignora sesiones donde no se hizo ese ejercicio', () => {
    const history = getExerciseHistory([completedSessionOld], 'e2')
    expect(history.length).toBe(0)
  })

  it('ignora sesiones que no están completadas, aunque tengan el ejercicio', () => {
    const history = getExerciseHistory([inProgressSession], 'e1')
    expect(history.length).toBe(0)
  })
})

describe('getExerciseHistory: calentamiento y series', () => {
  const session: Session = {
    id: 's',
    routineId: null,
    startedAt: new Date('2026-02-01'),
    endedAt: new Date('2026-02-01'),
    status: 'completed',
    manualExerciseKcal: null,
    exercises: [
      {
        exerciseId: 'e1',
        notes: '',
        sets: [
          { type: 'Calentamiento', weight: 20, reps: 10, completedAt: new Date('2026-02-01') },
          { type: 'Normal', weight: 60, reps: 8, completedAt: new Date('2026-02-01') },
        ],
      },
    ],
  }

  it('el volumen no cuenta el calentamiento', () => {
    expect(getExerciseHistory([session], 'e1')[0]?.volume).toBe(480)
  })

  it('devuelve las series de esa sesión, para poder mostrarlas', () => {
    expect(getExerciseHistory([session], 'e1')[0]?.sets).toHaveLength(2)
  })
})

describe('findPreviousSetForType', () => {
  const set = (type: CompletedSet['type'], weight: number, reps: number): CompletedSet => ({
    type,
    weight,
    reps,
    completedAt: new Date('2026-02-01'),
  })
  const lastTime = [set('Calentamiento', 20, 12), set('Normal', 60, 8), set('Normal', 60, 8), set('Normal', 60, 7)]

  it('sin sesión anterior no hay referencia', () => {
    expect(findPreviousSetForType(null, [], 'Normal')).toBeNull()
    expect(findPreviousSetForType([], [], 'Normal')).toBeNull()
  })

  it('hoy sin calentamiento: la 1.ª Normal se compara con la 1.ª Normal, no con el calentamiento', () => {
    expect(findPreviousSetForType(lastTime, [], 'Normal')).toBe(lastTime[1])
    expect(findPreviousSetForType(lastTime, [set('Normal', 60, 8)], 'Normal')).toBe(lastTime[2])
    expect(findPreviousSetForType(lastTime, [set('Normal', 60, 8), set('Normal', 60, 8)], 'Normal')).toBe(lastTime[3])
  })

  it('hoy con calentamiento y la vez pasada sin él: el calentamiento no tiene referencia y las Normal no se desfasan', () => {
    const withoutWarmup = [set('Normal', 60, 8), set('Normal', 60, 7)]
    expect(findPreviousSetForType(withoutWarmup, [], 'Calentamiento')).toBeNull()
    expect(findPreviousSetForType(withoutWarmup, [set('Calentamiento', 20, 10)], 'Normal')).toBe(withoutWarmup[0])
  })

  it('el calentamiento se compara con el calentamiento', () => {
    expect(findPreviousSetForType(lastTime, [], 'Calentamiento')).toBe(lastTime[0])
  })

  it('si hoy haces más series de un tipo que la vez pasada, las extra no tienen referencia', () => {
    const done = [set('Normal', 60, 8), set('Normal', 60, 8), set('Normal', 60, 8)]
    expect(findPreviousSetForType(lastTime, done, 'Normal')).toBeNull()
  })

  it('cuenta por tipo al intercalar tipos distintos', () => {
    const previous = [set('Normal', 60, 8), set('Drop Set', 40, 10), set('Normal', 60, 6)]
    expect(findPreviousSetForType(previous, [set('Normal', 60, 8), set('Drop Set', 40, 9)], 'Normal')).toBe(previous[2])
  })
})

describe('getLastPerformedDates', () => {
  it('da la fecha más reciente de cada ejercicio, sin contar sesiones en curso ni ejercicios sin series', () => {
    const skipped: Session = {
      ...completedSessionNew,
      id: 'skipped',
      endedAt: new Date('2026-04-01'),
      exercises: [{ exerciseId: 'e1', notes: '', sets: [] }],
    }
    const dates = getLastPerformedDates([completedSessionOld, completedSessionNew, inProgressSession, skipped])
    expect(dates.get('e1')).toEqual(new Date('2026-02-01'))
    expect(dates.get('e2')).toEqual(new Date('2026-02-01'))
    expect(dates.has('e3')).toBe(false)
  })
})

describe('summarizeExercise', () => {
  const stat = (day: number, maxWeight: number, oneRm: number): ExerciseSessionStat => ({
    sessionId: `s${day}`,
    date: new Date(2026, 0, day),
    maxWeight,
    bestOneRepMax: oneRm,
    volume: 0,
    sets: [],
  })

  it('sin sesiones no hay resumen', () => {
    expect(summarizeExercise([])).toBeNull()
  })

  it('con una sola sesión, primera y última son la misma y el cambio es cero', () => {
    const summary = summarizeExercise([stat(1, 60, 76)])
    expect(summary?.sessionCount).toBe(1)
    expect(summary?.first).toBe(summary?.last)
    expect(summary?.oneRepMaxChange).toEqual({ kg: 0, percent: 0 })
  })

  it('encuentra el mejor 1RM y el mayor peso con su fecha, aunque no sean de la última sesión', () => {
    const summary = summarizeExercise([stat(1, 60, 76), stat(8, 70, 90), stat(15, 65, 82)])
    expect(summary?.bestOneRepMax).toEqual({ value: 90, date: new Date(2026, 0, 8) })
    expect(summary?.maxWeight).toEqual({ value: 70, date: new Date(2026, 0, 8) })
  })

  it('en un empate se queda con la sesión más antigua', () => {
    const summary = summarizeExercise([stat(1, 60, 80), stat(8, 60, 80)])
    expect(summary?.bestOneRepMax.date).toEqual(new Date(2026, 0, 1))
    expect(summary?.maxWeight.date).toEqual(new Date(2026, 0, 1))
  })

  it('calcula el cambio del 1RM entre la primera y la última sesión, en kg y en porcentaje', () => {
    const summary = summarizeExercise([stat(1, 60, 80), stat(15, 70, 90)])
    expect(summary?.oneRepMaxChange.kg).toBe(10)
    expect(summary?.oneRepMaxChange.percent).toBeCloseTo(12.5, 10)
  })

  it('el cambio puede ser negativo, y con 1RM inicial 0 no hay porcentaje', () => {
    expect(summarizeExercise([stat(1, 60, 80), stat(15, 50, 70)])?.oneRepMaxChange.kg).toBe(-10)
    expect(summarizeExercise([stat(1, 0, 0), stat(15, 50, 70)])?.oneRepMaxChange.percent).toBeNull()
  })
})

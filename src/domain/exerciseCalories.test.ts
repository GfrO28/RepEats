import { describe, expect, it } from 'vitest'
import type { Session } from '@/repositories/SessionRepository'
import {
  RESISTANCE_TRAINING_MET,
  estimateDayExerciseKcal,
  estimateExerciseKcal,
  estimateSessionKcal,
  resolveDayExerciseKcal,
  resolveSessionKcal,
} from './exerciseCalories'

function makeSession(
  id: string,
  endedAt: Date,
  minutes: number,
  status: Session['status'] = 'completed',
  manualExerciseKcal: number | null = null,
): Session {
  return {
    id,
    routineId: null,
    startedAt: new Date(endedAt.getTime() - minutes * 60_000),
    endedAt: status === 'completed' ? endedAt : null,
    status,
    exercises: [],
    manualExerciseKcal,
  }
}

describe('estimateExerciseKcal', () => {
  it('kcal = MET × peso × horas', () => {
    // 3.5 × 72 kg × 1 h = 252 kcal
    expect(estimateExerciseKcal(3600, 72)).toBe(252)
  })

  it('usa las horas fraccionadas: 75 minutos', () => {
    // 3.5 × 72 × 1.25 = 315
    expect(estimateExerciseKcal(75 * 60, 72)).toBe(315)
  })

  it('acepta otro MET', () => {
    expect(estimateExerciseKcal(3600, 72, 6)).toBe(432)
    expect(RESISTANCE_TRAINING_MET).toBe(3.5)
  })

  it('sin duración, o con duración o peso inválidos, no estima nada', () => {
    expect(estimateExerciseKcal(0, 72)).toBe(0)
    expect(estimateExerciseKcal(-60, 72)).toBe(0)
    expect(estimateExerciseKcal(3600, 0)).toBe(0)
    expect(estimateExerciseKcal(3600, -70)).toBe(0)
    expect(estimateExerciseKcal(Number.NaN, 72)).toBe(0)
    expect(estimateExerciseKcal(3600, Number.NaN)).toBe(0)
  })

  it('redondea a kcal enteras', () => {
    expect(Number.isInteger(estimateExerciseKcal(1234, 71.3))).toBe(true)
  })
})

describe('estimateSessionKcal', () => {
  it('usa lo que duró la sesión', () => {
    expect(estimateSessionKcal(makeSession('a', new Date(2026, 2, 4, 19), 60), 72)).toBe(252)
  })

  it('una sesión sin fin cuenta desde que empezó hasta el mismo instante: 0 kcal', () => {
    const open = makeSession('a', new Date(2026, 2, 4, 19), 60, 'in_progress')
    expect(estimateSessionKcal(open, 72)).toBe(0)
  })
})

describe('estimateDayExerciseKcal', () => {
  it('suma las sesiones completadas que terminaron ese día', () => {
    const sessions = [
      makeSession('mañana', new Date(2026, 2, 4, 9), 60),
      makeSession('tarde', new Date(2026, 2, 4, 19), 30),
      makeSession('otro-dia', new Date(2026, 2, 5, 19), 60),
      makeSession('en-curso', new Date(2026, 2, 4, 20), 60, 'in_progress'),
    ]
    // 252 + 126 = 378
    expect(estimateDayExerciseKcal(sessions, '2026-03-04', 72)).toBe(378)
  })

  it('un día sin entrenar da 0', () => {
    expect(estimateDayExerciseKcal([makeSession('a', new Date(2026, 2, 4, 19), 60)], '2026-03-06', 72)).toBe(0)
    expect(estimateDayExerciseKcal([], '2026-03-04', 72)).toBe(0)
  })

  it('usa el día local: una sesión que termina justo después de medianoche es del día siguiente', () => {
    const late = makeSession('noche', new Date(2026, 2, 5, 0, 15), 60)
    expect(estimateDayExerciseKcal([late], '2026-03-05', 72)).toBe(252)
    expect(estimateDayExerciseKcal([late], '2026-03-04', 72)).toBe(0)
  })
})

describe('resolveSessionKcal', () => {
  it('sin corrección manual, usa la estimación por MET', () => {
    const session = makeSession('a', new Date(2026, 2, 4, 19), 60)
    expect(resolveSessionKcal(session, 72)).toBe(252)
  })

  it('con corrección manual, usa ese valor en vez de la estimación', () => {
    const session = makeSession('a', new Date(2026, 2, 4, 19), 60, 'completed', 400)
    expect(resolveSessionKcal(session, 72)).toBe(400)
  })
})

describe('resolveDayExerciseKcal', () => {
  it('suma la corrección manual cuando existe, y la estimación cuando no', () => {
    const sessions = [
      makeSession('mañana', new Date(2026, 2, 4, 9), 60, 'completed', 400),
      makeSession('tarde', new Date(2026, 2, 4, 19), 30),
    ]
    // 400 + 126 = 526
    expect(resolveDayExerciseKcal(sessions, '2026-03-04', 72)).toBe(526)
  })
})

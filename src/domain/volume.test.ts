import { describe, it, expect } from 'vitest'
import { calculateSessionVolume } from './volume'
import type { Session } from '@/repositories/SessionRepository'

const exampleSession: Session = {
  id: 's1',
  routineId: null,
  startedAt: new Date(),
  endedAt: null,
  status: 'in_progress',
  manualExerciseKcal: null,
  exercises: [
    {
      exerciseId: 'e1',
      notes: '',
      sets: [
        { type: 'Normal', weight: 60, reps: 8, rir: undefined, completedAt: new Date() },
        { type: 'Normal', weight: 60, reps: 8, rir: undefined, completedAt: new Date() },
      ],
    },
    {
      exerciseId: 'e2',
      notes: '',
      sets: [{ type: 'Normal', weight: 20, reps: 10, rir: undefined, completedAt: new Date() }],
    },
  ],
}

describe('calculateSessionVolume', () => {
  it('suma peso * reps de todas las series de todos los ejercicios', () => {
    expect(calculateSessionVolume(exampleSession)).toBe(1160)
  })

  it('da 0 si ningún ejercicio tiene series completadas', () => {
    const emptySession: Session = {
      ...exampleSession,
      exercises: exampleSession.exercises.map((exercise) => ({ ...exercise, sets: [] })),
    }
    expect(calculateSessionVolume(emptySession)).toBe(0)
  })

  it('excluye las series de tipo Calentamiento del volumen', () => {
    const sessionWithWarmup: Session = {
      ...exampleSession,
      exercises: [
        {
          exerciseId: 'e1',
          notes: '',
          sets: [
            { type: 'Calentamiento', weight: 20, reps: 10, rir: undefined, completedAt: new Date() },
            { type: 'Normal', weight: 60, reps: 8, rir: undefined, completedAt: new Date() },
          ],
        },
      ],
    }

    expect(calculateSessionVolume(sessionWithWarmup)).toBe(480)
  })
})

import { describe, it, expect } from 'vitest'
import { findNewRecords } from './personalRecords'
import type { Session } from '@/repositories/SessionRepository'

const pastSession: Session = {
  id: 'past1',
  routineId: null,
  startedAt: new Date('2026-01-01'),
  endedAt: new Date('2026-01-01'),
  status: 'completed',
  manualExerciseKcal: null,
  exercises: [
    {
      exerciseId: 'e1',
      notes: '',
      sets: [{ type: 'Normal', weight: 50, reps: 8, rir: undefined, completedAt: new Date('2026-01-01') }],
    },
  ],
}

describe('findNewRecords', () => {
  it('detecta un récord nuevo cuando el 1RM de esta sesión supera al histórico', () => {
    const currentSession: Session = {
      id: 'current',
      routineId: null,
      startedAt: new Date(),
      endedAt: null,
      status: 'in_progress',
      manualExerciseKcal: null,
      exercises: [
        {
          exerciseId: 'e1',
          notes: '',
          sets: [{ type: 'Normal', weight: 60, reps: 8, rir: undefined, completedAt: new Date() }],
        },
      ],
    }

    const records = findNewRecords(currentSession, [pastSession])

    expect(records.length).toBe(1)
    expect(records[0]?.exerciseId).toBe('e1')
  })

  it('no detecta récord si la sesión actual no supera lo anterior', () => {
    const currentSession: Session = {
      id: 'current',
      routineId: null,
      startedAt: new Date(),
      endedAt: null,
      status: 'in_progress',
      manualExerciseKcal: null,
      exercises: [
        {
          exerciseId: 'e1',
          notes: '',
          sets: [{ type: 'Normal', weight: 40, reps: 8, rir: undefined, completedAt: new Date() }],
        },
      ],
    }

    const records = findNewRecords(currentSession, [pastSession])

    expect(records.length).toBe(0)
  })
})

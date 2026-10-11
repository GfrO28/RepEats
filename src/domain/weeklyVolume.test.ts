import { describe, it, expect } from 'vitest'
import { calculateWeeklyVolumeByMuscleGroup } from './weeklyVolume'
import type { Session } from '@/repositories/SessionRepository'
import type { Exercise } from '@/repositories/WorkoutRepository'

const pressBanca: Exercise = {
  id: 'ex1',
  name: 'Press de banca',
  primaryMuscles: ['pectoral_medio'],
  secondaryMuscles: [],
  equipment: 'Barra',
  notes: '',
}

const elevacionPiernas: Exercise = {
  id: 'ex2',
  name: 'Elevación de piernas colgado',
  primaryMuscles: ['psoas_iliaco'],
  secondaryMuscles: ['recto_abdominal'],
  equipment: 'Peso corporal',
  notes: '',
}

const weekStart = new Date('2026-03-02')
const weekEnd = new Date('2026-03-08')

const sessionInsideWeek: Session = {
  id: 's1',
  routineId: null,
  startedAt: new Date('2026-03-04'),
  endedAt: new Date('2026-03-04'),
  status: 'completed',
  manualExerciseKcal: null,
  exercises: [
    {
      exerciseId: 'ex1',
      notes: '',
      sets: [
        { type: 'Normal', weight: 60, reps: 8, rir: undefined, completedAt: new Date('2026-03-04') },
        { type: 'Normal', weight: 60, reps: 8, rir: undefined, completedAt: new Date('2026-03-04') },
        { type: 'Normal', weight: 60, reps: 8, rir: undefined, completedAt: new Date('2026-03-04') },
      ],
    },
    {
      exerciseId: 'ex2',
      notes: '',
      sets: [
        { type: 'Normal', weight: 0, reps: 10, rir: undefined, completedAt: new Date('2026-03-04') },
        { type: 'Normal', weight: 0, reps: 10, rir: undefined, completedAt: new Date('2026-03-04') },
      ],
    },
  ],
}

const sessionOutsideWeek: Session = {
  id: 's2',
  routineId: null,
  startedAt: new Date('2026-02-01'),
  endedAt: new Date('2026-02-01'),
  status: 'completed',
  manualExerciseKcal: null,
  exercises: [
    {
      exerciseId: 'ex1',
      notes: '',
      sets: [{ type: 'Normal', weight: 60, reps: 8, rir: undefined, completedAt: new Date('2026-02-01') }],
    },
  ],
}

const sessionInProgress: Session = {
  id: 's3',
  routineId: null,
  startedAt: new Date('2026-03-05'),
  endedAt: null,
  status: 'in_progress',
  manualExerciseKcal: null,
  exercises: [
    {
      exerciseId: 'ex1',
      notes: '',
      sets: [{ type: 'Normal', weight: 60, reps: 8, rir: undefined, completedAt: new Date('2026-03-05') }],
    },
  ],
}

describe('calculateWeeklyVolumeByMuscleGroup', () => {
  it('cuenta las series (no los ejercicios) del grupo muscular dentro de la semana', () => {
    const result = calculateWeeklyVolumeByMuscleGroup(
      [sessionInsideWeek, sessionOutsideWeek, sessionInProgress],
      [pressBanca, elevacionPiernas],
      weekStart,
      weekEnd,
    )

    expect(result.Pectorales).toBe(3)
  })

  it('un músculo secundario aporta la mitad de una serie efectiva a su grupo', () => {
    // elevacionPiernas: primario psoas_iliaco (no cuenta), secundario recto_abdominal (Abdominales); 2 series
    const result = calculateWeeklyVolumeByMuscleGroup(
      [sessionInsideWeek],
      [pressBanca, elevacionPiernas],
      weekStart,
      weekEnd,
    )
    expect(result.Abdominales).toBe(1) // 2 series × 0.5
  })

  it('primario y secundario del mismo grupo, en músculos distintos, se suman', () => {
    // Remo con agarre pronado: primario Romboides, secundario Trapecio medio (ambos "Espalda alta")
    const remoPronado: Exercise = {
      id: 'ex3',
      name: 'Remo sentado en máquina, agarre pronado',
      primaryMuscles: ['romboides'],
      secondaryMuscles: ['trapecio_medio', 'biceps_cabeza_corta'],
      equipment: 'Máquina',
      notes: '',
    }
    const session: Session = {
      ...sessionInsideWeek,
      exercises: [{ exerciseId: 'ex3', notes: '', sets: [{ type: 'Normal', weight: 40, reps: 10, completedAt: new Date('2026-03-04') }] }],
    }
    const result = calculateWeeklyVolumeByMuscleGroup([session], [remoPronado], weekStart, weekEnd)
    // 1 serie de Romboides (primario, "Espalda alta") + 1 × 0.5 de Trapecio medio (secundario, también "Espalda alta")
    expect(result['Espalda alta']).toBe(1.5)
    expect(result.Bíceps).toBe(0.5) // Bíceps cabeza corta, secundario, otro grupo
  })

  it('excluye el grupo auxiliar "Flexores de cadera" del conteo, sea primario o secundario', () => {
    const result = calculateWeeklyVolumeByMuscleGroup(
      [sessionInsideWeek],
      [pressBanca, elevacionPiernas],
      weekStart,
      weekEnd,
    )
    expect(result['Flexores de cadera']).toBeUndefined() // psoas_iliaco es primario en elevacionPiernas

    const asSecondary: Exercise = { ...elevacionPiernas, id: 'ex4', primaryMuscles: ['recto_abdominal'], secondaryMuscles: ['psoas_iliaco'] }
    const session: Session = { ...sessionInsideWeek, exercises: [{ exerciseId: 'ex4', notes: '', sets: [{ type: 'Normal', weight: 0, reps: 10, completedAt: new Date('2026-03-04') }] }] }
    expect(calculateWeeklyVolumeByMuscleGroup([session], [asSecondary], weekStart, weekEnd)['Flexores de cadera']).toBeUndefined()
  })

  it('ignora sesiones fuera del rango de la semana o no completadas', () => {
    const result = calculateWeeklyVolumeByMuscleGroup(
      [sessionOutsideWeek, sessionInProgress],
      [pressBanca, elevacionPiernas],
      weekStart,
      weekEnd,
    )

    expect(result.Pectorales).toBeUndefined()
  })
})

describe('calculateWeeklyVolumeByMuscleGroup: calentamiento', () => {
  const warmUpSession: Session = {
    id: 's4',
    routineId: null,
    startedAt: new Date('2026-03-04'),
    endedAt: new Date('2026-03-04'),
    status: 'completed',
    manualExerciseKcal: null,
    exercises: [
      {
        exerciseId: 'ex1',
        notes: '',
        sets: [
          { type: 'Calentamiento', weight: 20, reps: 12, rir: undefined, completedAt: new Date('2026-03-04') },
          { type: 'Calentamiento', weight: 40, reps: 8, rir: undefined, completedAt: new Date('2026-03-04') },
          { type: 'Normal', weight: 60, reps: 8, rir: undefined, completedAt: new Date('2026-03-04') },
          { type: 'Al Fallo', weight: 60, reps: 6, rir: undefined, completedAt: new Date('2026-03-04') },
        ],
      },
    ],
  }

  it('no cuenta las series de calentamiento', () => {
    const result = calculateWeeklyVolumeByMuscleGroup([warmUpSession], [pressBanca], weekStart, weekEnd)
    expect(result.Pectorales).toBe(2)
  })

  it('un ejercicio con solo calentamiento no suma nada al grupo', () => {
    const onlyWarmUp: Session = {
      ...warmUpSession,
      exercises: [{ exerciseId: 'ex1', notes: '', sets: warmUpSession.exercises[0]!.sets.slice(0, 2) }],
    }
    const result = calculateWeeklyVolumeByMuscleGroup([onlyWarmUp], [pressBanca], weekStart, weekEnd)
    expect(result.Pectorales).toBeUndefined()
  })
})

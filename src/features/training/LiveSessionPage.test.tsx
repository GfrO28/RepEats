import { afterEach, describe, expect, it, vi } from 'vitest'
import { render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import type { Exercise } from '@/repositories/WorkoutRepository'
import type { Routine } from '@/repositories/RoutineRepository'
import type { Profile } from '@/repositories/ProfileRepository'
import type { Session } from '@/repositories/SessionRepository'
import { LiveSessionPage } from './LiveSessionPage'

let exercises: Exercise[] = []
let routines: Routine[] = []
let profile: Profile | null = null
let pastSessions: Session[] = []
const updateSession = vi.fn()
const deleteSession = vi.fn()

vi.mock('@/data/firestore/workoutRepository', () => ({
  firebaseWorkoutRepository: {
    subscribeExercises: (onChange: (data: Exercise[]) => void) => {
      onChange(exercises)
      return () => {}
    },
  },
}))
vi.mock('@/data/firestore/routineRepository', () => ({
  firebaseRoutineRepository: {
    subscribeRoutines: (onChange: (data: Routine[]) => void) => {
      onChange(routines)
      return () => {}
    },
  },
}))
vi.mock('@/data/firestore/profileRepository', () => ({
  firebaseProfileRepository: {
    subscribeProfile: (onChange: (data: Profile | null) => void) => {
      onChange(profile)
      return () => {}
    },
  },
}))
vi.mock('@/data/firestore/sessionRepository', () => ({
  firebaseSessionRepository: {
    subscribeSessions: (onChange: (data: Session[]) => void) => {
      onChange(pastSessions)
      return () => {}
    },
    updateSession: (session: Session) => updateSession(session),
    deleteSession: (id: string) => deleteSession(id),
  },
}))

const session: Session = {
  id: 's1',
  routineId: null,
  startedAt: new Date('2026-09-27T10:00:00'),
  endedAt: null,
  status: 'in_progress',
  exercises: [],
  manualExerciseKcal: null,
}

afterEach(() => {
  updateSession.mockClear()
  deleteSession.mockClear()
  profile = null
  exercises = []
  routines = []
  pastSessions = []
  vi.restoreAllMocks()
})

describe('LiveSessionPage: finalizar', () => {
  it('al finalizar, el resumen ofrece guardar o descartar la sesión', async () => {
    render(<LiveSessionPage session={session} />)

    await userEvent.click(screen.getByRole('button', { name: 'Finalizar sesión' }))
    expect(screen.getByRole('heading', { name: 'Resumen de la sesión' })).toBeInTheDocument()
    expect(screen.getByRole('button', { name: 'Guardar sesión' })).toBeInTheDocument()
    expect(screen.getByRole('button', { name: 'Descartar sesión' })).toBeInTheDocument()
  })

  it('"Guardar sesión" la marca como completada', async () => {
    render(<LiveSessionPage session={session} />)
    await userEvent.click(screen.getByRole('button', { name: 'Finalizar sesión' }))
    await userEvent.click(screen.getByRole('button', { name: 'Guardar sesión' }))

    expect(updateSession).toHaveBeenCalledWith(expect.objectContaining({ id: 's1', status: 'completed' }))
    expect(deleteSession).not.toHaveBeenCalled()
  })

  it('"Descartar sesión" pide confirmar y, al aceptar, la elimina sin guardarla', async () => {
    render(<LiveSessionPage session={session} />)
    await userEvent.click(screen.getByRole('button', { name: 'Finalizar sesión' }))

    const confirmSpy = vi.spyOn(window, 'confirm').mockReturnValue(false)
    await userEvent.click(screen.getByRole('button', { name: 'Descartar sesión' }))
    expect(deleteSession).not.toHaveBeenCalled()

    confirmSpy.mockReturnValue(true)
    await userEvent.click(screen.getByRole('button', { name: 'Descartar sesión' }))
    expect(deleteSession).toHaveBeenCalledWith('s1')
    expect(updateSession).not.toHaveBeenCalled()
  })
})

describe('LiveSessionPage: corrección manual de kcal', () => {
  it('sin perfil, el campo de kcal empieza vacío y se guarda como null si no se toca', async () => {
    render(<LiveSessionPage session={session} />)
    await userEvent.click(screen.getByRole('button', { name: 'Finalizar sesión' }))

    expect(screen.getByLabelText('Kcal quemadas')).toHaveValue(null)
    await userEvent.click(screen.getByRole('button', { name: 'Guardar sesión' }))
    expect(updateSession).toHaveBeenCalledWith(expect.objectContaining({ manualExerciseKcal: null }))
  })

  it('con perfil, precarga la estimación; si no se cambia, se guarda como null', async () => {
    profile = {
      sex: 'male',
      weightKg: 72,
      heightCm: 164,
      ageYears: 34,
      activityLevel: 'moderate',
      optionalMeals: [],
      adaptiveTdee: null,
    }
    render(<LiveSessionPage session={session} />)
    await userEvent.click(screen.getByRole('button', { name: 'Finalizar sesión' }))

    const input = screen.getByLabelText(/Kcal quemadas/)
    expect(Number(input.getAttribute('value'))).toBeGreaterThan(0)
    await userEvent.click(screen.getByRole('button', { name: 'Guardar sesión' }))
    expect(updateSession).toHaveBeenCalledWith(expect.objectContaining({ manualExerciseKcal: null }))
  })

  it('si el usuario escribe un valor distinto de la estimación, se guarda ese valor', async () => {
    render(<LiveSessionPage session={session} />)
    await userEvent.click(screen.getByRole('button', { name: 'Finalizar sesión' }))

    await userEvent.type(screen.getByLabelText('Kcal quemadas'), '450')
    await userEvent.click(screen.getByRole('button', { name: 'Guardar sesión' }))
    expect(updateSession).toHaveBeenCalledWith(expect.objectContaining({ manualExerciseKcal: 450 }))
  })
})

describe('LiveSessionPage: referencia de la última vez', () => {
  const pressExercise: Exercise = {
    id: 'press',
    name: 'Press de banca',
    primaryMuscles: ['pectoral_medio'],
    secondaryMuscles: [],
    equipment: 'Barra',
    notes: '',
  }
  const routine: Routine = {
    id: 'r1',
    name: 'Empuje',
    suggestedDay: 'Lunes',
    suggestedTime: null,
    order: 0,
    exercises: [
      {
        exerciseId: 'press',
        targetSets: [
          { type: 'Normal', weight: 50, repsMin: 8, repsMax: 10, restSeconds: 60 },
          { type: 'Normal', weight: 50, repsMin: 8, repsMax: 10, restSeconds: 60 },
        ],
      },
    ],
  }
  const liveSession: Session = {
    id: 's2',
    routineId: 'r1',
    startedAt: new Date('2026-09-30T10:00:00'),
    endedAt: null,
    status: 'in_progress',
    exercises: [{ exerciseId: 'press', notes: '', sets: [] }],
    manualExerciseKcal: null,
  }

  it('sin historial de ese ejercicio, no muestra nada de "Antes"', () => {
    exercises = [pressExercise]
    routines = [routine]
    render(<LiveSessionPage session={liveSession} />)
    expect(screen.queryByText(/Antes/)).not.toBeInTheDocument()
  })

  it('en la fila activa, muestra el peso y las reps de esa misma serie la vez pasada, cada uno debajo de su campo', async () => {
    exercises = [pressExercise]
    routines = [routine]
    pastSessions = [
      {
        id: 'old',
        routineId: 'r1',
        startedAt: new Date('2026-09-23T10:00:00'),
        endedAt: new Date('2026-09-23T11:00:00'),
        status: 'completed',
        manualExerciseKcal: null,
        exercises: [
          {
            exerciseId: 'press',
            notes: '',
            sets: [
              { type: 'Normal', weight: 60, reps: 8, completedAt: new Date('2026-09-23T10:10:00') },
              { type: 'Normal', weight: 65, reps: 6, completedAt: new Date('2026-09-23T10:15:00') },
            ],
          },
        ],
      },
    ]
    const { rerender } = render(<LiveSessionPage session={liveSession} />)

    // Serie 1 es la activa: muestra lo de la serie 1 pasada, no lo de la serie 2 (esa todavía está bloqueada)
    expect(screen.getByText('Antes 60')).toBeInTheDocument()
    expect(screen.getByText('Antes 8')).toBeInTheDocument()
    expect(screen.queryByText('Antes 65')).not.toBeInTheDocument()

    // Al completar la serie 1 se guarda en Firestore (acá, el mock) y la pantalla recibe la sesión actualizada;
    // recién ahí la serie 2 pasa a ser la activa y muestra su propia referencia
    await userEvent.click(screen.getByRole('button', { name: 'Completar serie 1' }))
    const updatedSession = updateSession.mock.calls[0]?.[0] as Session
    rerender(<LiveSessionPage session={updatedSession} />)
    expect(screen.getByText('Antes 65')).toBeInTheDocument()
    expect(screen.getByText('Antes 6')).toBeInTheDocument()
  })

  it('si la vez pasada tuvo menos series, la serie extra activa no muestra "Antes"', async () => {
    exercises = [pressExercise]
    const oneSetRoutine: Routine = { ...routine, exercises: [{ exerciseId: 'press', targetSets: [] }] }
    routines = [oneSetRoutine]
    pastSessions = [
      {
        id: 'old',
        routineId: 'r1',
        startedAt: new Date('2026-09-23T10:00:00'),
        endedAt: new Date('2026-09-23T11:00:00'),
        status: 'completed',
        manualExerciseKcal: null,
        exercises: [
          {
            exerciseId: 'press',
            notes: '',
            sets: [{ type: 'Normal', weight: 60, reps: 8, completedAt: new Date('2026-09-23T10:10:00') }],
          },
        ],
      },
    ]
    const { rerender } = render(<LiveSessionPage session={liveSession} />)
    // Sin series objetivo, hay que agregar una "serie extra" a mano; esa primera fila sí coincide con la pasada
    await userEvent.click(screen.getByRole('button', { name: '+ Agregar serie' }))
    expect(screen.getByText('Antes 60')).toBeInTheDocument()

    // Se completa esa serie (la pantalla recibe la sesión actualizada) y se agrega una segunda: ya no tiene con
    // qué compararse, porque la vez pasada solo tuvo una
    await userEvent.click(screen.getByRole('button', { name: 'Completar serie 1' }))
    const updatedSession = updateSession.mock.calls[0]?.[0] as Session
    rerender(<LiveSessionPage session={updatedSession} />)
    await userEvent.click(screen.getByRole('button', { name: '+ Agregar serie' }))
    expect(screen.queryByText(/Antes/)).not.toBeInTheDocument()
  })
})

describe('LiveSessionPage: unidad de peso (kg/lb)', () => {
  const pressExercise: Exercise = {
    id: 'press',
    name: 'Press de banca',
    primaryMuscles: ['pectoral_medio'],
    secondaryMuscles: [],
    equipment: 'Barra',
    notes: '',
  }
  const routine: Routine = {
    id: 'r1',
    name: 'Empuje',
    suggestedDay: 'Lunes',
    suggestedTime: null,
    order: 0,
    exercises: [{ exerciseId: 'press', targetSets: [{ type: 'Normal', weight: 50, repsMin: 8, repsMax: 10, restSeconds: 60 }] }],
  }
  const liveSession: Session = {
    id: 's3',
    routineId: 'r1',
    startedAt: new Date('2026-09-30T10:00:00'),
    endedAt: null,
    status: 'in_progress',
    exercises: [{ exerciseId: 'press', notes: '', sets: [] }],
    manualExerciseKcal: null,
  }

  it('por defecto es kg, y el botón permite cambiar a lb', async () => {
    exercises = [pressExercise]
    routines = [routine]
    render(<LiveSessionPage session={liveSession} />)

    expect(screen.getByRole('button', { name: /Unidad de peso: kilogramos/ })).toHaveTextContent('KG')
    await userEvent.click(screen.getByRole('button', { name: /Unidad de peso: kilogramos/ }))
    expect(screen.getByRole('button', { name: /Unidad de peso: libras/ })).toHaveTextContent('LB')
  })

  it('en lb, el objetivo de la fila bloqueada se muestra convertido (50 kg ≈ 110.2 lb)', async () => {
    const target = { type: 'Normal', weight: 50, repsMin: 8, repsMax: 10, restSeconds: 60 } as const
    exercises = [pressExercise]
    routines = [{ ...routine, exercises: [{ exerciseId: 'press', targetSets: [target, target] }] }]
    render(<LiveSessionPage session={liveSession} />)

    await userEvent.click(screen.getByRole('button', { name: /Unidad de peso: kilogramos/ }))
    expect(screen.getByText('110.2')).toBeInTheDocument() // fila bloqueada (serie 2), peso objetivo convertido
  })

  it('al completar la serie en lb, se guarda convertido a kg (todo el resto de la app sigue en kg)', async () => {
    exercises = [pressExercise]
    routines = [routine]
    render(<LiveSessionPage session={liveSession} />)

    await userEvent.click(screen.getByRole('button', { name: /Unidad de peso: kilogramos/ }))
    const weightInput = screen.getByLabelText('Press de banca, serie 1: peso en libras')
    await userEvent.clear(weightInput)
    await userEvent.type(weightInput, '135')
    await userEvent.click(screen.getByRole('button', { name: 'Completar serie 1' }))

    expect(updateSession).toHaveBeenCalledWith(
      expect.objectContaining({
        exercises: [expect.objectContaining({ sets: [expect.objectContaining({ weight: 61.23 })] })],
      }),
    )
  })
})

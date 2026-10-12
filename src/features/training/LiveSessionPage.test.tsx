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

describe('LiveSessionPage: Drop Set con bajadas anidadas', () => {
  const pressExercise: Exercise = {
    id: 'press',
    name: 'Press de banca',
    primaryMuscles: ['pectoral_medio'],
    secondaryMuscles: [],
    equipment: 'Barra',
    notes: '',
  }
  const target = { type: 'Normal', weight: 50, repsMin: 8, repsMax: 10, restSeconds: 60 } as const
  const routine: Routine = {
    id: 'r1',
    name: 'Empuje',
    suggestedDay: 'Lunes',
    suggestedTime: null,
    order: 0,
    exercises: [{ exerciseId: 'press', targetSets: [target, target] }],
  }
  const liveSession: Session = {
    id: 's4',
    routineId: 'r1',
    startedAt: new Date('2026-10-01T10:00:00'),
    endedAt: null,
    status: 'in_progress',
    exercises: [{ exerciseId: 'press', notes: '', sets: [] }],
    manualExerciseKcal: null,
  }

  function lastSavedSession(): Session {
    return updateSession.mock.calls.at(-1)?.[0] as Session
  }

  // Cambia la serie 1 a Drop Set y la completa; devuelve la función para refrescar la pantalla con lo último guardado
  async function completeDropSetMother() {
    exercises = [pressExercise]
    routines = [routine]
    const view = render(<LiveSessionPage session={liveSession} />)
    await userEvent.click(screen.getByRole('button', { name: /Serie 1, tipo Normal/ }))
    await userEvent.click(screen.getByRole('button', { name: /Drop Set/ }))
    await userEvent.click(screen.getByRole('button', { name: 'Completar serie 1' }))
    const refresh = () => view.rerender(<LiveSessionPage session={lastSavedSession()} />)
    refresh()
    return refresh
  }

  it('al completar la madre se guarda con "drops" vacío y aparecen 2 bajadas, la primera con -20 % redondeado a 2.5', async () => {
    await completeDropSetMother()

    expect(lastSavedSession().exercises[0]?.sets[0]).toEqual(expect.objectContaining({ type: 'Drop Set', drops: [] }))
    // 50 kg → 40 kg (la bajada propuesta); la segunda, 40 → 32.5, se ve bloqueada
    expect(screen.getByLabelText('Press de banca, bajada 1: peso en kilogramos')).toHaveValue('40')
    expect(screen.getByRole('button', { name: 'Press de banca: quitar bajada 2' })).toBeInTheDocument()
    expect(screen.getByText('32.5')).toBeInTheDocument()
  })

  it('no hay descanso entre la madre y las bajadas, y la serie siguiente espera a que el bloque termine', async () => {
    await completeDropSetMother()

    expect(screen.queryByRole('progressbar', { name: 'Descanso' })).not.toBeInTheDocument()
    expect(screen.queryByRole('button', { name: 'Completar serie 2' })).not.toBeInTheDocument()
  })

  it('cada bajada completada se guarda dentro de la madre; el descanso corre solo tras la última', async () => {
    const refresh = await completeDropSetMother()

    await userEvent.click(screen.getByRole('button', { name: 'Completar bajada 1' }))
    expect(lastSavedSession().exercises[0]?.sets[0]?.drops).toEqual([
      expect.objectContaining({ weight: 40, reps: 8 }),
    ])
    refresh()
    expect(screen.queryByRole('progressbar', { name: 'Descanso' })).not.toBeInTheDocument()
    // la segunda bajada continúa la cascada desde la primera: 40 → 32.5
    expect(screen.getByLabelText('Press de banca, bajada 2: peso en kilogramos')).toHaveValue('32.5')

    await userEvent.click(screen.getByRole('button', { name: 'Completar bajada 2' }))
    expect(lastSavedSession().exercises[0]?.sets[0]?.drops).toHaveLength(2)
    refresh()
    expect(screen.getByRole('progressbar', { name: 'Descanso' })).toBeInTheDocument()
    expect(screen.getByRole('button', { name: 'Completar serie 2' })).toBeInTheDocument()
  })

  it('un doble toque en ✓ no registra la misma bajada dos veces', async () => {
    await completeDropSetMother()

    const check = screen.getByRole('button', { name: 'Completar bajada 1' })
    await userEvent.dblClick(check)
    expect(lastSavedSession().exercises[0]?.sets[0]?.drops).toHaveLength(1)
  })

  it('"+ Otra bajada" agrega una tercera y ✕ quita cualquiera de las pendientes', async () => {
    await completeDropSetMother()

    await userEvent.click(screen.getByRole('button', { name: '+ Otra bajada' }))
    expect(screen.getByRole('button', { name: 'Press de banca: quitar bajada 3' })).toBeInTheDocument()

    await userEvent.click(screen.getByRole('button', { name: 'Press de banca: quitar bajada 2' }))
    expect(screen.queryByRole('button', { name: 'Press de banca: quitar bajada 3' })).not.toBeInTheDocument()
    expect(screen.getByRole('button', { name: 'Press de banca: quitar bajada 2' })).toBeInTheDocument()
  })

  it('quitar la última bajada pendiente da por terminado el bloque: corre el descanso y se libera la serie siguiente', async () => {
    await completeDropSetMother()

    await userEvent.click(screen.getByRole('button', { name: 'Press de banca: quitar bajada 2' }))
    await userEvent.click(screen.getByRole('button', { name: 'Press de banca: quitar bajada 1' }))

    expect(screen.getByRole('progressbar', { name: 'Descanso' })).toBeInTheDocument()
    expect(screen.getByRole('button', { name: 'Completar serie 2' })).toBeInTheDocument()
  })

  it('se puede quitar una bajada ya completada: se borra de la sesión guardada', async () => {
    const refresh = await completeDropSetMother()
    await userEvent.click(screen.getByRole('button', { name: 'Completar bajada 1' }))
    refresh()

    await userEvent.click(screen.getByRole('button', { name: 'Press de banca: quitar bajada 1' }))
    expect(lastSavedSession().exercises[0]?.sets[0]?.drops).toEqual([])
  })

  it('en la serie siguiente al bloque, el "Antes" no se desfasa por las bajadas', async () => {
    const refresh = await completeDropSetMother()
    await userEvent.click(screen.getByRole('button', { name: 'Completar bajada 1' }))
    refresh()
    await userEvent.click(screen.getByRole('button', { name: 'Completar bajada 2' }))
    refresh()

    // La serie 2 es Normal y la vez pasada no hubo historial: no hay nada que comparar
    expect(screen.getByLabelText('Press de banca, serie 2: peso en kilogramos')).toBeInTheDocument()
    expect(screen.queryByText(/Antes/)).not.toBeInTheDocument()
  })

  it('muestra el "Antes" de cada bajada y el bloque anterior completo', async () => {
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
              {
                type: 'Drop Set',
                weight: 60,
                reps: 8,
                completedAt: new Date('2026-09-23T10:10:00'),
                drops: [
                  { weight: 45, reps: 6, completedAt: new Date('2026-09-23T10:11:00') },
                  { weight: 30, reps: 5, completedAt: new Date('2026-09-23T10:12:00') },
                ],
              },
            ],
          },
        ],
      },
    ]
    const view = render(<LiveSessionPage session={liveSession} />)
    await userEvent.click(screen.getByRole('button', { name: /Serie 1, tipo Normal/ }))
    await userEvent.click(screen.getByRole('button', { name: /Drop Set/ }))
    expect(screen.getByText('Bloque anterior: 60×8 → 45×6 → 30×5')).toBeInTheDocument()

    await userEvent.click(screen.getByRole('button', { name: 'Completar serie 1' }))
    view.rerender(<LiveSessionPage session={lastSavedSession()} />)
    expect(screen.getByText('Antes 45')).toBeInTheDocument()
    expect(screen.getByText('Antes 6')).toBeInTheDocument()
  })
})

describe('LiveSessionPage: superset', () => {
  const curl: Exercise = {
    id: 'curl',
    name: 'Curl de bíceps',
    primaryMuscles: ['biceps_cabeza_corta'],
    secondaryMuscles: [],
    equipment: 'Mancuernas',
    notes: '',
  }
  const triceps: Exercise = {
    id: 'triceps',
    name: 'Extensión de tríceps',
    primaryMuscles: ['triceps_cabeza_larga'],
    secondaryMuscles: [],
    equipment: 'Polea',
    notes: '',
  }
  const press: Exercise = {
    id: 'press',
    name: 'Press de banca',
    primaryMuscles: ['pectoral_medio'],
    secondaryMuscles: [],
    equipment: 'Barra',
    notes: '',
  }
  const targetOf = (restSeconds: number) => ({ type: 'Normal', weight: 20, repsMin: 8, repsMax: 10, restSeconds }) as const
  const routine: Routine = {
    id: 'r9',
    name: 'Brazos',
    suggestedDay: 'Lunes',
    suggestedTime: null,
    order: 0,
    exercises: [
      { exerciseId: 'curl', targetSets: [targetOf(90), targetOf(90)], supersetGroup: 'ss1' },
      { exerciseId: 'triceps', targetSets: [targetOf(90), targetOf(90)], supersetGroup: 'ss1' },
      { exerciseId: 'press', targetSets: [targetOf(60)] },
    ],
  }
  const liveSession: Session = {
    id: 's5',
    routineId: 'r9',
    startedAt: new Date('2026-10-02T10:00:00'),
    endedAt: null,
    status: 'in_progress',
    exercises: [
      { exerciseId: 'curl', notes: '', sets: [], supersetGroup: 'ss1' },
      { exerciseId: 'triceps', notes: '', sets: [], supersetGroup: 'ss1' },
      { exerciseId: 'press', notes: '', sets: [] },
    ],
    manualExerciseKcal: null,
  }

  function setup(routineToUse: Routine = routine) {
    exercises = [curl, triceps, press]
    routines = [routineToUse]
    const view = render(<LiveSessionPage session={liveSession} />)
    // Completa la serie activa y refresca la pantalla con lo último guardado (el mock no actualiza solo)
    async function completeActive(label: string) {
      // El ejercicio suelto (Press) también tiene su serie activa; la del superset es siempre la primera en pantalla
      await userEvent.click(screen.getAllByRole('button', { name: label })[0]!)
      const saved = updateSession.mock.calls.at(-1)?.[0] as Session
      view.rerender(<LiveSessionPage session={saved} />)
      return saved
    }
    return { completeActive }
  }

  it('la pareja se dibuja en una sola tarjeta "Superset", y el ejercicio suelto aparte', () => {
    setup()
    expect(screen.getByText('Superset')).toBeInTheDocument()
    expect(screen.getAllByText('Superset')).toHaveLength(1)
    expect(screen.getByText('Ronda 1')).toBeInTheDocument()
    expect(screen.getByText('Ronda 2')).toBeInTheDocument()
    expect(screen.getByText('Press de banca')).toBeInTheDocument()
  })

  it('el turno es A, B, A, B: solo la primera serie sin hacer es editable', async () => {
    const { completeActive } = setup()

    expect(screen.getByLabelText('Curl de bíceps, serie 1: peso en kilogramos')).toBeInTheDocument()
    expect(screen.queryByLabelText('Extensión de tríceps, serie 1: peso en kilogramos')).not.toBeInTheDocument()

    await completeActive('Completar serie 1') // A1
    expect(screen.getByLabelText('Extensión de tríceps, serie 1: peso en kilogramos')).toBeInTheDocument()
    expect(screen.queryByLabelText('Curl de bíceps, serie 2: peso en kilogramos')).not.toBeInTheDocument()

    await completeActive('Completar serie 1') // B1
    expect(screen.getByLabelText('Curl de bíceps, serie 2: peso en kilogramos')).toBeInTheDocument()
  })

  it('no hay descanso entre A y B; corre al cerrar la ronda, con el descanso de la serie de B', async () => {
    const { completeActive } = setup()

    await completeActive('Completar serie 1') // A1
    expect(screen.queryByRole('progressbar', { name: 'Descanso' })).not.toBeInTheDocument()

    await completeActive('Completar serie 1') // B1: cierra la ronda 1
    expect(screen.getByRole('progressbar', { name: 'Descanso' })).toBeInTheDocument()
    expect(screen.getByText('1:30')).toBeInTheDocument()
  })

  it('con rondas desiguales, la serie de A sin pareja en esa ronda cierra la ronda y descansa', async () => {
    const uneven: Routine = {
      ...routine,
      exercises: [
        { exerciseId: 'curl', targetSets: [targetOf(90), targetOf(45)], supersetGroup: 'ss1' },
        { exerciseId: 'triceps', targetSets: [targetOf(90)], supersetGroup: 'ss1' },
      ],
    }
    const { completeActive } = setup(uneven)
    await completeActive('Completar serie 1') // A1
    await completeActive('Completar serie 1') // B1: cierra la ronda 1
    expect(screen.getByText('1:30')).toBeInTheDocument()

    await completeActive('Completar serie 2') // A2: B ya no tiene serie en la ronda 2, así que descansa de inmediato
    expect(screen.getByText('0:45')).toBeInTheDocument()
  })

  it('un Drop Set en A resuelve primero sus bajadas; recién después le toca a B', async () => {
    const { completeActive } = setup()

    await userEvent.click(screen.getAllByRole('button', { name: /Serie 1, tipo Normal/ })[0]!)
    await userEvent.click(screen.getByRole('button', { name: /Drop Set/ }))
    await completeActive('Completar serie 1') // A1 (madre del Drop Set)

    // Con bajadas pendientes, B todavía no está activo y no hay descanso
    expect(screen.getByRole('button', { name: 'Completar bajada 1' })).toBeInTheDocument()
    expect(screen.queryByLabelText('Extensión de tríceps, serie 1: peso en kilogramos')).not.toBeInTheDocument()
    expect(screen.queryByRole('progressbar', { name: 'Descanso' })).not.toBeInTheDocument()

    await completeActive('Completar bajada 1')
    await completeActive('Completar bajada 2')
    // Terminadas las bajadas se pasa a B; el descanso todavía no corre porque la ronda no se cerró
    expect(screen.getByLabelText('Extensión de tríceps, serie 1: peso en kilogramos')).toBeInTheDocument()
    expect(screen.queryByRole('progressbar', { name: 'Descanso' })).not.toBeInTheDocument()
  })

  it('"+ Serie en [ejercicio]" agrega una ronda extra a ese ejercicio', async () => {
    setup()
    await userEvent.click(screen.getByRole('button', { name: '+ Serie en Curl de bíceps' }))
    expect(screen.getByText('Ronda 3')).toBeInTheDocument()
  })

  it('al terminar todas las rondas del superset, se pasa al ejercicio suelto', async () => {
    const { completeActive } = setup()
    await completeActive('Completar serie 1') // A1
    await completeActive('Completar serie 1') // B1
    await completeActive('Completar serie 2') // A2
    await completeActive('Completar serie 2') // B2
    expect(screen.getByLabelText('Press de banca, serie 1: peso en kilogramos')).toBeInTheDocument()
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
